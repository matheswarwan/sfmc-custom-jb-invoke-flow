# PROJECT STATE — Phase 3: OAuth client credentials

The application now uses backend-only OAuth client credentials. The admin UI, administrator login, authorization-code/PKCE handlers, callbacks, and refresh-token service have been removed at the user's request.

## Configuration

Cloudflare Worker Secrets: `SF_CLIENT_ID`, `SF_CLIENT_SECRET`.

Cloudflare text environment variable: `SF_LOGIN_URL` (Salesforce HTTPS My Domain origin).

Enable Client Credentials Flow in the Salesforce app and configure its integration / Run As user. No interactive login, consent button or callback is used by this app. See docs/phase-3-oauth.md.

## Implementation

- Internal Salesforce client exchanges credentials for an access token using grant_type=client_credentials.
- Tokens are cached in connection-instance memory for up to five minutes; concurrent requests share acquisition.
- A Salesforce 401 causes one new token exchange and one retry. No refresh token is used.
- No public token endpoint or general Salesforce proxy is exposed.
- `/connections`, `/api/admin/*`, and `/oauth/*` return HTTP 410 and clear the old admin cookie.
- Previous encrypted Durable Object records remain dormant and are never read; old credentials are not automatically migrated into environment variables.
- Deployments preserve dashboard variables with --keep-vars.

## Verification

All TypeScript builds and 32 tests passed. Tests cover token exchange, caching, concurrent acquisition, expiration, 401 retry bounds, redacted errors, endpoint restrictions and retired routes, along with the existing Postmonger mapper tests.

Actual Salesforce authentication remains pending environment setup and Salesforce app policy verification. Presence of settings in /health is not an authentication test. The Flow catalog is still mocked, and real Flow discovery/execution remains the next phase. Runtime and activation are still disabled.

Live demo: https://sfmc-custom-jb-invoke-flow.mathes-btech.workers.dev/?demo=1

Repository: https://github.com/matheswarwan/sfmc-custom-jb-invoke-flow

The updated client-credentials ZIP supersedes earlier Phase 3 artifacts and the old administrator access file. No private keys are included.
