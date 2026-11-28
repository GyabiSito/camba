# Camba v2 — cierre local de auditoría 1–3
feat/camba-v2 · base fa027ce, rama limpia al inicio · local only / ask-on-risk.
Runners: Docker aislado para infraestructura, Laravel SQLite aislado y Playwright/Mailpit para demo. Forecast: 650–950 líneas.

## Specs
### S1
Corregí los puntos 1, 2 y 3 de la auditoría de Camba v2 sobre el HEAD local de `feat/camba-v2`. Conservá los cambios existentes. Dejá CI/CD, `develop`, el merge a `main` y el despliegue para después.
1. Persistí el log de reintegros en producción

Renombrá el canal y el directorio `refounds` a `refunds`. La ruta final debe ser `/var/www/html/storage/logs/refunds/DDMMAAAA.log`.

Actualizá las referencias en Laravel, Docker, las pruebas y la documentación. Montá `storage/logs/refunds` en un volumen persistente compartido por `api-fpm`, `worker` y `scheduler`. Si ya hay archivos en `refounds`, preservalos en la ruta nueva sin duplicar entradas.

Verificá en Docker aislado que quede una sola línea por reintegro y que el archivo siga disponible después de recrear el contenedor.

### S2
2. Cerrá Términos y Privacidad

Usá como fuente de datos de Camba las páginas públicas https://www.camba.com.uy/terms-conditions, https://www.camba.com.uy/privacy-policy y https://www.camba.com.uy/contact. Tomá de ahí el RUT, domicilio, teléfonos y datos de contacto. José ya aprobó adaptar los textos a Uruguay y a la operación real de Camba v2.

Conectá la denominación fiscal a `CAMBA_FISCAL_NAME` en el `.env` de la API. José va a completar ese valor. Dejá la variable documentada y vacía en `.env.example`. Exponé a Tienda únicamente el valor público necesario. Conservá las versiones históricas de los términos y el texto guardado en las compras existentes.

### S3
3. Corregí y completá el flujo de arrepentimiento

- Mantené únicamente el botón público en Inicio, sin login. El formulario sigue pidiendo la referencia del pedido y el correo. Siempre devuelve una constancia con número y fecha, sin revelar si el pedido existe.
- Para pedidos asociados a una cuenta, compará con el correo verificado de la cuenta dueña del pedido. El contacto editable del checkout queda fuera de esa validación. Si se combina el pedido de A con el correo de B, guardá la solicitud sin vincular, avisá al admin y evitá enviarle correo a B.
- En Admin, al revisar un caso sin vincular cuyo pedido existe, agregá «Solicitar confirmación». Reutilizá la cola de correo y mandá un enlace con vencimiento y de un solo uso al correo verificado de la cuenta dueña del pedido. Abrir el enlace muestra la confirmación. Recién al tocar «Sí, hice esta solicitud» se vincula el pedido, sin exigir login. Así, un escáner de correo que abra el enlace no confirma la solicitud.
- Al vincular, conservá el número, la fecha y el correo ingresado originalmente. Registrá qué admin pidió la confirmación y cuándo confirmó el comprador. Un enlace vencido, alterado o reutilizado no debe cambiar el caso. La confirmación solo vincula el pedido. Para registrar un reintegro, seguí exigiendo evidencia de la devolución total del pago original en Mercado Pago.

Validá con Laravel, Playwright y Mailpit. Cubrí correo correcto, pedido de A con correo de B, confirmación válida, vencimiento, reintentos y conservación de la constancia. Probá el reintegro con evidencia simulada. Entregá el SHA, los resultados y lo que quede pendiente. Evitá cobros, reintegros reales, correos externos y cambios en producción.

## Tasks
- [x] T1 · S1 · delegado · riesgo 1/5 · a3c8ecc.
- [x] T2 · S2 · delegado · riesgo 3 · fb15a6a.
- [x] T3 · S3 · inline · riesgos 2/4 · implementado en el commit que contiene esta entrada.

## Log
### L1 · pedido
Corregí los puntos 1, 2 y 3 de la auditoría de Camba v2 sobre el HEAD local de `feat/camba-v2`. Conservá los cambios existentes. Dejá CI/CD, `develop`, el merge a `main` y el despliegue para después.
1. Persistí el log de reintegros en producción

Renombrá el canal y el directorio `refounds` a `refunds`. La ruta final debe ser `/var/www/html/storage/logs/refunds/DDMMAAAA.log`.

Actualizá las referencias en Laravel, Docker, las pruebas y la documentación. Montá `storage/logs/refunds` en un volumen persistente compartido por `api-fpm`, `worker` y `scheduler`. Si ya hay archivos en `refounds`, preservalos en la ruta nueva sin duplicar entradas.

