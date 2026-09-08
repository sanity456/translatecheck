# TranslateCheck

Checks whether short English translations preserve meaning in French, Spanish,
or Mandarin Chinese (Simplified). No Indian-language option is included.

The app provides side-by-side editing, literal evidence quotes, public history,
multi-provider wallet discovery, resumable transactions, and an exact-text
publication registry. Examples are labeled, not presented as live verdicts.

## Why GenLayer

Validators independently review the same text pair and agree on PRESERVED,
CHANGED, or REVIEW plus a primary reason category. Only the resulting immutable
assessment can authorize publication. No private off-chain LLM makes the decision.

`evaluate_policy_view(assessment_id, source, translation, target)` returns
`{satisfied, failure_reasons, policy, assessment_id}` without an LLM call.
`publish` rechecks that gate inside the contract and records the caller as publisher.
No one can overwrite an assessment or substitute different text. This gate
controls this registry, not arbitrary outside websites. External publishing
agents must use its deterministic read or write to benefit from it.

## Run and verify

Use Node 24 and Python 3.12. The static React/Vite app reads durable records
from GenLayer. It needs no application database, server secret, or private API key.

```sh
npm ci
npm run dev
python -m pip install -r requirements.txt
genvm-lint check contracts/translatecheck.py
genvm-lint typecheck contracts/translatecheck.py
python -m pytest tests/direct -q
npm run typecheck
npm test
npm run build
node scripts/verify-deployment.mjs
```

`verify-deployment.mjs` is read-only and selects `LATEST_FINAL` explicitly.
`node scripts/live-smoke.mjs` instead deploys a NEW contract and writes public
test fixtures using a fresh ephemeral StudioNet account. It never reads or
persists a user's wallet key. Do not run it just to inspect an existing contract.
Live evidence is in `deployments/studionet.json`; configuration and source hash
are in `lib/deployment.ts`.

## Wallets and limitations

Examples, history, and existing results need no wallet. Writes use the explicitly
selected provider. EIP-6963 and legacy discovery detect MetaMask, OKX, Phantom,
and other injected Ethereum wallets. Detection does not guarantee support for
StudioNet's custom network. The app never silently switches to a different wallet.

All submitted text is public. Do not submit private data. This is not certified
translation or a substitute for qualified review of high-stakes content.
Consensus can be wrong, and StudioNet can be rate-limited or reset.

Direct tests mock model results. Captured-validator tests additionally exercise
independent agreement/disagreement. The live smoke uses real GenVM validators
and asserts execution success, not merely transaction status.
[GitHub Actions](https://github.com/sanity456/translatecheck/actions) runs the
contract checks on Linux and Windows and checks the app separately. Verify all
three jobs for the submitted revision; local test passes do not establish CI.
Actual Chrome/MetaMask signing, assessment, publication, cancellation, reconnect,
and interrupted-transaction recovery were verified. See `BROWSER_TEST_REPORT.md`
and `deployments/browser-wallet-test.json`. Mobile-device wallet testing and
actual OKX/Phantom compatibility remain unverified. Unit tests do not prove those
interactions. Public access and hosted CI must be verified before submission.

See `ARCHITECTURE.md` and `SECURITY.md` for boundaries.
