# Journey Action Hub — Phase 2

A React/TypeScript configuration application for an SFMC Journey Builder REST custom activity. It maps Entry Event fields to a mock Salesforce Flow schema using the real Postmonger package.

## Provenance

The referenced ChatGPT conversation, “Build Journey Builder App” (6a9f88e9-dca0-83e8-9257-cd9ed510c9d3), described a Phase 1 monorepo and a generated download. That artifact was not available through the conversation attachment list, local workspace/Downloads search, or matching GitHub repository search. This source reconstructs the documented Phase 1 structure and implements Phase 2; it is not a verified patch against the original artifact. The project repository is [matheswarwan/sfmc-custom-jb-invoke-flow](https://github.com/matheswarwan/sfmc-custom-jb-invoke-flow).

## Run

Requires Node.js 22.12+ (or a compatible newer release) and npm.

```sh
npm ci
npm run build
npm test
npm run dev
```

Open http://127.0.0.1:5173/?demo=1 for the explicit local demo. It uses synthetic Journey fields and saves only to the browser's `jah-demo` localStorage key. Map ContactId and EmailAddress, select Done, then reload to verify restoration. Remove that key to reset the demo. Demo mode is disabled in iframes even if the query parameter is present.

Without `?demo=1`, the application uses real Postmonger and waits for Journey Builder. `npm start` starts the API on port 3001; `GET /health` reports runtime disabled. API endpoints are scaffolding, not a production integration.

## Implemented

- Listeners registered before `ready`; `initActivity` restores the full activity and app configuration.
- `requestTriggerEventDefinition` / `requestedTriggerEventDefinition` field discovery with null, timeout, retry and unsupported-schema handling.
- Recursive JSON Schema `properties` and named `fields`/`Fields` adapters, including nested scalar objects; collections are excluded.
- Mock Flow: Customer_Onboarding_Flow; mock connection: sf-prod. Required ContactId and EmailAddress; optional FirstName, OrderNumber, OrderAmount.
- Mapping validation, stale-field detection and numeric compatibility checks for OrderAmount.
- Valid Done (UI button or host `clickedNext`) constructs `arguments.execute.inArguments`, sets `metaData.isConfigured`, and emits `updateActivity` with the full preserved activity.
- App-owned configuration at `metaData.journeyActionHub`, separate from runtime mappings. Existing legacy `configurationArguments.journeyActionHub` is readable and preserved. When no explicit mapping object exists, known Flow inputs are loaded from legacy inArguments.
- Unknown activity properties, metadata, lifecycle endpoints, execution URL/options, outcomes, outArguments, and unrelated inArguments survive save. Optional cleared mappings are removed. Unknown app properties survive load/save.

## SFMC configuration check

Build output is in `apps/web/dist`; it includes `index.html`, bundled Postmonger, and `config.json`. Before building for an SFMC sandbox, edit `jb-activity/config.json`: set the API HTTPS host and installed package's actual application extension key. Serve the complete web build over HTTPS at the custom activity endpoint, with its root `index.html` and `config.json`. Ensure hosting permits embedding by your Journey Builder host. The API is separately hosted. Docker scaffolding: `docker build -f deployment/Dockerfile.api -t journey-action-hub-api .` (not validated in this delivery).

Use a draft Journey for configuration verification. See [acceptance checks](docs/phase-2-verification.md). Native Journey Builder Cancel/close discards edits; the app does not invent a cancellation event. `updateActivity` submits to the canvas; save the Journey to persist it. The API deliberately rejects publish/validate and execute while runtime is unimplemented.

## Limits and next phase

Field schemas are not guaranteed in Postmonger's Entry Event response. No field data is fabricated in real mode and no tokens are requested. Missing DE metadata requires future authenticated metadata lookup. Names with unsupported punctuation/spaces are excluded rather than emitting guessed bindings. Nested object bindings are generated for supported descriptors but need validation against the actual Entry Source. Type handling is conservative: unknown numeric types are rejected; no automatic coercion is performed.

No Salesforce OAuth, live Flow discovery, credential storage, Flow invocation, REST execution, JWT verification, or production activation is implemented. Mock sf-prod is an identifier, not an authenticated connection. Runtime routing metadata transport must be finalized when adding real executors; app metadata is not assumed to arrive in the execute request.

See [architecture](docs/architecture.md), [official API evidence](docs/salesforce-reference.md), and [PROJECT STATE](PROJECT_STATE.md).
