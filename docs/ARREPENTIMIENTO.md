# Compras, retracto y privacidad de Camba v2

## Operación

1. El comprador revisa artículos, modalidad, costo de entrega o retiro y **total en UYU**. Puede volver y corregir los datos. La compra conserva la versión y una copia del texto de los Términos; no se asigna una versión retroactiva a compras viejas. El correo de confirmación incluye el aviso escrito de retracto y un enlace a la versión guardable.
2. En Inicio, **Botón de arrepentimiento** abre `/arrepentimiento`. Pide solo la referencia completa y el correo de compra. Guardá la constancia con su fecha; Camba también encola una copia por correo. El mensaje no confirma coincidencia del pedido, plazo ni reintegro. Repetir los mismos datos recupera la constancia original.
3. En **Admin → Pedidos → Arrepentimientos**, abrí la revisión. Si no hubo coincidencia, verificá los datos por un canal seguro, sin pedir contraseñas, tarjetas ni enviar documentación a un tercero. La recepción no se bloquea por dudas sobre el plazo.
4. Si corresponde restituir el pago, gestioná el reintegro completo en Mercado Pago. En el detalle del pedido usá la consulta de pago existente y esperá la conciliación. Volvé a Arrepentimientos y elegí **Registrar reintegro confirmado**. Camba exige evidencia conciliada del pago original y su importe completo; esta pantalla **no ejecuta cobros ni reembolsos**. También se puede cerrar una revisión sin registrar un reintegro.

## Fuentes y alcance

- [Términos publicados de Camba](https://www.camba.com.uy/terms-conditions) y [Privacidad publicada](https://www.camba.com.uy/privacy-policy): identifican la marca, RUT, domicilio, canales, responsable de datos y plazo de cambios voluntarios. No se trasladan los límites de responsabilidad, la prohibición general de reembolso ni las promesas de medios, tarifas o plazos que no estén verificadas en v2. La cotización de v2 muestra el costo disponible y no ofrece un plazo fijo publicado.
- [Ley 17.250, art. 16](https://www.impo.com.uy/bases/leyes/17250-2000/16) y [Ley 20.531, arts. 2](https://www.impo.com.uy/bases/leyes/20531-2026/2) [y 108](https://www.impo.com.uy/bases/leyes/20531-2026/108): fecha de vigencia, plazos, medio fehaciente, devolución y restitución. `PurchaseTerms.php` selecciona el documento versionado en `api/resources/legal/`; este define la regla que consumen checkout, Tienda y correo. Para cambiar el texto, agregá una nueva versión sin editar las anteriores. No se calcula ni rechaza un vencimiento automáticamente.
- [Ley 18.331, arts. 14](https://www.impo.com.uy/bases/leyes/18331-2008/14), [15](https://www.impo.com.uy/bases/leyes/18331-2008/15) y [23](https://www.impo.com.uy/bases/leyes/18331-2008/23): acceso, rectificación y otras solicitudes en cinco días hábiles y condiciones para transferencias. La política dirige a Contactanos y al correo publicado.
- [Declaración de Mercado Pago Uruguay](https://www.mercadopago.com.uy/privacidad/declaracion-privacidad/proteccion-datos-transferencia-internacional_32793) y [DPA de Resend](https://resend.com/legal/dpa): Mercado Pago informa tratamiento posible fuera del país y Resend identifica EE. UU. como centro principal de procesamiento. Esto no demuestra en qué país está alojado el entorno de producción de Camba ni en qué países se trata cada operación. La política no afirma que todo se guarde en Uruguay.

La identidad pública que consumen Tienda y producción está en `environment.business` (definición compartida en `environment.business.ts`). Laravel no necesita duplicar el RUT o el domicilio en el correo: enlaza a los Términos versionados y lee su propia configuración de soporte y URL. No se incorporan credenciales al navegador.

**Dato fiscal que falta:** la denominación fiscal exacta asociada al RUT 170245740012 según factura o constancia de DGI. El RUT y el nombre de la responsable de datos no permiten deducirla.

## Verificación sin recrear contenedores

- El entorno de prueba usa exclusivamente `camba-v2-demo-pg`; el código backend entra por el montaje existente. Ejecutá PHPUnit por `docker compose exec` con `APP_ENV=testing`, `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `DB_URL` vacío, `SANCTUM_STATEFUL_DOMAINS=localhost`, `MAIL_MAILER=array` y credenciales de pago desactivadas. No ejecutes las migraciones de la prueba sobre la base de la demo.
- La verificación del correo de constancia usa SMTP de Mailpit desde el servicio existente `worker`, con un caso sintético duradero durante la prueba y base en memoria. El flujo de la Tienda y Admin usa Chromium en el host con una base de pruebas del runner local.
- La Tienda de Docker está empaquetada: estos cambios se compilaron en el host. Para validar SSR de producción se usó el build del host y el API existente solo para lecturas. Antes de habilitar el flujo en una instalación, aplicá la migración aditiva y actualizá los artefactos de frontend en una operación autorizada. No cambies los volúmenes para este ensayo.
