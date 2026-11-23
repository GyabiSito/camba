# Correos transaccionales de Camba

Los ocho correos existentes comparten la [plantilla HTML](../api/resources/views/mail/transactional.blade.php) y su [alternativa en texto plano](../api/resources/views/mail/transactional-text.blade.php). El lazo es una versión PNG de la primera figura del [SVG oficial de la tienda](../web/projects/store/public/brand/camba.svg), adjunta al correo. No hay imágenes remotas; «Camba» queda como texto aunque el cliente bloquee el lazo.

| Correo | Cómo se genera |
| --- | --- |
| Verificá tu correo | Creá una cuenta de comprador o, sin verificar, ingresá y pedí otro enlace en Mi cuenta. |
| Restablecé tu contraseña | En Mi cuenta, elegí «Olvidé mi contraseña» e ingresá el correo de una cuenta de prueba. |
| Recibimos tu pedido | Confirmá una compra con un comprador de prueba verificado o como invitado con correo. |
| Pago confirmado | El pago verificado queda confirmado en el pedido. |
| Tu pedido está listo para retirar | Marcá un pedido pagado de retiro como listo, desde el Admin. |
| Enviamos tu pedido | Marcá un pedido pagado de entrega como enviado, desde el Admin. |
| Tu pago sigue pendiente | El pedido sigue pendiente y entra en la ventana previa al vencimiento; la tienda y el comprador verificado tienen el recordatorio activado. |
| Tenés productos en el carrito | El carrito de un comprador verificado conserva stock, supera el plazo de inactividad y no tiene una compra posterior; ambos permisos de recordatorio están activos. |

Las cuentas usan las notificaciones encoladas de Laravel. Para los otros seis correos, el scheduler ejecuta `php artisan camba:notices` y el worker entrega solo los avisos elegibles. El CTA «Ver pedido» no otorga acceso: la tienda exige la sesión del titular; los invitados ven «Ir a la tienda». El pie muestra solo los canales de ayuda de Configuración que estén publicados. Los avisos de stock, importación e incidencias operativas siguen siendo del panel.

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

Al terminar, detené solo el buzón descartable con `docker stop camba-transactional-mail-qa`. Para reproducir manualmente en la demo Docker existente, su bandeja sigue en [48025](http://127.0.0.1:48025/); si el worker ya estaba iniciado al cambiar el código, recargá ese proceso antes de enviar.

## Remitente

En local: **Camba <notificaciones@camba.test>**. En producción, configurá `MAIL_FROM_ADDRESS` con la dirección autorizada por el proveedor y dejá `MAIL_FROM_NAME=Camba`; no hay dirección local de respaldo en producción. Los ensayos con Mailpit no certifican entrega o apariencia en proveedores y clientes externos.
