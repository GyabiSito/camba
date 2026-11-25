# Purchase and payment logging
Branch: `feat/camba-v2` · baseline `1253279` · local implementation and Docker only, no real charges or publication.
Delivery: ask-on-risk if later asked to publish; forecast 500 authored lines in cohesive local work units. Runner: isolated Laravel PHPUnit/Docker, instrumented provider fakes, persistent volume readback.

## Specs

S1 — Creá un canal de Laravel llamado `pagos` que escriba exclusivamente en `storage/logs/pagos/DDMMAAAA.log`. Usá la fecha de Uruguay (`America/Montevideo`). Por ejemplo, el 25 de noviembre de 2026 debe escribir en `storage/logs/pagos/25112026.log`. Verificá que cambie de archivo a medianoche aunque el worker siga corriendo. El resto de la aplicación conserva su configuración de logs.

S2 — Instrumentá el flujo real de compra. Registrá el inicio del checkout, la creación del pedido, el inicio del pago, los cambios de estado que ya procese la aplicación y los errores. Usá `info` para las etapas normales, `warning` para los rechazos esperados y `error` para fallos internos o del proveedor. Si falla antes de que exista el pedido, usá un ID de correlación para rastrear el intento.

S3 — Incluí contexto útil para diagnosticar cada error: etapa, ID de correlación, ID del pedido si existe y un código o motivo seguro. Para una excepción, incluí su clase. Excluí datos de tarjeta, credenciales, tokens, datos personales y cuerpos completos de solicitudes o respuestas. Evitá registrar dos veces el mismo fallo si pasa por varias capas. Conservá el comportamiento del checkout y los mensajes que recibe el cliente.

S4 — Verificá en Docker local que el directorio se pueda escribir y quede en el almacenamiento persistente. Probá una compra exitosa y un fallo simulado del proveedor, con datos de prueba y sin cargos reales. Comprobá que ambos queden en el archivo de la fecha, que el error aparezca en el canal `pagos` y que esas entradas estén ausentes de `laravel.log`. Probá también el cambio de fecha. Si Mercado Pago sigue deshabilitado, usá el flujo simulado existente.

S5 — Entregá la ruta del archivo que generaste, un ejemplo sanitizado de una entrada exitosa y otra de error, y el resultado de las pruebas.

## Tasks

- [x] T1 · S1/S4 · Monolog daily file and persistent storage · `65d9ad7`; isolated rollover 1/7, resolved Compose mounts checked. Risk item 5 (delivery/storage).
- [x] T2 · S2/S3 · checkout, rejection, correlation and committed order creation · `bc0debb`; checkout/rotation suites 16/354. Risk item 2 (customer data redaction).
- [x] T3 · S2/S3 · payment provider, transitions and deduplication · `a9aea1f`; normalized checkout/payment/rollover suite 33/619. Risk items 2 and 4 (payload redaction and existing lifecycle locks).
- [x] T4 · S1–S5 · Docker fake-provider proof 1/42, same-logger rollover 1/7, entire Orders/Payments suite 44/698, independent verifier approved all specs · inline integration plus independent verifier for the named risks.

## Log

### L1 — Original request

Implementá logging de compras y pagos en Camba v2, en C:\Users\Josec\camba.

1. Creá un canal de Laravel llamado `pagos` que escriba exclusivamente en `storage/logs/pagos/DDMMAAAA.log`. Usá la fecha de Uruguay (`America/Montevideo`). Por ejemplo, el 25 de noviembre de 2026 debe escribir en `storage/logs/pagos/25112026.log`. Verificá que cambie de archivo a medianoche aunque el worker siga corriendo. El resto de la aplicación conserva su configuración de logs.

2. Instrumentá el flujo real de compra. Registrá el inicio del checkout, la creación del pedido, el inicio del pago, los cambios de estado que ya procese la aplicación y los errores. Usá `info` para las etapas normales, `warning` para los rechazos esperados y `error` para fallos internos o del proveedor. Si falla antes de que exista el pedido, usá un ID de correlación para rastrear el intento.

