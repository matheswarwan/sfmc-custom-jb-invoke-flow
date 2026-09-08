# Phase 3 — Salesforce OAuth and connection management

Phase 3 adds one administrator-managed Salesforce org connection (`sf-prod`) per deployment. It does not discover or invoke real Flows yet. The Journey Builder mapper still uses the Phase 2 mock input catalog and does not infer authorization from an activity's saved connection ID.

## Set up Salesforce

Create an External Client App (or use an existing supported Connected App) in the target org. Configure:

- OAuth web server / authorization code flow with PKCE (S256).
- Callback URL: `https://sfmc-custom-jb-invoke-flow.mathes-btech.workers.dev/oauth/callback`.
- OAuth scopes: `api`, `refresh_token` (offline access), and `id` (identity).
- Require client secret for web server and refresh token flows.
- Give the authorizing integration user the appropriate org access and app policy permission. An API-enabled org/user is required. This phase verifies identity; later phases will verify permissions to discover and execute Flows.

At `/connections`, sign in with the Journey Action Hub administrator key, enter the consumer key/client ID, consumer secret/client secret, and Salesforce login URL. Choose `https://login.salesforce.com`, `https://test.salesforce.com`, or the org's HTTPS My Domain origin. Save settings, then authorize Salesforce. The actual Salesforce login/consent happens at Salesforce; this app never requests your Salesforce password.

Use Test connection to check the current access token (automatically refresh on 401), Refresh authorization to test refresh-token exchange, and Disconnect to revoke the refresh token and remove stored tokens. A failed remote revocation preserves local tokens so it can be retried. If Salesforce reports invalid_grant, reconnect is required. Disconnect first, then authorize again.

## Where data is stored

| Data | Storage |
| --- | --- |
| Administrator access key | Cloudflare Worker Secret `ADMIN_ACCESS_KEY` |
| AES-256-GCM encryption key | Cloudflare Worker Secret `TOKEN_ENCRYPTION_KEY` |
| Client ID, client secret, login endpoint | Encrypted record in the connection's SQLite Durable Object |
| Access token, refresh token, instance and identity URLs | Encrypted record in the same Durable Object |
| Admin sessions | Hashed opaque session IDs and CSRF values with a 30-minute expiry in Durable Object storage |
| Pending OAuth attempt | Encrypted state hash, PKCE verifier, callback URI, browser session binding and 10-minute expiry |
| Journey activity | Non-secret `connectionId` and mapping configuration only |

Client secrets and Salesforce tokens are never returned by connection-status APIs, written to browser storage, committed to Git, or logged by application code. The client secret is transiently present in the administrator's password field when entered and is cleared after a successful save. Only the non-secret client ID, URLs, timestamps and connection state appear in authenticated status responses.

The generated administrator key is supplied separately as a private local delivery file, outside the Git repository. Keep it in a password manager. The encryption key is not included in that delivery file; protect the Cloudflare secret and do not rotate it without migrating existing encrypted records. Loss of that key requires clearing the connection records and reauthorizing.

## Backend controls

- Admin and OAuth routes fail closed when bootstrap secrets are absent.
- Administrator cookie is Secure, HttpOnly, SameSite=Lax, host-only, and expires after 30 minutes. Logout deletes its server-side session.
- Every POST checks the fixed app Origin. Authenticated mutations also require a CSRF token.
- Five administrator login attempts per IP per minute, stored server-side.
- Random one-time OAuth state, bound to the same admin session; code verifier sent only during token exchange. Replayed, wrong-session, expired and mismatched callbacks cannot exchange codes.
- OAuth callbacks redirect to a fixed local page, dropping the code from navigation. Errors never reflect Salesforce response bodies.
- Salesforce endpoints accept only supported HTTPS Salesforce login/My Domain origins; no arbitrary proxy targets or redirect following.
- External requests have 8-second timeouts and response-body limits.
- Token refresh and disconnect operations are serialized per connection, preserving rotated refresh tokens before further network calls. This is administrator traffic, not the future contact execution path.
- The management page cannot be framed. It opens separately from Journey Builder, avoiding embedded third-party cookie dependence.

This is a single-administrator-key MVP. It is not multi-tenant authentication or enterprise SSO. A key holder can manage the one deployment connection. Key rotation blocks new login with the previous key; existing sessions expire within 30 minutes. Durable Object records expire logically on access and are physically purged on subsequent writes.

## Deployment

The Worker binds a SQLite-backed `SalesforceConnection` Durable Object with migration `v1`. `wrangler types` generates runtime and binding definitions. The application origin is fixed in `wrangler.jsonc`; update it and the Salesforce callback together if changing domains.

For a fresh installation, create a 32-byte base64url `TOKEN_ENCRYPTION_KEY` and a high-entropy `ADMIN_ACCESS_KEY`, then set both with Wrangler Secrets. Never put them in `wrangler.jsonc`. Run `npm run deploy:check`, `npm test`, and `npm run deploy`. The Express scaffold is not the OAuth backend; OAuth routes are implemented in the Cloudflare Worker.

## Verification and limits

Automated tests cover encryption, endpoint validation, session authentication, CSRF, OAuth state replay/cross-session rejection, PKCE, denial, token confidentiality, rotation concurrency, invalid grants, and revocation failures. Local Cloudflare runtime tests verify real RPC and SQL persistence for login, settings, authorization URL and logout.

A real Salesforce code exchange, consent, org policy, refresh, and revocation must still be verified using your External Client App. Mocked upstream tests do not establish tenant acceptance. Runtime execution remains disabled; live Flow discovery is the next phase.

## Official references

- [Salesforce OAuth web server flow and PKCE](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm&language=en_US&type=5)
- [Salesforce OAuth endpoints](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_endpoints.htm&language=en_US&type=5)
- [External Client App setup](https://trailhead.salesforce.com/content/learn/projects/build-integrations-with-external-client-apps/create-and-configure-an-external-client-app)
- [Token revocation](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_revoke_token.htm&language=en_US&type=5)
- [Cloudflare SQLite Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
