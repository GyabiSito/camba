# Release readiness remediation (audited 8f5ee10)
Branch feat/camba-v2 · ask-on-risk · baseline and fetched origin agree; no publication.
Runners: Compose with synthetic env, Composer and Pint, Laravel and Angular/Playwright, isolated HTTPS and provider evidence when authorized. Forecast 400+ authored lines; independent work units where executable.

## Specs

Scope: Trabajá sobre GyabiSito/camba, rama feat/camba-v2. Actualizá la rama y usá el commit auditado 8f5ee10 como referencia para comprobar qué hallazgos siguen vigentes. Implementá las correcciones y ejecutá las verificaciones. Backups y recuperación ante desastres quedan fuera del alcance. Preservá los cambios locales y evitá modificar producción, desplegar o generar cobros reales sin autorización.

S1. 1. Dejá CI verde
- Corregí `.github/workflows/checks.yml` para que la validación de Compose use `CAMBA_DB_ADMIN_PASSWORD`.
- Corregí el fallo de `composer validate --strict` por la restricción exacta del SDK de Mercado Pago. Elegí un rango compatible y comprobá qué versión quedó resuelta en el lock.
- Corregí Pint en `PlaceOrder.php` y estabilizá Playwright. Aislá los datos de login para que la suite no agote el rate limit al reutilizar cuentas. Capturá los cuerpos de respuesta antes de navegar y actualizá la prueba de restablecimiento que busca un campo de correo ausente cuando el enlace ya identifica al usuario.
- Ejecutá las comprobaciones completas. Conservá las protecciones y las aserciones actuales.

S2. 2. Actualizá las dependencias vulnerables
- Revisá `composer audit --locked --no-dev`. Actualizá `symfony/http-kernel`, `symfony/mailer` y `symfony/routing` a versiones corregidas. La auditoría identificó 8.1.12 como primera versión corregida en esa serie.
- Regenerá `composer.lock`, repetí la auditoría y ejecutá las pruebas con las versiones efectivamente instaladas.

S3. 3. Cerrá la validación de Mercado Pago Orders
- Verificá en preproducción la configuración efectiva de Orders, el modo de prueba, el vendedor y la firma del webhook. Documentá qué valores deben configurarse para el entorno real. Conservá la conciliación de Preferences para los intentos históricos.
- Probá aprobación y rechazo de punta a punta. Cruzá el ID de Orders, el ID y estado de la transacción, el webhook firmado y el estado en Tienda y Admin. Verificá que la aprobación descuente el carrito y genere el aviso una sola vez, y que el rechazo libere la reserva una sola vez. Cubrí reanudación, reintento y webhook duplicado.
- Si Mercado Pago devuelve `recover` sin transacción, registrá el `x-request-id` y marcá la prueba como bloqueada por falta de evidencia del proveedor. Una orden `created` o una pantalla de confirmación por sí sola no satisface la validación.
- Si el flujo de venta exige pago online y la pasarela está deshabilitada, comprobá que la API rechace la compra antes de crear un pedido o reservar stock.

S4. 4. Validá el despliegue detrás de HTTPS
- Ensayá el Compose de producción en un entorno aislado con PostgreSQL 18, Redis, API, Tienda, Admin, worker y scheduler. Verificá migraciones, catálogo e imágenes, sesiones, CSRF, rutas del webhook y enlaces firmados.
- Comprobá con clientes distintos que Laravel distingue sus IP a través del proxy. Si hay que corregirlo, confiá únicamente en el proxy configurado y verificá que el borde sobrescriba los encabezados reenviados. Conservá los límites de registro e inicio de sesión.
- Demostrá con un trabajo de prueba que el worker consume la cola y que el scheduler ejecuta la conciliación y los avisos. Un `200` de `/ready` solo alcanza para la comprobación de PostgreSQL y Redis.

S5. 5. Alineá Términos, Privacidad y el checkout con la normativa uruguaya

- Términos de compra. Usá la Ley 17.250 y el Decreto 167/021. Publicá el nombre legal y comercial de Camba, RUT, domicilio físico y contacto de atención al consumidor con datos confirmados. Informá las condiciones reales de disponibilidad, pago, envío, retiro, garantías y reclamos. Separá la política comercial de cambios del derecho legal de retracto y de los reclamos por productos defectuosos.

- Antes de confirmar. Mostrá un resumen con los artículos, cantidades, total en UYU con impuestos y costo de envío desglosado. Permití corregir los datos antes de confirmar expresamente la compra. Dejá los Términos accesibles y guardables, e incluí el derecho de retracto por escrito en la documentación contractual que recibe el comprador.

