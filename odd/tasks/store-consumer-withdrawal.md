# Store legal terms, privacy and consumer withdrawal
feat/camba-v2 · HEAD 5057301 · local only / ask-on-risk. Forecast: 450–750 authored lines across bounded units.
Runners: host Chromium and artifact builds; Laravel disposable test DB via existing demo exec or host. No container lifecycle changes.

## Specs

### S1
REGLA DE DOCKER
Usá exclusivamente los contenedores existentes de camba-v2-demo-pg. Identificá los servicios con docker compose ps y ejecutá dentro de los que ya existen con docker compose exec. Cero contenedores nuevos o recreados. No uses docker run, docker compose run, docker compose up ni otro proyecto Compose. Dejá intactos camba-ready-86576846, Nexoruta y los volúmenes. Si la imagen actual no puede cargar un cambio sin recrearla, compilá y probá en el host y reportá qué quedó sin verificar en Docker.

### S2
TÉRMINOS Y COMPROBANTE
Redactá Términos con las condiciones reales de compra, pago por Mercado Pago, envío, retiro, cambios, garantías y reclamos. Revisá que el resumen antes de pagar muestre el total en UYU y el envío desglosado. Dejá los Términos guardables e incluí el aviso de retracto en el comprobante o correo de confirmación que recibe el comprador. Conservá la versión del texto asociada a cada compra.

### S3
ARREPENTIMIENTO
Implementá «Botón de arrepentimiento» visible y destacado en Inicio, accesible sin iniciar sesión. Pedí referencia de pedido y correo de compra, sin exigir motivo ni exponer datos del pedido. Registrá la solicitud con fecha y referencia, mostrá una constancia en pantalla y enviala por el canal de correo existente. Hacé que el equipo de Camba pueda ver y tramitar el caso desde su operación habitual. Reutilizá lo que ya exista para el reintegro y registrá su confirmación. Probá el recorrido con datos de prueba.

### S4
Explicá los plazos del art. 16 de la Ley 17.250. Hasta el 31/12/2026 rigen 5 días hábiles. Desde el 01/01/2027 rigen 10 días corridos por la Ley 20.531. Se cuentan desde la contratación o la entrega, a elección del consumidor. Explicá la devolución del producto y la restitución inmediata de lo abonado según la ley. Separá el retracto de los cambios voluntarios y de los reclamos por defectos. Recibí la solicitud aunque su plazo requiera revisión.

### S5
PRIVACIDAD
Escribí la política a partir de los datos que usa Camba para cuentas, compras, entregas, soporte y correo. Explicá qué datos reciben Mercado Pago, Resend y los demás proveedores, qué cookies se usan y cómo solicitar acceso, rectificación o supresión. Enlazá un canal funcional para ejercer esos derechos. Verificá qué transferencias internacionales existen antes de describirlas.

### S6
CIERRE
Buscá primero el nombre legal, RUT, domicilio y contacto en la configuración o documentación verificada de Camba. Si falta algún dato, terminá y probá todos los cambios que no dependan de él. En el cierre indicá únicamente los datos concretos que faltan para publicar el texto. No inventes una identidad fiscal ni des por validada la publicación con datos de demo. Mostrá el recorrido probado y qué contenedores existentes usaste.

### S7 — Updated public evidence and shared configuration
See the exact user update at L3; it supplies the public identity fields, published baselines, five-business-day privacy timeline, and the shared environment/legal policy rules. Only the fiscal denomination remains to be verified against a fiscal document.

## Tasks

- [x] T1 · S1, S6, S7 · Existing stack and published identity verified; no fiscal certificate found; no container lifecycle actions.
- [x] T2 · S2, S4, S5, S7 · Versioned terms snapshot and confirmation, checkout rules, shared frontend business data and final policy copy.
- [x] T3 · S3, S4, S7 · Durable neutral receipt, actual SMTP proof, Admin review plus simulated verified full-refund confirmation.
- [x] T4 · S1–S7 · Focused RED→GREEN, host builds and browser, existing API/worker/Mailpit proof. Docker Store image deliberately unchanged.

## Log

L1.

