# Architecture

The npm workspace retains the Phase 1 layout: `apps/web` (React/Vite), `apps/api` (Express), `packages/shared` (configuration models and pure transformations), `jb-activity/config.json`, and deployment scaffolding.

The web session controller owns the complete initial activity snapshot. The view updates only an immutable draft of the app's configuration. A valid save clones the activity, replaces only known Flow input arguments, merges app metadata, and emits the complete activity. Repeated init events cannot erase edits; repeated Done events do not submit twice. Disposal unregisters listeners and clears timers.

Configuration lives in `metaData.journeyActionHub`:

```json
{
  "version": 1,
  "executorType": "salesforce-flow",
  "connectionId": "sf-prod",
  "flowApiName": "Customer_Onboarding_Flow",
  "mappings": {
    "ContactId": "{{Event.ENTRY-KEY.ContactId}}",
    "EmailAddress": "{{Event.ENTRY-KEY.EmailAddress}}"
  }
}
```

The same bindings are emitted as separate objects in `arguments.execute.inArguments`. Journey Builder resolves those expressions at contact execution time. The service will receive resolved values; it should not query the Entry DE per contact. A later phase must explicitly carry or resolve the executor/connection/Flow configuration at runtime. This phase does not assume metaData is automatically delivered to execute.

Discovery inspects only schema-bearing locations: root `schema`, root `fields`/`Fields`, and `dataExtension.fields`/`Fields`. Within them, JSON Schema properties and named field arrays recurse to scalar leaves. No arbitrary object properties become fields. It deduplicates paths, excludes arrays and unsupported path characters, and bounds traversal depth with cycle protection. These adapters are compatibility code, not asserted Salesforce response contracts.

The known mock schema owns five input keys. Saving preserves foreign argument keys even when they share an object with an owned key. Explicit saved mappings take precedence over inferred legacy arguments. Unknown Flow/connection/executor/version configurations are displayed and blocked from saving, avoiding a silent conversion to the mock catalog.

No credentials or contact values are logged or persisted by the real UI. Only the explicit top-level local demo uses localStorage. The API is a disabled execution skeleton: save/stop/unpublish acknowledge requests; validate/publish reject activation; execute returns 501. Authentication and durable runtime configuration are future work.

## Phase 3 backend

The Cloudflare connection object uses environment-supplied OAuth client credentials and a short-lived in-memory access-token cache. It has no administrator UI or interactive callback. Old encrypted storage is dormant and never read by the new implementation. The internal request helper acquires a new token after a 401 and retries once; no token/proxy endpoint is exposed publicly. See phase-3-oauth.md.
