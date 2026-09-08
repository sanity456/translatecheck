# Release verification

Verified on 2026-09-08 UTC (2026-09-07 local).

- 32 direct contract tests passed on Windows/Python 3.12, including separately
  invoked validator callbacks for agreement, substantive disagreement, malformed
  evidence, and error handling. Mocked model outputs are not live AI accuracy tests.
- 11 frontend/protocol/rendering tests passed: scope, exact-text hashes, receipt
  semantics, selected wallet routing, rejection handling, network switching,
  and mutually exclusive error/progress feedback.
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

A passing hosted Linux/Windows CI run and publicly accessible submission links.
Real mobile-device wallet testing and other-wallet compatibility have not been
verified. Do not describe MetaMask results as universal wallet support.

## Real-wallet browser verification

Chrome and MetaMask were tested on the private deployed site. See
`BROWSER_TEST_REPORT.md` and `deployments/browser-wallet-test.json` for the exact
transactions, expected outcomes, and limitations. Assessment and publication
both finalized with successful execution and matching finalized contract reads.
The canceled request created no assessment; the existing five records remained.

One cosmetic issue was found: cancellation left an old confirmation instruction
visible alongside the error. Error paths now clear that notice, and one feedback
component ensures errors take precedence. Two rendering regressions cover this
fix. The intelligent contract and wallet submission logic were not changed.
