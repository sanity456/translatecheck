import hashlib
import json
import pytest

SOURCE = "Free delivery on orders over $50."

def address(value):
    return "0x" + value.hex() if isinstance(value, bytes) else str(value)
TRANSLATIONS = {
    "fr": "Livraison gratuite pour les commandes de plus de 50 $.",
    "es": "Envío gratis en pedidos de más de 50 $.",
    "zh-CN": "订单金额超过50美元即可免费配送。",
}


def review(verdict="PRESERVED", reason="NONE", translation=TRANSLATIONS["fr"]):
    return {"verdict": verdict, "reason_code": reason, "source_quote": SOURCE,
            "translation_quote": translation, "explanation": "The eligibility threshold is preserved."}


def mock(vm, result):
    vm.clear_mocks()
    vm.mock_llm("TRANSLATECHECK_MEANING_V1", json.dumps(result))


@pytest.fixture
def contract(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    # The contract pins the exact runner used by Studio Next.
    return direct_deploy("contracts/translatecheck.py")


def checked(vm, contract, verdict="PRESERVED", reason="NONE", target="fr"):
    text = TRANSLATIONS[target]
    mock(vm, review(verdict, reason, text))
    contract.assess(SOURCE, text, target)
    return contract.content_id(SOURCE, text, target)


@pytest.mark.parametrize("target", list(TRANSLATIONS))
def test_all_languages_roundtrip_and_publish(contract, direct_vm, direct_alice, target):
    aid = checked(direct_vm, contract, target=target)
    expected = hashlib.sha256(json.dumps(["translatecheck/meaning-v1", SOURCE, TRANSLATIONS[target], target],
        ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    assert aid == expected
    record = contract.get_assessment(aid)
    assert record["found"] and record["translation"] == TRANSLATIONS[target]
    assert contract.evaluate_policy_view(aid, SOURCE, TRANSLATIONS[target], target)["satisfied"] is True
    contract.publish(aid, SOURCE, TRANSLATIONS[target], target)
    assert contract.get_publication(aid, address(direct_alice))["found"] is True


@pytest.mark.parametrize("verdict,reason,failure", [
    ("CHANGED", "CONDITION", "MEANING_CHANGED"),
    ("REVIEW", "AMBIGUOUS", "NEEDS_REVIEW"),
    ("REVIEW", "WRONG_LANGUAGE", "NEEDS_REVIEW"),
    ("REVIEW", "OUT_OF_SCOPE", "NEEDS_REVIEW"),
])
def test_nonpasses_never_publish_or_mutate_history(contract, direct_vm, verdict, reason, failure):
    aid = checked(direct_vm, contract, verdict, reason)
    before = contract.get_assessment(aid)
    gate = contract.evaluate_policy_view(aid, SOURCE, TRANSLATIONS["fr"], "fr")
    assert gate["satisfied"] is False and gate["failure_reasons"] == [failure]
    with direct_vm.expect_revert(failure):
        contract.publish(aid, SOURCE, TRANSLATIONS["fr"], "fr")
    assert contract.get_assessment(aid) == before
    assert contract.get_config()["publication_count"] == 0


@pytest.mark.parametrize("field,value", [("source", SOURCE+" "), ("translation", TRANSLATIONS["fr"]+"!"),
    ("target", "es"), ("source", SOURCE.replace("over", "under"))])
def test_exact_content_gate(contract, direct_vm, field, value):
    aid = checked(direct_vm, contract)
    args = {"source": SOURCE, "translation": TRANSLATIONS["fr"], "target": "fr"}
    args[field] = value
    gate = contract.evaluate_policy_view(aid, **args)
    assert gate["satisfied"] is False and "CONTENT_MISMATCH" in gate["failure_reasons"]
    with direct_vm.expect_revert("CONTENT_MISMATCH"):
        contract.publish(aid, **args)
    assert contract.get_config()["publication_count"] == 0


def test_missing_assessment_fails_closed(contract, direct_vm):
    args = ["a"*64, SOURCE, TRANSLATIONS["fr"], "fr"]
    assert contract.evaluate_policy_view(*args)["failure_reasons"] == ["ASSESSMENT_NOT_FOUND"]
    with direct_vm.expect_revert("ASSESSMENT_NOT_FOUND"):
        contract.publish(*args)


def test_no_reroll_or_duplicate_publication(contract, direct_vm):
    aid = checked(direct_vm, contract)
    before = contract.get_assessment(aid)
    with direct_vm.expect_revert("Already assessed"):
        contract.assess(SOURCE, TRANSLATIONS["fr"], "fr")
    contract.publish(aid, SOURCE, TRANSLATIONS["fr"], "fr")
    with direct_vm.expect_revert("Already published"):
        contract.publish(aid, SOURCE, TRANSLATIONS["fr"], "fr")
    assert contract.get_assessment(aid) == before
    assert contract.get_config()["publication_count"] == 1


def test_reusable_assessment_does_not_impersonate_publisher(contract, direct_vm, direct_alice, direct_bob):
    aid = checked(direct_vm, contract)
    direct_vm.sender = direct_bob
    contract.publish(aid, SOURCE, TRANSLATIONS["fr"], "fr")
    assert contract.get_publication(aid, address(direct_bob))["found"] is True
    assert contract.get_publication(aid, address(direct_alice))["found"] is False


@pytest.mark.parametrize("source,text,target", [("", "hola", "es"), ("  ", "hola", "es"),
    (SOURCE, "", "fr"), ("a"*1201, "hola", "es"), (SOURCE, "b"*1201, "fr"), (SOURCE,"हिन्दी","hi")])
def test_invalid_input_creates_no_record(contract, direct_vm, source, text, target):
    with direct_vm.expect_revert("[EXPECTED]"):
        contract.assess(source, text, target)
    assert contract.get_config()["assessment_count"] == 0


@pytest.mark.parametrize("mutation", [
    {"verdict":"PRESERVED", "reason_code":"CONDITION"}, {"verdict": True},
    {"source_quote":"invented phrase"}, {"translation_quote":""},
    {"explanation":""}, {"explanation":"x"*701}, {"reason_code":"made_up"},
])
def test_malformed_model_output_never_approves(contract, direct_vm, mutation):
    payload = {**review(), **mutation}
    mock(direct_vm, payload)
    with direct_vm.expect_revert("[LLM_ERROR]"):
        contract.assess(SOURCE, TRANSLATIONS["fr"], "fr")
    assert contract.get_config()["assessment_count"] == 0


def test_independent_validator_agrees_despite_different_prose(contract, direct_vm):
    checked(direct_vm, contract)
    mock(direct_vm, {**review(), "explanation":"Orders must exceed fifty dollars in both versions."})
    assert direct_vm.run_validator() is True


def test_independent_validator_disagrees_with_wrong_verdict(contract, direct_vm):
    checked(direct_vm, contract)
    mock(direct_vm, review("CHANGED", "CONDITION"))
    assert direct_vm.run_validator() is False


def test_independent_validator_disagrees_with_wrong_reason(contract, direct_vm):
    checked(direct_vm, contract, "CHANGED", "CONDITION")
    mock(direct_vm, review("CHANGED", "NEGATION"))
    assert direct_vm.run_validator() is False


def test_validator_rejects_leader_errors_and_fabricated_quotes(contract, direct_vm):
    checked(direct_vm, contract)
    assert direct_vm.run_validator(leader_error=Exception("[LLM_ERROR] failed")) is False
    assert direct_vm.run_validator(leader_result={**review(), "source_quote":"made up"}) is False


def test_history_pagination(contract, direct_vm):
    assert contract.list_assessments(0, 10)["items"] == []
    for target in TRANSLATIONS:
        checked(direct_vm, contract, target=target)
    page = contract.list_assessments(0, 2)
    assert page["total"] == 3 and page["next_offset"] == 2
    assert len(page["items"]) == 2 and page["items"][0]["target"] == "zh-CN"
    assert len(contract.list_assessments(2, 2)["items"]) == 1
    with direct_vm.expect_revert("offset"):
        contract.list_assessments(-1, 10)
    with direct_vm.expect_revert("limit"):
        contract.list_assessments(0, 21)