3. Incluí contexto útil para diagnosticar cada error: etapa, ID de correlación, ID del pedido si existe y un código o motivo seguro. Para una excepción, incluí su clase. Excluí datos de tarjeta, credenciales, tokens, datos personales y cuerpos completos de solicitudes o respuestas. Evitá registrar dos veces el mismo fallo si pasa por varias capas. Conservá el comportamiento del checkout y los mensajes que recibe el cliente.

4. Verificá en Docker local que el directorio se pueda escribir y quede en el almacenamiento persistente. Probá una compra exitosa y un fallo simulado del proveedor, con datos de prueba y sin cargos reales. Comprobá que ambos queden en el archivo de la fecha, que el error aparezca en el canal `pagos` y que esas entradas estén ausentes de `laravel.log`. Probá también el cambio de fecha. Si Mercado Pago sigue deshabilitado, usá el flujo simulado existente.

Entregá la ruta del archivo que generaste, un ejemplo sanitizado de una entrada exitosa y otra de error, y el resultado de las pruebas.

### L2 — Initial discovery

The feature branch is clean at 1253279. The usual local API, worker, scheduler and PostgreSQL are up. The dev API image shares a named storage volume; the production roles need a dedicated persistent log mount that does not alter the existing default logger. Monolog's stock rotating handler rejects day-first formats. No real Mercado Pago credential or network request will be used.

### L3 — T1 file proof

RED: the channel does not exist. GREEN: one Laravel-resolved logger wrote exactly `25112026.log` and `26112026.log` for fake UTC records one second apart across midnight in Uruguay, with local timestamps and no `laravel.log` creation (1 test, 7 assertions). The handler reuses Monolog file locking and opens the stream lazily, and only adds the named Docker volume for the backend roles.

### L4 — T2 checkout proof

RED: the real stale-quote/confirm/retry HTTP regression created no dedicated log. GREEN: 16 checkout/channel tests and 354 assertions. Before order creation, quote attempts get their own UUID and valid confirmation attempts derive a non-reversible HMAC from the existing idempotency key and owner key; subsequent order events derive the same HMAC without a migration. HTTP responses are left unchanged. Only committed new orders log creation, not idempotent replays or rolled-back orders. The exact exception object is marked once to avoid unsanitized default exception reporting, and non-payment logs still reach the configured default channel.

### L5 — T3 payment proof

RED: the fake purchase/payment replay test observed real checkout order creation but no payment-start logs. GREEN: checkout, channel and payment lifecycle suites 33 cases and 619 assertions. Record provider errors at preference/reconciliation boundaries, new durable issue codes only, and committed payment/attempt/order state transitions. Order HMAC uses Laravel's application key and namespaces the owner/idempotency tuple; no original identifiers or payloads. A failed provider lookup cycle emits one error even if multiple subordinate lookups fail. Separate concurrent edits to the Mercado Pago configuration/example/docs/client tests are unrelated and not staged or altered.

### L6 — Docker verification

The committed code at `a9aea1fb9aa11f9886215dd42b931880c9a02b46` was copied from a Git archive into test containers with network disabled. The first harness run omitted `api/lang` and failed only the Spanish-message assertion; copying `lang` corrected the harness and reproduced the normal response. All Orders and Payments tests passed (44 cases, 698 assertions), including rollover using one live logger. Pint passed on 15 scoped PHP files. The focused fake-provider run mounted the existing `camba-v2-demo-pg_api-storage` volume and passed (1 case, 42 assertions). It created real orders in SQLite memory via the checkout endpoints, reconciled one fake payment to `paid`, logged one failed provider preference on the other, replayed without duplicate state/error entries, and found no matching entries in `laravel.log`. After the test container was removed, the existing worker could still read `/var/www/html/storage/logs/pagos/25112026.log` in the shared writable volume. No access to real provider, no live-data changes or service restarts.

### L7 — Independent check

The verifier found no functional, privacy or concurrency blocker after the `lang` documentation correction. Its independent readback matched the sanitized paid/failure records and confirmed they were absent from the default log; API, scheduler and worker share writable `camba-v2-demo-pg_api-storage`. The source-only archive remains in system temp because cleanup was denied; no credentials or logs are in the archive. No untracked or unstaged changes from the concurrent Mercado Pago task were staged.
