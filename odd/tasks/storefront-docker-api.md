# Verify storefront against the shared Docker API
Branch: feat/camba-v2 · baseline 62f44f6 plus inherited storefront/login worktree · local only, no publication.
Runner: Playwright on 4200/4300, Mailpit 48025, PostgreSQL volume/seed fingerprints · two independent journeys · forecast ~300–500 authored lines.

## Specs

### S1
> Integrá todo el storefront de Camba v2 con la API del Docker actual.
> El login de Tienda en 4200 y Admin en 4300 ya fue corregido. Conservá
> los accesos, el diseño aprobado y los datos existentes.
> 
> Primero revisá qué pantallas ya consumen la API y cuáles todavía usan
> mocks, respuestas fijas o estados exclusivos del modo demo. Reutilizá
> los clientes, servicios y contratos existentes. Los datos de prueba
> vienen del seed de PostgreSQL. Las fotos editoriales del home pueden
> seguir siendo assets del frontend.

### S2
> 1. CATÁLOGO Y FICHAS
>    Conectá listado, búsqueda, filtros, paginación, ficha, fotos, precio
>    y disponibilidad a los datos reales de la API. Verificá que publicar
>    o actualizar un producto en Admin se refleje en Tienda.

### S3
> 2. CUENTAS
>    Verificá registro, ingreso, cierre de sesión, perfil, direcciones,
>    verificación de correo y recuperación de contraseña según los
>    flujos existentes. Usá Mailpit para probar los correos. Comprobá que
>    los datos privados sigan restringidos a la cuenta correspondiente.

### S4
> 3. CARRITO Y CHECKOUT
>    Conectá agregar, actualizar cantidad y quitar al carrito de la API.
>    Probá como invitado y como cliente, incluida la unión de carritos
>    al ingresar si ya está soportada. La modal de confirmación aparece
>    después de que la API confirme el cambio. El contador, las cantidades
>    y el subtotal deben coincidir después de recargar.
> 
>    Conservá el diseño de «Confirmá tu compra». Verificá cotización,
>    entrega o retiro, direcciones guardadas y creación del pedido.
>    Comprobá que un reintento no duplique pedidos ni reservas de stock.

### S5
> 4. PEDIDOS
>    El pedido nuevo debe verse en Mi cuenta y en Admin, con la misma
>    referencia, productos y total. Mostrá el estado que devuelve la API.
>    Dejá el pago preparado mediante la función acordada anteriormente.
>    Si el proveedor no está habilitado, el pedido queda pendiente.
>    Usá los pedidos seedeados para revisar los otros estados.

### S6
> CIERRE
> 
> Probá el recorrido Admin → producto publicado → Tienda → ficha →
> carrito → checkout → pedido visible en ambos lados. Hacelo en el
> navegador contra el Docker real de 4200 y 4300, con las llamadas de
> ese recorrido llegando a la API. Probá también falta de stock y
> persistencia después de recargar. Usá registros de prueba identificables
> y dejá la cuenta y el carrito demo listos para que los pueda revisar.
> 
> Dejá el stack corriendo. Entregá qué pantallas ya estaban integradas,
> cuáles corregiste y qué quedó comprobado de punta a punta. Si alguna
> acción carece de un contrato disponible, identificá la acción exacta
> y completá los demás recorridos.

## Tasks

- [x] T1 · S1, S2, S4–S6 · delegated direct · actual Docker commerce suite, nine scenario groups and one QA order · `736be73`.
- [x] T2 · S1, S3, S6 · delegated direct · Mailpit customer identity and privacy on separate accounts · 10/10; test and independently scoped SMTP correction in `7adb777` · Risk: item 5 (local runtime mail configuration).
- [x] T3 · S1, S5–S6 · inline · runtime audit and preserved seed/volumes; independent SMTP/runtime checks passed. Scope and rerun commands documented in `736be73`.

## Log

### L1 — User request
Integrá todo el storefront de Camba v2 con la API del Docker actual.
El login de Tienda en 4200 y Admin en 4300 ya fue corregido. Conservá
los accesos, el diseño aprobado y los datos existentes.

Primero revisá qué pantallas ya consumen la API y cuáles todavía usan
mocks, respuestas fijas o estados exclusivos del modo demo. Reutilizá
los clientes, servicios y contratos existentes. Los datos de prueba
vienen del seed de PostgreSQL. Las fotos editoriales del home pueden
seguir siendo assets del frontend.

1. CATÁLOGO Y FICHAS
   Conectá listado, búsqueda, filtros, paginación, ficha, fotos, precio
   y disponibilidad a los datos reales de la API. Verificá que publicar
   o actualizar un producto en Admin se refleje en Tienda.

2. CUENTAS
   Verificá registro, ingreso, cierre de sesión, perfil, direcciones,
   verificación de correo y recuperación de contraseña según los
   flujos existentes. Usá Mailpit para probar los correos. Comprobá que
   los datos privados sigan restringidos a la cuenta correspondiente.