- Arrepentimiento. Aplicá el artículo 16 de la Ley 17.250 según su vigencia y prepará el cambio de la Ley 20.531, arts. 2 y 108. Documentá el plazo de 5 días hábiles vigente en 2026 y el de 10 días corridos desde el 1.º de enero de 2027, contados desde la contratación o la entrega, a elección del consumidor. Implementá el vínculo visible «Botón de arrepentimiento» en Inicio con un canal funcional que registre la solicitud y entregue constancia. Definí quién tramita la devolución y el reintegro por Mercado Pago. Aplicá excepciones del art. 16-BIS solo cuando correspondan al producto concreto.

- Privacidad. Aplicá la Ley 18.331 y los Decretos 414/009 y 64/020. Inventariá lo que Camba realmente recolecta, incluidos cuenta, pedidos, direcciones, contacto, cookies y preferencias de correo. Informá antes de recolectar los datos quién es el responsable, para qué los usa, cuáles son obligatorios, a quiénes se comunican y cómo ejercer los derechos de acceso, rectificación y supresión. Documentá la conservación efectiva y verificá la inscripción de las bases ante la URCDP cuando corresponda.

- Proveedores y preferencias. Revisá qué datos reciben Mercado Pago, Resend, el alojamiento y el operador de entregas. Si hay transferencias internacionales, documentá destinos y fundamento conforme al art. 23. Separá los avisos necesarios de cuenta y pedido de los recordatorios opcionales. Revisá las cookies y el almacenamiento que usa la tienda e implementá los controles que correspondan a su finalidad.

- Evidencia de cierre. Probá desde un navegador el resumen de compra, el acceso a los Términos guardables, la solicitud de arrepentimiento y el canal para ejercer derechos de privacidad. Entregá una lista de cada obligación con su fuente y dónde quedó implementada. Mantené como pendiente cualquier dato comercial o jurídico que falte confirmar y conservá el estado de borrador hasta que Camba apruebe el texto.

S6. 6. Usá Resend para los correos transaccionales
- Integrá el driver nativo de Laravel 13 con `resend/resend-php`. Configurá `services.resend.key` con `env('RESEND_API_KEY')`. La clave ya está cargada en el `.env`, usá esa misma variable y evitá imprimirla, reemplazarla o versionarla. En `.env.example` agregá solo `RESEND_API_KEY=` si falta.
- Configurá `MAIL_MAILER=resend` en el entorno de validación y prepará su configuración para producción. Comprobá que la API y el worker reciban la variable efectiva con Docker y con la configuración cacheada. Usá `MAIL_FROM_ADDRESS` de un dominio verificado en Resend. Conservá Mailpit para desarrollo y pruebas automatizadas.
- Reutilizá los correos, plantillas, cola y deduplicación existentes. Cubrí verificación de cuenta, restablecimiento, aviso de cambio de contraseña y avisos de pedido, pago, envío y retiro. Si falta la clave o el envío falla, registrá el fallo sin secretos y evitá marcar el correo como enviado.
- Probá el flujo con Mailpit y, si hay un destinatario de QA autorizado, hacé un envío controlado con Resend. Registrá por separado la aceptación de Resend y la recepción en el buzón. Reportá cualquier bloqueo de dominio, clave o permisos sin exponer valores.

Al terminar, entregá el SHA, los archivos modificados y el resultado de cada uno de los seis puntos. Incluí evidencia de CI, `composer audit`, Laravel, Playwright, builds de Tienda y Admin, el ensayo de despliegue y las pruebas de Mercado Pago y correo. Indicá qué se verificó con servicios reales, qué se simuló y qué sigue pendiente. Emití un veredicto de salida a producción basado en esa evidencia.

## Tasks

- [x] T1 · S1 · Local gates passed, 54 browser tests plus all 4 opt-in cases separately; `8ec5f18`, `9db776b`, Pint in `dc8e128`. Hosted CI not run for unpublished commits.
- [x] T2 · S2 · Strict Composer and locked production audit passed with patched installed Symfony; `5d94c7f`.
- [ ] T3 · S3 · Partial: fail-closed policy `dc8e128` and mocked Orders proofs passed; real sandbox approval and rejection pending authorized preproduction.
- [x] T4 · S4 · Production Compose behind real TLS tested in an isolated project; `dc8e128`. Actual preproduction edge pending.
- [ ] T5 · S5 · Partial: draft checkout disclosures, printable Terms, privacy contact and obligation matrix `a473b6d`; durable withdrawal receipt, confirmed commercial/legal data and contractual evidence pending.
- [ ] T6 · S6 · Partial: native Resend, config cache, redacted failure tests and local Mailpit passed; `5d94c7f`, `9db776b`. No authorized verified sender/QA inbox for external delivery.

## Log

