# Atomic checkout cart and reservation lifecycle
Branch: feat/camba-v2 · baseline 736be73 plus inherited worktree · local verification, no publication.
Runner: isolated PostgreSQL feature tests, actual Docker API/Chromium 4200, and bounded reservation-expiry probes. Risk: item 4 (cart and stock ordering/idempotency).

## Specs

### S1
> Investigá el pedido b79254f4-0f25-4b2d-b5e3-774a170afa49 en el Docker
> actual. Verificá si tiene una reserva activa por la cantidad pedida,
> si bajó el disponible del producto y qué devuelve la API del carrito
> después de confirmar y recargar.

### S2
> Si la API todavía devuelve la línea, corregí el checkout para que al
> guardar el pedido y reservar stock retire del carrito las cantidades
> incluidas en ese pedido dentro de la misma transacción. Si la API ya
> devuelve el carrito actualizado, corregí la sincronización del contador
> y la vista en Angular. Revisá ambas cosas.

### S3
> Probá con un producto de una sola unidad: al confirmar, se crea un
> pedido pendiente, el carrito queda actualizado incluso al recargar y
> otro comprador no puede pedir esa unidad mientras esté reservada.
> Verificá que repetir la confirmación no duplique el pedido ni la reserva,
> que un checkout rechazado conserve el carrito y que al vencer la reserva
> se recupere la disponibilidad. Conservá el flujo de pago actual.

## Tasks

- [x] T1 · S1–S3 · delegated direct · consume purchased overlap under existing locks; RED then GREEN on isolated PostgreSQL · `e1875ba`.
- [x] T2 · S3 · delegated direct · disabled/no-history release under existing order/lease lock; keep all attempted orders in remote evidence path · `abd97d0`.
- [x] T3 · S1–S3 · inline · Docker Chromium, isolated PostgreSQL and natural scheduler QA proof; original incident unchanged; independent risk 4 verification passed.

## Log

### L1 — User request
Investigá el pedido b79254f4-0f25-4b2d-b5e3-774a170afa49 en el Docker
actual. Verificá si tiene una reserva activa por la cantidad pedida,
si bajó el disponible del producto y qué devuelve la API del carrito
después de confirmar y recargar.

Si la API todavía devuelve la línea, corregí el checkout para que al
guardar el pedido y reservar stock retire del carrito las cantidades
incluidas en ese pedido dentro de la misma transacción. Si la API ya
devuelve el carrito actualizado, corregí la sincronización del contador
y la vista en Angular. Revisá ambas cosas.

Probá con un producto de una sola unidad: al confirmar, se crea un
pedido pendiente, el carrito queda actualizado incluso al recargar y
otro comprador no puede pedir esa unidad mientras esté reservada.
Verificá que repetir la confirmación no duplique el pedido ni la reserva,
que un checkout rechazado conserve el carrito y que al vencer la reserva
se recupere la disponibilidad. Conservá el flujo de pago actual.

### L2 — Baseline
- Read-only DB inspection at 2026-11-23 15:10:31 UTC: requested order `b79254f4-0f25-4b2d-b5e3-774a170afa49` is `pending_payment`, placed 15:08:06 UTC, cutoff 15:38:06 UTC, no release, zero attempts/payments. Product #10 ordered 1, PostgreSQL available stock 5 (previous Docker journey verified 6), purchased product still exists in that buyer's cart quantity 1. Do not impersonate or mutate original buyer or order.
- `PlaceOrder` locks the owner cart, returns on replay, creates order/stock transaction, but does not consume cart lines. `CartController.show` returns those persisted owned lines. Angular checkout already emits `CART_CHANGED` after successful POST; header reads the API on that event. Live API confirmation/reload proof remains a distinct check.

### L3 — Fix and verification
- Checkout removes only purchased overlap from persisted cart inside the existing owner cart transaction after reservation and before commit. Leaves positive remainders and unrelated items. Idempotent replay returns before reserving or changing any newer cart contents. HTTP RED reproduced occupied cart and partial-line failure; GREEN tests include guest and authenticated carts, stale/competing rejection, late cart edits and replay.
- Without provider credentials, reconciliation previously could not complete an external lookup and never released even untouched expired reservations. RED isolated test remained `pending_payment` after the existing grace. Only provider-disabled orders with zero attempts and zero payments bypass the remote lookup, while holding the same order lock as payment initiation. Reuse existing lease, complete evidence/grace and stock release guards; configured, uncertain, previously attempted and paid/conflicting flows remain on existing paths. No payment API or Angular changes.
- Parent command: isolated `camba_v2_demo_test` PHPUnit `tests/Feature/Orders tests/Feature/Cart tests/Feature/Payments` passed **37 tests/620 assertions**; scoped Pint and diff checks passed. No real payment provider used. Native assessment unassessable due to inherited untracked inventory; no review receipt.
- Chromium on real 4200/Admin 4300: new QA product #11 started with one unit; two independent guests quoted it. First POST created pending `f34b7245-7e2a-4d37-bfbf-2b208fff0a26`, stock 1→0, immediate cart GET empty, header no badge, same after reload. Same POST UUID/body returned the same order; no second reservation. Competing stale checkout returned 422 with the exact original line still persisted and visible after reload. See `web/test-results/checkout-cart-reservation/checked.json` and two cart screenshots.
- Advanced the deadline only on the anonymous QA order with guarded SQL. Actual normal scheduler marked it `payment_expired` and restored unit to 1, without re-adding the purchased cart line; public `in_stock:true`, fresh Chromium successfully added restored unit. Independent verifier reproduced the final scoped PostgreSQL/current public state and examined lock ordering. Original `b792…` still pending/active at final check, requested one, available five, persisted historical cart line one; no retroactive cleanup. All Docker roles healthy.