3. CARRITO Y CHECKOUT
   Conectá agregar, actualizar cantidad y quitar al carrito de la API.
   Probá como invitado y como cliente, incluida la unión de carritos
   al ingresar si ya está soportada. La modal de confirmación aparece
   después de que la API confirme el cambio. El contador, las cantidades
   y el subtotal deben coincidir después de recargar.

   Conservá el diseño de «Confirmá tu compra». Verificá cotización,
   entrega o retiro, direcciones guardadas y creación del pedido.
   Comprobá que un reintento no duplique pedidos ni reservas de stock.

4. PEDIDOS
   El pedido nuevo debe verse en Mi cuenta y en Admin, con la misma
   referencia, productos y total. Mostrá el estado que devuelve la API.
   Dejá el pago preparado mediante la función acordada anteriormente.
   Si el proveedor no está habilitado, el pedido queda pendiente.
   Usá los pedidos seedeados para revisar los otros estados.

CIERRE

Probá el recorrido Admin → producto publicado → Tienda → ficha →
carrito → checkout → pedido visible en ambos lados. Hacelo en el
navegador contra el Docker real de 4200 y 4300, con las llamadas de
ese recorrido llegando a la API. Probá también falta de stock y
persistencia después de recargar. Usá registros de prueba identificables
y dejá la cuenta y el carrito demo listos para que los pueda revisar.

Dejá el stack corriendo. Entregá qué pantallas ya estaban integradas,
cuáles corregiste y qué quedó comprobado de punta a punta. Si alguna
acción carece de un contrato disponible, identificá la acción exacta
y completá los demás recorridos.

### L2 — Baseline and safe scope
- Docker Store 4200, Admin 4300 and Mailpit 48025 return HTTP 200. The live storefront offline mock gateway returns 404. Actual Laravel Compose API and PostgreSQL were retained.
- Keep existing seed users, orders, catalog, buyer cart, named volumes and launch setup; use newly identifiable QA records for successful mutations. No live payment provider or outbound mail.

### L3 — Runtime audit, RED and GREEN
- The running Store is `production,editorial,no-payment`: editorials are local assets independent of the offline demo, whose server path is absent. Resolver/ApiClient already drive home merchandising, catalog, search, product photos/prices/availability, account, cart, quote, orders and server-origin sessions. Both UIs proxy the same Laravel/PostgreSQL. No API contract or Angular UI changes were needed.
- Registration returned HTTP 201 but Redis worker retries for `QueuedVerifyEmail` failed with `Unsupported mail transport []` despite reachable Mailpit SMTP. Old transport resolution reproduced the exception; setting `MAIL_URL=smtp://mailpit:1025` resolved the transport. Recreated only API/worker/scheduler after confirming no pending migrations. Worker logs show both verification and password-reset jobs finishing and Mailpit actually delivered both.
- Customer UI proof (10/10): register/unverified state, real signed verification and resend, login/logout/reload, profile, saved address CRUD and reload, foreign address GET/PATCH/DELETE rejected, buyer Admin denied, no session access as guest, exact recovery link with token removed from the browser URL, old password rejected and new password persistent. Evidence `web/test-results/storefront-docker-account/results.json`.
- Commerce QA product #10, with two original local test images and price updated through Admin, reflected in the real Store catalog/category/search/order/gallery. Real pagination gave distinct API pages and the UI handled an out-of-range page; the catalog has only eight published entries vs UI page size 12, so no active next-page control was expected.
- Commerce proof (9 groups; rerun reused this order): guest/buyer cart mutations persist across reload, 1+1 merges, confirmation waits for API, excessive add responds 422 without confirmation, both quote modes returned and checkout used a saved delivery address. Real 201 order response was lost deliberately after server commit; retry reused UUID/body and same order. One order `50eda858-dfe9-447f-98df-47d63da9368e` for QA buyer `qa-compra-20261123145006@camba.test` (local README password), `pending_payment`, UYU 2.589,50, same items and totals in both UIs/APIs, stock 8→6 only once. That QA buyer retains one cart unit for review.
- Existing buyer/admin browser logins still work on both host aliases after restart; permissions and CSRF remain enforced. Actual seeded three-state review passed at 1440/390; the test now finds exact fixture references rather than assuming a payment status is unique. The before/after hashes match for both existing accounts, addresses, six existing account orders and lines, two original cart rows, nine seed products and fifteen photos. Volumes unchanged, no payment initiated. Protocol evidence `web/test-results/storefront-docker-api/`.
- Native assessment was unable to classify the source candidate due to inherited untracked inventory; no native review receipt. Two local commits targeted only the new mail environment setting, independent E2E scenarios and their documentation; unrelated storefront work remains untouched.
- Independent risk 5 verification: all eight services healthy, 4200/4300/48025 HTTP 200, three Laravel roles match local DSN, ten completed mail jobs and zero failures since restart, unchanged seed/volume evidence, exact API page 2 and anonymous profile HTTP 401. Examined sanitized checkout and account evidence, no writes. No real payments tested; normal GUI second-page navigation remains unexercised at current catalog size.

