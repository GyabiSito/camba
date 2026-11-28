# Run and check the Camba backend

One CI-built API image runs Nginx, PHP-FPM, the queue worker, the scheduler, and migrations. The production Compose file has no application build step, source mounts, or published host ports. It does not replace the TLS edge, deploy workflow, or frontend services.

## Release order

The automated release must serialize these steps and stop on any failure. For a direct invocation, confirm the selected project does not belong to the legacy installation, then export the approved name as `CAMBA_COMPOSE_PROJECT`. Pass that same variable to `-p`: Docker Compose still interpolates `name` even when `-p` is present. If using the edge overlay, also set the independently approved `CAMBA_EDGE_ALIAS_PREFIX` in the protected Compose environment file.

1. Resolve `CAMBA_API_IMAGE` to the tested immutable image reference, and pull it. On first setup, also start the pinned PostgreSQL and Redis services and wait for their checks. Provision `camba` as a non-superuser login with `CAMBA_DB_PASSWORD`, then make it the owner of the `camba` database before migration. Keep the separate `postgres` administrator password in `CAMBA_DB_ADMIN_PASSWORD`; do not place either password in a command argument.
2. Run `docker compose -p "$CAMBA_COMPOSE_PROJECT" --env-file <protected-release-env> -f infra/compose.prod.yml --profile release run --rm migrate` **once per release**. The one-shot job uses the same image and configuration as the app. It runs `migrate --force --isolated=75`; a held migration lock fails the job rather than pretending it ran. No container runs migrations or seeds on startup.
3. Recreate only `api`, `api-fpm`, `worker`, and `scheduler` from the verified reference. Check `GET /ready` through Nginx and confirm the worker and scheduler are running without restart loops before marking the reference deployed. A healthy response checks connectivity, not migration completion, so it does not replace step 2.

For an image rollback, keep the release's project and edge prefix and switch only the image manifest. Run `config --quiet` with the same project, Compose files and previous manifest before restoring the images. Do not restart PostgreSQL or Redis. Use forward-compatible migrations; restoring the image does not revert the schema, queued work, media, or orders. Back up the data volumes before the initial cutover and rehearse restoring them in a separate project. Do not destroy volumes or reset the database during an update.

## Runtime configuration

Keep release environment files outside Git with access restricted to the release operator. Do not print resolved Compose configuration or dump container environments with real secrets.

| Release variable | Required value |
| --- | --- |
| `CAMBA_COMPOSE_PROJECT` | Approved project name, with no production default. If using the edge overlay, also reserve and set `CAMBA_EDGE_ALIAS_PREFIX` explicitly. |
| `CAMBA_API_IMAGE` | Immutable CI image reference. For a local scratch build only: `docker build -t camba-prodcheck-api:local api`. The context must be `api/` so its Docker allowlist excludes secrets, local vendor files, test fixtures, logs, and generated caches. |
| `CAMBA_APP_KEY` | Stable, generated Laravel encryption key shared by PHP-FPM, worker, scheduler and migrate. Preserve between releases. |
| `CAMBA_APP_URL` | Public HTTPS origin for signed email links and public media URLs. |
| `CAMBA_SANCTUM_DOMAINS` | Comma-separated first-party storefront/admin domains, including ports only when appropriate. |
| `CAMBA_TRUSTED_PROXY_IPS` | Required comma-separated exact IPs of the stable ingress peers, not addresses of shoppers, wildcards or subnets. The edge must overwrite `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Port`. Compose rejects an unset or empty value; Laravel rejects invalid entries in production. Use a TEST-NET address only in an isolated direct HTTP rehearsal that should not trust forwarded headers. |
| `CAMBA_DB_PASSWORD`, `CAMBA_DB_ADMIN_PASSWORD` | Separate PostgreSQL application/admin passwords. The app database and non-superuser owner are `camba`; the administrator password is only given to PostgreSQL. Reusing a volume does not rotate database passwords. |
| `CAMBA_API_ENV_FILE` | Optional absolute path to the protected runtime env file for SMTP and other provider settings (default: `/etc/camba/api.env`). Compose controls the DB, Redis, session, queue, and debug settings. Never put provider settings in a build argument or image layer. |

Nginx and PHP roles run as `www-data` (UID/GID 33 in the Debian image). Nginx gets no application credentials and reads only the public-media volume. PHP roles share public media and private files; PostgreSQL and Redis each have dedicated volume storage. PostgreSQL and Redis are only on the internal data network; Redis persists its queue and session data with AOF.

## Checks and edge handoff

- For a direct local rehearsal in Bash, `export CAMBA_COMPOSE_PROJECT=camba-prodcheck` and use `-p "$CAMBA_COMPOSE_PROJECT"` on **every** Compose command. No port mapping is needed: after startup, run `docker compose -p "$CAMBA_COMPOSE_PROJECT" --env-file <synthetic-env> -f infra/compose.prod.yml exec api curl -fsS http://127.0.0.1:8080/ready`.
- `GET /up` is process liveness. `GET /ready` returns 200 only if the application can query PostgreSQL and ping Redis; an outage returns generic JSON and 503 without disclosing credentials or dependency identities. Docker checks `/ready` through Nginx, which also returns a generic 503 if PHP cannot answer the readiness probe within three seconds.
- Only `api:8080` should join the Camba edge network. The edge terminates TLS, restricts accepted hosts, and **overwrites** Host and `X-Forwarded-Proto` before proxying `/api/`, `/sanctum/`, `/email/verify/`, and `/storage/`; forward health paths only where monitoring needs them. Never publish PHP-FPM, PostgreSQL, or Redis. Nginx trusts edge-supplied HTTPS only on this internal HTTP path; client-IP forwarding requires its own trusted proxy policy before deployment.
- `/storage/` serves public image files; PHP is always executed through a single fixed front controller, never from an upload path. The edge must allow the backend's body limit (125 MiB) for authenticated image batches. Do not mount private files or database volumes in the edge.
- Once the edge and provider are configured, verify signed HTTPS email links, webhook routing, and a restore before any cutover. The backend-only checks do not validate those integrations.
