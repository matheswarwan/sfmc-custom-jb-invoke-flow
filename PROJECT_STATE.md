# PROJECT STATE — Phase 3

Project: Journey Action Hub

Status: Salesforce OAuth and connection management implemented and deployed. Live Salesforce org authorization remains pending user setup.

## Live URLs

- Connection management: https://sfmc-custom-jb-invoke-flow.mathes-btech.workers.dev/connections
- Mapper demo: https://sfmc-custom-jb-invoke-flow.mathes-btech.workers.dev/?demo=1
- SFMC activity configuration: https://sfmc-custom-jb-invoke-flow.mathes-btech.workers.dev/config.json

Cloudflare deployment version: c28465ff-b8af-4a79-95e2-9bf4c101c6ba (2026-09-08).

## Implemented in Phase 3

- Separate SLDS administrator page with login, External Client App settings, connect, test, refresh, disconnect and logout.
- Salesforce authorization code flow with S256 PKCE, one-time state, browser-session binding, callback expiry and fixed callback URL.
- One deployment-scoped Salesforce connection (`sf-prod`), stored in a SQLite-backed Durable Object.
- AES-256-GCM encryption for client settings, access/refresh tokens and pending OAuth state; encryption key in Cloudflare Secrets.
- Administrator key in Cloudflare Secrets; opaque server-side sessions with Secure/HttpOnly/SameSite cookies, CSRF/origin validation and login attempt limiting.
- Supported Salesforce HTTPS endpoint validation, bounded requests, redacted errors, token rotation serialization, connection verification, and remote revocation before local deletion.
- Generated Cloudflare binding/runtime types and documented deployment migration.

## Verification

- Shared/API/web/Cloudflare TypeScript builds: passed.
- Automated tests: 38 passed, 0 failed.
- Cloudflare deployment dry-run: passed.
- Local Cloudflare runtime: real Durable Object RPC and SQL storage verified for login, settings, OAuth URL creation and logout.
- Live deployment: protected status, administrator login, cookie attributes, authenticated status, logout, management-page headers and phase-3 health verified.
- Browser: live SLDS administrator sign-in page rendered correctly.
- Real Salesforce consent/code exchange, refresh and revoke: not yet run. Tests use mocked Salesforce responses.

## What you need to do

Open the connection-management page and sign in using the separately delivered private administrator access file. Enter your Salesforce External Client App consumer key, secret and login endpoint, then authorize Salesforce. Callback and scope instructions are in docs/phase-3-oauth.md and on the page. No Salesforce credentials are currently configured.

The SFMC application extension key remains unset. The mapper continues to use the Phase 2 mock Flow catalog. Actual Flow discovery, dynamic input metadata and execution are not implemented. Runtime and activation remain deliberately disabled.

## Next phase

Discover eligible active API-invocable autolaunched Flows through the authorized backend, fetch real input-variable metadata, and replace the mock catalog. Keep credentials server-side and define authenticated Journey Builder access to this metadata before exposing it to the iframe. Then implement authenticated runtime execution, lifecycle validation and tenant end-to-end acceptance.

## Provenance

Phase 1 was reconstructed from the referenced ChatGPT conversation because its original source artifact was unavailable. Phase 2 implemented and verified the Postmonger mapper. The source is maintained at https://github.com/matheswarwan/sfmc-custom-jb-invoke-flow on main.

The Phase 3 ZIP includes source, tests, lockfile, documentation and compiled assets. It excludes Git history, installed dependencies, Cloudflare local state and all private keys. The private administrator access file is delivered separately and must not be committed or shared publicly.
