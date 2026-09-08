# Release verification

Verification records: 2026-09-08 UTC.

## Fix & Recheck release

- 61 direct contract tests pass: the original 32 plus 29 correction tests,
  including explicitly invoked validator callbacks rejecting unfaithful output,
  truthy strings/numbers in place of a boolean, malformed leader output and errors.
  These are mocked tests, not an accuracy benchmark. Cross-contract reads are
  stubbed in direct mode; the live test below exercises the actual call.
- 60 frontend tests pass: 49 feature regressions plus 11 evidence/shared-UI
  regressions added during review maintenance. Feature coverage includes
  correction binding to the exact original, advisory flags, malformed/unchanged
  drafts, Unicode quote highlighting, validated
  before/after links, cancellation, bounded recovery, and no automatic writes.
  Actual Workspace handlers verify adoption cannot approve, edits invalidate an
  approval, revisions call the checker separately, and existing results are reused.
- The native correction companion at `0xCE0e2EbF9CdB30145EE4badcacAecFCCc6bc593e`
  was deployed on StudioNet and its exact source hash verified:
  `a927245bef02f7c52c719b4be898729aed1eb94932010d28e65f32b5112b4acc`.
- Live consensus produced advisory corrections for French, Spanish and Mandarin.
  All three originals remained unchanged and blocked. French reused a pre-existing
  independently finalized assessment of its corrected text; Spanish and Mandarin
  had no assessment at first and were confirmed blocked, then separately assessed
  and confirmed preserved. No publication was created by this test. See
  `deployments/corrections-studionet.json` for transaction hashes, texts and gates.
- The original checker address, meaning policy and source are unchanged. There
  is no Bradbury migration. Site and repository access remain private.
- The isolated UI-handler tests are distinct from the subsequently completed
  Chrome/MetaMask browser E2E on revision
  `1f9853c11215aaae6a2a5a2383a0a10c41af4eec`. Three fresh user-approved StudioNet
  transactions finalized with successful execution: failed original assessment,
  advisory correction, and independent revised assessment. Finalized reads
  confirmed the original remained blocked, the exact revision passed, and no
  publication was created. Reload restored both results; editing cleared approval.
  See [the browser report](docs/fix-recheck-browser-test.md) and
  [structured evidence](deployments/fix-recheck-browser-test.json). This does not
  establish mobile-device or other-wallet compatibility. Hosted CI remains a
  separate check for each submitted revision.

## Evidence and full-lint maintenance

The completed Fix & Recheck browser record is now versioned in the repository,
with its original timestamps, tested source revision, exact inputs, transaction
links, and before/after policy results. README and browser/validation reports
link this evidence instead of describing the flow as unverified. Recording it
does not turn it into a new browser run against the later maintenance revision.

The full `npm run lint` command passes with `oxlint --deny-warnings`, and CI runs
it before TypeScript, frontend tests, and the production build. The global lint
configuration and scan scope were not weakened. Fixes cover native group/status
semantics, label/link contents, explicit chart key conversion, and subscription
state/cleanup in the mobile and carousel helpers. One documented, line-scoped
accessibility exception preserves the input addon's pointer-only focus shortcut;
the actual input and nested buttons remain the native keyboard targets.

Eight regressions exercise the changed UI helpers and subscription cleanup;
three bind the evidence to exact text commitments, deployed contract metadata,
and the documented CI command. Together with the unchanged contract suite this
is 60 frontend tests and 61 direct contract tests (121 distinct tests). These
isolated checks are separate from the recorded real-wallet browser test. No
contract source, address, wallet submission logic, network, or access policy was
changed by this maintenance.

## Earlier release records

The records below describe earlier releases and are retained as history.

- 32 direct contract tests passed on Windows/Python 3.12, including separately
  invoked validator callbacks for agreement, substantive disagreement, malformed
  evidence, and error handling. Mocked model outputs are not live AI accuracy tests.
- 25 frontend/protocol/rendering/recovery tests passed: scope, exact-text hashes, receipt
  semantics, selected wallet routing, rejection handling, network switching,
  mutually exclusive error/progress feedback, and explicit stale-transaction recovery.
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

## Submission checks

Require a passing hosted Linux/Windows CI run and publicly accessible submission
links. Check the actual [GitHub Actions results](https://github.com/sanity456/translatecheck/actions)
for the submitted revision; a local test pass is not a hosted CI result.
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

## Clean-run SDK bootstrap correction

The first hosted run failed during test setup, before any contract assertion:
`genlayer-test` selected the latest GenVM release and requested its obsolete
`genvm-universal.tar.xz` asset, which returned HTTP 404. Local runs had an SDK
archive cached, so they had not exercised this download path.

The direct-deploy fixture now explicitly selects `sdk_version="v0.2.12"`, whose
[official release](https://github.com/genlayerlabs/genvm/releases/tag/v0.2.12)
contains the universal archive. The contract continues to select its exact
`py-genlayer` runner by the unchanged header hash; no policy assertion is removed
or mocked to bypass the failure. The matrix now runs both operating systems to
completion even if one fails.

After the archive pin, Linux passed all 32 contract tests. Windows then failed
while printing the linter's Unicode checkmark to its CP1252 console, before
reaching the tests. The contract job now explicitly uses `PYTHONUTF8=1` and
`PYTHONIOENCODING=utf-8` on both systems. This changes tooling encoding, not
contract execution or test assertions.

## Stale-transaction recovery correction

A deeper review reproduced a gap not covered by the initial suite: when a saved
transaction permanently returned a normal lookup error, `pending` stayed set,
the new-check action stayed disabled, and only another retry was offered.

The app now offers an explicit, confirmed **Stop tracking** action. It performs
read-only finalized-state reconciliation with a ten-second limit, retains the
original hash, and clears the local active tracking entry even when the network
is unavailable. It never turns a missing receipt into a failed or successful
transaction and never automatically resubmits. Publication recovery requires
the saved submitting account; legacy entries do not guess the current wallet.
New publication requests also reuse an already-finalized publication first.

Ten recovery tests cover missing data, network/rate-limit errors, bounded hung
reads, late responses, exact-content/policy mismatch, blocked assessments, saved
senders, and legacy publication data. Four component-handler regressions execute
the actual Workspace source with in-memory React hooks/storage and mocked RPC:
stop after a missing transaction and reload, cancel confirmation, retain a
blocked verdict, and reuse an existing publication without a write. These are
isolated fault tests, not a claim of new browser or real-wallet E2E coverage.

The original 11 frontend tests and 32 contract tests remain. No contract source,
address, network, repository visibility, or Site access policy was changed.