L1.
Trabajá sobre GyabiSito/camba, rama feat/camba-v2. Actualizá la rama y usá el commit auditado 8f5ee10 como referencia para comprobar qué hallazgos siguen vigentes. Implementá las correcciones y ejecutá las verificaciones. Backups y recuperación ante desastres quedan fuera del alcance. Preservá los cambios locales y evitá modificar producción, desplegar o generar cobros reales sin autorización.

1. Dejá CI verde
- Corregí `.github/workflows/checks.yml` para que la validación de Compose use `CAMBA_DB_ADMIN_PASSWORD`.
- Corregí el fallo de `composer validate --strict` por la restricción exacta del SDK de Mercado Pago. Elegí un rango compatible y comprobá qué versión quedó resuelta en el lock.
- Corregí Pint en `PlaceOrder.php` y estabilizá Playwright. Aislá los datos de login para que la suite no agote el rate limit al reutilizar cuentas. Capturá los cuerpos de respuesta antes de navegar y actualizá la prueba de restablecimiento que busca un campo de correo ausente cuando el enlace ya identifica al usuario.
- Ejecutá las comprobaciones completas. Conservá las protecciones y las aserciones actuales.

2. Actualizá las dependencias vulnerables
- Revisá `composer audit --locked --no-dev`. Actualizá `symfony/http-kernel`, `symfony/mailer` y `symfony/routing` a versiones corregidas. La auditoría identificó 8.1.12 como primera versión corregida en esa serie.
- Regenerá `composer.lock`, repetí la auditoría y ejecutá las pruebas con las versiones efectivamente instaladas.

3. Cerrá la validación de Mercado Pago Orders
- Verificá en preproducción la configuración efectiva de Orders, el modo de prueba, el vendedor y la firma del webhook. Documentá qué valores deben configurarse para el entorno real. Conservá la conciliación de Preferences para los intentos históricos.
- Probá aprobación y rechazo de punta a punta. Cruzá el ID de Orders, el ID y estado de la transacción, el webhook firmado y el estado en Tienda y Admin. Verificá que la aprobación descuente el carrito y genere el aviso una sola vez, y que el rechazo libere la reserva una sola vez. Cubrí reanudación, reintento y webhook duplicado.
- Si Mercado Pago devuelve `recover` sin transacción, registrá el `x-request-id` y marcá la prueba como bloqueada por falta de evidencia del proveedor. Una orden `created` o una pantalla de confirmación por sí sola no satisface la validación.
- Si el flujo de venta exige pago online y la pasarela está deshabilitada, comprobá que la API rechace la compra antes de crear un pedido o reservar stock.

4. Validá el despliegue detrás de HTTPS
- Ensayá el Compose de producción en un entorno aislado con PostgreSQL 18, Redis, API, Tienda, Admin, worker y scheduler. Verificá migraciones, catálogo e imágenes, sesiones, CSRF, rutas del webhook y enlaces firmados.
- Comprobá con clientes distintos que Laravel distingue sus IP a través del proxy. Si hay que corregirlo, confiá únicamente en el proxy configurado y verificá que el borde sobrescriba los encabezados reenviados. Conservá los límites de registro e inicio de sesión.
- Demostrá con un trabajo de prueba que el worker consume la cola y que el scheduler ejecuta la conciliación y los avisos. Un `200` de `/ready` solo alcanza para la comprobación de PostgreSQL y Redis.

5. Alineá Términos, Privacidad y el checkout con la normativa uruguaya

- Términos de compra. Usá la Ley 17.250 y el Decreto 167/021. Publicá el nombre legal y comercial de Camba, RUT, domicilio físico y contacto de atención al consumidor con datos confirmados. Informá las condiciones reales de disponibilidad, pago, envío, retiro, garantías y reclamos. Separá la política comercial de cambios del derecho legal de retracto y de los reclamos por productos defectuosos.

- Antes de confirmar. Mostrá un resumen con los artículos, cantidades, total en UYU con impuestos y costo de envío desglosado. Permití corregir los datos antes de confirmar expresamente la compra. Dejá los Términos accesibles y guardables, e incluí el derecho de retracto por escrito en la documentación contractual que recibe el comprador.

- Arrepentimiento. Aplicá el artículo 16 de la Ley 17.250 según su vigencia y prepará el cambio de la Ley 20.531, arts. 2 y 108. Documentá el plazo de 5 días hábiles vigente en 2026 y el de 10 días corridos desde el 1.º de enero de 2027, contados desde la contratación o la entrega, a elección del consumidor. Implementá el vínculo visible «Botón de arrepentimiento» en Inicio con un canal funcional que registre la solicitud y entregue constancia. Definí quién tramita la devolución y el reintegro por Mercado Pago. Aplicá excepciones del art. 16-BIS solo cuando correspondan al producto concreto.

