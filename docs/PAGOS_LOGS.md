# Purchase and payment logs

Laravel's `pagos` channel writes JSON Lines to `storage/logs/pagos/DDMMAAAA.log`. For example, November 25, 2026 in `America/Montevideo` goes to `25112026.log`. The logger chooses the path per record, including in an already running worker. The default log channel, stack, and level are unchanged.

In the Docker demo the files are inside the existing named `api-storage` volume. The production backend roles share their own `payment-logs` volume mounted at `storage/logs/pagos`; public frontend and proxy containers do not mount it. The normal volume lifecycle preserves logs across container recreation. Apply your retention policy to this volume separately from database backups.

## Find an attempt

- `checkout.quote.started` covers quote requests; before an order ID is available the checkout confirmation has a correlation ID. Valid confirmation retries and later payment events for the order share a keyed digest of the existing owner/idempotency pair. Use `order_id` for cross-reference, including after an application-key rotation. No raw key or public order reference is recorded.
- `order.created`, `payment.started`, `payment.attempt.changed`, `payment.status_changed`, and `order.status_changed` describe committed changes. Idempotent replays do not recreate these records. Rejections and newly detected evidence issues are `WARNING`; internal faults and failed provider calls are `ERROR`.
- Use `stage`, `correlation_id`, `order_id` (when known), fixed `reason`, `exception_class` and the application state fields. Do not add exception messages, credentials, request/response content, payment-provider identifiers or customer/contact data. Logging is observational: a storage error must not change checkout responses or fall back to another log. Monitor volume write access and free space independently.

## Reproduce locally without provider access

Start the regular Docker demo first. The probe runs the existing Laravel HTTP fake with the real HTTP checkout/payment endpoints and reconcile command in the test kernel, an in-memory SQLite database, and Docker networking entirely disabled. It mounts only the demo's shared log storage and dependencies; it does not use live accounts, stock, or orders. Set the opt-in flag only for this test to retain its synthetic entries in the usual payment log.

~~~powershell
$api = (Resolve-Path api).Path
$mounts = docker inspect camba-v2-demo-pg-api-1 --format '{{json .Mounts}}' | ConvertFrom-Json
$storage = ($mounts | Where-Object Destination -eq '/var/www/html/storage').Name
$vendor = ($mounts | Where-Object Destination -eq '/var/www/html/vendor').Name
if (-not $storage -or -not $vendor) { throw 'Expected the named volumes of the local demo.' }
$copy = 'set -eu; cp -R /input/app /input/bootstrap /input/config /input/database /input/lang /input/public /input/resources /input/routes /input/tests /input/artisan /input/composer.json /input/phpunit.xml .; mkdir -p storage/framework/views storage/framework/testing storage/logs'
$proof = 'php vendor/bin/phpunit --do-not-cache-result tests/Feature/Payments/PaymentLifecycleTest.php --filter test_real_checkout_logs_simulated_payment'
docker run --rm --pull never --network none --entrypoint sh -w /work `
  --mount "type=bind,source=$api,target=/input,readonly" `
  --mount "type=volume,source=$vendor,target=/work/vendor,readonly" `
  --mount "type=volume,source=$storage,target=/work/storage" `
  -e APP_ENV=testing -e DB_CONNECTION=sqlite -e 'DB_DATABASE=:memory:' -e DB_URL= `
  -e CACHE_STORE=array -e SESSION_DRIVER=array -e QUEUE_CONNECTION=sync -e MAIL_MAILER=array `
  -e 'APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' -e CAMBA_PAGOS_DOCKER_PROOF=1 `
  camba-v2-dev-php-pg -c "$copy; $proof"
~~~

The test prints sanitized matching records. To verify a worker can still see the files after the test container is removed, inspect the corresponding date in `docker exec camba-v2-demo-pg-worker-1 ls -l /var/www/html/storage/logs/pagos`. The channel regression `PaymentLogChannelTest` sends records at `02:59:59Z` and `03:00:00Z` on November 26, 2026 to the **same logger**; in Uruguay those records belong to distinct files.
