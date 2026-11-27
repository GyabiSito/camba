# Resume held Checkout Pro cart
Branch: feat/camba-v2 · baseline acab374 with preserved pending SDK and media changes · local delivery only.
Runners: Payments/Cart isolated PostgreSQL, Store build, Playwright localhost:4200, authorized CambaTest diagnostics.

## Specs

S5. Corregí la reanudación de pagos abandonados en C:\Users\Josec\camba. Reproducí el caso en localhost:4200 con una sola unidad de stock: iniciá el pago, salí de Mercado Pago y volvé a /carrito. Hoy aparece «Quitá este producto para continuar».

S1. Identificá en PostgreSQL y en el log `pagos` qué intento reservó la unidad. Verificá si pertenece al mismo comprador y carrito, si sigue vigente y si Mercado Pago ya registró algún pago.

S2. Si el mismo comprador tiene un intento vigente que puede continuar, mostrá «Continuar pago» en el carrito y reabrí su `init_point` original. Usá el mismo pedido, intento y reserva. Verificá la titularidad del intento y que corresponda al contenido del carrito. Si el pago ya fue aprobado, mostrale el pedido confirmado.

S3. Si el intento venció o fue cancelado, conciliá con Mercado Pago y liberá la reserva una sola vez cuando corresponda. Actualizá el carrito para que pueda volver a pagar. Si el estado todavía está por confirmarse, mostrá un mensaje claro y una acción para consultar el estado. Salir de la página por sí solo no autoriza a liberar el stock ni a crear otra preferencia.

S4. Probalo con la última unidad. El comprador original debe poder continuar el pago y el segundo comprador debe ver la unidad como reservada. Verificá también que, tras el vencimiento, el stock vuelva una sola vez y el carrito permita iniciar un intento nuevo. Mostrá las entradas de `pagos` que lo comprueban.

## Tasks

- [x] T1 · S1/S5 · inline · real baseline QA stock reproduction and ledger diagnosis.
- [x] T2 · S2/S3 · inline · Risk items 2 and 4: same-owner cart equality and lock ordering.
- [x] T3 · S4 · inline + independent verifier · API/Store end-to-end and expiry proof.

## Log

L1.

Corregí la reanudación de pagos abandonados en C:\Users\Josec\camba. Reproducí el caso en localhost:4200 con una sola unidad de stock: iniciá el pago, salí de Mercado Pago y volvé a /carrito. Hoy aparece «Quitá este producto para continuar».

1. Identificá en PostgreSQL y en el log `pagos` qué intento reservó la unidad. Verificá si pertenece al mismo comprador y carrito, si sigue vigente y si Mercado Pago ya registró algún pago.

2. Si el mismo comprador tiene un intento vigente que puede continuar, mostrá «Continuar pago» en el carrito y reabrí su `init_point` original. Usá el mismo pedido, intento y reserva. Verificá la titularidad del intento y que corresponda al contenido del carrito. Si el pago ya fue aprobado, mostrale el pedido confirmado.

3. Si el intento venció o fue cancelado, conciliá con Mercado Pago y liberá la reserva una sola vez cuando corresponda. Actualizá el carrito para que pueda volver a pagar. Si el estado todavía está por confirmarse, mostrá un mensaje claro y una acción para consultar el estado. Salir de la página por sí solo no autoriza a liberar el stock ni a crear otra preferencia.

4. Probalo con la última unidad. El comprador original debe poder continuar el pago y el segundo comprador debe ver la unidad como reservada. Verificá también que, tras el vencimiento, el stock vuelva una sola vez y el carrito permita iniciar un intento nuevo. Mostrá las entradas de `pagos` que lo comprueban.

L2. Baseline Chromium with two guests on item 13/stock 1 reproduced the unavailable message for owner and other cart after one real order and preference (both HTTP 201); order ref 4feb8221-5a18-427b-b137-e7047c232aa1. Preserve all existing stock/expiry rules; do not alter a real SKU or execute payment to test resumption.

L3. Baseline order 57/attempt 23: same owner/cart and exact line quantities, expiry 15:33:59 UY, stock 0, CambaTest search 200 with no payments. Cart renders removal reason for both sessions.
L4. Implemented private cart checkout projection and strict POST cart checkout resume, comparing owner, cart ID, sorted quantities, payment evidence and status/deadline under cart → order locks. Stored original init_point only for ready; approval reads existing order; expiry follows existing scheduler/reconciliation. Other carts see a generic reserve indication, never an order reference. PostgreSQL isolated Payments/Cart: 55 tests / 689 assertions; Store Docker image built and only Store recreated. RED reproduced both absent ready/paid cart state. Pint and Impeccable detector passed. Independent static verifier found no blocker; its own synthetic harness failed before assertions. Native review preflight could not assess mixed untracked working tree; no review and no publishing.
L5. Real localhost:4200 test with separate guests on QA SKU 13, order 58/ref e60d62fe-8cf2-41ad-8cf8-62bdd69bb04f/attempt 24. Original exact provider URL opened twice; only one order-payment start and resume 200. Other cart says reserved, has no checkout reference; stock 0, compact viewport 320px; focus verified on Continue button. At 15:36:12 UY pagos payment.resumed references attempt 24. Provider exact attempt search HTTP 200 empty. Existing reservation ends 15:46:06 UY; foreground Playwright process session 33503 is observing natural scheduler, pending-check CTA and next attempt.

L6. Natural live expiry proof complete on localhost:4200. Scheduler expired attempt 24 and logged one checkout.stock_released at 15:48:01 UY. At 15:48:07 stock was 1 and both carts showed availability; owner saw Continuar la compra. At 15:48:08 the same order 58 got new attempt 25 with a different provider preference (HTTP 201) and a new reservation (stock 0; ends 15:58:08 UY). No real payment submitted; both exact lookup searches were empty. Isolated 320px Chromium fixture also verified Consultar estado POSTs order refresh (202) and renders the announcement, and renders Pedido confirmado with the proper link when cart is empty after approval. The 55-test PG suite separately proves the real response/expiry rules, ownership rejection, guest access expiry and approval projection; no live approval was needed for the abandon/resume test.
