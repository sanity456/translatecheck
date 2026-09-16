# Studio Next review response — 2026-09-16

## Response to paste

Thank you for identifying the network mismatch. TranslateCheck now targets Studio
Next (chain 61997), not stable Studio 61999. The active read/write clients, wallet
switch/add requests, transaction tracking, and both checker/correction verification
links use the same Next configuration. Both contracts were deployed with the
Next-compatible pinned runtime and their on-chain sources verified byte-for-byte.
The SDK-signed assess → correct → independently recheck → publish workflow passed
on 61997. A separate Chrome/MetaMask test then passed three user-approved
transactions: assessment, advisory correction and independent recheck. The
incorrect original remains blocked; an unassessed suggestion and
altered content cannot satisfy the publication gate. The original history is
unchanged. Evidence below includes addresses, source hashes, successful finalized
transactions, exact inputs and policy payloads. Local verification passed 61
contract tests, 79 app tests, lint, type checking and the production build.

## Links and configuration

- [Public app](https://translatecheck-studionet.vercel.app/)
- [Source repository](https://github.com/sanity456/translatecheck)
- [Structured release evidence](../deployments/studio-next.json)
- [Fresh Chrome/MetaMask evidence on 61997](../deployments/metamask-studio-next-workflow.json)
- [Active network configuration](../lib/network.ts)
- [Active contract configuration](../lib/deployment.ts)
- [Passing CI for deployed source 865608c](https://github.com/sanity456/translatecheck/actions/runs/35076197671)
- [Verified before/after comparison](https://translatecheck-studionet.vercel.app/?assessment=f7b74d2620367d9c0d854e8b0552d058fa47e3875e48700ad71e551c5cded832&compare=979a836e88c42a093a91d4fb5f6d66bac2584e0692de3a33df7f2060918c87a3)

Chain: **61997** (`0xf22d`), RPC: `https://studio-dev.genlayer.com/api`.
The public site's `-studionet` domain name is unchanged; it does not determine
the network. The header explicitly identifies Studio Next 61997.

| Contract | Address | SHA-256 of exact deployed source |
|---|---|---|
| [Checker/publication](https://explorer-studio-dev.genlayer.com/address/0xc3B4B96695A6f090660dF3733D43962f799A9684) | `0xc3B4B96695A6f090660dF3733D43962f799A9684` | `4c5037921ec50e138374e6d61b1af9e864454b8c35b0b13ea37a892ff29e3c19` |
| [Correction companion](https://explorer-studio-dev.genlayer.com/address/0x275068022df67d8502d1669DF4668e5ccae7EAcf) | `0x275068022df67d8502d1669DF4668e5ccae7EAcf` | `6139dde97d71bc356d9af2837937d0f3fa675ec4e9978950af7b18b421b4d2e9` |

The correction contract's `get_config().checker` equals the checker above.
Its `advisory_only` and `requires_separate_assessment` flags are both true.

## Live reproduction and outcomes

On 2026-09-16, a disposable Studio Next sandbox account submitted the workflow
with real network validators (`leaderOnly: false`). Every transaction below
finalized **with successful execution**, followed by `LATEST_FINAL` reads.

| Action | Transaction hash |
|---|---|
| Deploy checker | `0xd4f613e71d69e24971dd138f95e69840f6d6d787b5ff19e59d25c1f945bc3b6a` |
| Deploy companion | `0x3c00e9984fb21ebf21078232b3be6555f03697d0ea7bddeea66540d8e8d0d630` |
| Assess incorrect translation | `0xc969844bcc0c98eff469bc894e423072cc66c61fb9a90177e941f66bb592a63d` |
| Suggest correction | `0xbb506feea2c1d5391c201506b2afc7774f1487efc06a33d5d262fd4c96c8ae2a` |
| Independently recheck revision | `0xb998a97bfc1ac2d78a577c221f6b04cbc859e15644fa9eb82d874bbe82594334` |
| Publish exact revision | `0x95566811398bb9f9b1d5e958bd33a47557fa1181547886d2246665bfbc16cee9` |

English: **You do not need a ticket to enter the exhibition.**

Incorrect Spanish: **Necesitas una entrada para entrar a la exposición.**
Result: `CHANGED / NEGATION`; gate:
`{"satisfied":false,"failure_reasons":["MEANING_CHANGED"]}`.

Suggested Spanish: **No necesitas una entrada para entrar a la exposición.**
Before independent assessment its gate was false (`ASSESSMENT_NOT_FOUND`).
After separate assessment: `PRESERVED / NONE`; gate:
`{"satisfied":true,"failure_reasons":[]}`. Altering the English source then
returns `{"satisfied":false,"failure_reasons":["CONTENT_MISMATCH"]}`.
The original assessment was re-read and compared unchanged. Publication was
re-read under the exact revised assessment and the actual submitting account.
Full gate payloads, timestamps and records are in the structured evidence.

Read-only verification (no signing, no writes):

```sh
npm ci
node scripts/verify-deployment.mjs
```

To inspect in the app, open the comparison link. **Request correction** reuses
the existing on-chain draft without a transaction. **Use suggestion** only copies
text; **Recheck revision** independently reads the existing exact assessment.
Editing the revision clears approval. A new, unassessed text requires a wallet
on 61997. Studio Next uses estimated test-GEN protocol deposits; the old gasless
wording has been removed. No real tokens were used for this sandbox verification.

## Fresh Chrome/MetaMask verification on Studio Next

On 2026-09-16, the public Vercel app completed a separate desktop Chrome/MetaMask
flow on **61997**. The owner approved all three transactions. Each was verified
as `FINALIZED` **and** `FINISHED_WITH_RETURN`, then read using `LATEST_FINAL`.
The deployed app source revision is `865608c5304acea45c0cd48cd9ccd29981f90e50`;
this evidence-only update does not change the deployed app or contracts.

| Action | Transaction |
|---|---|
| Assess incorrect French | [0x8d4fed829e5331ae153fdc5582c5a2e5790bbab386e657cfd5fb728d6c16cec5](https://explorer-studio-dev.genlayer.com/tx/0x8d4fed829e5331ae153fdc5582c5a2e5790bbab386e657cfd5fb728d6c16cec5) |
| Request advisory correction | [0x14395afd87f6b0dee09c826367d58ba8d4f6d9485c93bff0b53161adf3afa4fb](https://explorer-studio-dev.genlayer.com/tx/0x14395afd87f6b0dee09c826367d58ba8d4f6d9485c93bff0b53161adf3afa4fb) |
| Independently recheck revision | [0x647acfc58f11dee361b2bf16c8ea7ee3eff945e5541d8f48b04600c019ab97e0](https://explorer-studio-dev.genlayer.com/tx/0x647acfc58f11dee361b2bf16c8ea7ee3eff945e5541d8f48b04600c019ab97e0) |

English: **Free delivery on orders over $50.**

Original French: **Livraison gratuite pour les commandes de moins de 50 $.**
The immutable original is `CHANGED / CONDITION`; its gate is
`{"satisfied":false,"failure_reasons":["MEANING_CHANGED"]}`.

Corrected French: **Livraison gratuite pour les commandes de plus de 50 $.**
The companion returns `advisory_only: true` and
`requires_separate_assessment: true`. The browser labelled the suggestion as a
draft and kept publication blocked after **Use suggestion**. Only a separately
approved checker transaction produced `PRESERVED / NONE`, with
`{"satisfied":true,"failure_reasons":[]}` for the exact corrected content.
Changing the source amount to $500 returns
`{"satisfied":false,"failure_reasons":["CONTENT_MISMATCH"]}`.
The original was compared with the pre-correction snapshot and was unchanged.

[Open the verified French before/after comparison](https://translatecheck-studionet.vercel.app/?assessment=2ac14e884cf62adab2a7f737dc5af0255df50b23b3df297088ccb1992619a107&compare=f64e733324d5cb45920857ec4ff369c4efcfe7ba5adc8cc3cbf62a221c7d31b0).
The structured MetaMask evidence includes exact inputs, timestamps, IDs, wallet,
transactions and policy payloads. This French wallet test did **not** publish;
the successful Next publication evidence is the separate SDK-signed Spanish
workflow above. Mobile, OKX and Phantom signing are not claimed.

## Compatibility and evidence boundaries

The original issue was inconsistent active network configuration, compounded by
the older SDK/runtime not matching Next. The migration pins `genlayer-js`
`2.0.0-rc.1`, the v0.3 runner
`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`, and compatible
contract-test/linter releases. It updates SDK imports, nondeterministic execution
and cross-contract APIs without changing the meaning policy or publication gate.
Fee estimation precedes signing; wrong-chain, changed-account and excessive-fee
conditions fail closed. Pending storage is isolated by chain and checker.

The report retains an initial failed old-runner deployment and a superseded,
unused candidate pair as diagnostic history. Neither is the active release.
The six successful transactions above belong to the configured final pair.

The 61 direct tests use model mocks and invoked validator callbacks; they are not
an AI accuracy benchmark. The 79 app tests include actual writer-handler tests
with isolated RPC/provider doubles, not real extension signing. The local browser
loaded both finalized results from Next and cleared approval when edited.
The older Chrome/MetaMask reports and demo video remain historical **61999**
evidence. They are not relabelled as Next tests; the fresh 61997 MetaMask evidence
is explicitly separated above. The linked CI passed all three jobs for the
deployed source revision, including 61 direct contract tests, 79 app tests,
lint, type checking and build. Direct and provider-double tests are not evidence
of other-wallet or physical mobile compatibility.

The submission readiness audit also found four high-severity entries in the
Cloudflare development-tool dependency chain; `npm audit --omit=dev` returned
zero advisories on 2026-09-16. Those development dependencies are not patched by
this evidence update. This is not a claim of a comprehensive security audit.

Existing stable deployments and historical evidence remain available. This
change does not copy their records into Studio Next or silently resume their
pending transactions there. The portal resubmission remains the owner's action.