Verificá en Docker aislado que quede una sola línea por reintegro y que el archivo siga disponible después de recrear el contenedor.2. Cerrá Términos y Privacidad

Usá como fuente de datos de Camba las páginas públicas https://www.camba.com.uy/terms-conditions, https://www.camba.com.uy/privacy-policy y https://www.camba.com.uy/contact. Tomá de ahí el RUT, domicilio, teléfonos y datos de contacto. José ya aprobó adaptar los textos a Uruguay y a la operación real de Camba v2.

Conectá la denominación fiscal a `CAMBA_FISCAL_NAME` en el `.env` de la API. José va a completar ese valor. Dejá la variable documentada y vacía en `.env.example`. Exponé a Tienda únicamente el valor público necesario. Conservá las versiones históricas de los términos y el texto guardado en las compras existentes.

3. Corregí y completá el flujo de arrepentimiento

- Mantené únicamente el botón público en Inicio, sin login. El formulario sigue pidiendo la referencia del pedido y el correo. Siempre devuelve una constancia con número y fecha, sin revelar si el pedido existe.
- Para pedidos asociados a una cuenta, compará con el correo verificado de la cuenta dueña del pedido. El contacto editable del checkout queda fuera de esa validación. Si se combina el pedido de A con el correo de B, guardá la solicitud sin vincular, avisá al admin y evitá enviarle correo a B.
- En Admin, al revisar un caso sin vincular cuyo pedido existe, agregá «Solicitar confirmación». Reutilizá la cola de correo y mandá un enlace con vencimiento y de un solo uso al correo verificado de la cuenta dueña del pedido. Abrir el enlace muestra la confirmación. Recién al tocar «Sí, hice esta solicitud» se vincula el pedido, sin exigir login. Así, un escáner de correo que abra el enlace no confirma la solicitud.
- Al vincular, conservá el número, la fecha y el correo ingresado originalmente. Registrá qué admin pidió la confirmación y cuándo confirmó el comprador. Un enlace vencido, alterado o reutilizado no debe cambiar el caso. La confirmación solo vincula el pedido. Para registrar un reintegro, seguí exigiendo evidencia de la devolución total del pago original en Mercado Pago.

Validá con Laravel, Playwright y Mailpit. Cubrí correo correcto, pedido de A con correo de B, confirmación válida, vencimiento, reintentos y conservación de la constancia. Probá el reintegro con evidencia simulada. Entregá el SHA, los resultados y lo que quede pendiente. Evitá cobros, reintegros reales, correos externos y cambios en producción.

- Evidencia pública: RUT 170245740012, Colón 650, San José de Mayo, Uruguay; 4344 2183, +598 99 387 986; contacto@camba.com.uy y responsable de datos María Valeria Hernández. La denominación fiscal debe ingresar por configuración, sin inferirla. Leyes y fuentes públicas consultadas antes de hacer cambios.
- Rutas de implementación: T1/T2 se pueden hacer en paralelo sin editar un mismo archivo, T3 preserva la evidencia de reintegro y tiene sus propios endpoints/componentes.

- T1: RED faltaban canal e importador; GREEN 7 pruebas de archivo. Ensayo sin red con tres roles UID/GID 33: dos escrituras idénticas, una sola línea, SHA-256 idéntico en los tres contenedores recreados. En demo se importó un archivo histórico; repetir dejó origen y destino sin cambios.
- T2: RED 3 fallos de identidad/versión; GREEN 5 Laravel/82 aserciones, 3 Playwright. Términos y Privacidad 200 SSR y noindex con fiscalName null. El .env local ignorado deja CAMBA_FISCAL_NAME vacío; el recurso de 2026-11-27 sigue intacto.
- T3: RED el contacto B vinculaba la compra de A y faltaba confirmación. GREEN 109 Laravel/1576 aserciones, 1 omitida por engine; compilaciones de Store y Admin correctas. Playwright verifica GET sin POST, botón explícito y rechazo de reutilización. La verificación independiente de identidad y token pasó.
- Demo: migración 2026_11_27_150000 solo aditiva, Store recreada y worker reiniciado. Mailpit: al caso A+B, 1 interno y 0 a B; al ingresado con A, 1 copia; al pedir confirmación para A+B, 1 enlace exclusivamente a A pese al reintento. GET no vincula, POST anónimo conserva referencia/fecha/correo, alteración/reutilización rechazadas. Admin rechazó reintegro previo (409), aceptó tras evidencia simulada de 451 UYU. Una línea de ese caso en la ruta nueva; sin proveedor real.
- Actores/entrega: cambios se mantienen solo en feat/camba-v2. Pendientes: completar identidad fiscal y confirmar datos externos de privacidad; preparar importación de fuente real antes de recrear producción, sin ejecutar despliegue.
