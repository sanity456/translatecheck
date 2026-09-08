# TranslateCheck on Vercel

## Ownership and privacy

- Account: `sanity456`; personal workspace: `sanity3` (display name `sanity`).
- Project: `translatecheck` (`prj_HX3OBG4TceiYqG1LWl9TgRfYOXU9`).
- [Project dashboard](https://vercel.com/sanity3/translatecheck).
- Hobby plan; no paid upgrade or add-on was enabled.
- Vercel Authentication is enabled with
  `ssoProtection.deploymentType = prod_deployment_urls_and_all_previews`.
- Deploy explicitly to **preview**, not production, while privacy is required.
- There is no connected Git integration or automatic production deployment.
  The source remains in the private `sanity456/translatecheck` GitHub repository.

[Vercel's Hobby protection](https://vercel.com/docs/deployment-protection)
protects preview deployments, but not the production domain. A private preview
is not a public hackathon submission link. Obtain approval before a public
production launch or before connecting automatic Git deployments.

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
vercel deploy --target preview --scope sanity3 --project prj_HX3OBG4TceiYqG1LWl9TgRfYOXU9
```

Before uploading, inspect the dry-run files and verify that the project still
has Vercel Authentication enabled. After deploying, verify READY status, a
non-production target, and that an unauthenticated HTTP request is denied or
redirected to Vercel login. Never upload environment files or paste protection
bypass credentials into evidence or links. The local `.vercel` link stays
ignored by Git. CLI linking may create an ignored `.env.local` containing an
OIDC token; the app does not need that file.

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
