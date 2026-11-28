# Angular environments and Checkout Pro availability
Branch feat/camba-v2 · baseline a2940ae plus inherited uncommitted local-port work · local only · ask-on-risk for publication (not requested) · forecast 400–550 authored lines.
Runners: isolated Laravel PHPUnit with blocking HTTP fake, Angular builds and Chromium on the local Docker Store with a simulated payment provider.

## Specs

- S1. Agregá environments explícitos para desarrollo y producción en los proyectos Angular de Tienda y Admin. Conectalos en angular.json y verificá qué configuración usa cada build de Docker. Buscá y mové a configuración las URLs, los orígenes y los flags que cambian entre entornos. Respetá el proxy y la configuración SSR existentes. La API está disponible en localhost:8000 para pruebas directas. Si el navegador ya usa rutas relativas por el proxy, preservá ese flujo para que las cookies y CSRF sigan funcionando. El access token de Mercado Pago queda en Laravel.
- S2. Reproducí el fallo en http://localhost:4200. Desde el clic en «Confirmar pedido», seguí el handler, las peticiones y sus respuestas. Comprobá si la API del Docker activo tiene habilitado Checkout Pro, si lee las credenciales del .env y si devuelve la URL de pago. Identificá la causa exacta usando ese entorno.
- S3. Hacé que «Confirmar pedido» cree o reutilice el pedido, inicie Checkout Pro y redirija a la URL que devuelve Laravel, todo en el mismo clic. Si falla la apertura, mostrá un error claro y permití reintentar desde el mismo pedido. Evitá pedidos y reservas duplicados por doble clic o reintento. Si faltan credenciales de prueba o la configuración está deshabilitada, hacelo visible en el checkout.
- S4. Aplicá los cambios al Docker habitual y probá el botón real desde 4200. Verificá en el navegador que un clic genera un solo pedido y abre Mercado Pago. Probá también un fallo de apertura y el reintento. Si falta configuración para probar el sandbox real, indicá qué variable o URL falta y qué comprobaste con el proveedor simulado.
- S5: Revisá el webhook y el fallback de Mercado Pago tomando la implementación de Komorebi como referencia. Seguí el código de Komorebi desde que llega la notificación hasta que se actualiza el pedido. Identificá también qué mecanismo recupera un pago cuando el webhook se demora o nunca llega, y adaptá ese mismo flujo a Camba.
  En Camba, verificá que la URL del webhook apunte a la API del entorno, que se valide la firma y que Laravel consulte el pago directamente en Mercado Pago. Antes de confirmar el pedido, comprobá el estado, la referencia, el importe, la moneda y el vendedor. Los parámetros de retorno del navegador pueden disparar una consulta, pero la confirmación sale de la respuesta verificada de Mercado Pago.
  Hacé que el webhook y el fallback usen la misma lógica de conciliación. Si los dos procesan el mismo pago, el pedido debe actualizarse una sola vez y los avisos y movimientos de stock deben quedar sin duplicados. Una notificación vieja tampoco debe revertir un pedido ya pagado.
  Probá el webhook normal, uno repetido, una firma inválida y un pago aprobado cuyo webhook nunca llega. En este último caso, comprobá que el fallback actualice el pedido en Tienda y Admin. Si Komorebi usa conciliación programada, probá también el caso en que el comprador cierra la pestaña sin volver a Camba.
  Mostrá qué fallback encontraste en Komorebi, dónde quedó en Camba y qué pruebas pasaron. Verificá los eventos en el canal `pagos` con el ID del pedido, sin incluir credenciales ni datos personales.
- S6: “Entregá la causa concreta, los archivos de environment que usa cada build y la evidencia del clic en «Confirmar pedido» hasta la redirección.”

## Tasks

- T1 · S1/S2/S5 · mapping and runtime diagnostic complete; actual 4200 browser RED recorded.
- T2 · S1/S3/S4/S6 · inline · implemented explicit build environments and checkout readiness; PHP RED→GREEN and three isolated Chromium tests passed. Independent check: diff clean and 26 readiness cases passed, no blocker. Risk: items 2/4/5 (credential boundary, order/payment orchestration and Docker/SSR config).
- T3 · S5 · inline · existing payment evidence kernel preserved; signature/replay and unattended recovery passed in isolated Laravel, including both owner and Admin status, one notice per channel after replay and sanitized pagos.
- T4 · S4/S6 · inline · build and isolated Chromium verified; habitual 4200 post-change browser and HTTP proof blocked by the Docker Desktop Linux engine; real sandbox also blocked by seller ID and public HTTPS API origin.

## Log

### L1 — Initial user request (2026-11-25)

Corregí la configuración de Angular y el checkout de Mercado Pago en C:\Users\Josec\camba. Usá Komorebi como referencia para el recorrido de pago.

1. Agregá environments explícitos para desarrollo y producción en los proyectos Angular de Tienda y Admin. Conectalos en angular.json y verificá qué configuración usa cada build de Docker. Buscá y mové a configuración las URLs, los orígenes y los flags que cambian entre entornos. Respetá el proxy y la configuración SSR existentes. La API está disponible en localhost:8000 para pruebas directas. Si el navegador ya usa rutas relativas por el proxy, preservá ese flujo para que las cookies y CSRF sigan funcionando. El access token de Mercado Pago queda en Laravel.

