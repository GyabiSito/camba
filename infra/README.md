# Isolated development services

Run these commands from the repository root:

```sh
docker compose -f infra/compose.dev.yml up -d --wait
docker compose -f infra/compose.dev.yml ps
```

This Compose project (`camba-demo-pg`) runs PostgreSQL, Redis and Mailpit for the local demo. Only Mailpit's UI is published by this file, at `http://localhost:8025` by default (`CAMBA_DEV_MAIL_UI_PORT`). Its HTTP healthcheck uses `/readyz` on the internal web port `8025`; messages are stored in the local `mailpit-data` volume.

The Docker API and worker deliver to `mailpit:1025` using SMTP without authentication or TLS. The SMTP port is not published on the host. For the full stack and isolated test setup, see [Development](../docs/DEVELOPMENT.md). Do not remove the demo volume just to run tests.

The local application overlay publishes the API at `http://localhost:8000` by default (`CAMBA_DEV_API_PORT`). Both host bindings use IPv4 loopback only. These files do not deploy production infrastructure.

## CI scope check

Run `bash infra/ci/checks.test.sh` to exercise docs-only, API-only, first-push and invalid-head cases plus the required gate's success/failure combinations. The GitHub workflow leaves publication and deploy out of these pull-request checks. The required aggregate accepts only actual success for jobs selected by the diff and intentional skips for other jobs.
