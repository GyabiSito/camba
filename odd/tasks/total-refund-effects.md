# Avisos y registro de reintegros totales
feat/camba-v2 · HEAD 109ce9a, con cambios locales previos preservados · validación local, sin publicación.
Runners: Laravel en SQLite aislado y Compose existente camba-v2-demo-pg con PostgreSQL, Redis y Mailpit; proveedor simulado. Estimación: 350–500 líneas propias.

## Specs

### S1
Implementá los avisos y el log de reintegros totales en Camba v2, sobre el HEAD local actual.

1. Cuando la conciliación verifique por primera vez un reintegro total con Mercado Pago, generá dos correos transaccionales:
   - Comprador. Asunto «Camba: confirmamos tu reintegro». Incluí monto, moneda, referencia y enlace a «Ver pedido». Usá el correo de la cuenta compradora, siguiendo la misma regla del comprobante.
   - Admin. Asunto «Camba: reintegro total verificado». Incluí monto, moneda, referencia y enlace al pedido en Admin. Si hay una solicitud de arrepentimiento vinculada, incluí también su constancia y un enlace para revisarla. Usá el mismo destinatario interno que recibe «Nuevo pedido en Camba».

   Reutilizá la cola y las plantillas HTML y texto plano de los correos existentes. El disparador debe ser la conciliación que consulta a Mercado Pago y verifica el monto sobre el pago original. Debe funcionar tanto por webhook como por verificación manual. «Registrar reintegro confirmado» sigue siendo el paso administrativo de la solicitud.

### S2
2. Escribí una entrada JSON por reintegro total verificado en `storage/logs/refounds/DDMMAAAA.log`, con la fecha de verificación en `America/Montevideo`. Conservá el nombre `refounds` tal cual. Reutilizá el handler diario de `pagos`. Incluí fecha y hora, referencia Camba, IDs de orden y pago de Mercado Pago, monto, moneda y, si existe, la constancia vinculada. Limitá el registro a esos campos. Confirmá que el proceso que concilia pueda escribirlo en el almacenamiento del stack.

### S3
3. Protegé los dos avisos y el registro contra duplicados por webhook repetido, reintentos y conciliaciones concurrentes. Persistí los avisos con la confirmación para que un fallo de correo permita recuperarlos sin perder el reintegro. Un reintegro parcial, pendiente o de otro pago debe generar cero correos de confirmación total y cero entradas de reintegro total.

Validá en `camba-v2-demo-pg` con evidencia simulada basada en el `order.refunded` de esta prueba. Confirmá en Mailpit que llega un correo a cada destinatario y que el archivo tiene una sola entrada, incluso al repetir el evento y pedir una verificación manual. Usá los contenedores y volúmenes existentes, aplicá los cambios solo a los servicios necesarios y mantené la prueba aislada de Mercado Pago real. Informá los resultados y la ruta exacta del log dentro del contenedor.

### S4
Además de los dos avisos que se generan al verificar el reintegro con Mercado Pago, agregá un correo al comprador cuando el admin haga clic en «Registrar reintegro confirmado» y la solicitud cambie efectivamente a «Reintegro confirmado».

Asunto: «Camba: resolvimos tu solicitud de arrepentimiento».
Contenido: número de constancia, referencia del pedido, importe y moneda del reintegro ya verificado, fecha de cierre y enlace a «Ver pedido». Usá el correo de la cuenta compradora según la misma regla del comprobante. Reutilizá las plantillas HTML y texto plano.

Guardá el aviso en la misma transacción que el cierre y envialo por la cola después del commit. Deduplicá por solicitud y tipo de aviso. Un doble clic, un reintento o una solicitud ya cerrada deben generar cero correos adicionales. «Cerrar sin reintegro» tampoco debe disparar este aviso.

Probalo en Mailpit con una solicitud nueva y evidencia de reintegro simulada. Primero verificá que la conciliación genere sus dos avisos. Después registrá el reintegro desde Admin y comprobá que llegue exactamente un correo adicional al comprador, con la constancia correcta. Usá `camba-v2-demo-pg`.

## Tasks
- [x] T1 · S1–S3 · inline · evidencia estricta, dos avisos y proyección idempotente del log.
- [x] T2 · S4 · inline, depende de T1 · aviso comprador al guardar cierre.
- [x] T3 · S1–S4 · verificación local + independiente (riesgo 4) · runner simulado y stack compartido.

## Log
- L1 (pedido literal):

Implementá los avisos y el log de reintegros totales en Camba v2, sobre el HEAD local actual.

