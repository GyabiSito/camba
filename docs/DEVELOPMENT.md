# Develop Camba v2 in isolation

Use Docker Desktop or Docker Engine with Compose V2. Limit commands to the new Camba worktree and its Compose project; do not start the previous application.

## Complete development stack

Set `CAMBA_DEV_APP_KEY` in your local shell (or an ignored private environment file) to a dedicated generated Laravel key. Do not reuse the production key. For example, from the host with PHP installed:

```powershell
$env:CAMBA_DEV_APP_KEY = 'base64:' + (php -r "echo base64_encode(random_bytes(32));")
docker compose -f infra/compose.dev.yml -f infra/compose.dev.apps.yml up -d --build --wait
docker compose -f infra/compose.dev.yml -f infra/compose.dev.apps.yml exec api php artisan migrate
```

Install no commercial seed by default. The development stack includes PHP and Composer, a Redis queue worker and scheduler, MySQL, both Angular development servers and Mailpit. Admin, cart, orders and payment simulation need isolated synthetic data/tests; external credentials are not needed to boot.

| Local URL or address | Role |
| --- | --- |
| `http://127.0.0.1:43812` | Store (SSR development server) |
| `http://127.0.0.1:43813` | Admin (CSR development server) |
| `http://127.0.0.1:43811/up` | Laravel process liveness |
| `http://127.0.0.1:48025` | Mailpit messages from local work only |
| `127.0.0.1:43306`, `127.0.0.1:46379` | MySQL and Redis for local tools |

The frontends proxy Laravel paths on their own origins. Do not mix `localhost` and `127.0.0.1` in the same cookie journey. Override the documented `CAMBA_DEV_*_PORT` values if a port is taken, and use a different project name for a rehearsal. MySQL stores commerce state in `camba_v2`; an explicit dedicated test account/run can target `camba_v2_test`. Never use a test runner against any other schema.

To stop development without deleting data, run the same Compose file pair with `stop`. Do not run `down -v` on a non-disposable schema.

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

To exercise the independent database connections rather than just browser tabs, use MySQL 8.4 on loopback with a **disposable** `camba_v2_test` schema, a test-only APP_KEY, and no socket or database URL override. Run `php vendor/bin/phpunit --filter MySqlCatalogContentionTest` from `api/`. The runner holds an owner or product row and identifies both waiting connections before releasing it; the SQLite runner intentionally skips these cases.

Both admin upload flows keep the operation key in the current browser until the API confirms it. After a lost response, use **Reintentar carga**. After reopening the gallery, select the original files in the original order; the app verifies the bytes before sending. Reopening **Carga por fotos** shows links to affected drafts. No preview or photo bytes are stored in browser storage, and there is no need to compare saved thumbnails. Use a current browser on HTTPS or loopback, with site storage enabled. Lost confirmation while creating the product itself is separate: find the existing draft before creating it again.

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
