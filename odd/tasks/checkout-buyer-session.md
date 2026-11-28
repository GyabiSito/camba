# Checkout exige cuenta compradora
feat/camba-v2 · baseline acab374 + cambios locales preservados · entrega local, sin publicación.
Runners: Laravel en PostgreSQL aislado; build SSR Docker habitual; Playwright en localhost:4200. Forecast 350–450 líneas incluyendo pruebas; ask-on-risk si se solicita publicar.

## Specs

S1. En web/projects/store/src/app/features/orders/data-access/order.models.ts, corregí las etiquetas a En preparación y Pago en revisión. Guardá el archivo en UTF‑8, reconstruí la Tienda y verificá que en el detalle del pedido, bajo «Retiro», se lea En preparación.Corregí el carrito y el checkout de Camba en la rama local.

S2. 1. Carrito. Eliminá el bloque «Pedido confirmado / Tu pago fue aprobado» de /carrito. Después de una acreditación verificada, el detalle del pedido muestra la confirmación. Al volver al carrito, mostrá el estado vacío si ya no quedan productos, o los artículos que todavía estén ahí. Conservá el carrito si el pago sigue pendiente, falla o se cancela.

S3. 2. Compra con cuenta obligatoria. Una persona puede navegar y armar el carrito sin sesión. Al elegir «Continuar la compra», ofrecé Iniciar sesión y Crear cuenta. Reutilizá /cuenta?volver=checkout y la fusión del carrito de invitado. Verificá que tanto el ingreso como el registro permitan retomar la compra con los productos y cantidades conservados. Protegé también el acceso directo a /checkout.

S4. 3. Aplicá la regla en Laravel. Revisá api/routes/orders.php y api/routes/payments.php. Exigí sesión de comprador y verificá la titularidad para crear pedidos e iniciar, reanudar o reintentar un pago. Conservá la consulta de pedidos anteriores de invitados por su mecanismo actual y la conciliación de pagos ya iniciados. Actualizá el checkout, las preguntas frecuentes y los términos donde dicen que se puede comprar como invitado.

S5. 4. Verificá en Docker que una llamada directa sin sesión no cree un pedido ni una orden de Mercado Pago, que ingresar o registrarse conserve el carrito y que, después de un pago aprobado simulado, la confirmación aparezca en el pedido y nunca en /carrito.

## Tasks

- [x] T1 · S2–S4 · inline, mapa delegado · RED: POST invitado devolvía 201 y fallback quitaba productos; GREEN: sesión/titularidad y consumo solo tras acreditación.
- [x] T2 · S1, S5 · build Store SSR, Docker 4200 + PostgreSQL aislado, verificación independiente estática sin bloqueos. Suite de navegador del host no está verde; ver L4.

## Log

L1.
En web/projects/store/src/app/features/orders/data-access/order.models.ts, corregí las etiquetas a En preparación y Pago en revisión. Guardá el archivo en UTF‑8, reconstruí la Tienda y verificá que en el detalle del pedido, bajo «Retiro», se lea En preparación.Corregí el carrito y el checkout de Camba en la rama local.
1. Carrito. Eliminá el bloque «Pedido confirmado / Tu pago fue aprobado» de /carrito. Después de una acreditación verificada, el detalle del pedido muestra la confirmación. Al volver al carrito, mostrá el estado vacío si ya no quedan productos, o los artículos que todavía estén ahí. Conservá el carrito si el pago sigue pendiente, falla o se cancela.
2. Compra con cuenta obligatoria. Una persona puede navegar y armar el carrito sin sesión. Al elegir «Continuar la compra», ofrecé Iniciar sesión y Crear cuenta. Reutilizá /cuenta?volver=checkout y la fusión del carrito de invitado. Verificá que tanto el ingreso como el registro permitan retomar la compra con los productos y cantidades conservados. Protegé también el acceso directo a /checkout.
3. Aplicá la regla en Laravel. Revisá api/routes/orders.php y api/routes/payments.php. Exigí sesión de comprador y verificá la titularidad para crear pedidos e iniciar, reanudar o reintentar un pago. Conservá la consulta de pedidos anteriores de invitados por su mecanismo actual y la conciliación de pagos ya iniciados. Actualizá el checkout, las preguntas frecuentes y los términos donde dicen que se puede comprar como invitado.
4. Verificá en Docker que una llamada directa sin sesión no cree un pedido ni una orden de Mercado Pago, que ingresar o registrarse conserve el carrito y que, después de un pago aprobado simulado, la confirmación aparezca en el pedido y nunca en /carrito.

L2. El código existente ya tiene fusión al ingresar y alcance por titular; mantener el histórico invitado y el webhook. El cambio parte de un árbol con varias modificaciones previas, que no se mezclarán en commits.

L3. Laravel aplica `auth:web` y `can:camba-buyer` a crear pedido, iniciar/reintentar pago y reanudar desde el carrito. El histórico invitado conserva lectura y consulta de pagos. El carrito queda enlazado incluso cuando el proveedor está deshabilitado y solo descuenta cantidades en la primera transición acreditada. Mantener los avisos no administrados frente a este cambio de carrito.

L4. Docker: Tienda construida y recreada; worker/scheduler reiniciados, volúmenes intactos. Chromium en 4200 comprobó acceso directo y tres 401 con CSRF válido; registro 2 unidades, acceso posterior 3; con respuesta simulada, Retiro muestra En preparación, detalle muestra Pago en revisión para revisión y Pedido confirmado solo si pagado. Carrito muestra vacío o remanentes, no el banner. Laravel PostgreSQL aislado: 120 pruebas, 1739 aserciones sin red al proveedor en las pruebas de pago. Suite Playwright aislada del host en primera corrida: 8 pasaron y 6 fallaron; observados bloqueos SQLite, SDK de Mercado Pago ausente en vendor del host y espera del guard al volver después de autenticación. Se quitó la carga no necesaria de datos de cuenta antes de volver y la prueba de navegador Docker volvió a pasar. No se ejecutaron pagos reales.

L5. Risk: items 2, 3 y 4 (autorización de mutaciones, contrato HTTP y consumo idempotente del carrito). Verificador independiente leyó titularidad/retención/UTF-8 y no halló bloqueos. Gentle AI devolvió unassessable: untracked files require an explicit declaration. No se congeló la revisión ni se creó un commit mezclando cambios previos del mismo árbol.
