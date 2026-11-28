# Unified Camba storefront
Branch: feat/camba-v2 · base 0d714d8 plus inherited, partially untracked storefront · local only, no publication.
Runner: Angular SSR, real Docker/PostgreSQL 4200, isolated Playwright payment contract, 1440/390 visual comparison · about 450–650 authored changes.

## Specs

### S1
> Refactorizá el storefront de Camba v2 sobre el checkout actual. Quiero
> una sola experiencia de tienda, con código fácil de seguir y datos de
> prueba cargados en PostgreSQL. Conservá el diseño aprobado y el stack
> Docker actual en 4200 y 4300.

### S2
> 1. SEPARÁ EL LAYOUT EN COMPONENTES CON RESPONSABILIDADES CLARAS
> 
> - StoreShell compone el enlace de salto, header, main con router-outlet
>   y footer. Conservá el destino correcto de «Saltar al contenido» al
>   navegar a rutas con filtros o parámetros.
> - StoreHeader contiene marca, navegación, menú móvil y accesos a
>   búsqueda, cuenta y carrito. Reutilizá el estado existente del carrito.
>   «Tienda» sigue siendo un enlace directo. El comportamiento del menú
>   pertenece al header.
> - StoreFooter contiene el pie claro aprobado, con marca, Explorá, Ayuda
>   y contacto publicado cuando corresponda.
> - El mosaico de seis fotos pertenece al home. Si hoy
>   `store-home-closing` mezcla el mosaico con el footer, separalos.
>   Preservá las seis fotos, sus recortes, sus enlaces y su posición.
> 
> Mantené una separación práctica entre componentes de UI, páginas y
> acceso a datos. Reutilizá los servicios y tipos existentes. Extraé
> componentes cuando tengan una responsabilidad propia y mantené los
> botones y enlaces sencillos dentro de su plantilla.

### S3
> 2. LIMPIÁ LOS RESTOS DE DEMO QUE VE EL CLIENTE
> 
> Buscá `demoMode`, `demo_paid`, «simular», «sin cobros» y mensajes como
> «No disponible en modo demo» en el storefront. Revisá también los datos
> del seed que se muestran como contenido de la tienda, por ejemplo el
> nombre del punto de retiro.
> 
> Usá los mismos componentes, mensajes y contratos en Docker y en la
> tienda normal. Dejá las cuentas, fixtures y datos seedeados como recursos
> de desarrollo. Conservá sus accesos documentados en el README. Si una
> función está deshabilitada por configuración, mostrá un estado natural o
> retirá la acción, según corresponda. Conservá el aislamiento de pagos
> y correo de la demo local.

### S4
> 3. SIMPLIFICÁ PEDIDOS Y DEJÁ UN SOLO PUNTO DE ENTRADA PARA PAGOS
> 
> Separá historial y detalle en sus archivos si hoy comparten el mismo.
> La página de detalle muestra el pedido, sus estados y sus acciones.
> Delegá el inicio del pago a una función o servicio pequeño del módulo,
> por ejemplo `startPayment`, apoyado en el cliente API actual.
> 
> Eliminá de `OrderPage` la rama especial de `demoMode`, la interpretación
> de `demo_paid` y los mensajes de «simular pago». Si existe una integración
> de pago vigente, conservá su comportamiento detrás de ese punto de
> entrada. Si el entorno todavía no puede iniciar un pago, el pedido se
> muestra pendiente y se ofrece únicamente una acción que funcione.
> Dejá preparada la conexión para implementar el proveedor después.
> 
> El estado de pago se lee del pedido en la API. Conservá la protección
> contra doble envío, la clave de idempotencia al reintentar y la consulta
> de estado al volver del proveedor. Para verificar un pedido confirmado
> en Docker, usá el pedido seedeado. Si una prueba necesita simular la
> transición, hacelo en su fixture con el contrato normal.

