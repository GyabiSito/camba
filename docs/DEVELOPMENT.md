# Develop Camba v2 in isolation

Use Docker Desktop or Docker Engine with Compose V2. Limit commands to the new Camba worktree and its Compose project; do not start the previous application.

## Offline frontend fixtures

For the current shared demo, use the [complete Docker stack](#complete-development-stack). These optional, separate frontend fixtures are for offline UI work only. Run the two commands below from `web/` in separate terminals. Install the locked dependencies with `npm ci --ignore-scripts` if needed. Do not pass a proxy configuration or leave these standalone processes running alongside the shared demo.

| App | Command | URL | Demo email |
| --- | --- | --- | --- |
| Store | `npm run start:demo:store` | [Store](http://127.0.0.1:44822/tienda) · [Sign in](http://127.0.0.1:44822/cuenta) | `cliente.diseno@camba.test` |
| Admin | `npm run start:demo:admin` | [Sign in](http://127.0.0.1:44823/ingresar) | `admin.diseno@camba.test` |

Both demo passwords are `CambaDemo2026!`. These credentials are public fixtures and work only in their respective demo apps. Guests can browse the read-only catalog; sign in as the demo buyer to review saved addresses, the preloaded cart, checkout and seeded orders. The local demo server shares the synthetic buyer state between browser contexts until it restarts. Signing out clears only the session. For the review launch and reset commands, see [Demo local](../README.md#demo-local). Payments, registration, catalog writes and emails are not simulated in these screens.

To return to API mode, stop using the demo URLs and start the [complete development stack](#complete-development-stack). The normal `development` and `production` Angular configurations do not include the demo data or accounts. With both demo apps running, run `node --test e2e/frontend-demo.mjs` from `web/` for the browser smoke check.

## Complete development stack

Use the [local demo commands and fixture logins](../README.md#demo-local) to launch `camba-v2-demo-pg`. Its ignored `infra/dev/demo.env.local` holds a dedicated Laravel key. It must not use a production key. The application starts after PostgreSQL and Redis, with migrations applied before the API exposes readiness. The explicit demo seeder manages synthetic content only; the normal default seeder stays empty.

| Local URL or address | Role |
| --- | --- |
| `http://127.0.0.1:4200` | Store (optimized SSR build with local editorial photography) |
| `http://127.0.0.1:4300` | Admin (CSR development server) |
| `http://127.0.0.1:48025` | Mailpit messages from local work only |
| `http://api:8000/ready`, `postgres:5432`, `redis:6379` | Internal API readiness, PostgreSQL and Redis |

The frontends proxy Laravel on their own origins. Do not mix `localhost` and `127.0.0.1` in a single cookie journey. Separate browser profiles keep the demo buyer and admin sessions independent. PostgreSQL 18.7 is pinned by image digest and joins only an internal Docker network with no published port. The three Laravel roles share that network and the database; this demo does not reuse MySQL or any existing application volume.

The Docker store builds with `production,editorial,no-payment`: it copies the local editorial photos without enabling frontend mock data, and offers order status checks without starting a payment. The offline `demo` configuration enables the editorial photos and fixtures, also without a payment provider. Rebuild just `store` to update its sources; the admin remains on its development server.

With the seeded stack running, run `node e2e/storefront-unified-docker.mjs` from `web/` to check both review widths, the checkout and all three seeded order states without placing an order. The separate `node e2e/docker-editorial-parity.mjs` check adds and removes only the editorial shirt; run it against the untouched two-line demo cart when nobody else is editing it.

To stop development without deleting data, run the same Compose file pair with `stop`. Do not run `down -v`.

### PostgreSQL checks

Run database integration checks in a separate Compose project. This creates an empty disposable PostgreSQL volume and its own internal network; it does not connect to, reset or reuse the running `camba-v2-demo-pg` database or volume. The project's development PHP image is used only as a test runner.

```powershell
$testProject = 'camba-v2-pg-integration'
$testNetwork = "${testProject}_postgres-private"
$testApi = (Resolve-Path api).Path
docker compose -p $testProject -f infra/compose.dev.yml up -d --wait postgres
$testEnv = @('-e', 'APP_ENV=testing', '-e', 'APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    '-e', 'CACHE_STORE=array', '-e', 'SESSION_DRIVER=array', '-e', 'MAIL_MAILER=array', '-e', 'QUEUE_CONNECTION=sync',
    '-e', 'DB_CONNECTION=pgsql', '-e', 'DB_URL=', '-e', 'DB_HOST=postgres', '-e', 'DB_PORT=5432',
    '-e', 'DB_DATABASE=camba_v2_demo_test', '-e', 'DB_USERNAME=camba_v2', '-e', 'DB_PASSWORD=camba-local-db')
$apiRunner = @('run', '--rm', '--network', $testNetwork, '-v', "${testApi}:/var/www/html", '-w', '/var/www/html',
    '--entrypoint', 'php') + $testEnv + @('camba-v2-dev-php-pg')
docker @apiRunner vendor/bin/phpunit --do-not-cache-result --filter '~^(?!Tests\\Feature\\Demo\\)~'
$seedEnv = @('-e', 'APP_ENV=testing', '-e', 'APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    '-e', 'CACHE_STORE=array', '-e', 'SESSION_DRIVER=array', '-e', 'MAIL_MAILER=array', '-e', 'QUEUE_CONNECTION=sync',
    '-e', 'DB_CONNECTION=pgsql', '-e', 'DB_URL=', '-e', 'DB_HOST=postgres', '-e', 'DB_PORT=5432',
    '-e', 'DB_DATABASE=camba_v2_demo_seed_test', '-e', 'DB_USERNAME=camba_v2', '-e', 'DB_PASSWORD=camba-local-db')
$seedRunner = @('run', '--rm', '--network', $testNetwork, '-v', "${testApi}:/var/www/html", '-w', '/var/www/html',
    '--entrypoint', 'php') + $seedEnv + @('camba-v2-dev-php-pg')
docker @seedRunner vendor/bin/phpunit --do-not-cache-result tests/Feature/Demo
cd web
node e2e/postgres-local-demo.mjs
```

The first PHPUnit command runs all API features on real PostgreSQL, except the demo seeder group which uses its separate seed database. It includes all six independent-connection contention cases. The browser smoke test opens both local ports against the shared development stack and leaves the prepared cart intact. Never run PHPUnit against either database in the shared demo project.

To keep the isolated PostgreSQL database for another run, leave the test project stopped. Do not use `down -v` with the shared demo project; only remove the disposable `camba-v2-pg-integration` project after confirming its name and scope.

### Live store, admin and Mailpit journeys

Run these from `web/` with the seeded Docker stack already up. They use the current Laravel API and create clearly named QA records; they do not use or clear the seeded buyer's cart. Use the same Store hostname as the local `APP_URL` when following a signed verification link.

```powershell
$env:CAMBA_DEMO_PASSWORD = 'CambaDemo2026!'
node e2e/storefront-docker-customer.mjs
node e2e/storefront-docker-commerce.mjs
```

The customer check creates separate accounts and reads only their Mailpit messages. The commerce check publishes a QA product, creates one pending order under a QA buyer and verifies that a retry does not reserve stock twice. It keeps the order and uses `test-results/storefront-docker-api/commerce-state.json` to resume the same check; keep that file to reuse the records. Reports and captures stay under the ignored `web/test-results/` directory. Neither check sends mail outside Mailpit or initiates a provider payment.

Docker uses the explicit local DSN `smtp://mailpit:1025`. A blank `MAIL_URL` is not equivalent to omitting it: Laravel can accept the registration but fail the queued notification with `Unsupported mail transport []`.

## Native checks

- **API:** from `api/`, install locked Composer dependencies, then run `php vendor/bin/pint --test`, `php vendor/bin/phpunit` with a disposable `APP_KEY` and the PDO driver(s), and `postman spec lint openapi.yaml --issueType syntax --no-report-events`.
- **Angular:** from `web/`, run `npm ci --ignore-scripts` and `npm exec -- ng build store` / `npm exec -- ng build admin`. These builds do not prove browser interactions or accessibility.
- **Images:** with Docker running, use `bash infra/ci/build-image.sh <api|store|admin> <local-name>`. The script builds and probes local artifacts without pushing.
- **Release:** local rehearsals and input configuration are described in [RELEASE.md](RELEASE.md). The [progress matrix](PROGRESS.md) distinguishes executed checks from pending user journeys and external checks.

## Browser checks and captures

Install PHP 8.4 with SQLite PDO, GD, EXIF and ZIP, plus the locked dependencies in `api/` (`composer install`). From `web/` with the locked npm dependencies installed:

```sh
npm run test:e2e:install
npm run test:e2e
```

Playwright starts both Angular applications, Laravel and a queue worker on loopback with a temporary SQLite database, synthetic users/catalog, and no real payment or mail provider. It does not start or change the development Compose stack. Set the distinct numeric variables `CAMBA_E2E_API_PORT`, `CAMBA_E2E_ADMIN_PORT` and `CAMBA_E2E_STORE_PORT` if the defaults `43819–43821` are already in use. Use `npm run test:e2e -- --project=store` or `--project=admin` to restrict assertions.

Captures and failure traces are in `web/test-results/`; open the local HTML report with `npm exec -- playwright show-report`. These artifacts are ignored by Git. Successful captures do not mark the Impeccable phase approved; read [the progress matrix](PROGRESS.md#acceptance-matrix) for the current evidence and limits.

For the second-engine accessibility checks, install the locked Firefox with `npm exec -- playwright install firefox`, set `CAMBA_E2E_BROWSER=firefox`, then run `npm run test:e2e -- e2e/admin-store-accessibility.spec.ts`. The default remains Chromium. The checks cover computed contrast, keyboard focus, form alerts, reduced motion, 200% text size and reflow at 320 CSS px. They do not audit spoken announcements.

### Cart contention and photo recovery

The six PostgreSQL contention tests above exercise independent application processes and database connections on the target engine. They identify both waiting workers through `pg_stat_activity` and `pg_blocking_pids()` before releasing the held row lock; do not substitute SQLite or skip these cases.

Both admin upload flows keep the operation key in the current browser. After an uncertain upload, **Reintentar carga** sends the same ordered files with the same key. If the original files are unavailable, use **Cerrar carga pendiente** instead. The server keeps already committed photos and prevents a late upload with that key from appending. Reopening **Carga por fotos** links to the exact draft.

The interface distinguishes three results:

- **Close unconfirmed:** retry the same close. Do not clear the site's reservation or start a replacement upload.
- **Server closed, browser cleanup pending:** restore site-storage access and select **Reintentar recuperación**. The acknowledgement is stored separately by operation key so another tab or a reload can resume without uploading files or repeating the close. If the gallery refresh fails, or storage cannot persist or release the reservation, recovery stays pending. After reload, if the acknowledgement could not be written, repeating the same close is safe.
- **Recovery complete:** new photos can be selected, unless another tab already reserved a separate operation. Cleanup never removes that newer reservation. The small acknowledgement for the closed key is retained so a suspended tab cannot recreate the reservation after resuming.

Site storage is required. IndexedDB serializes reservations when Web Locks is unavailable. Without SubtleCrypto, an exact retry needs the original files still open in memory; otherwise, close the pending upload first. No photo bytes or previews are persisted in browser storage. Use HTTPS in production. Lost confirmation while creating the product itself is separate: find the existing draft before creating it again.

### Delivered account links and idle-session expiry

The standard run sends no email outside the Laravel array transport. For real local SMTP delivery, run a disposable Mailpit in a separate terminal:

```powershell
docker run --rm --name camba-e2e-local-mailpit -p 127.0.0.1:43972:1025 -p 127.0.0.1:43973:8025 axllent/mailpit:v1.31.5
```

From `web/`, set `CAMBA_E2E_MAILPIT_SMTP_PORT=43972`, `CAMBA_E2E_MAILPIT_HTTP_PORT=43973` and `CAMBA_E2E_SHORT_SESSION=1`, then run `npm run test:e2e -- --project=store e2e/store-account.spec.ts`. Stop the Mailpit terminal afterward. These opt-in scenarios query only the loopback sink and wait for an actual one-minute idle expiry in the disposable fixture. They do not change production session policy or use an external SMTP provider.

### Reproduce the mobile storefront audit

Use the same synthetic API and the **compiled SSR server**, not `ng serve`: Vite injects a development client and source maps even with production optimization. Run each server in a separate terminal from `web/` with loopback-only ports:

| Command | Environment |
| --- | --- |
| `node e2e/fixtures/start-api.mjs` | `CAMBA_E2E_API_PORT=43859`, `CAMBA_E2E_ADMIN_PORT=43860`, `CAMBA_E2E_STORE_PORT=43863` |
| `npm exec -- ng build store`, then `node dist/store/server/server.mjs` | `HOST=127.0.0.1`, `PORT=43862`, `NG_ALLOWED_HOSTS=127.0.0.1,localhost`, `CAMBA_SSR_API_ORIGIN=http://127.0.0.1:43859`, `CAMBA_PUBLIC_STORE_ORIGIN=http://127.0.0.1:43863` |
| `node e2e/fixtures/performance-proxy.mjs` | `CAMBA_E2E_STORE_PORT=43863`, `CAMBA_E2E_API_PORT=43859`, `PORT=43862` |

Set `CHROME_PATH` to the path printed by `node -e "console.log(require('playwright').chromium.executablePath())"`. After checking `http://127.0.0.1:43863/` returns 200 and running `node e2e/fixtures/check-store-encoding.mjs`, run:

```sh
npm exec --yes --package=lighthouse@13.6.0 -- lighthouse http://127.0.0.1:43863/ --only-categories=performance,accessibility,seo --output=json --output-path=./test-results/lighthouse-mobile.json --chrome-flags=--headless --quiet
```

The Angular initial budget is 500 kB warning / 1 MB error per application. Inspect actual WebP bytes in the report; target at most 250 kB for the above-fold hero on mobile, use smaller derivatives for listings, and keep LCP at or below 2.5 s and CLS at or below 0.10 in the mobile lab. This isolated report is not real-user INP, production edge timing, or a WCAG certification. Stop the three lab servers after the run.

See the [five-run baseline and compressed comparison](LOCAL_PERFORMANCE.md) for methodology and retained JSON, traces and network files.

## Codex and Engram project binding on Windows

If the Codex daemon log (`%USERPROFILE%\.codex\app-server-daemon\daemon.stderr.log`) identifies `PreToolUse` refusing an Engram call because it cannot confirm the host session, check the workspace first. The supported resolver `engram hook resolve-hook-project` on stdin (JSON field `cwd`) resolves `C:\Users\Josec\camba` to `camba` but did not resolve the home directory to that project. Resume the same Codex task from the repository workspace with `codex resume --cd C:\Users\Josec\camba` and let the host dispatch `SessionStart`. Do not disable the guard, manually register a session, or guess an ID. A shell command running in the right folder does not change the current Codex task's registered workspace.
