# Correo seguro de retracto y sincronización del carrito
feat/camba-v2 · HEAD 109ce9a, cambios locales previos preservados; entrega local.
Runners: Laravel SQLite aislado, Playwright y escenario de prueba en camba-v2-demo-pg. Estimación: 180–300 líneas propias.

## Specs
### S1
Mantené la recepción del retracto aunque el correo no coincida. Mostrá siempre la misma constancia guardable en pantalla, sin revelar si existe el pedido, y avisá al admin para que pueda revisar el caso. Enviá la copia por correo únicamente si el servidor verifica que la referencia y el correo corresponden a la misma compra. Si no coinciden, dejá la solicitud sin vincular, sin correo externo y sin habilitar el reintegro desde esa solicitud. Cambiá el mensaje en pantalla para que indique que la copia por correo se envía solo si los datos coinciden. Probá en Mailpit que con un pedido existente y un correo distinto llegue solo el aviso interno, y que con los datos correctos llegue también la copia al comprador.

### S2
Corregí el contador del carrito en la cabecera de Camba. Reutilizá CART_CHANGED para que, cuando la API confirme el pago al volver de Mercado Pago o durante la verificación posterior, la cabecera vuelva a consultar el carrito. El número debe reflejar las unidades que devuelve el servidor y desaparecer cuando queden cero. Asegurate también de que al abrir «Tu carrito», la cabecera refleje los mismos datos que muestra la página.

Validá en Playwright que el contador se actualice sin recargar, que conserve las unidades de otros productos que sigan en el carrito y que un pago pendiente o rechazado mantenga los productos. Usá un pago simulado en camba-v2-demo-pg.

## Tasks
- [x] T1 · S1 · inline · recepción neutral, entrega condicionada y protección de reintegro; riesgo 2 (revelación de datos y control de vinculación).
- [x] T2 · S2 · inline · actualización del contador al recibir estado pagado y al cargar carrito.

## Log
### L1 · solicitud original
Mantené la recepción del retracto aunque el correo no coincida. Mostrá siempre la misma constancia guardable en pantalla, sin revelar si existe el pedido, y avisá al admin para que pueda revisar el caso. Enviá la copia por correo únicamente si el servidor verifica que la referencia y el correo corresponden a la misma compra. Si no coinciden, dejá la solicitud sin vincular, sin correo externo y sin habilitar el reintegro desde esa solicitud. Cambiá el mensaje en pantalla para que indique que la copia por correo se envía solo si los datos coinciden. Probá en Mailpit que con un pedido existente y un correo distinto llegue solo el aviso interno, y que con los datos correctos llegue también la copia al comprador.Corregí el contador del carrito en la cabecera de Camba. Reutilizá CART_CHANGED para que, cuando la API confirme el pago al volver de Mercado Pago o durante la verificación posterior, la cabecera vuelva a consultar el carrito. El número debe reflejar las unidades que devuelve el servidor y desaparecer cuando queden cero. Asegurate también de que al abrir «Tu carrito», la cabecera refleje los mismos datos que muestra la página.

Validá en Playwright que el contador se actualice sin recargar, que conserve las unidades de otros productos que sigan en el carrito y que un pago pendiente o rechazado mantenga los productos. Usá un pago simulado en camba-v2-demo-pg.

- RED: el caso con correo equivocado creaba una copia y la prueba del contador veía 5 tras confirmación o después de que el carrito vacío había cargado.
- GREEN: 38 Laravel/672 aserciones; 5 Playwright en suite aislada y 2 de contador sobre el Store de Docker. La prueba real con evidencia de aprobación simulada y GETs locales de Laravel/PostgreSQL pasó de 5 a 3 unidades sin recargar.
- Mailpit/worker existentes: pedido existente con correo distinto 1 interno/0 comprador; correo correcto 1 interno/1 comprador; constancia y guardado indistinguibles, mismo número al repetir, bloqueo 409 de vínculo/reintegro y antigua cola no verificable cancelada. Verificación independiente S1 aprobada.
- Solo se reconstruyó/recreó store y reinició worker; archivos por montaje en Admin/API, puertos y volúmenes intactos. No se hizo un commit combinado con los cambios previos. Gentle AI preflight no iniciado (invalid_request, intended_untracked_selection_required).
