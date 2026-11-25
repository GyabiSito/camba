# Camba order operations and notices
Branch feat/camba-v2 · baseline 676f760 + inherited dirty checkout · local only, ask-on-risk · forecast 450–600 authored lines.
Runners: Laravel PHPUnit on isolated SQLite; Angular Admin build; Chromium/Store 4200/Admin 4300 and real worker/Mailpit 48025; no payment provider.

## Specs

S1: “1. Hacé visible Avisos operativos. Agregá «Avisos» con una campana en el menú lateral, al lado de Pedidos, y reutilizá la pantalla existente. Abrí por defecto los avisos activos y dejá el filtro para ver todos o los resueltos. Si mostrás un contador, usá el total de activos de la API, no el número de la página actual.”

S2: “2. Ajustá la tabla de Pedidos. Reemplazá los recuadros grandes de Pago y Preparación y entrega por etiquetas de estado compactas y legibles. Usá dos columnas separadas, «Pago» y «Entrega», con valores como «Pagado», «Pago vencido», «En preparación», «Enviado» y «Entregado». Conservá los filtros, la paginación y las acciones en el detalle del pedido.”

S3: “3. Notificá al comprador cuando cambie el estado del envío. Revisá primero qué pasó con el pedido que ya marqué como entregado. Confirmá que «Enviamos tu pedido» salga al marcarlo como Enviado y agregá «Tu pedido fue entregado» al confirmar la entrega. Usá la plantilla Camba, la referencia del pedido y el enlace que corresponda al comprador. Generá el aviso solo al guardar una transición real, con deduplicación por pedido y evento.”

S4: “4. Enviá «Nuevo pedido en Camba» al correo del único administrador de la tienda cuando se cree un pedido válido, incluso si queda pendiente de pago. Incluí referencia, total, modalidad, estado del pago y un botón «Ver pedido» que abra el detalle en Admin. Conservá también el aviso del panel. Reutilizá la cola existente y garantizá un solo correo por pedido aunque se repita la confirmación.”

S5: “Validá en el Docker de uso habitual (Tienda 4200, Admin 4300 y Mailpit 48025). Creá un pedido QA y comprobá que el administrador reciba una sola notificación. Usá un pedido QA con pago confirmado para marcarlo Enviado y luego Entregado desde Admin. Verificá en Mailpit un correo de cada evento para el comprador correcto y confirmá que repetir las acciones no genere duplicados. Hacé la prueba sin cobros reales y preservá los volúmenes de trabajo. Entregá capturas de la tabla y de Avisos, y reportá qué pasó con el pedido original.”

## Tasks

- T1 · S1–S2 · inline · validated in live Admin and isolated Playwright; scoped commit unavailable on inherited dirty files.
- T2 · S3–S4 · inline · two atomic entry points, PHP/independent/queue checks green · Risk: item 2 (admin recipient, deep link) and item 4 (locked transaction and durable dedupe).
- T3 · S5 · inline + independent verification · live evidence complete; no charge, volume reset, original-order mutation or historical notice replay.

## Log

### L1 — Original request

Corregí la gestión de pedidos y avisos de Camba v2 en el Docker local.

1. Hacé visible Avisos operativos. Agregá «Avisos» con una campana en el menú lateral, al lado de Pedidos, y reutilizá la pantalla existente. Abrí por defecto los avisos activos y dejá el filtro para ver todos o los resueltos. Si mostrás un contador, usá el total de activos de la API, no el número de la página actual.

2. Ajustá la tabla de Pedidos. Reemplazá los recuadros grandes de Pago y Preparación y entrega por etiquetas de estado compactas y legibles. Usá dos columnas separadas, «Pago» y «Entrega», con valores como «Pagado», «Pago vencido», «En preparación», «Enviado» y «Entregado». Conservá los filtros, la paginación y las acciones en el detalle del pedido.

3. Notificá al comprador cuando cambie el estado del envío. Revisá primero qué pasó con el pedido que ya marqué como entregado. Confirmá que «Enviamos tu pedido» salga al marcarlo como Enviado y agregá «Tu pedido fue entregado» al confirmar la entrega. Usá la plantilla Camba, la referencia del pedido y el enlace que corresponda al comprador. Generá el aviso solo al guardar una transición real, con deduplicación por pedido y evento.

