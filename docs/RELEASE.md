# Release contract and rehearsal

The release executor is for automated deployment on Linux. Do not invoke it manually against the current Camba installation. Only the isolated rehearsal has been run; the production edge, GitHub environment, and external credentials are not configured.

## Inputs

- A stable, increasing integer from the **same publishing workflow** (for example, its GitHub run number). Retries reuse that sequence and the same image digests.
- Each changed component's tested image as `api=registry/name@sha256:…`, `store=…`, or `admin=…`. The first release needs all three digests. Publishing must not use mutable tags as deployment inputs.
- `CAMBA_RELEASE_DIR`: an absolute protected, persistent directory on the release filesystem. It contains the lock, `current.env` and `previous.env`, never provider secrets.
- `CAMBA_RUNTIME_ENV_FILE`: an absolute path to the separate protected Compose runtime settings. Configure provider secrets and backup prerequisites as in [backend operations](OPERATIONS_BACKEND.md).
- `CAMBA_COMPOSE_FILE`: an absolute path to the installed release Compose file that contains all three application groups. `CAMBA_COMPOSE_PROJECT` defaults to `camba-v2`; never supply the legacy project name.
- `CAMBA_EDGE_COMPOSE_FILE`: optional absolute path to the installed `infra/compose.edge.yml` overlay. Set `CAMBA_EDGE_NETWORK` in the protected Compose configuration to the existing edge network and `CAMBA_STORE_ALLOWED_HOSTS` to the exact publicly served storefront hosts. Do not use wildcards.

The release account needs Docker Compose with `up --wait`, Bash, and `flock`. Start PostgreSQL and Redis and confirm their health separately for the first installation. PostgreSQL is initialized with the distinct administrator credential `CAMBA_DB_ADMIN_PASSWORD`; provision the application login and database ownership before running migrations. Keep `CAMBA_DB_PASSWORD` out of command arguments: pass it into `psql`'s environment and read it with `\getenv` from SQL supplied on stdin. These services are not updated or restarted by this executor.

## What it does

1. Serializes all executions under one persistent lock and ignores older per-component releases.
2. Validates Compose and pulls only affected services at their digest; there is no build on the host.
3. Runs the isolated one-shot migration only for API changes.
4. Applies the affected services with `--no-deps` and waits for their configured health checks. On failure it attempts to restore their prior images without reversing database migrations.
5. Atomically replaces the current version manifest after successful service checks. The previous manifest preserves the rollback reference. A failed first release has no previous image; inspect isolated services before retrying.

The check in `infra/release/apply.test.sh` uses a fake Docker CLI in a temporary directory. It demonstrates exact service selection, a stale release, migration behavior, validation of immutable references and failure rollback. It does not demonstrate a real edge deployment, backup/restore, or a healthy all-service Compose release.

## GitHub and edge prerequisites

`.github/workflows/checks.yml` validates the selected components and always resolves the required aggregate. On a successful main push, repository variable `CAMBA_RELEASE_ENABLED=true` opts into GHCR publication and wire-up; leave it unset until UI and deployment acceptance are complete. The publish job validates each affected local image before pushing its SHA tag, then hands the resulting digest to the deploy job. No image is rebuilt on the server.

Protect the `camba-production` GitHub environment. Supply secrets `CAMBA_DEPLOY_TARGET` (restricted SSH account at a DNS hostname), `CAMBA_DEPLOY_KEY` (dedicated private key), `CAMBA_DEPLOY_KNOWN_HOSTS` (verified exact host key); optional environment variable `CAMBA_DEPLOY_PORT` defaults to 22. Give the server pull-only GHCR access to the three images. Place this repository's executor and Compose files in an operator-owned release directory, and provide `/usr/local/bin/camba-ci-release` as the restricted entry point that sets the above paths and forwards the validated arguments to the executor. Pin the authorized deploy key to that command and forbid agent forwarding, PTY and arbitrary port forwarding. Changes to the executor or edge configuration require the site's controlled bootstrap/configuration procedure; app deploys alone do not overwrite those files.

The edge should route same-origin `/api/`, `/sanctum/`, `/email/verify/` and `/storage/` to `camba-v2-api:8080` on both frontends. On the storefront route other requests to `camba-v2-store:4000`; on the admin host route them to `camba-v2-admin:8080`. Overwrite trusted proxy headers, constrain the accepted public hosts, preserve query strings (especially the literal `data.id` webhook field), and agree on a source-IP trust policy before relying on per-IP limits. Do not rebind global ports or change existing application vhosts from development.
