# Phase 2 verification

## Automated

Run `npm run build` and `npm test` from the root. Builds include shared declarations, API TypeScript, web TypeScript, and Vite assets. Tests exercise pure mapping transformations and the same session controller used by the React application with a fake event transport.

Coverage: flat/nested schemas; DE descriptors; absent/malformed metadata; unsafe field paths; collections/cycles; deduplication; required and numeric validation; stale event references; argument/config preservation; legacy load; idempotent round-trip; unsupported saved configurations; lifecycle initialization, Done, invalid save, duplicate events, retry and timeouts.

## Local UI acceptance

1. Open `?demo=1`. Confirm the synthetic-data banner and mock labels.
2. Map the required ContactId and EmailAddress inputs. Done becomes available.
3. Map OrderAmount to a text field. Confirm the error and disabled Done; select decimal OrderAmount to recover.
4. Select Done and reload. All mappings return. Clear an optional mapping, save, and reload; it remains empty.
5. Open without demo mode outside Journey Builder. Confirm it waits and reports no host response instead of inventing fields.

## Live SFMC acceptance — requires tenant access

1. Host the build over HTTPS and configure package/endpoint placeholders; add the activity to a draft Journey with an Entry Source.
2. Confirm ready/initActivity and requestTriggerEventDefinition/requestedTriggerEventDefinition in a test harness or browser debugger. Capture a sanitized schema only; do not record tokens or contact values.
3. Check actual field names and event key against the Entry Source. If metadata is absent, confirm the unavailable state and no fabricated mapping choices.
4. Map required fields and use native Journey Builder Done. Reopen; verify mappings and untouched execute/lifecycle URLs, outcomes and metadata.
5. Cancel an edit and reopen; previous mappings should remain. Save the Journey, reload it and reopen the activity to verify persisted state.
6. Change Entry Source and reopen. Old bindings must be flagged until remapped. Check a nested field against real source semantics if offered.
7. Confirm publish/validate fail explicitly because runtime is not implemented. Do not activate this Phase 2 scaffold for real contacts.

Live tenant checks, authenticated field lookup, and real runtime execution are not claimed by the local automated suite.
