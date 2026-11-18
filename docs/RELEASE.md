# Release contract and rehearsal

The release executor is for automated deployment on Linux. Do not invoke it manually against the current Camba installation. Only the isolated rehearsal has been run; the production edge, GitHub environment, and external credentials are not configured.

## Inputs

- A stable, increasing integer from the **same publishing workflow** (for example, its GitHub run number). Retries reuse that sequence and the same image digests.
- Each changed component's tested image as `api=registry/name@sha256:…`, `store=…`, or `admin=…`. The first release needs all three digests. Publishing must not use mutable tags as deployment inputs.
- `CAMBA_RELEASE_DIR`: an absolute protected, persistent directory on the release filesystem. It contains the lock, `current.env` and `previous.env`, never provider secrets.
- `CAMBA_RUNTIME_ENV_FILE`: an absolute path to the separate protected Compose runtime settings. Configure provider secrets and backup prerequisites as in [backend operations](OPERATIONS_BACKEND.md).
- `CAMBA_COMPOSE_FILE`: an absolute path to the installed release Compose file that contains all three application groups. `CAMBA_COMPOSE_PROJECT` defaults to `camba-v2`; never supply the legacy project name.

The release account needs Docker Compose with `up --wait`, Bash, and `flock`. Start MySQL and Redis and confirm their health separately for the first installation. They are not updated or restarted by this executor.

## What it does

1. Serializes all executions under one persistent lock and ignores older per-component releases.
2. Validates Compose and pulls only affected services at their digest; there is no build on the host.
3. Runs the isolated one-shot migration only for API changes.
4. Applies the affected services with `--no-deps` and waits for their configured health checks. On failure it attempts to restore their prior images without reversing database migrations.
5. Atomically replaces the current version manifest after successful service checks. The previous manifest preserves the rollback reference. A failed first release has no previous image; inspect isolated services before retrying.

The check in `infra/release/apply.test.sh` uses a fake Docker CLI in a temporary directory. It demonstrates exact service selection, a stale release, migration behavior, validation of immutable references and failure rollback. It does not demonstrate a real edge deployment, backup/restore, or a healthy all-service Compose release.
