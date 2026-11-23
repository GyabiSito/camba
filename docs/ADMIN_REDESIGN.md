# Camba Admin: local access and verification

Open [Admin](http://127.0.0.1:4300/) and use the Admin account documented in [Demo local](../README.md#demo-local). Use a separate browser profile if you want to stay signed in as a buyer in [the storefront](http://127.0.0.1:4200/): cookies are scoped to the host, not the port.

## What caused “La sesión no está disponible”

The exact message reproduced at `http://localhost:4300/` in Chromium, not at `http://127.0.0.1:4300/` (including when the store was open in the same profile). The dev proxy reached Laravel on both origins. `GET /sanctum/csrf-cookie` returned 204 with `XSRF-TOKEN` and `laravel-session`, and the browser sent `X-XSRF-TOKEN`. But the actual login POST was 400 JSON on `localhost` and did not reach the follow-up session check. The active PostgreSQL API's Sanctum allowlist had only the two `127.0.0.1` origins. Without a recognized origin, Sanctum did not attach the session and `LoginRequest` rejected the POST before credential validation. This establishes the cause of the reproduced failure; it does not establish the hostname of the original incident.

The fix adds the exact `localhost` Admin port to the **local PostgreSQL Compose** allowlist. It changes no production configuration, credentials, database rows, gates or CSRF protections. The API was the only service recreated; normal startup found no pending migrations. The seeded admin was verified read-only against the active database (role, verified email and password hash). The canonical and alias Admin requests now complete with `204 → 204 → 200`; the buyer is denied `403` by the protected session endpoint. There was no unverified admin in the demo; the unverified case was verified with the existing isolated Laravel test, not by editing demo accounts.

## Checks to repeat

From `web/`, set `CAMBA_DEMO_PASSWORD` to the documented local fixture password and run:

```text
node e2e/admin-docker-access.mjs
node e2e/admin-docker-redesign.mjs
npm exec -- ng build admin --configuration production
npm exec -- playwright test --project admin --reporter=list
```

The Docker journey uses real demo data. Its CSV is an **unconfirmed preview** with one valid and one invalid row; it never applies the import or changes inventory. The regular Playwright suite uses a disposable SQLite fixture. If another session uses the default test ports, choose three different loopback ports with `CAMBA_E2E_API_PORT`, `CAMBA_E2E_ADMIN_PORT` and `CAMBA_E2E_STORE_PORT`.

The storefront home, catalog and known product detail on 4200 returned HTTP 200, and Chromium decoded the product image. Browser captures at 1440 and 390 px are under `web/test-results/admin-redesign/`; the live journey also checks for horizontal overflow at 320 px. The local `web/test-results/admin-redesign.zip` includes the before/after gallery (`admin-redesign/index.html`) and the original PNGs.

All 22 isolated Admin cases passed across two runs on the final files. Catalog and operations passed 16 cases before the disposable PHP listener on the default port became unavailable. The other 6 (shell, accessibility, and upload recovery) passed separately on dedicated loopback ports. The production Admin build and the live Docker journey passed independently.

See [Admin design guide](../web/projects/admin/DESIGN.md) for the Admin-only visual decisions and [task evidence](../odd/tasks/admin-redesign.md) for the verification log.
