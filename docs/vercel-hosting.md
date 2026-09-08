# TranslateCheck on Vercel

## Current public address

Open [translatecheck-studionet.vercel.app](https://translatecheck-studionet.vercel.app/)
without Vercel login. The owner approved public hosting after the initial
private migration, then requested the matching `-studionet` name for both apps.
The earlier `translatecheck.vercel.app` link remains available. Both are
production domains on the existing project, so they follow future production
releases. The project and GitHub repository have not been renamed.

The public address change does not redeploy contracts or move on-chain records.
Reconnect the wallet on the new origin; browser-local drafts and tracking remain
on their original origin. The initial migration report below is historical,
not a statement that the current production website is private.

## Ownership and privacy

- Account: `sanity456`; personal workspace: `sanity3` (display name `sanity`).
- Project: `translatecheck` (`prj_HX3OBG4TceiYqG1LWl9TgRfYOXU9`).
- [Project dashboard](https://vercel.com/sanity3/translatecheck).
- Hobby plan; no paid upgrade or add-on was enabled.
- Vercel Authentication is enabled with
  `ssoProtection.deploymentType = prod_deployment_urls_and_all_previews`.
- Production domains are public by owner approval. Preview and generated
  deployment URLs remain protected. Do not confuse website access with the
  GitHub repository's visibility: the repository remains private.
- There is no connected Git integration or automatic production deployment.
  The source remains in the private `sanity456/translatecheck` GitHub repository.

[Vercel's Hobby protection](https://vercel.com/docs/deployment-protection)
protects preview and generated deployment URLs, but not production domains.
Use the public app link above for sharing. Connecting automatic Git deployments
remains a separate, unapproved change.

## Build and deploy

This is a native static Vite deployment, not a Next.js or Cloudflare Worker
server. `vercel.json` uses `npm ci`, `npm run build`, and the `dist` directory.
`package.json` pins Node 24.x, matching CI. No package versions were changed.
No app secrets, environment variables, database, or wallet keys are required.

`.vercelignore` allows only frontend source, public assets, and build inputs.
Contract tooling, tests, evidence, caches, `.env` files, credentials, and the
backup Sites configuration are excluded from CLI uploads. They remain in the
local checkout or private source repository as appropriate.

From this project's checkout, using the authenticated owner account:

```sh
npm run lint
npm run typecheck
npm test
npm run build
vercel deploy --dry --json --target preview --scope sanity3 --project prj_HX3OBG4TceiYqG1LWl9TgRfYOXU9
```

Before uploading, inspect the dry-run files. The dry run uploads nothing.
For a public release, verify READY status and unauthenticated HTTP 200 on the
primary production domain; keep preview protection enabled. For any future
request to make the site private, do not assume
`--target preview` can safely bootstrap a private project: this migration found
that Vercel coerced its first deployment to production. Do not use `staging`
as a workaround; it also created an alias. Future private deployments must avoid
automatic alias assignment and verify every actual alias and public project
domain, not merely the target label. A private release must deny or redirect
unauthenticated HTTP requests to Vercel login.
Never upload environment files or paste protection
bypass credentials into evidence or links. The local `.vercel` link stays
ignored by Git. CLI linking may create an ignored `.env.local` containing an
OIDC token; the app does not need that file.

## Initial private migration snapshot — 2026-09-08

This is the state verified before the subsequent owner-approved public launch
and domain naming change. It is retained as historical evidence.

- [Private deployed app](https://translatecheck-8ikcrck4f-sanity3.vercel.app).
- [Deployment dashboard](https://vercel.com/sanity3/translatecheck/5EG463z5wG3EVBsnn9VNz1Pni21v).
- Deployment ID: `dpl_5EG463z5wG3EVBsnn9VNz1Pni21v`; status: `READY`.
- Exact uploaded source: `170820bf17efc95500f1700fb6826cb79a4d6664`.
  Subsequent migration-note changes are outside the Vercel upload allowlist.
- Actual target metadata: `production` because Vercel promoted the first
  deployment target automatically. This deployment is **not aliased to a public
  address**. Its aliases list is empty and the project has no current production
  deployment target. Do not describe it as a verified preview-target deployment.
- Anonymous request to its generated URL returned HTTP 302 to authentication.
  Both `translatecheck.vercel.app` and the removed
  `translatecheck-sanity3.vercel.app` alias returned HTTP 404.
- One confirmed workspace member: `sanity456` (OWNER). No Git integration or
  sharing/bypass links were enabled. GitHub and the original Sites deployment
  remained private.
- Local lint, typecheck, 65 frontend tests, and the Vite build passed.
  [CI for the uploaded source](https://github.com/sanity456/translatecheck/actions/runs/34226783451)
  passed all three jobs: app, Linux contracts, Windows contracts (126 distinct
  frontend/contract tests; the contract suite runs twice).
- Vercel's remote build passed: 2,493 modules transformed, static Vite output
  produced. The existing large-chunk warning is non-blocking.
- No new wallet transaction or browser signing test was performed.

### Temporary-public-alias incident

The initial CLI upload requested `--target preview`, but Vercel returned
`target: production`. That deployment
(`dpl_ASFAANivjSDApYB4UbMG7dBktjV1`) was removed immediately after the unexpected
target was observed. The source remains recoverable from GitHub.

A subsequent explicit `staging` API request with
`autoAssignCustomDomains: false` was also coerced to production. The service
still assigned the staging alias `translatecheck-sanity3.vercel.app`, which
returned HTTP 200 without authentication. That alias was removed as soon as
the HTTP check identified it. Its deletion was verified by an empty deployment
alias list and HTTP 404. Only the authenticated generated deployment URL was
retained. The user was informed; do not claim that the migration had no temporary
public exposure. No private wallet keys, environment files, caches, or test
tooling were in the upload. No visitor-access audit was performed.

## What stays unchanged

- Both StudioNet contracts, their source hashes, and the network remain unchanged.
- Assessments, corrections, and publications remain on GenLayer; no migration
  transaction is needed.
- Wallet selection, signing, translation policy, and publication logic are
  unchanged.
- The private [Sites deployment](https://translatecheck.blazekingsley2.chatgpt.site)
  remains available as a backup; its configuration is preserved.
- Browser-local drafts, preferences, and pending-transaction tracking are
  origin-specific. They are not copied automatically. Retain pending hashes
  and use the original site to resume tracking when necessary. Reconnect the
  wallet separately on Vercel; never import a seed phrase into the app.
- Existing browser-test evidence describes its original tested URL and source
  revision. A hosting build and HTTP checks do not establish a fresh browser
  wallet-signing test on the Vercel origin. Mobile signing remains unverified
  and was postponed by the user.