- Privacidad. Aplicá la Ley 18.331 y los Decretos 414/009 y 64/020. Inventariá lo que Camba realmente recolecta, incluidos cuenta, pedidos, direcciones, contacto, cookies y preferencias de correo. Informá antes de recolectar los datos quién es el responsable, para qué los usa, cuáles son obligatorios, a quiénes se comunican y cómo ejercer los derechos de acceso, rectificación y supresión. Documentá la conservación efectiva y verificá la inscripción de las bases ante la URCDP cuando corresponda.

- Proveedores y preferencias. Revisá qué datos reciben Mercado Pago, Resend, el alojamiento y el operador de entregas. Si hay transferencias internacionales, documentá destinos y fundamento conforme al art. 23. Separá los avisos necesarios de cuenta y pedido de los recordatorios opcionales. Revisá las cookies y el almacenamiento que usa la tienda e implementá los controles que correspondan a su finalidad.

- Evidencia de cierre. Probá desde un navegador el resumen de compra, el acceso a los Términos guardables, la solicitud de arrepentimiento y el canal para ejercer derechos de privacidad. Entregá una lista de cada obligación con su fuente y dónde quedó implementada. Mantené como pendiente cualquier dato comercial o jurídico que falte confirmar y conservá el estado de borrador hasta que Camba apruebe el texto.

6. Usá Resend para los correos transaccionales
- Integrá el driver nativo de Laravel 13 con `resend/resend-php`. Configurá `services.resend.key` con `env('RESEND_API_KEY')`. La clave ya está cargada en el `.env`, usá esa misma variable y evitá imprimirla, reemplazarla o versionarla. En `.env.example` agregá solo `RESEND_API_KEY=` si falta.
- Configurá `MAIL_MAILER=resend` en el entorno de validación y prepará su configuración para producción. Comprobá que la API y el worker reciban la variable efectiva con Docker y con la configuración cacheada. Usá `MAIL_FROM_ADDRESS` de un dominio verificado en Resend. Conservá Mailpit para desarrollo y pruebas automatizadas.
- Reutilizá los correos, plantillas, cola y deduplicación existentes. Cubrí verificación de cuenta, restablecimiento, aviso de cambio de contraseña y avisos de pedido, pago, envío y retiro. Si falta la clave o el envío falla, registrá el fallo sin secretos y evitá marcar el correo como enviado.
- Probá el flujo con Mailpit y, si hay un destinatario de QA autorizado, hacé un envío controlado con Resend. Registrá por separado la aceptación de Resend y la recepción en el buzón. Reportá cualquier bloqueo de dominio, clave o permisos sin exponer valores.

Al terminar, entregá el SHA, los archivos modificados y el resultado de cada uno de los seis puntos. Incluí evidencia de CI, `composer audit`, Laravel, Playwright, builds de Tienda y Admin, el ensayo de despliegue y las pruebas de Mercado Pago y correo. Indicá qué se verificó con servicios reales, qué se simuló y qué sigue pendiente. Emití un veredicto de salida a producción basado en esa evidencia.

L2. Fast-forward fetch made no change; clean local branch and origin at 8f5ee10. Explorer unavailable: exact required model gpt-6.1-luna rejected by runtime. No .atl skill registry. Continue bounded independent units. RED Composer strict failed exact SDK pin; locked audit initially 5 advisories, 3 packages.

L3. Composer lock and installed vendor resolve MP 3.8.0, Symfony 8.1.12 and Resend 1.19.0; strict validation, production audit and Pint green. Isolated PostgreSQL Laravel 223 tests/3259 assertions (one omitted), Demo 3/51, final focused 4/11. Store, Admin and API Docker builds, Compose checks and Linux release assertions passed.

L4. Chromium standard final 54 pass/4 opt-in skip, exit 0. All 4 opt-ins passed separately. An earlier run hit shared trace directory ENOENT; distinct ports and output paths removed collision. Optional shipping mail fixture now records the same notice as production, with the fulfilment event timestamp. No change to rate limits.

L5. Isolated TLS, PostgreSQL 18.7 and Redis: secure session, CSRF 419, signed verification, real Mailpit worker/scheduler, edge clients rate limits, webhook invalid/valid/replay and online-only 503 preserving stock/cart confirmed. Verified privacy draft contact POST 204 and Mailpit support intake. Edge and mail transport independently spot-checked. Risk: item 2 (forwarded headers and secret handling); item 5 (Compose and dependencies).

L6. NO GO. No push, production changes or real charge. Need authorized preproduction with real Orders transaction evidence, confirmed legal identity/terms/privacy and tracked withdrawal workflow, and authorized Resend test recipient and verified sender. See docs/SALIDA_PRODUCCION_8F5EE10.md.
