# PostgreSQL production candidate

Camba's development, production and integration paths use the same pinned PostgreSQL 18.7 image. SQLite remains an isolated test tool, not a deployed database. The production API ingress proxies PHP-FPM; only the PHP-FPM, worker, scheduler and migrator containers get the PostgreSQL application settings. PostgreSQL has no published port.

## Run the production definitions locally

From a clean candidate checkout on Windows with local Linux Docker, Compose with support for file-backed configs and <code>up --wait</code>, and the workspace Playwright dependencies and Chromium installed:

~~~powershell
powershell.exe -File infra/rehearsal/postgresql.ps1 -StorePort 44970 -AdminPort 44971
~~~

The script builds API, Store and Admin from an archive of the checked-out SHA and checks their OCI revision labels. It creates a uniquely named Compose project with fresh volumes and prints its environment file and loopback URLs. The documented rehearsal overlay changes only ingress and the synthetic HTTP session setup; it is never installed on the VPS. Wait for the final result: the script checks migrations, PostgreSQL roles, the reference-only state, worker/scheduler processes, the browser checkout and Admin lookup, and persisted IDs, sequences, stock and exact cents. Only after checking reference-only initialization does it insert the synthetic account and product. It leaves the candidate running for inspection without changing demo containers, data or volumes. The printed stop command targets only that project. No registry push or VPS operation is involved.

## Single VPS: initialize an empty installation

These commands are for a **fresh PostgreSQL destination**, not a migration of existing MySQL data. Install the tested <code>infra/compose.prod.yml</code> and <code>infra/compose.edge.yml</code> as <code>/etc/camba/compose.prod.yml</code> and <code>/etc/camba/compose.edge.yml</code>. Install the reverse proxy and existing external edge network before exposing Camba. The proxy routes Store/Admin to the Compose edge aliases and <code>/api/*</code>, <code>/sanctum/*</code>, <code>/email/*</code> and <code>/storage/*</code> to <code>camba-v2-api:8080</code>, forwarding the public host and HTTPS scheme.

Do not use these first-install commands against an existing Compose project. During a data cutover, keep the new stack off the live proxy network until validation is complete; two stacks must not claim the same edge aliases.

Configure <code>/etc/camba/compose.env</code> with permissions restricted to the operator:

- <code>CAMBA_API_IMAGE</code>, <code>CAMBA_STORE_IMAGE</code>, <code>CAMBA_ADMIN_IMAGE</code>: immutable registry digests built and labeled for the chosen source SHA. Do not build or pull source on the host.
- <code>CAMBA_APP_KEY</code>: existing protected Laravel key for a migration that preserves encrypted data; a new generated key for an empty installation only.
- <code>CAMBA_APP_URL</code>, <code>CAMBA_ADMIN_URL</code>: actual HTTPS origins. Set <code>CAMBA_SANCTUM_DOMAINS</code> to the corresponding hostnames (and ports if non-default), <code>CAMBA_STORE_ALLOWED_HOSTS</code> to the exact Store host(s), and <code>CAMBA_EDGE_NETWORK</code> to the pre-existing proxy network.
- <code>CAMBA_DB_ADMIN_PASSWORD</code> and <code>CAMBA_DB_PASSWORD</code>: separate strong credentials. Only PostgreSQL gets its administrator password. Do not put either in command-line arguments. Existing initialized PostgreSQL credentials are not rotated by editing Compose variables.
- <code>CAMBA_API_ENV_FILE</code>: path to the protected Laravel mail, payment and store configuration, normally <code>/etc/camba/api.env</code>. Production Compose fixes the Laravel driver, host, port, database and application role; a MySQL <code>DB_URL</code> or <code>DB_*</code> value in that file cannot override them.

On the VPS, in Bash, after separately authorizing release and preparing those files and digests, use a shell without conflicting exported <code>CAMBA_*</code> values:

~~~bash
dc() {
  docker compose --project-name camba-v2 --env-file /etc/camba/compose.env \
    -f /etc/camba/compose.prod.yml -f /etc/camba/compose.edge.yml "$@"
}
dc config --quiet &&
  dc pull postgres redis api store admin &&
  dc up -d --wait postgres redis &&
  dc exec postgres psql -X -U postgres -d postgres
~~~

Only on the newly initialized destination, at the <code>psql</code> prompt, use the application password from the protected environment file when prompted:

~~~sql
\set ON_ERROR_STOP on
CREATE ROLE camba_v2 LOGIN;
\password camba_v2
ALTER DATABASE camba_v2 OWNER TO camba_v2;
\q
~~~

Back in Bash:

~~~bash
(
  set -euo pipefail
  dc --profile release run --rm --no-deps migrate
  dc --profile release run --rm --no-deps migrate \
    php artisan db:seed --class=GeographySeeder --force --no-interaction
  dc up -d --wait api-fpm api worker scheduler store admin
  dc exec -T api-fpm php artisan migrate:status --no-interaction
  dc exec -T api curl --fail --silent http://127.0.0.1:8080/ready
  dc top worker scheduler
  dc ps
)
~~~

Stop on any failed command; do not start the app after a failed migration. Geography is the only explicit seed. Do not run the demo seeder or the rehearsal fixture on the VPS. For later releases reuse the PostgreSQL volume and roles, back up before applying new migrations, and use the existing [release procedure](RELEASE.md); do not repeat the first-install role creation.

## Existing MySQL installation

The stock MySQL data directory is **not** a PostgreSQL volume. Keep the old MySQL service, backup and media intact and plan a separate write freeze and switch at the reverse proxy. Take an authorized, coherent export and corresponding media snapshot, audit the source schema, and rehearse the conversion to a different PostgreSQL project before routing production traffic. This step requires the actual source export, not an archival or academic SQL dump.

- For v1, use the [legacy catalog planner and disposable PostgreSQL staging flow](../api/docs/legacy-migration.md) with reviewed classifications, residual stock and legacy redirects. Its draft staging is not an account, order, payment or whole-database importer.
- For a v2 MySQL export, apply the v2 PostgreSQL migrations first, then rehearse a schema-aware conversion with explicit primary and foreign IDs. Check per-table counts, SKU/stock and reservations, order/item/payment balances in integer cents, and the relationship and media integrity of the export. Match sequence state to imported IDs and verify a new insert does not collide. Keep the original Laravel application key if migrating encrypted v2 records. Do not import sessions, temporary jobs or retries blindly, or trigger real emails, refunds or payment lookups in a rehearsal.
- Do not overwrite a PostgreSQL database that has handled new writes with an old MySQL snapshot. Image rollback alone is not a data rollback or a switch between engines.

No suitable current export with approved data scope and matching media was available locally. The historical v1 SQL archive found in the legacy workspace has a different schema and was not loaded. Live data conversion and reconciliation remain pending that export; only synthetic data is used during local rehearsals.
