# Correos transaccionales de Camba

Los correos usan la [plantilla HTML](../api/resources/views/mail/transactional.blade.php) y su [alternativa en texto plano](../api/resources/views/mail/transactional-text.blade.php), salvo la bienvenida, que tiene sus propias vistas de [HTML](../api/resources/views/mail/buyer-welcome.blade.php) y [texto plano](../api/resources/views/mail/buyer-welcome-text.blade.php). El lazo es una versión PNG de la primera figura del [SVG oficial de la tienda](../web/projects/store/public/brand/camba.svg), adjunta al correo. No hay imágenes remotas; «Camba» queda como texto aunque el cliente bloquee el lazo.

| Correo | Cómo se genera |
| --- | --- |
| Verificá tu correo | Creá una cuenta de comprador o, sin verificar, ingresá y pedí otro enlace en Mi cuenta. |
| Te damos la bienvenida a Camba | Registrá un comprador. Llega una vez aunque el correo siga sin verificar. «Explorá la tienda» lleva a `/tienda`. Verificar o reenviar la verificación no dispara otra bienvenida; tampoco se envía a cuentas preexistentes. |
| Restablecé tu contraseña | En Mi cuenta, elegí «Olvidé mi contraseña» e ingresá el correo de una cuenta de prueba. |
| Tu contraseña de Camba se actualizó | En Mi cuenta, cambiá la contraseña. Solo un cambio efectivo genera un aviso al correo registrado; una contraseña actual incorrecta o una confirmación distinta no envían nada. |
| Consulta desde Camba | Enviá el formulario de [Contactanos](http://127.0.0.1:4200/contacto) con el destinatario interno configurado en Admin. |
| Recibimos tu pedido | Confirmá una compra con un comprador de prueba verificado o como invitado con correo. |
| Pago confirmado | El pago verificado queda confirmado en el pedido. |
| Tu pedido está listo para retirar | Marcá un pedido pagado de retiro como listo, desde el Admin. |
| Enviamos tu pedido | Marcá un pedido pagado de entrega como enviado, desde el Admin. |
| Tu pedido fue entregado | Confirmá la entrega de un pedido enviado, desde el Admin. |
| Nuevo pedido en Camba | Confirmá un pedido válido, incluso pendiente de pago. Lo recibe el único administrador verificado; el aviso del panel también se conserva. |
| Constancia de solicitud de arrepentimiento | Enviá el formulario público de arrepentimiento. Siempre aparece una constancia guardable; solo se envía una copia por correo si la referencia y el correo coinciden con la compra. No confirma un reintegro. |
| Nueva solicitud de arrepentimiento | La misma solicitud nueva genera un aviso independiente al único administrador verificado. «Abrir solicitud» lleva al caso en Admin con la sesión habitual. |
| Camba: confirmamos tu reintegro | La conciliación confirma por primera vez que Mercado Pago reintegró el importe completo del pago original. Llega a la cuenta del comprador. |
| Camba: reintegro total verificado | La misma verificación genera un aviso independiente al único administrador verificado, con el pedido y la solicitud vinculada si existe. |
| Camba: resolvimos tu solicitud de arrepentimiento | Desde una solicitud abierta con reintegro verificado, elegí «Registrar reintegro confirmado». Llega a la cuenta del comprador, con la constancia y la fecha del cierre. No sale al cerrar sin reintegro. |
| Tu pago sigue pendiente | El pedido sigue pendiente y entra en la ventana previa al vencimiento; la tienda y el comprador verificado tienen el recordatorio activado. |
| Tenés productos en el carrito | El carrito de un comprador verificado conserva stock, supera el plazo de inactividad y no tiene una compra posterior; ambos permisos de recordatorio están activos. |

Al abrir un enlace válido en el navegador, Mi cuenta muestra «Tu cuenta ha sido verificada». Si abrís el correo en otro navegador, vas a ver el aviso junto al ingreso y, al entrar, vas a quedar en Mi cuenta. Los enlaces inválidos o vencidos muestran un aviso; la firma no pasa a la URL de la cuenta. Los clientes JSON conservan la respuesta 204 para un enlace válido.

Verificación y recuperación usan las notificaciones encoladas de Laravel. El scheduler ejecuta `php artisan camba:notices` y el worker entrega solo los avisos elegibles, incluidos los de bienvenida y cambio de contraseña. La consulta de Contactanos se envía sincrónicamente al destinatario interno; el botón y `Reply-To` apuntan al correo del visitante. El CTA «Ver pedido» no otorga acceso: la tienda exige la sesión del titular; los invitados ven «Ir a la tienda». El pie muestra solo los canales de ayuda de Configuración que estén publicados. Los avisos de stock, importación e incidencias operativas siguen siendo del panel.

Los correos de envío y entrega a domicilio se registran en la misma transacción que el cambio de estado. Pasar a Entregado antes del próximo ciclo no anula el aviso de Enviado. No se generan correos retroactivos. El correo al administrador también se registra al guardar el pedido por primera vez; si no hay un solo administrador verificado o cambia su dirección antes del envío, no se redirige a otra persona. Configurá el origen de Admin (`CAMBA_ADMIN_URL` en Compose de producción, `ADMIN_URL` en Laravel). El Docker local lo toma del puerto de Admin; «Ver pedido» lleva al detalle autenticado.

El registro guarda la cuenta y un único aviso de bienvenida en la misma transacción. El scheduler lo encola después del commit, sin esperar la verificación. El correo de verificación y su enlace se envían por separado. Una falla de SMTP no revierte el registro: se aplican los [reintentos seguros del registro de avisos](../api/docs/notices.md#delivery-and-recovery). Si no se sabe si SMTP aceptó el correo, no se reenvía automáticamente.

El cambio de contraseña guarda el aviso con la cuenta en la misma transacción. El correo no contiene contraseñas ni tokens; el botón abre el formulario habitual de recuperación.

Para comprobar el arrepentimiento en la demo existente, usá un pedido de prueba en [el formulario público](http://localhost:4200/arrepentimiento). Con el correo de compra correcto llegan la copia y el aviso interno a [Mailpit](http://localhost:8025/). Con otro correo aparece la misma confirmación guardable, pero solo llega el aviso interno. Ese caso se puede revisar y cerrar, no vincular manualmente ni usar para registrar un reintegro. Repetir el envío devuelve el mismo número y no genera otro correo.

La verificación de un reintegro total se hace contra la evidencia del proveedor, no contra el cuerpo del webhook. Orders requiere reintegros procesados para el pago original que sumen el importe exacto; Payments verifica el importe devuelto contra ese pago. La verificación registra los dos avisos y el trabajo de auditoría en la misma transacción. Un reintento no los duplica. Si se interrumpe la escritura, el scheduler vuelve a proyectar la entrada al archivo del día original, sin repetir una línea completa. Un fallo de correo no revierte un reintegro; se aplican las reglas de recuperación del registro de avisos.

En Docker local, el registro se lee dentro de API, worker o scheduler en `/var/www/html/storage/logs/refounds/DDMMAAAA.log`, con fecha y hora de Uruguay. Usa el volumen compartido `api-storage`; no está montado en el host. El JSON se limita al instante de verificación, referencia Camba, ID de orden (si está disponible) y de pago del proveedor, monto en centésimos, moneda y constancia vinculada si existe. Antes de habilitarlo en otro stack, asegurá un almacenamiento persistente compartido para ese directorio entre sus procesos de conciliación.

## Reproducir con Mailpit sin tocar la demo

Desde la raíz del repositorio, iniciá un buzón descartable. El Laravel de prueba usa una SQLite temporal, el worker real y solo este SMTP de loopback:

```powershell
docker run --pull=never --rm -d --name camba-transactional-mail-qa -p 127.0.0.1:43986:1025 -p 127.0.0.1:43987:8025 axllent/mailpit:v1.31.5
Set-Location web
$env:CAMBA_E2E_MAILPIT_SMTP_PORT = '43986'
$env:CAMBA_E2E_MAILPIT_HTTP_PORT = '43987'
$env:CAMBA_E2E_MAIL_RUN = [guid]::NewGuid().ToString('N')
npm run test:e2e -- --project=store e2e/store-account.spec.ts --grep "delivers and captures" --reporter=list
```

Abrí el [buzón de prueba](http://127.0.0.1:43987/). El recorrido crea una cuenta, usa el enlace firmado, cambia la contraseña con el mensaje recibido y confirma un pedido. Para los eventos de pago, retiro, envío y recordatorios, usa estados sintéticos comprometidos en SQLite y ejecuta el mismo comando de proyección, sin llamar a un proveedor de pago. Revisá las capturas de 600 y 390 px (también sin imágenes) en `web/test-results/transactional-mail/`; todos los enlaces visibles de las capturas se reemplazan por «[enlace oculto]».

Para comprobar la bienvenida, registrá un comprador y esperá ambos correos sin abrir el enlace: «Verificá tu correo» y «Te damos la bienvenida a Camba». El botón «Explorá la tienda» y la URL del texto plano apuntan a `/tienda` en el `APP_URL` de esa ejecución. Abrí el enlace de verificación y volvé a abrirlo: después de otro ciclo de `camba:notices` debe seguir habiendo una sola bienvenida. El recorrido automatizado comprueba esta secuencia y guarda `bienvenida-600.png`, `bienvenida-390.png` y `bienvenida-390-sin-imagenes.png` en la carpeta de la ejecución (`CAMBA_E2E_MAIL_RUN`).

Al terminar, detené solo el buzón descartable con `docker stop camba-transactional-mail-qa`. Para reproducir manualmente en la demo Docker existente, abrí el [buzón en 8025](http://localhost:8025/); si el worker ya estaba iniciado al cambiar el código, recargá ese proceso antes de enviar.

Para probar los tres correos nuevos o corregidos en la demo habitual (4200/4300/8025), desde `web` ejecutá `node e2e/order-notices-docker.mjs` con `CAMBA_DEMO_PASSWORD` (credencial local del README) y `CAMBA_QA_PRODUCT_ID` (producto publicado con slug `qa-…`). El recorrido crea un comprador y un pedido QA, repite la confirmación, simula el pago **solo en ese pedido** sin contactar al proveedor y marca Enviado y Entregado desde Admin. Guarda las capturas de Pedidos y Avisos en `web/test-results/order-notices-docker/`.

Si solo querés volver a capturar evidencia de un pedido QA ya entregado, usá `CAMBA_QA_ORDER_REFERENCE` en lugar del ID de producto. Este modo no crea ni modifica pedidos.

## Remitente

En local: **Camba <notificaciones@camba.test>**. En producción, configurá `MAIL_FROM_ADDRESS` con la dirección autorizada por el proveedor y dejá `MAIL_FROM_NAME=Camba`. Si la variable falta, se conserva el respaldo anterior `hello@example.com` por compatibilidad; no lo uses como remitente en instalaciones nuevas. Los ensayos con Mailpit no certifican entrega o apariencia en proveedores y clientes externos.
