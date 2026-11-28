# Camba API

The API uses independent cookie sessions for buyers and the single administrator. See [OpenAPI](openapi.yaml) for the endpoint contracts.

## Run locally

1. Run `composer install`. This installs packages but does not create an environment or migrate a database.
2. Copy `.env.example` to `.env`, run `php artisan key:generate`, and configure an **isolated** MySQL schema owned by Camba v2. The sample uses port 43306, not the MySQL default port.
3. Recheck the configured host, port and schema before running `php artisan migrate`. Never point development or tests at the existing Camba installation.
4. Run `php artisan serve --host=127.0.0.1 --port=43800`. `GET /up` checks liveness only. Run `php artisan queue:work` with a local mail sink when checking delivery; do not configure a real mail account from development.

For first-party requests, use the same origin for the frontend and API, fetch `/sanctum/csrf-cookie`, send credentials, and pass the decoded `XSRF-TOKEN` cookie as `X-XSRF-TOKEN` on writes. Refresh the CSRF value after session changes. Select HTTPS and `SESSION_SECURE_COOKIE=true` for production; see the [Sanctum configuration guide](https://laravel.com/framework/docs/13.x/sanctum).

Registration returns `201` even if notification enqueue fails, with `meta.verification_queued=false`. In that case, sign in and POST to `/api/v1/auth/email/verification-notification` to retry. Run normal forward migrations when upgrading an existing Camba v2 development schema; the role migration preserves existing rows and roles.

## Checks

Run `composer validate --strict --no-check-publish`, `php vendor/bin/pint --test`, and `php vendor/bin/phpunit`. With PDO SQLite available the tests default to `:memory:`. To verify on MySQL, set `DB_CONNECTION=mysql` and point `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD` to a dedicated test server with `DB_DATABASE=camba_test`. The identity suite resets schema in that test database; use a dedicated instance.

Buyer password recovery requires first-party CSRF and uses only buyer accounts. The reset link contains a short-lived, single-use opaque context. Admin has no public registration or password reset.

## Provision Admin after migrations

On the intended API instance, use a trusted interactive shell:

| Situation | Command |
| --- | --- |
| First access on a fresh installation | `php artisan camba:admin admin@example.test --name="Camba"` |
| Adopt an existing verified administrator | `php artisan camba:admin admin@example.test --from-legacy` |
| Recover access to the provisioned account | `php artisan camba:admin admin@example.test` |

Replace the example with the exact authorized email. Legacy adoption never chooses an account automatically, even if there is only one. It copies the selected credential and leaves every legacy user and historical reference in place. Fresh provisioning and recovery prompt for the password without echoing it; recovery invalidates existing Admin logins without ending buyer sessions.

Set `CAMBA_ADMIN_URL` (Laravel `ADMIN_URL`) to the actual HTTPS Admin origin in production. The reverse proxy must preserve its Host. Admin endpoints fail closed on other hosts or if the origin is absent. The Admin browser obtains CSRF at `/api/v1/admin/auth/csrf-cookie`, sends decoded `CAMBA-ADMIN-XSRF-TOKEN` as `X-XSRF-TOKEN`, and uses `/api/v1/admin/auth/login`, `/api/v1/admin/session` and `/api/v1/admin/auth/logout`. Store auth continues to use `/sanctum/csrf-cookie` and `/api/v1/auth/*`.
