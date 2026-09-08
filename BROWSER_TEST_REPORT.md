# Real-wallet browser test report

Tested on 2026-09-08 UTC with Chrome, MetaMask, and GenLayer StudioNet (61999).
The app was owner-private during testing. No tokens were transferred.

## Verified flow

- The wallet button opened the chooser and detected MetaMask.
- User-approved connection and actual wallet-signed writes succeeded.
- Public history and exact-result reuse worked without additional transactions.
- Editing the original text or target language cleared its prior approval.
- Meaning-changing Spanish and French assessments blocked publication.
- Mandarin preserved-meaning and wrong-language REVIEW results displayed their
  respective allowed/blocked decisions correctly.
- Closing/reopening the browser recovered the pending hash. Resume completed
  the original assessment without resubmitting it or needing another signature.
- Reload and reconnect restored the user's existing publication and removed the
  duplicate-publish action.
- Rejecting a new MetaMask assessment request restored the enabled editor,
  displayed a cancellation error, and left no pending transaction.

## Wallet-signed assessment

[Finalized assessment transaction](https://explorer-studio.genlayer.com/tx/0x41c4571c82bd461662fd195e438f33629fdcf39b047e3aa01c3f85b685b6be46)

Source: `Free delivery on orders over $50.`

French: `Livraison gratuite pour les commandes de moins de 50 $.`

Expected and observed: `CHANGED`, primary reason `CONDITION`; the condition is
reversed. A separate `LATEST_FINAL` read returned `satisfied: false` and
`failure_reasons: ["MEANING_CHANGED"]` for the exact stored inputs.

Assessment ID:
`f64e733324d5cb45920857ec4ff369c4efcfe7ba5adc8cc3cbf62a221c7d31b0`

## Wallet-signed publication

[Finalized publication transaction](https://explorer-studio.genlayer.com/tx/0xa32032abad8825c0373ab45a92c3c6c02a6b346c5708ecdaab46d2e3ff96bdbf)

The corrected French text was
`Livraison gratuite pour les commandes de plus de 50 $.`
Its existing immutable assessment was reused. Publication execution succeeded,
and an independent finalized read returned the publication for the connected
wallet. The app displayed `Published in the registry`.

Publication ID:
`2d6aa6c6579d15d88e7c16159364bf2cb69d4a97dec74f14e87af4555eaaa507`

Publisher: `0x29B8b7D7CBF534Eba01E56919dE19d79d1509360`

Publication time: `2026-09-08T06:46:10.500179Z`

## Cancellation evidence and correction

The user rejected the request for `The meeting starts at 9 am.` →
`会议上午9点开始。` (`zh-CN`). At `2026-09-08T06:56:15.025Z`, a finalized read
reported no assessment for
`9bd19d5e1322b699afef70d766110976fc8fd182cb605337d47170ac14b09be3`;
history remained at five assessments. No transaction hash was produced by the
app for this canceled request.

The functional cancellation passed, but a stale confirmation message remained
under the cancellation error. Error paths now clear the notice, and the feedback
renderer cannot show progress alongside an error. Two React rendering tests
cover this correction; the contract and wallet submission logic are unchanged.

## Scope and limitations

This is evidence for the tested Chrome/MetaMask journey, not certification of
all wallets or devices. No real mobile-device wallet or actual OKX/Phantom
signing was tested. No claim is made that consensus is always linguistically
correct. Initial browser checks used revision
`dd699c754795c51120217841fea5c60ca5e3cc4f`; the feedback-only correction follows
that revision and has dedicated rendering regression coverage.

Responsive smoke checks used 390 × 844 and 1280 × 900 browser viewports. The
document fit the available width without horizontal overflow at those sizes;
the phone-sized editor stacked correctly. The normal viewport was restored.
These checks do not substitute for testing a physical phone and mobile wallet.

The exact source hash and structured results are in
`deployments/browser-wallet-test.json`. Public access and a passing hosted CI
run are separate submission requirements; local test passes are not hosted CI.
