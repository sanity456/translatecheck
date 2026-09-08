# TranslateCheck

Checks whether short English translations preserve meaning in French, Spanish,
or Mandarin Chinese (Simplified). No Indian-language option is included.

The app provides side-by-side editing, literal evidence quotes, public history,
multi-provider wallet discovery, resumable transactions, and an exact-text
publication registry. Examples are labeled, not presented as live verdicts.

## Fix & Recheck

Open a finalized CHANGED or REVIEW result in **Public history**, then choose
**Fix & recheck**. Request a native GenLayer correction, or edit the translation
yourself. **Use suggestion** only copies a draft into the editor; it neither
assesses nor publishes it. Choose **Recheck revision** for a separate exact-text
assessment. If that exact revision already has a finalized assessment, the app
reads and reuses it without another transaction.

The before/after view keeps the original result and cited phrase visible.
**Open verified comparison** links both finalized assessment IDs so the result
can be reopened. The original English source and target language stay fixed in
comparison mode; exit comparison to start a different text or language.

The correction companion is `0xCE0e2EbF9CdB30145EE4badcacAecFCCc6bc593e` on
StudioNet. The original checker and publication contract are unchanged. New
corrections require a separate wallet request and consensus wait; no tokens are
transferred. A suggestion cannot approve itself. Ambiguous and specialist cases
return human-review guidance instead of a guessed correction. See
`docs/fix-and-recheck.md` and `deployments/corrections-studionet.json`.

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
genvm-lint check contracts/translatecheck_corrections.py
genvm-lint typecheck contracts/translatecheck_corrections.py
python -m pytest tests/direct -q
npm run typecheck
npm run lint
npm test
npm run build
node scripts/verify-deployment.mjs
```

`verify-deployment.mjs` reads the chain using `LATEST_FINAL` explicitly and
updates the local deployment evidence file; it does not submit transactions.
`node scripts/live-smoke.mjs` instead deploys a NEW contract and writes public
test fixtures using a fresh ephemeral StudioNet account. It never reads or
persists a user's wallet key. Do not run it just to inspect an existing contract.
Live evidence is in `deployments/studionet.json`; configuration and source hash
are in `lib/deployment.ts`.

`node scripts/corrections-smoke.mjs` deploys a NEW correction companion and writes
public correction/recheck fixtures against the configured checker. Use `--resume`
only to continue its saved report, not to reroll suggestions or deploy again.
Do not run either smoke script merely to inspect the app. The correction flow
has live three-language contract coverage, isolated UI-handler tests, and a
completed Chrome/MetaMask browser signing test on StudioNet. Its three fresh
user-approved transactions covered assessment, native correction, and a separate
recheck. The original stayed blocked; reload and edit-invalidation checks passed.
See [the Fix & Recheck browser report](docs/fix-recheck-browser-test.md) and its
[structured evidence](deployments/fix-recheck-browser-test.json). This evidence
identifies the exact tested revision and does not claim other-wallet coverage.

## Recover a stuck transaction

Use **Resume transaction** to keep tracking the original hash. If it cannot be
recovered, choose **Stop tracking**, then **Check and stop tracking**. The app
checks finalized records for up to ten seconds before clearing local tracking.
An offline network does not prevent you starting another check. This does not
cancel the on-chain transaction, prove it failed, or automatically resubmit it.
Check its original link before retrying the same action.

The last stopped transaction link is retained when browser storage is available.
Older entries without a saved sender cannot prove publication for a wallet;
reconnect the original wallet to check its publication. Existing assessments and
publications are reused before another submission. See `VALIDATION.md` for the
fault-injection regression coverage. StudioNet and the contract are unchanged.

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
contract checks on Linux and Windows and runs full-repository lint, app type
checking, tests, and the build separately. Verify all
three jobs for the submitted revision; local test passes do not establish CI.
Actual Chrome/MetaMask signing, assessment, publication, cancellation, reconnect,
and interrupted-transaction recovery were verified. See `BROWSER_TEST_REPORT.md`
and `deployments/browser-wallet-test.json`. Mobile-device wallet testing and
actual OKX/Phantom compatibility remain unverified. Unit tests do not prove those
interactions. Public access and hosted CI must be verified before submission.

See `ARCHITECTURE.md` and `SECURITY.md` for boundaries.

## Hosting

Vercel hosting is configured for the personal `sanity456` account in workspace
`sanity3`: [TranslateCheck project](https://vercel.com/sanity3/translatecheck).
Open [TranslateCheck](https://translatecheck-studionet.vercel.app/).
The owner approved public production hosting; this address needs no Vercel
login. The earlier `translatecheck.vercel.app` link remains available. Both
addresses belong to the same Vercel project and follow its production releases.
The GitHub repository remains private, and automatic Git-connected Vercel
deployments are not enabled. Preview deployment protection remains enabled.

The existing [Sites version](https://translatecheck.blazekingsley2.chatgpt.site)
and `.openai/hosting.json` remain intact as a private backup. The host change
does not redeploy contracts or move chain records. Reconnect your wallet on the
new origin; browser-local drafts and pending-transaction tracking remain on the
origin where they were created. See [Vercel hosting notes](docs/vercel-hosting.md).
