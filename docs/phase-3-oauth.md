# Phase 3 — OAuth client credentials

Salesforce authentication is server-to-server. There is no administrator UI, access key, Authorize button, callback or refresh-token flow.

## Cloudflare configuration

In the Worker Settings → Variables and Secrets, configure:

| Name | Type | Value |
| --- | --- | --- |
| SF_CLIENT_ID | Secret | Salesforce consumer key / client ID |
| SF_CLIENT_SECRET | Secret | Salesforce consumer secret |
| SF_LOGIN_URL | Text variable | Org's HTTPS My Domain origin, e.g. https://your-org.my.salesforce.com |

Use the My Domain origin without a path or trailing token endpoint. The backend appends `/services/oauth2/token`. Configure `SF_LOGIN_URL` in the dashboard or wrangler.jsonc. The deploy script uses `--keep-vars` to preserve dashboard-set variables. Secrets are never placed in source, browser configuration, or Journey arguments.

For CLI setup, run `npx wrangler secret put SF_CLIENT_ID` and `npx wrangler secret put SF_CLIENT_SECRET`. Enter their values at the secure prompts, not in command arguments.

## Salesforce settings

Enable OAuth Client Credentials Flow on the External Client App or supported existing Connected App. Enable API access scope and configure its integration / Run As user and app policies. Give that user only the permissions required for the eventual Flow integration. No callback or interactive consent is used by this app. No refresh token is issued.

## Backend behavior

The internal Salesforce client posts a form containing `grant_type=client_credentials`, `client_id`, and `client_secret` to the token endpoint. It uses the returned instance_url for Salesforce data API requests. Tokens remain in per-connection memory for at most five minutes (shorter if expires_in is supplied). Concurrent requests share acquisition. After a 401, the client acquires a fresh token and retries exactly once. HTTP redirects are rejected; token responses are bounded and network calls time out.

There is deliberately no public endpoint that returns tokens or accepts arbitrary Salesforce proxy requests. The internal Durable Object client is ready for the next phase's authenticated Flow discovery service. Flow discovery and actual execution remain unimplemented, so ordinary page views do not acquire tokens.

`/health` reports `authMethod: client_credentials` and whether all three configuration values are present. Presence is not proof of successful Salesforce authentication.

## Migration from the previous implementation

The UI, admin API, PKCE and authorization-code code paths have been removed. `/connections`, `/api/admin/*` and `/oauth/*` return 410 and expire the old admin cookie. The existing Durable Object namespace is retained to avoid destroying historical records during migration, but the new class never reads them. Previously stored credentials are not automatically copied to environment variables: set the three values above in Cloudflare.

Historical encrypted records and their legacy Cloudflare encryption secret remain dormant; the previous administrator key is no longer accepted anywhere. You can revoke the old app authorization in Salesforce independently. Do not use the earlier administrator access file or Phase 3 ZIP: the updated client-credentials package supersedes them.

## Verification

Tests cover form parameters, cache/concurrency, token reacquisition, bounded retries, endpoint/path restrictions, error redaction and removal of old routes. Real Salesforce authentication must be verified after environment configuration and Run As user policy are complete.

[Salesforce client credentials guide](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_client_credentials_flow.htm&language=en_US&type=5) · [Salesforce integration-user guidance](https://developer.salesforce.com/blogs/2024/02/invoke-rest-apis-with-the-salesforce-integration-user-and-oauth-client-credentials)