2. Reproducí el fallo en http://localhost:4200. Desde el clic en «Confirmar pedido», seguí el handler, las peticiones y sus respuestas. Comprobá si la API del Docker activo tiene habilitado Checkout Pro, si lee las credenciales del .env y si devuelve la URL de pago. Identificá la causa exacta usando ese entorno.

3. Hacé que «Confirmar pedido» cree o reutilice el pedido, inicie Checkout Pro y redirija a la URL que devuelve Laravel, todo en el mismo clic. Si falla la apertura, mostrá un error claro y permití reintentar desde el mismo pedido. Evitá pedidos y reservas duplicados por doble clic o reintento. Si faltan credenciales de prueba o la configuración está deshabilitada, hacelo visible en el checkout.

4. Aplicá los cambios al Docker habitual y probá el botón real desde 4200. Verificá en el navegador que un clic genera un solo pedido y abre Mercado Pago. Probá también un fallo de apertura y el reintento. Si falta configuración para probar el sandbox real, indicá qué variable o URL falta y qué comprobaste con el proveedor simulado.

Entregá la causa concreta, los archivos de environment que usa cada build y la evidencia del clic en «Confirmar pedido» hasta la redirección.

### L2 — Webhook and fallback requirement (2026-11-25)

5. Revisá el webhook y el fallback de Mercado Pago tomando la implementación de Komorebi como referencia. Seguí el código de Komorebi desde que llega la notificación hasta que se actualiza el pedido. Identificá también qué mecanismo recupera un pago cuando el webhook se demora o nunca llega, y adaptá ese mismo flujo a Camba.

En Camba, verificá que la URL del webhook apunte a la API del entorno, que se valide la firma y que Laravel consulte el pago directamente en Mercado Pago. Antes de confirmar el pedido, comprobá el estado, la referencia, el importe, la moneda y el vendedor. Los parámetros de retorno del navegador pueden disparar una consulta, pero la confirmación sale de la respuesta verificada de Mercado Pago.

Hacé que el webhook y el fallback usen la misma lógica de conciliación. Si los dos procesan el mismo pago, el pedido debe actualizarse una sola vez y los avisos y movimientos de stock deben quedar sin duplicados. Una notificación vieja tampoco debe revertir un pedido ya pagado.

Probá el webhook normal, uno repetido, una firma inválida y un pago aprobado cuyo webhook nunca llega. En este último caso, comprobá que el fallback actualice el pedido en Tienda y Admin. Si Komorebi usa conciliación programada, probá también el caso en que el comprador cierra la pestaña sin volver a Camba.

Mostrá qué fallback encontraste en Komorebi, dónde quedó en Camba y qué pruebas pasaron. Verificá los eventos en el canal `pagos` con el ID del pedido, sin incluir credenciales ni datos personales.

### L3 — Reference and boundaries

Komorebi's hosted Checkout Pro redirects and uses a signed webhook or return status search then a server-side authoritative payment lookup through its shared synchronizer. No unattended Mercado Pago job in its inspected scheduler. Camba already shares ApplyPaymentEvidence between its authenticated webhook inbox and minute reconciliation with no buyer/browser prerequisite. Preserve that kernel, stable order/preference, and same-origin cookies/CSRF; do not move credentials or server-only origins into Angular browser bundles. Prior local ports and their separate review remain intact.

### L4 — Diagnosis and isolated validation

- Actual 4200 browser, with a simulated order response and no database writes: “Confirmar pedido” sent one order POST (201), no payment POST, then opened the order. Local Docker build was `production,editorial,no-payment`. Laravel read non-placeholder provider configuration but had no valid collector ID and its origin was loopback HTTP. Exact credential values were not read out or contacted.
- RED: public capability absent; invalid HTTPS configuration created an uncertain attempt and returned 409 instead of rejecting without an attempt. GREEN: 66 Laravel tests / 1011 assertions and Pint inside Docker with memory SQLite and HTTP fakes, 3 isolated Chromium tests (existing order replay, return/rejection/approval and abandoned checkout). With no webhook, scheduled reconciliation passed the buyer and Admin paid detail checks; late replay left one paid notice per channel and the same reserved stock. Dedicated `pagos` tests verified order/correlation IDs and redaction.
- Docker Store `production,editorial` built. Host production Store/Admin and development Admin built in scratch. Applied Store image and restarted the existing Admin container before Docker Desktop stopped. Recovery is restoring existing containers only; final 4200 click trace and readiness still pending.

### L5 — Live validation boundary

The optimized Store built/recreated and was initially healthy; the existing Admin restarted. Before post-change HTTP and browser checks the Docker Desktop Linux engine disappeared. The supported start/recovery attempt did not restore the engine; 4200/4300/8000/8025 no longer accepted HTTP connections. No data services or volumes were recreated. The browser capture delivered here is from the isolated Chromium suite, not an active sandbox or the post-change habitual Docker. The tests use synthetic provider responses, including same-order retry. Remaining: restore Docker and repeat the 4200 browser click and HTTP checks; configure a valid MERCADOPAGO_COLLECTOR_ID and public HTTPS CAMBA_DEV_APP_URL for a real sandbox callback before testing with the provider.