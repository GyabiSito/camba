# Camba API

The first local delivery provides Laravel 13 with buyer registration, queued email verification, and a Sanctum cookie session. See [OpenAPI](openapi.yaml) for the current endpoint contract.

## Run locally

1. Run `composer install`. This installs packages but does not create an environment or migrate a database.
2. Copy `.env.example` to `.env`, run `php artisan key:generate`, and configure an **isolated** MySQL schema owned by Camba v2. The sample uses port 43306, not the MySQL default port.
3. Recheck the configured host, port and schema before running `php artisan migrate`. Never point development or tests at the existing Camba installation.
4. Run `php artisan serve --host=127.0.0.1 --port=43800`. `GET /up` checks liveness only. Run `php artisan queue:work` with a local mail sink when checking delivery; do not configure a real mail account from development.

For first-party requests, use the same origin for the frontend and API, fetch `/sanctum/csrf-cookie`, send credentials, and pass the decoded `XSRF-TOKEN` cookie as `X-XSRF-TOKEN` on writes. Refresh the CSRF value after session changes. Select HTTPS and `SESSION_SECURE_COOKIE=true` for production; see the [Sanctum configuration guide](https://laravel.com/framework/docs/13.x/sanctum).

Registration returns `201` even if notification enqueue fails, with `meta.verification_queued=false`. In that case, sign in and POST to `/api/v1/auth/email/verification-notification` to retry. Run normal forward migrations when upgrading an existing Camba v2 development schema; the role migration preserves existing rows and roles.

## Checks

Run `composer validate --strict --no-check-publish`, `php vendor/bin/pint --test`, and `php vendor/bin/phpunit`. With PDO SQLite available the tests default to `:memory:`. To verify on MySQL, set `DB_CONNECTION=mysql` and point `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD` to a dedicated test server with `DB_DATABASE=camba_v2_test`. The identity suite resets schema in that test database; use a dedicated instance.

The password recovery endpoints require first-party CSRF. Reset emails point to the configured `APP_URL` at `/cuenta/restablecer#token=…`; the store must read the fragment and collect email before submitting the reset. The token is short-lived and single-use.

There is no default administrator. On the intended Camba v2 instance, an authorized operator can run `php artisan camba:grant-admin verified@example.test` for an existing account whose email has already been verified. Confirm the instance and the target owner before executing; public registration cannot grant this role. `GET /api/v1/admin/session` verifies server-side access.
