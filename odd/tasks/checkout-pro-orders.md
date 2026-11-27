# Checkout Pro con Orders
Branch: feat/camba-v2 · baseline acab374 + preserved unstaged local checkout · local sandbox only.
Delivery: ask-on-risk (no publication) · Laravel Payments isolated PostgreSQL, Docker HTTPS CambaTest · forecast 600–1000 authored lines.

## Specs

S1. «Desde Laravel, creá la orden del proveedor con `POST /v1/orders`, `type: online`, `processing_mode: manual` y `capture_mode: automatic` para conservar el modo binario.» «Persistí un `X-Idempotency-Key` por intento y reutilizalo ante doble clic o timeout.»

S2. «Hacé que webhook, retorno y scheduler converjan en la misma conciliación mediante `GET /v1/orders/{order_id}`. Confirmá la compra solo con acreditación verificada del intento correcto, comprobando referencia, importe, moneda y entorno.»

S3. «Si el comprador vuelve con una orden vigente que reservó su última unidad, mostrá «Continuar pago» y reabrí el mismo `checkout_url`, con control de titularidad y del contenido del carrito.» «Ante rechazo o vencimiento confirmado, liberá la reserva una sola vez y conservá el carrito.»

S4. «Aplicá Orders a los checkouts nuevos y mantené la conciliación de las preferencias anteriores que todavía puedan recibir pagos. Conservá el historial y distinguí el ID de orden del proveedor del ID de pago.»

S5. «Completá un `APRO` y un `OTHE`. Verificá el estado que devuelve Orders, el webhook firmado, el pedido en Tienda y Admin, el carrito, el stock y el log.» «Un `201` que devuelve `checkout_url` valida la apertura. Para dar por validado el pago, mostrá el ID de la orden, el ID y estado de su transacción y el resultado aplicado en Camba.»

S6. «Conservá `capture_mode: automatic` para el modo binario salvo que encuentres evidencia concreta que justifique otro valor.» «Verificá que un timeout repita la creación con la misma clave de idempotencia y el mismo cuerpo. Conservá la conciliación de las preferencias anteriores.»

S7. «Hacé que el webhook, el retorno y el reconciliador consulten `GET /v1/orders/{id}` antes de actualizar el pago.» «Verificá que una acreditación confirmada genere una sola compra visible y que las entregas repetidas no dupliquen cambios de stock ni avisos.»

S8. ««Continuar pago» debe reabrir la orden vigente, incluso cuando la última unidad esté reservada para ese comprador. Tras un estado terminal confirmado, «Reintentar» debe crear un nuevo intento de Mercado Pago bajo la misma compra interna.»

S9. «Si Mercado Pago vuelve a devolver `recover` sin transacción, completá las pruebas del flujo con el proveedor simulado y documentá el bloqueo con el ID de orden, la hora y el `x-request-id`.»

## Tasks

- [x] T1 · S1/S4 · inline · RED→GREEN for same-key timeout replay and actual 201 without status_detail; deployed locally · Risk: items 1, 3, 4.
- [x] T2 · S2/S3/S4 · inline · signed inbox, verified reconciliation and cancellation; isolated regression and real cancellation/webhook · Risk: items 2, 3, 4.
- [ ] T3 · S5 · partial · hosted Checkout and underlying Orders IDs verified; APRO and OTHE failed before a transaction; independent code checks passed.
- [x] T4 · S6–S8 · inline · RED→GREEN for processing without reopening; own return+fallback, retry, latest attempt; 10 focused tests/180 assertions · Risk: item 4, concurrent stock and payment state.
- [x] T5 · S9 · local suite + sandbox rerun executed; actual payment remains blocked under T3; scenario matrix in docs/MERCADO_PAGO_ORDERS_QA.md.

## Log

L1.

Migrá Camba v2 a Checkout Pro con Orders en C:\Users\Josec\camba. CambaTest ya está configurada con «API de Orders». Trabajá sobre el checkout local que corre en Docker, con las credenciales de prueba de CambaTest y `CAMBA_MP_LIVE=false`. Usá Komorebi como referencia de la experiencia de compra y la documentación de Orders para el contrato con Mercado Pago.

1. Creación y redirección. Desde Laravel, creá la orden del proveedor con `POST /v1/orders`, `type: online`, `processing_mode: manual` y `capture_mode: automatic` para conservar el modo binario. Calculá el total en UYU del lado servidor y comprobá que coincida con la suma de los ítems, incluido el envío cuando corresponda. Configurá una cuota y los retornos HTTPS con los campos de Orders. Persistí un `X-Idempotency-Key` por intento y reutilizalo ante doble clic o timeout. Guardá el ID de la orden del proveedor y redirigí al `checkout_url` que devolvió Mercado Pago.

