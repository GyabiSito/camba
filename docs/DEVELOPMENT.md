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
- **Angular:** from `web/`, run `npm ci --ignore-scripts` and `npm exec -- ng build store` / `npm exec -- ng build admin`. The current apps are incomplete: these checks do not prove browsing, checkout, or WCAG requirements.
- **Images:** with Docker running, use `bash infra/ci/build-image.sh <api|store|admin> <local-name>`. The script builds and probes local artifacts without pushing.
- **Release:** local rehearsals and input configuration are described in [RELEASE.md](RELEASE.md). The [progress matrix](PROGRESS.md) distinguishes executed checks from pending user journeys and external checks.
