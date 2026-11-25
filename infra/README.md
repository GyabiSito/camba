# Isolated development services

Run these commands from the repository root:

```sh
docker compose -f infra/compose.dev.yml up -d --wait
docker compose -f infra/compose.dev.yml ps
```

This Compose project (`camba-v2-demo-pg`) runs PostgreSQL, Redis and Mailpit for the local demo. Only Mailpit's UI is published by this file, at `http://127.0.0.1:48025` by default. Its HTTP healthcheck uses `/readyz` on the internal web port `8025`.

The Docker API and worker deliver to `mailpit:1025` using SMTP without authentication or TLS. The SMTP port is not published on the host. For the full stack and isolated test setup, see [Development](../docs/DEVELOPMENT.md). Do not remove the demo volume just to run tests.

This file provides dependencies for the local API and Angular tooling. It does not deploy application containers or production infrastructure.

## CI scope check

Run `bash infra/ci/checks.test.sh` to exercise docs-only, API-only, first-push and invalid-head cases plus the required gate's success/failure combinations. The GitHub workflow leaves publication and deploy out of these pull-request checks. The required aggregate accepts only actual success for jobs selected by the diff and intentional skips for other jobs.
