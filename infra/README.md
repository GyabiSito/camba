# Isolated development services

Run these commands from the repository root:

```sh
docker compose -f infra/compose.dev.yml up -d --wait
docker compose -f infra/compose.dev.yml ps
```

This Compose project (`camba-v2-dev`) publishes MySQL on `127.0.0.1:43306`, Redis on `127.0.0.1:46379`, and Mailpit on SMTP `127.0.0.1:41025` / UI `http://127.0.0.1:48025`. The MySQL volume and database names are unique to Camba v2 development. The default credentials are public, local-only values; never use them in production or publish these ports on another interface.

Set the API development `DB_PASSWORD` to `CAMBA_DEV_DB_PASSWORD` (default `camba-local-db`). Use `camba_v2` for the application and `camba_v2_test` only for the suite. Mail must use the local sink (`MAIL_MAILER=smtp`, `MAIL_HOST=127.0.0.1`, `MAIL_PORT=41025`). Stop the dev services with `docker compose -f infra/compose.dev.yml stop`. Do not remove the volume just to run tests.

This file provides dependencies for the local API and Angular tooling. It does not deploy application containers or production infrastructure.

## CI scope check

Run `bash infra/ci/checks.test.sh` to exercise docs-only, API-only, first-push and invalid-head cases plus the required gate's success/failure combinations. The GitHub workflow leaves publication and deploy out of these pull-request checks. The required aggregate accepts only actual success for jobs selected by the diff and intentional skips for other jobs.
