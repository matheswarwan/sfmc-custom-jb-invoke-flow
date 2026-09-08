# Cloudflare deployment

Phase 3 uses server-side OAuth client credentials. See [OAuth setup](phase-3-oauth.md) for Cloudflare environment settings and Salesforce integration-user configuration.

Cloudflare Workers hosts both the built React assets and a lightweight adapter for the Phase 2 lifecycle/API stubs. No separate Express hosting is needed. The existing Express app remains available for local development.

```sh
npm ci
npx wrangler login
npm run deploy:check
npm test
npm run deploy
```

The Worker name is `sfmc-custom-jb-invoke-flow`. The deployment prints the account-specific workers.dev HTTPS URL. Open `/?demo=1` to try synthetic mappings; use the base URL as the custom activity endpoint in SFMC. `/config.json` generates execute/lifecycle URLs from the actual request origin. `/health` reports runtime disabled and whether the installed-package extension key is set.

Set the Worker variable `APPLICATION_EXTENSION_KEY` to the actual SFMC installed-package application extension key before configuring the activity in SFMC. This value is not a secret. Until supplied, the configuration retains its explicit placeholder and health reports packageConfigured false. The hosting deployment can still be used in demo mode.

Static assets use Cloudflare's asset binding; only config.json, health and activity paths run the Worker first. No frame-blocking header is added, so Journey Builder can embed the UI. Runtime execution returns 501, and publish/validate return 422 until the later runtime phases are implemented. Hosting does not make this scaffold production-ready for contact execution.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/) and [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