Terminá el punto 5 de Camba en la rama feat/camba-v2 desde el HEAD local. Implementá el flujo y escribí los textos finales en español claro. Usá la normativa uruguaya y el comportamiento real de la tienda.

REGLA DE DOCKER
Usá exclusivamente los contenedores existentes de camba-v2-demo-pg. Identificá los servicios con docker compose ps y ejecutá dentro de los que ya existen con docker compose exec. Cero contenedores nuevos o recreados. No uses docker run, docker compose run, docker compose up ni otro proyecto Compose. Dejá intactos camba-ready-86576846, Nexoruta y los volúmenes. Si la imagen actual no puede cargar un cambio sin recrearla, compilá y probá en el host y reportá qué quedó sin verificar en Docker.

TÉRMINOS Y COMPROBANTE
Redactá Términos con las condiciones reales de compra, pago por Mercado Pago, envío, retiro, cambios, garantías y reclamos. Revisá que el resumen antes de pagar muestre el total en UYU y el envío desglosado. Dejá los Términos guardables e incluí el aviso de retracto en el comprobante o correo de confirmación que recibe el comprador. Conservá la versión del texto asociada a cada compra.

ARREPENTIMIENTO
Implementá «Botón de arrepentimiento» visible y destacado en Inicio, accesible sin iniciar sesión. Pedí referencia de pedido y correo de compra, sin exigir motivo ni exponer datos del pedido. Registrá la solicitud con fecha y referencia, mostrá una constancia en pantalla y enviala por el canal de correo existente. Hacé que el equipo de Camba pueda ver y tramitar el caso desde su operación habitual. Reutilizá lo que ya exista para el reintegro y registrá su confirmación. Probá el recorrido con datos de prueba.

Explicá los plazos del art. 16 de la Ley 17.250. Hasta el 31/12/2026 rigen 5 días hábiles. Desde el 01/01/2027 rigen 10 días corridos por la Ley 20.531. Se cuentan desde la contratación o la entrega, a elección del consumidor. Explicá la devolución del producto y la restitución inmediata de lo abonado según la ley. Separá el retracto de los cambios voluntarios y de los reclamos por defectos. Recibí la solicitud aunque su plazo requiera revisión.

PRIVACIDAD
Escribí la política a partir de los datos que usa Camba para cuentas, compras, entregas, soporte y correo. Explicá qué datos reciben Mercado Pago, Resend y los demás proveedores, qué cookies se usan y cómo solicitar acceso, rectificación o supresión. Enlazá un canal funcional para ejercer esos derechos. Verificá qué transferencias internacionales existen antes de describirlas.

CIERRE
Buscá primero el nombre legal, RUT, domicilio y contacto en la configuración o documentación verificada de Camba. Si falta algún dato, terminá y probá todos los cambios que no dependan de él. En el cierre indicá únicamente los datos concretos que faltan para publicar el texto. No inventes una identidad fiscal ni des por validada la publicación con datos de demo. Mostrá el recorrido probado y qué contenedores existentes usaste.

L2. Start clean at 5057301 on feat/camba-v2; only existing camba-v2-demo-pg accessed. Exact odd-explorer model rejected; reuse the existing verifier as bounded read-only mapper. No project skill registry available.

L3.

Usá los Términos y la Política de Privacidad publicados de Camba como base para completar e implementar el punto 5:
https://www.camba.com.uy/terms-conditions
https://www.camba.com.uy/privacy-policy