### S5
> 4. VERIFICÁ SOBRE DOCKER
> 
> Recorré home, catálogo, carrito, checkout e historial. Abrí pedidos
> pendiente, confirmado y vencido. Confirmá que los textos de demo se
> eliminaron de las pantallas y que el checkout aprobado sigue igual.
> Verificá el menú y el enlace de salto con teclado, la hidratación SSR
> y el footer en una ruta interna. Entregá los cambios implementados,
> las pruebas y una lista corta de dónde quedaron el header, el footer
> y la función de pago.

## Tasks

- [x] T1 · S1, S2, S5 · delegated direct · shell/header/footer and home mosaic checked on Docker; focused 2/2 plus established shell regression at 320/390/1440.
- [x] T2 · S1, S3–S5 · delegated direct · split order pages and use one payment entry point; enabled and unavailable isolated contract probes, offline shopper suite, six existing store tests, and independent verification. Risk: items 4/5 (payment sequencing and build availability).
- [x] T3 · S3, S5 · inline · fixture text normalization (`39d4f12`, PostgreSQL 3/51), live program/data checks and same-viewport captures; rebuilt only store.

## Log

### L1 — User request
Refactorizá el storefront de Camba v2 sobre el checkout actual. Quiero
una sola experiencia de tienda, con código fácil de seguir y datos de
prueba cargados en PostgreSQL. Conservá el diseño aprobado y el stack
Docker actual en 4200 y 4300.

1. SEPARÁ EL LAYOUT EN COMPONENTES CON RESPONSABILIDADES CLARAS

- StoreShell compone el enlace de salto, header, main con router-outlet
  y footer. Conservá el destino correcto de «Saltar al contenido» al
  navegar a rutas con filtros o parámetros.
- StoreHeader contiene marca, navegación, menú móvil y accesos a
  búsqueda, cuenta y carrito. Reutilizá el estado existente del carrito.
  «Tienda» sigue siendo un enlace directo. El comportamiento del menú
  pertenece al header.
- StoreFooter contiene el pie claro aprobado, con marca, Explorá, Ayuda
  y contacto publicado cuando corresponda.
- El mosaico de seis fotos pertenece al home. Si hoy
  `store-home-closing` mezcla el mosaico con el footer, separalos.
  Preservá las seis fotos, sus recortes, sus enlaces y su posición.

Mantené una separación práctica entre componentes de UI, páginas y
acceso a datos. Reutilizá los servicios y tipos existentes. Extraé
componentes cuando tengan una responsabilidad propia y mantené los
botones y enlaces sencillos dentro de su plantilla.

2. LIMPIÁ LOS RESTOS DE DEMO QUE VE EL CLIENTE

Buscá `demoMode`, `demo_paid`, «simular», «sin cobros» y mensajes como
«No disponible en modo demo» en el storefront. Revisá también los datos
del seed que se muestran como contenido de la tienda, por ejemplo el
nombre del punto de retiro.

Usá los mismos componentes, mensajes y contratos en Docker y en la
tienda normal. Dejá las cuentas, fixtures y datos seedeados como recursos
de desarrollo. Conservá sus accesos documentados en el README. Si una
función está deshabilitada por configuración, mostrá un estado natural o
retirá la acción, según corresponda. Conservá el aislamiento de pagos
y correo de la demo local.

3. SIMPLIFICÁ PEDIDOS Y DEJÁ UN SOLO PUNTO DE ENTRADA PARA PAGOS

Separá historial y detalle en sus archivos si hoy comparten el mismo.
La página de detalle muestra el pedido, sus estados y sus acciones.
Delegá el inicio del pago a una función o servicio pequeño del módulo,
por ejemplo `startPayment`, apoyado en el cliente API actual.

Eliminá de `OrderPage` la rama especial de `demoMode`, la interpretación
de `demo_paid` y los mensajes de «simular pago». Si existe una integración
de pago vigente, conservá su comportamiento detrás de ese punto de
entrada. Si el entorno todavía no puede iniciar un pago, el pedido se
muestra pendiente y se ofrece únicamente una acción que funcione.
Dejá preparada la conexión para implementar el proveedor después.