2. Webhook y conciliación. Configurá el evento de prueba «Order (Mercado Pago)». Validá la firma con `x-signature`, `x-request-id` y el `data.id` firmado. Los IDs de Orders son alfanuméricos, así que revisá los validadores que hoy exigen IDs numéricos de Payments. Hacé que webhook, retorno y scheduler converjan en la misma conciliación mediante `GET /v1/orders/{order_id}`. Confirmá la compra solo con acreditación verificada del intento correcto, comprobando referencia, importe, moneda y entorno. Las entregas repetidas y los eventos tardíos deben mantener el pedido, el stock y los avisos consistentes.

3. Carrito y stock. Si el comprador vuelve con una orden vigente que reservó su última unidad, mostrá «Continuar pago» y reabrí el mismo `checkout_url`, con control de titularidad y del contenido del carrito. Alineá el vencimiento de la reserva con la vigencia que acepte Orders. Si el comprador cancela explícitamente y la orden admite cancelación, verificá el estado final del proveedor antes de liberar stock o crear otro intento. Ante rechazo o vencimiento confirmado, liberá la reserva una sola vez y conservá el carrito. La compra aparece en «Tus compras» después de la acreditación verificada.

4. Compatibilidad y logs. Aplicá Orders a los checkouts nuevos y mantené la conciliación de las preferencias anteriores que todavía puedan recibir pagos. Conservá el historial y distingué el ID de orden del proveedor del ID de pago. Registrá creación o reanudación, resultado y movimientos de stock en `api/storage/logs/pagos/DDMMAAAA.log`, legible desde Windows y compartido por API, worker y scheduler. Excluí secretos y datos de tarjeta.

5. Validación. Aplicalo al Docker habitual y probá desde la Tienda HTTPS. Seguí la guía de Orders con tarjetas oficiales de prueba en incógnito y sin sesión de Mercado Pago. Completá un `APRO` y un `OTHE`. Verificá el estado que devuelve Orders, el webhook firmado, el pedido en Tienda y Admin, el carrito, el stock y el log. Probá también la reanudación de la última unidad, un timeout de creación y un webhook repetido.

Entregá los archivos modificados y la evidencia de cada caso. Un `201` que devuelve `checkout_url` valida la apertura. Para dar por validado el pago, mostrá el ID de la orden, el ID y estado de su transacción y el resultado aplicado en Camba. Si el proveedor bloquea algún paso, indicá el endpoint, el código y el ID de solicitud.

L2. Read-only provider contract probe from Docker validated the CambaTest seller before creating a standalone non-shopping test order. POST /v1/orders 201, request 771a1ec9-c29b-4b7e-8d8d-c5efadc0ece9, ID ORDTST01M8CNM554AA2N9KGGJBWNM6H4. Same key/body returned the same ID with 201. GET returned 200, exact reference, 451.00 UYU, manual/automatic, max_installments 1, PT10M, and the configured seller. No payment was attempted. Official fields are config.online.{success_url,failure_url,pending_url,auto_return} and config.payment_method.max_installments.

L3. Independent read-only seam map completed from existing cart explorer. Retain owner/cart validation and existing payment state machine; branch per persisted attempt protocol, not per global configuration, so previous references and inbox work remain valid. No writes to the habitual database during implementation.

L4. Added protocol and independent order/create identity to payment_attempts, kept encrypted payload and URL, added Orders inbox identity and widened ledger transaction IDs. Orders adapter validates seller, currency, exact cents, type, mode, capture, order/attempt reference and accredited transaction amount. Timeout can replay only the persisted key and body; unbound scheduler searches exact reference. Explicit cancel validates then refetches the provider before applying. PostgreSQL test suite passed 57 tests/656 assertions, followed by the focused approval test including Admin detail (26 assertions). Pint 14 files, git diff check and Angular SSR build passed. Independent verifier found no blocking implementation finding (5 focused tests/90 assertions + 7 standalone identity/accreditation checks). Prior unrelated local edits preserved.

L5. Applied additive migration to the habitual Docker, set private Compose env flag true with CAMBA_MP_LIVE=false, and recreated API, worker, scheduler and Store; PostgreSQL stayed up. Incognito/guest QA Orders report: docs/MERCADO_PAGO_ORDERS_QA.md. Real OTHE provider flow returned PUT 200 with application status recover, request 789b7328-ef53-4554-a738-22edd199a9b7. APRO showed the same hosted recovery screen. GETs confirmed no transactions for either. Last unit resumed the same Orders ID; explicit OTHE cancellation confirmed canceled, produced a real verified webhook, and released stock once with cart preserved. Controlled HTTPS duplicate/invalidation returned 200/200/401 and one processed inbox row. No approval or rejection applied or claimed. Native assess was unassessable because the mixed local worktree needs explicit untracked scope; no freeze or native authority created, no staging/commit or publication.

