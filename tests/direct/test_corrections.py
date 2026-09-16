import json
from types import SimpleNamespace
import pytest

CHECKER = "0xd79Fc921D3DD42227E81e5f13311643E8720E603"
PARENT = "a" * 64
OLD = "Livraison gratuite pour les commandes de moins de 50 $."
NEW = "Livraison gratuite pour les commandes de plus de 50 $."


@pytest.fixture
def context(direct_vm, direct_deploy, direct_alice, monkeypatch):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/translatecheck_corrections.py", CHECKER)
    import genlayer as gl
    record = {"found": True, "id": PARENT, "policy": "translatecheck/meaning-v1",
              "source": "Free delivery on orders over $50.", "translation": OLD, "target": "fr",
              "review": {"verdict": "CHANGED", "reason_code": "CONDITION", "explanation": "Threshold reversed."}}
    # Direct mode has no cross-contract dispatcher. This stub isolates our state
    # machine; the live smoke checks the actual fixed-checker cross-contract read.
    def checker_at(addr):
        assert str(addr).lower() == CHECKER.lower()
        return SimpleNamespace(view=lambda: SimpleNamespace(get_assessment=lambda _: dict(record)))
    monkeypatch.setattr(gl.contract, "get_at", checker_at)
    return contract, record


def draft(vm, **overrides):
    value = {"status": "SUGGESTED", "translation": NEW, "explanation": "Changed under to over."}
    value.update(overrides)
    vm.mock_llm("TRANSLATECHECK_CORRECTION_V1", json.dumps(value))


def test_advisory_record_cannot_approve_or_overwrite_original(context, direct_vm):
    contract, original = context
    before = json.dumps(original, sort_keys=True)
    draft(direct_vm)
    contract.suggest(PARENT)
    result = contract.get_suggestion(PARENT)
    assert result["found"] and result["parent_id"] == PARENT
    assert result["advisory_only"] is True and result["requires_separate_assessment"] is True
    assert "satisfied" not in result and "assessment_id" not in result
    assert result["suggestion"]["translation"] == NEW
    assert json.dumps(original, sort_keys=True) == before
    assert contract.get_config()["suggestion_count"] == 1
    with direct_vm.expect_revert("Correction already exists"):
        contract.suggest(PARENT)
    assert contract.get_suggestion(PARENT) == result


@pytest.mark.parametrize("reason", ["AMBIGUOUS", "OUT_OF_SCOPE"])
def test_human_context_returns_unavailable_without_llm(context, direct_vm, reason):
    contract, original = context
    original["review"] = {"verdict": "REVIEW", "reason_code": reason}
    contract.suggest(PARENT)  # No LLM mock: proves no AI interpretation is attempted.
    result = contract.get_suggestion(PARENT)["suggestion"]
    assert result["status"] == "UNAVAILABLE" and result["translation"] == ""


@pytest.mark.parametrize("field,value", [
    ("found", False), ("policy", "untrusted"), ("id", "b" * 64), ("target", "hi"),
    ("review", {"verdict": "PRESERVED", "reason_code": "NONE"}),
])
def test_invalid_parent_never_creates_record(context, direct_vm, field, value):
    contract, original = context
    original[field] = value
    with direct_vm.expect_revert():
        contract.suggest(PARENT)
    assert contract.get_suggestion(PARENT) == {"found": False}
    assert contract.get_config()["suggestion_count"] == 0


@pytest.mark.parametrize("overrides", [
    {"status": "APPROVED"}, {"translation": ""}, {"translation": OLD},
    {"translation": " " + OLD + " "}, {"translation": "x" * 1201},
    {"translation": False}, {"explanation": ""}, {"explanation": "x" * 701},
    {"status": "UNAVAILABLE", "translation": NEW},
])
def test_invalid_ai_output_fails_without_writing(context, direct_vm, overrides):
    contract, _ = context
    draft(direct_vm, **overrides)
    with direct_vm.expect_revert("LLM_ERROR"):
        contract.suggest(PARENT)
    assert contract.get_suggestion(PARENT) == {"found": False}
    assert contract.get_config()["suggestion_count"] == 0


@pytest.mark.parametrize("parent", ["", "a" * 63, "G" * 64, "0x" + "a" * 64])
def test_invalid_identifier(context, direct_vm, parent):
    contract, _ = context
    with direct_vm.expect_revert("Invalid parent"):
        contract.suggest(parent)


def test_wrong_language_can_be_rewritten(context, direct_vm):
    contract, original = context
    original["target"] = "zh-CN"
    original["review"] = {"verdict": "REVIEW", "reason_code": "WRONG_LANGUAGE"}
    draft(direct_vm, translation="订单金额超过50美元即可免费配送。")
    contract.suggest(PARENT)
    assert contract.get_suggestion(PARENT)["target"] == "zh-CN"


def test_ai_can_decline(context, direct_vm):
    contract, _ = context
    draft(direct_vm, status="UNAVAILABLE", translation="", explanation="More context is needed.")
    contract.suggest(PARENT)
    assert contract.get_suggestion(PARENT)["suggestion"]["status"] == "UNAVAILABLE"


@pytest.mark.parametrize("faithful,expected", [(True, True), (False, False), ("true", False), (1, False), (None, False)])
def test_validator_independently_checks_candidate_not_just_shape(context, direct_vm, faithful, expected):
    contract, _ = context
    draft(direct_vm)
    contract.suggest(PARENT)
    direct_vm.clear_mocks()
    direct_vm.mock_llm("TRANSLATECHECK_CORRECTION_VALIDATE_V1", json.dumps({"faithful": faithful}))
    assert direct_vm.run_validator() is expected


def test_validator_disagrees_on_invalid_leader_or_failed_execution(context, direct_vm):
    contract, _ = context
    draft(direct_vm)
    contract.suggest(PARENT)
    assert direct_vm.run_validator(leader_result={"status": "APPROVED"}) is False
    assert direct_vm.run_validator(leader_error=Exception("broken model")) is False
