# PROJECT STATE — Phase 2

**Project:** Journey Action Hub
**Version:** 0.2.0
**Status:** Phase 2 implemented and locally verified; live SFMC acceptance pending.
**Delivery date:** 2026-09-08

## Baseline

Reconstructed the Phase 1 monorepo described in the referenced conversation because its downloadable source was unavailable. The original artifact was not modified or compared. This delivery contains the complete reconstructed source and Phase 2 implementation.

## Completed

- React/TypeScript mapper with explicit mock Salesforce connection and Flow schema.
- Real bundled Postmonger 0.0.16; ready/initActivity, trigger event request/response, native clickedNext and updateActivity.
- Recursive scalar field discovery, duplicate handling, null/missing schemas, timeout/retry states, and unsupported collection/path handling.
- Required mappings, numeric validation, stale reference detection, and safe handling of unsupported saved configurations.
- Full activity preservation, execute.inArguments construction, metadata persistence, legacy loading, and idempotent reopening.
- Local demo with synthetic fields and browser-only persistence.
- Reconstructed Express lifecycle/executor scaffolding, explicitly disabled for runtime use.
- README, architecture, official Salesforce references, deployment notes, and tenant acceptance checklist.

## Verification

- Shared package TypeScript build: passed.
- API TypeScript build: passed.
- Web TypeScript and Vite production build: passed.
- Automated suite: 23 tests passed, 0 failed.
- Browser demo: rendered correctly; required fields block Done; text-to-number mapping rejected; decimal mapping enables Done; save and reload restore mappings.
- Dependency installation audit: reported 0 vulnerabilities at install time.
- No live SFMC tenant, JWT, Salesforce OAuth, or Flow execution test performed. Docker build not run.

## Decisions and constraints

Journey Builder resolves Event expressions into execute.inArguments at runtime. No per-contact Entry DE lookup. Source schemas are not guaranteed by Postmonger, so absence blocks mapping rather than fabricating fields. Recursive adapters and nested paths require testing against the actual Entry Source response. Unsupported name punctuation is excluded conservatively. Native Cancel/close is used; no invented cancel event.

## Next phase

Implement Salesforce OAuth, secure connection storage, live Flow/input discovery, and authenticated SFMC metadata fallback. Define durable runtime configuration transport/lookup, authenticate lifecycle and execute requests, implement executors and error/idempotency behavior, then run tenant end-to-end acceptance before enabling activation.

## Package

The adjacent journey-action-hub-phase-2.zip includes source, lockfile, docs, tests and compiled builds. Dependencies and secrets are excluded. Install with npm ci; build with npm run build; test with npm test. No deployment was performed. The Phase 2 source is maintained at https://github.com/matheswarwan/sfmc-custom-jb-invoke-flow on main; generated builds remain in the downloadable package and are excluded from Git.

## Cloudflare hosting preparation

Worker adapter, deployment configuration, deployed-origin config.json URLs, health check and deployment documentation added. All builds, 23 tests and Wrangler deployment dry-run pass. Actual deployment is pending Cloudflare sign-in; no hosted URL has been created yet.