1. Cuando la conciliación verifique por primera vez un reintegro total con Mercado Pago, generá dos correos transaccionales:
   - Comprador. Asunto «Camba: confirmamos tu reintegro». Incluí monto, moneda, referencia y enlace a «Ver pedido». Usá el correo de la cuenta compradora, siguiendo la misma regla del comprobante.
   - Admin. Asunto «Camba: reintegro total verificado». Incluí monto, moneda, referencia y enlace al pedido en Admin. Si hay una solicitud de arrepentimiento vinculada, incluí también su constancia y un enlace para revisarla. Usá el mismo destinatario interno que recibe «Nuevo pedido en Camba».

   Reutilizá la cola y las plantillas HTML y texto plano de los correos existentes. El disparador debe ser la conciliación que consulta a Mercado Pago y verifica el monto sobre el pago original. Debe funcionar tanto por webhook como por verificación manual. «Registrar reintegro confirmado» sigue siendo el paso administrativo de la solicitud.

2. Escribí una entrada JSON por reintegro total verificado en `storage/logs/refounds/DDMMAAAA.log`, con la fecha de verificación en `America/Montevideo`. Conservá el nombre `refounds` tal cual. Reutilizá el handler diario de `pagos`. Incluí fecha y hora, referencia Camba, IDs de orden y pago de Mercado Pago, monto, moneda y, si existe, la constancia vinculada. Limitá el registro a esos campos. Confirmá que el proceso que concilia pueda escribirlo en el almacenamiento del stack.

3. Protegé los dos avisos y el registro contra duplicados por webhook repetido, reintentos y conciliaciones concurrentes. Persistí los avisos con la confirmación para que un fallo de correo permita recuperarlos sin perder el reintegro. Un reintegro parcial, pendiente o de otro pago debe generar cero correos de confirmación total y cero entradas de reintegro total.

Validá en `camba-v2-demo-pg` con evidencia simulada basada en el `order.refunded` de esta prueba. Confirmá en Mailpit que llega un correo a cada destinatario y que el archivo tiene una sola entrada, incluso al repetir el evento y pedir una verificación manual. Usá los contenedores y volúmenes existentes, aplicá los cambios solo a los servicios necesarios y mantené la prueba aislada de Mercado Pago real. Informá los resultados y la ruta exacta del log dentro del contenedor.

Además de los dos avisos que se generan al verificar el reintegro con Mercado Pago, agregá un correo al comprador cuando el admin haga clic en «Registrar reintegro confirmado» y la solicitud cambie efectivamente a «Reintegro confirmado».

Asunto: «Camba: resolvimos tu solicitud de arrepentimiento».
Contenido: número de constancia, referencia del pedido, importe y moneda del reintegro ya verificado, fecha de cierre y enlace a «Ver pedido». Usá el correo de la cuenta compradora según la misma regla del comprobante. Reutilizá las plantillas HTML y texto plano.

Guardá el aviso en la misma transacción que el cierre y envialo por la cola después del commit. Deduplicá por solicitud y tipo de aviso. Un doble clic, un reintento o una solicitud ya cerrada deben generar cero correos adicionales. «Cerrar sin reintegro» tampoco debe disparar este aviso.

Probalo en Mailpit con una solicitud nueva y evidencia de reintegro simulada. Primero verificá que la conciliación genere sus dos avisos. Después registrá el reintegro desde Admin y comprobá que llegue exactamente un correo adicional al comprador, con la constancia correcta. Usá `camba-v2-demo-pg`.

- Mapa previo: el snapshot de Orders debe probar `transactions.refunds` procesados del pago acreditado y total exacto. La ruta de conciliación compartida y el outbox existente permiten registrar los efectos bajo el lock del pedido. El host no tiene montaje de `refounds`, pero API/worker/scheduler comparten el volumen `api-storage`; no se requiere modificar Compose.
- RED: Orders aceptaba la devolución parcial como estado refunded; el cierre no tenía aviso. GREEN: 94 pruebas y 1396 aserciones, 1 omitida por driver; se comprobó el recupero de una cola de archivo con fin parcial y el cambio de fecha de Uruguay.
- En camba-v2-demo-pg: dos entregas firmadas simuladas concurrentes, refresh manual simulado y una sola línea; antes del cierre, 1 + 1 correos; tras «Registrar reintegro confirmado», 1 correo adicional y PATCH repetido idéntico. QA de 451 UYU sin consultar al proveedor real. Solo se reinició worker; fuentes por montaje, sin cambios de Compose ni migraciones.
- Verificación independiente aprobada: sumas de reintegros procesados, rechazo por remanente pendiente/ajeno o duplicado, reintento del log cruzando medianoche, recuperación de escritura sin ACK y cierre ya cerrado. Se agregó una prueba durable de reintento de proyección.
- Entrega local sobre el árbol de trabajo; sin commit conjunto con trabajo previo. Gentle AI detectó riesgo alto sobre un candidato mixto y no congeló autoridad: el preflight respondió `invalid_request` (selección de archivos sin seguimiento requerida).