L6.

Terminá la integración de Mercado Pago Checkout Pro con Orders API en Camba. El MCP oficial `mercadopago` ya está configurado. Usalo para contrastar el código actual con la documentación de Uruguay antes de corregir diferencias. Partí de lo que ya funciona en el Docker local.

Contexto del bloqueo: CambaTest crea órdenes y abre el `checkout_url` correctamente. Dos órdenes de control creadas directamente contra Mercado Pago, fuera de Camba, con `automatic` y `automatic_async`, devolvieron `recover` al pulsar «Pagar» con APRO. Ambas quedaron en `created`, sin transacciones. El último control fue `ORDTST01M8CZWBPKY0V2ZFEEW3XQ22ZB`, con `x-request-id` `fe1b125d-0b19-4fd2-9bfd-c6b0c4e465ef`. Conservá `capture_mode: automatic` para el modo binario salvo que encuentres evidencia concreta que justifique otro valor.

1. Revisá la creación por `POST /v1/orders`, los importes en UYU, la redirección con el `checkout_url` exacto y los retornos. Verificá que un timeout repita la creación con la misma clave de idempotencia y el mismo cuerpo. Conservá la conciliación de las preferencias anteriores.

2. Validá el webhook de Orders, su firma y la deduplicación. Hacé que el webhook, el retorno y el reconciliador consulten `GET /v1/orders/{id}` antes de actualizar el pago. Verificá que una acreditación confirmada genere una sola compra visible y que las entregas repetidas no dupliquen cambios de stock ni avisos.

3. Cerrá los casos de abandono, vencimiento, cancelación y rechazo. «Continuar pago» debe reabrir la orden vigente, incluso cuando la última unidad esté reservada para ese comprador. Tras un estado terminal confirmado, «Reintentar» debe crear un nuevo intento de Mercado Pago bajo la misma compra interna. Verificá que el carrito se conserve y que el stock se libere una sola vez cuando corresponda.

4. Ejecutá las pruebas de integración y el recorrido en el Docker local. Verificá aprobación, rechazo, reanudación, cancelación, webhook duplicado y conciliación sin webhook. En CambaTest usá únicamente el entorno de prueba. Si Mercado Pago vuelve a devolver `recover` sin transacción, completá las pruebas del flujo con el proveedor simulado y documentá el bloqueo con el ID de orden, la hora y el `x-request-id`.

Entregame los cambios realizados, las pruebas ejecutadas y el estado de cada escenario. Identificá cuáles se verificaron en el sandbox de Mercado Pago, cuáles con simulación y cuáles siguen pendientes. Mantené las credenciales fuera del código y de los logs.

L7. Official MP MCP MLU re-check: keep online/manual/automatic, exact checkout_url and config.online HTTPS return URLs. Orders webhook identifies resource through signed x-signature, x-request-id and query data.id; commerce updates only on authenticated provider GET. Existing code remains the base; no capture-mode or schema toggle change.

L8. RED: verified processing without a transaction still returned ready from cart. GREEN: closeAttempt projects a bound processing checkout as checking, leaves stock held even when local expiry passes, and buyer detail projects pending without inventing a ledger transaction. Provider expired detail, latest Admin attempt, and fresh browser key for terminal retry now match behavior. Added no-webhook return/scheduler recovery after accepted POST timeout, and rejected → fresh attempt → late old webhook → single approval assertion. Isolated Payments/Orders/Cart/Notices 96/1413; Pint, SSR build and diff check passed. Independent static verifier found no blocker; its beyond-expiry regression passed. Native assess remained unassessable because of untracked scope in mixed worktree; no native receipt/stage/commit/push.

L9. Existing HTTPS tunnel was pointing straight to Laravel:8000, making public /tienda return 404. Within previously authorized scope it was moved back to Store:4200 with rewritten Host; public storefront and store-info 200. QA order 65 represents live sandbox creation, last-unit resume, same-origin return, cancel and retry under the same reference. APRO order ORDTST01M8D0MTBXTBH2FXHFP9AFPNFD: recover at 19:44:48.155 UY, x-request-id 47e9c73d-d299-433b-85b0-9e8fb2c10109; GET model stays created/no transaction. Real signed cancellation plus controlled duplicate (401/200/200, one deduped row) processed while attempt 34 remained ready and stock held. Both QA reservations were then closed through buyer cancellation, each released once; no charges or notices. Actual approved/rejected payment not claimed.