- Reutilizá los datos públicos del comercio: Camba, RUT 170245740012, Colón 650, San José de Mayo, contacto@camba.com.uy, 4344 2183 y 099 387 986. La política publicada identifica a María Valeria Hernández como responsable de datos personales. Buscá la denominación fiscal exacta en una factura o constancia de DGI disponible en el proyecto. Si falta, completá el resto y señalá solo ese dato como pendiente de identificación fiscal.
- Conservá los 10 días hábiles desde la recepción para cambios voluntarios. Redactá por separado el retracto legal y los reclamos por defectos. Quitá las restricciones de reembolso y de responsabilidad en cuanto alcancen derechos legales del consumidor. Mostrá los medios de pago, costos y plazos que Camba v2 efectivamente ofrece.
- Implementá el «Botón de arrepentimiento» visible en Inicio, sin exigir login ni motivo. Registrá la solicitud, entregá constancia y dejá el caso disponible para tramitar el reintegro. Incluí el aviso de retracto por escrito en la confirmación de compra. Aplicá los 5 días hábiles hasta el 31/12/2026 y los 10 días corridos desde el 01/01/2027, contados desde la contratación o la entrega, a elección del comprador.
- Actualizá Privacidad según los datos que Camba v2 utiliza y comparte con Mercado Pago, Resend y el operador de envíos. Corregí el plazo publicado de 10 días hábiles para solicitudes de datos y aplicá los 5 días hábiles previstos en los arts. 14 y 15 de la Ley 18.331. Verificá dónde se procesan los datos antes de mantener la afirmación de que están en Uruguay.
- Implementá y probá el flujo usando únicamente los contenedores existentes de camba-v2-demo-pg. Usá docker compose exec. Cero contenedores nuevos o recreados. Evitá docker run, compose run y compose up. Si un cambio de frontend requiere una imagen nueva, compilalo y probalo en el host e informá que la imagen en ejecución sigue pendiente de actualizar.Centralizá los datos públicos del comercio en `environment.ts`, bajo `environment.business`. Incluí nombre comercial, denominación fiscal si está confirmada, RUT, domicilio, correo de atención, teléfonos, responsable de datos y URL pública.

Consumí esa configuración desde Términos, Privacidad, Contacto, el pie de página y el checkout. Compartí la definición con `environment.production.ts` para evitar duplicados y verificá que el build de producción muestre los datos correctos.

Si Laravel necesita esos mismos datos para correos o comprobantes, usá la configuración de comercio del backend como fuente común y exponé solo los campos públicos mediante `store-info`, el endpoint que ya existe. Mantené `RESEND_API_KEY` y las credenciales de Mercado Pago en el `.env` del backend. Los valores de `environment.ts` son visibles en el navegador.

Centralizá los plazos de retracto y la fecha de entrada en vigencia en una sola regla legal. Las pantallas y el aviso contractual tienen que mostrar el mismo plazo. Verificá todo con los contenedores existentes de `camba-v2-demo-pg`, sin crear ni recrear ninguno.

L4. Official Camba public identity and trade/privacy baselines checked. No Camba fiscal invoice/certificate found in the project. PHP isolated RED 404 then GREEN; Orders/Notices/Payments: 95 tests, 1409 assertions, one opt-in skip. Existing worker exec delivered one unique real SMTP receipt to existing Mailpit with an in-memory SQLite DB. Production Store and Admin built in the host; SSR host used existing demo API read-only. Risk: items 1 (durable legal records), 2 (personal data and Admin authorization), 4 (submission idempotency and refund evidence).

L5. Independent source review found a mutable dependency in the archived text; fixed by freezing the rule and date inside the dated document and pinning its public response hash. Recheck resolved. Existing API served the archive. Existing worker exec/Mailpit validated one receipt and one confirmation with the same legal periods and versioned archive link; no payment was initiated. Orders, Notices, Payments and Settings: 104 tests, 1536 assertions, one opt-in skip. Chromium host at 320 px passed checkout totals/version, guest request, Admin review and Terms/Privacy/Contact navigation. The demo DB schema was neither migrated nor reset.

L6. API work unit: c45f6cd. Store and checkout work unit: 59982ee. Admin operations, acceptance test and this log are delivered together in the final work unit. Production Store SSR showed the verified identity on Home, Terms, Privacy and Contact. The legal publication blocker is the unverified fiscal denomination; the container rollout was not authorized.

L7. Native bounded correction: withdrawal throttles isolated by connection, authenticated confirmations restored to account email, verified admins can link the original case to its submitted order reference after identity verification, and stale terminal actions report a conflict instead of success. Focused Docker suite RED 4 failures → GREEN 4 tests/92 assertions; related suite 105 tests/1545 assertions (1 opt-in skip), Admin production build, host browser conflict/reload, and both test emails verified through existing worker/Mailpit. No new container, volume operation or real refund.