4. Enviá «Nuevo pedido en Camba» al correo del único administrador de la tienda cuando se cree un pedido válido, incluso si queda pendiente de pago. Incluí referencia, total, modalidad, estado del pago y un botón «Ver pedido» que abra el detalle en Admin. Conservá también el aviso del panel. Reutilizá la cola existente y garantizá un solo correo por pedido aunque se repita la confirmación.

Validá en el Docker de uso habitual (Tienda 4200, Admin 4300 y Mailpit 48025). Creá un pedido QA y comprobá que el administrador reciba una sola notificación. Usá un pedido QA con pago confirmado para marcarlo Enviado y luego Entregado desde Admin. Verificá en Mailpit un correo de cada evento para el comprador correcto y confirmá que repetir las acciones no genere duplicados. Hacé la prueba sin cobros reales y preservá los volúmenes de trabajo. Entregá capturas de la tabla y de Avisos, y reportá qué pasó con el pedido original.

### L2 — Live diagnosis and guardrails

- Read-only PostgreSQL: order …0101 preparing 22:52:01, shipped 22:52:10 and completed 22:52:13 America/Montevideo (23 Nov). Buyer order/payment emails sent; no shipping/receipt ledger row. Scheduler used current-stage-only eligibility and could miss the 3-second shipped state; completed did not exist as a mail kind.
- Exactly one currently verified admin in this Docker. Record new admin order and buyer delivery notices at the committed action, no older-order replay. Shared queue, panel projection and pickup unchanged.
- Baseline 676f760 has inherited unrelated dirty frontend/backend; don't stage mixed edits. No remote operation, no live provider call, no change to the original order.

### L3 — Candidate proof

- RED on live Admin with mocked reads: no sidebar link and default all. Backend RED: rapid real `shipped` and `completed` left zero mail rows before projector, and no admin order notice after checkout/replay.
- Candidate compiles in Admin and passed Notices/Orders/Identity (47 tests, 680 assertions before additional recipient regression). Completed delivery must not invalidate a committed shipped row. Existing pickup mail retains current-stage eligibility. Admin snapshot hash rechecked on both worker eligibility checks. No original-order replay.
- Recreated only the local worker to load Admin origin on 4300 and the updated mail logic; effective Redis/SMTP/PostgreSQL confirmed. API and Admin remain bound to local source.
- Guest QA 38b408ab… received administrative, shipping and delivered messages once per ledger, 1 attempt each. Its Store fallback link is correct because the signup/verification steps do not create a signed-in checkout. Added explicit login to verify the registered buyer deep link on a separate QA order.

### L4 — Final runtime and test evidence

- On QA order dcc4778d-b228-40f1-a045-b197843a1447 the Admin message arrived while pending; the checkout replay returned 200 for the same reference. Simulated only that order's paid state, then clicked preparation, shipping and delivery in Admin. Shipped/completed replays each returned 409. Mailpit real delivery: one admin mail with 4300 detail and correct pending state/modality; one Enviado and one Entregado to the registered buyer, both with 4200 detail. PostgreSQL showed one sent row/apiece, one attempt, plus active panel `order_created`. Original …0101 still has no shipment/delivery mail rows.
- Fixed native select ordering: `[value]` before Angular adds dynamic options displayed All while requesting Active. Existing `FormsModule` select binding keeps the visible default and requested state synchronized. Confirmed actual 4300 active/resolved/all, current sidebar item and compact statuses. Actual captures: `web/test-results/order-notices-docker/{pedidos,avisos}.png`.
- Final scoped Laravel 50 tests/700 assertions, Pint pass; two independent scratch tests/36 assertions (rollback, no backfill, no retarget); adopted rollback coverage in both suites. Admin production build succeeded with pre-existing stylesheet budget warnings and browser Admin suite 5/5.
- Only worker container recreated. API, scheduler, Redis, PostgreSQL, Store, Admin and Mailpit retained container identities. No commit or native review: review assessment could not isolate candidate with unrelated tracked and untracked workspace changes. Independent scratch is outside repo and was retained because its reparse-point guard refused deletion.
