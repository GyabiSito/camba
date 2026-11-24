# Correos transaccionales de Camba

Los nueve correos existentes comparten la [plantilla HTML](../api/resources/views/mail/transactional.blade.php) y su [alternativa en texto plano](../api/resources/views/mail/transactional-text.blade.php). El lazo es una versión PNG de la primera figura del [SVG oficial de la tienda](../web/projects/store/public/brand/camba.svg), adjunta al correo. No hay imágenes remotas; «Camba» queda como texto aunque el cliente bloquee el lazo.

| Correo | Cómo se genera |
| --- | --- |
| Verificá tu correo | Creá una cuenta de comprador o, sin verificar, ingresá y pedí otro enlace en Mi cuenta. |
| Te damos la bienvenida a Camba | Abrí el enlace firmado recibido para confirmar por primera vez el correo de un comprador. El botón «Ver tienda» lleva a `/tienda`. No se envía al registrarse, al reenviar el enlace, al abrirlo otra vez ni a cuentas verificadas por seeds o migraciones. |
| Restablecé tu contraseña | En Mi cuenta, elegí «Olvidé mi contraseña» e ingresá el correo de una cuenta de prueba. |
| Recibimos tu pedido | Confirmá una compra con un comprador de prueba verificado o como invitado con correo. |
| Pago confirmado | El pago verificado queda confirmado en el pedido. |
| Tu pedido está listo para retirar | Marcá un pedido pagado de retiro como listo, desde el Admin. |
| Enviamos tu pedido | Marcá un pedido pagado de entrega como enviado, desde el Admin. |
| Tu pago sigue pendiente | El pedido sigue pendiente y entra en la ventana previa al vencimiento; la tienda y el comprador verificado tienen el recordatorio activado. |
| Tenés productos en el carrito | El carrito de un comprador verificado conserva stock, supera el plazo de inactividad y no tiene una compra posterior; ambos permisos de recordatorio están activos. |

Al abrir un enlace válido en el navegador, Mi cuenta muestra «Tu cuenta ha sido verificada». Si abrís el correo en otro navegador, vas a ver el aviso junto al ingreso y, al entrar, vas a quedar en Mi cuenta. Los enlaces inválidos o vencidos muestran un aviso; la firma no pasa a la URL de la cuenta. Los clientes JSON conservan la respuesta 204 para un enlace válido.

Verificación y recuperación usan las notificaciones encoladas de Laravel. Para los otros siete correos, incluido el de bienvenida, el scheduler ejecuta `php artisan camba:notices` y el worker entrega solo los avisos elegibles. El CTA «Ver pedido» no otorga acceso: la tienda exige la sesión del titular; los invitados ven «Ir a la tienda». El pie muestra solo los canales de ayuda de Configuración que estén publicados. Los avisos de stock, importación e incidencias operativas siguen siendo del panel.

La primera confirmación guarda un único aviso de bienvenida junto con la verificación. Una falla al enviar no desverifica la cuenta: se aplican los [reintentos seguros del registro de avisos](../api/docs/notices.md#delivery-and-recovery). Si no se sabe si SMTP aceptó el correo, no se reenvía automáticamente.

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

Para comprobar la bienvenida, buscá el correo de un comprador recién registrado. Primero tiene que llegar «Verificá tu correo». Abrí su enlace y, tras el siguiente ciclo de `camba:notices`, confirmá que llegó «Te damos la bienvenida a Camba» y que «Ver tienda» apunta al `APP_URL` de esa ejecución más `/tienda`. Volvé a abrir el mismo enlace: después de otro ciclo debe seguir habiendo una sola bienvenida para ese destinatario. El recorrido automatizado comprueba esta secuencia y guarda `bienvenida-600.png` en la carpeta de la ejecución (`CAMBA_E2E_MAIL_RUN`).

Al terminar, detené solo el buzón descartable con `docker stop camba-transactional-mail-qa`. Para reproducir manualmente en la demo Docker existente, su bandeja sigue en [48025](http://127.0.0.1:48025/); si el worker ya estaba iniciado al cambiar el código, recargá ese proceso antes de enviar.

## Remitente

En local: **Camba <notificaciones@camba.test>**. En producción, configurá `MAIL_FROM_ADDRESS` con la dirección autorizada por el proveedor y dejá `MAIL_FROM_NAME=Camba`. Si la variable falta, se conserva el respaldo anterior `hello@example.com` por compatibilidad; no lo uses como remitente en instalaciones nuevas. Los ensayos con Mailpit no certifican entrega o apariencia en proveedores y clientes externos.