El estado de pago se lee del pedido en la API. Conservá la protección
contra doble envío, la clave de idempotencia al reintentar y la consulta
de estado al volver del proveedor. Para verificar un pedido confirmado
en Docker, usá el pedido seedeado. Si una prueba necesita simular la
transición, hacelo en su fixture con el contrato normal.

4. VERIFICÁ SOBRE DOCKER

Recorré home, catálogo, carrito, checkout e historial. Abrí pedidos
pendiente, confirmado y vencido. Confirmá que los textos de demo se
eliminaron de las pantallas y que el checkout aprobado sigue igual.
Verificá el menú y el enlace de salto con teclado, la hidratación SSR
y el footer en una ruta interna. Entregá los cambios implementados,
las pruebas y una lista corta de dónde quedaron el header, el footer
y la función de pago.

### L2 — Baseline
- Inherited storefront edits, demo layers and Docker image recipe must stay intact; no publication. Router shell and home closing currently mix unrelated responsibilities. At 4200 the seeded pending order offers two actions although the stack has no configured payment provider. Preserved baseline home and identical-setting checkout captures at 1440 and 390 in `web/test-results/storefront-unified` before editing any source.

### L3 — Delivery and checks
- `StoreShell` owns the skip/existing main and root styling; `layout/store-header.*` owns the native mobile popover, links and cart subscription; `layout/store-footer.*` owns the published support information and catalog directory. The home mosaic remains after the editorial, inside the page. For local anchors, Angular `Location` reflects both query-only navigation and the sanitized URL after provider returns. The legacy footer top link failed on an internal filtered route because of the HTML document base; this was reproduced with Chromium/no JS and fixed via the same shell route anchor.
- History/detail now load separately. `shopper/order-payment.ts` owns `startPayment`. The independent Angular `no-payment` capability still uses real purchases, order data and a useful GET-only state action; it does not start one or enqueue a provider reconciliation. Production keeps its existing integration; the offline fixture has no mock payment action or sentinel. Middleware, API schema, mail and provider credentials were not changed.
- PostgreSQL seed tests RED on the former public business name and GREEN with 3 tests/51 assertions; Pint passed. Live normalization guarded exact fixture rows; only display fields and image descriptions changed. Before/after fingerprints match for the two accounts excluding display name, both address records excluding recipient name, all three order snapshots and lines, two cart items, and nine products. Case data, order/payment statuses, flags, and PostgreSQL volume remain. Mailpit and empty provider credentials checked in API, worker and scheduler. The storefront account remains documented.
- Optimized Docker SSR and ordinary production SSR build passed (existing `home.css` budget warning). Playwright Docker journey passed at 1440/390: home, filtered catalog, account/cart, checkout, all three order statuses; zero payment POSTs/external browser requests. Focused keyboard/SSR tests passed 2/2 (including no JS and retained filters on the top link); established shell verification passed at 320/390/1440. Home screenshots match pixel-for-pixel, both checkout page sizes match and the only changes are the synthetic name and the accurate next-step copy. Evidence: `web/test-results/storefront-unified`.
- Playwright real-API account/checkout and Admin smoke passed, no writes to order/payment state. Enabled and disabled isolated frontend payment-contract checks passed (HTTPS-only redirect, lost response/retry key, double-submit guard, sanitized provider-return URL, authoritative GET, disabled duplicate refresh and read failure). Existing shopper suite 6/6 and offline shopper smoke passed. The suite emitted an unrelated Admin stylesheet warning during another worktree change; live Admin smoke passed. Real external payments were not attempted.
- Independent verifier: no new reproduced blocker (including forged status remains pending and no-payment double refresh makes a single GET). Native assessment was unassessable for the inherited untracked working tree; no receipt claimed. The clean seed slice was committed; frontend files overlap inherited work and remain installed from the local tree, without staging it all or publishing.

