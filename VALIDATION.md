# Release verification

Verified on 2026-09-08 UTC (2026-09-07 local).

- 32 direct contract tests passed on Windows/Python 3.12, including separately
  invoked validator callbacks for agreement, substantive disagreement, malformed
  evidence, and error handling. Mocked model outputs are not live AI accuracy tests.
- 9 frontend/protocol tests passed: scope, exact-text hashes, receipt semantics,
  selected wallet routing, rejection handling, and network switching.
- Live StudioNet deployment source matches the local SHA-256. Real validators
  assessed French PRESERVED, Spanish CHANGED, Mandarin PRESERVED, and a
  wrong-language Mandarin submission REVIEW. See `deployments/studionet.json`.
- An exact approved translation was published. Tampered text and a rejected
  translation failed publication without changing assessment history.
- All four assessments and gates were independently re-read using `latest-final`.
- Focused WebMCP checks passed in the in-app browser: both tools registered;
  Mandarin staging and read-back worked; invalid language input failed without
  changing the draft; the original example was restored. No wallet prompt or
  transaction was triggered by this browser check.

## Harness correction recorded, not hidden

Studio placed an idle fallback validator in `leader_receipt` alongside the actual
successful leader. An initial all-receipts success test produced a false negative.
The parser now filters actual leaders and rejects missing/failed execution.
A regression covers the mixed leader/idle-validator payload. The deployed
contract was unchanged. Exact source and finalized state were rechecked.

The SDK's correct final-state selector is `TransactionHashVariant.LATEST_FINAL`;
the obsolete `stateStatus` argument is not used in the app or verification script.

## Still required before submission

Real browser-extension wallet signing, complete interactive/mobile browser QA,
and a passing hosted Linux/Windows CI run. A CI workflow is supplied but has not
yet been run on GitHub. This private first release is not claimed submission-ready.
