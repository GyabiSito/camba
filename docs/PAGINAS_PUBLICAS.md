# Ayuda y páginas legales de Camba

El pie compartido enlaza las cinco páginas. **Términos y Privacidad son borradores sin indexación:** no se deben publicar como políticas vigentes hasta aprobar los textos y datos marcados.

## Qué revisar antes de publicar

| Ruta | Fuente actual | Falta confirmar |
| --- | --- | --- |
| `/envios` | Configuración pública y cotización del checkout. Retiro sin costo si hay dirección; envío con tarifa configurada si está habilitado. | Cobertura comercial por zona, transportista, plazos de preparación/entrega, horarios de retiro y, si se ofrece, seguimiento del transportista. |
| `/preguntas-frecuentes` | Carrito, checkout como invitado o con cuenta, avisos de estado y recuperación de contraseña. | Actualizar la respuesta sobre cambios cuando se apruebe la política. |
| `/contacto` | El formulario siempre está visible. El servidor usa **Admin → Configuración → Correo interno para consultas** como destinatario. Los canales públicos se muestran aparte y provienen del entorno. | Correo operativo, teléfono si corresponde y horarios o plazos de atención si se desean comunicar. |
| `/terminos-y-condiciones` | Borrador que separa el flujo actual de las condiciones pendientes. | Identidad legal y domicilio, medios de pago, condiciones de entrega y atención, cancelaciones, cambios, devoluciones, reembolsos y garantías. |
| `/politica-de-privacidad` | Borrador basado en los datos del registro, checkout, avisos y formulario. | Responsable y contacto de privacidad, proveedores que reciben datos, retención, procedimiento para ejercer derechos, cookies no esenciales y tratamiento de datos de menores. |

El selector de localidades y departamentos no constituye una confirmación de cobertura. La disposición de Contactanos toma como referencia la [página de contacto de Komorebi](https://komorebi.com.uy/contact); no se copiaron sus políticas ni sus datos. La copia local `KomorebiStore` (`fa774fa`, `src/app/features/checkout/ui/pages/checkout/checkout.ts`) no usa Anime.js en el checkout, así que la entrada de los bloques adapta el patrón existente de la portada de Camba.

## Configurar los canales públicos

Definí `CAMBA_PUBLIC_CONTACT_EMAIL` y `CAMBA_PUBLIC_CONTACT_PHONE` en el `.env` de Laravel. Para Docker local podés usar `infra/dev/demo.env.local`, y en producción el archivo de entorno de la API configurado con `CAMBA_API_ENV_FILE`. En Docker local recreá el servicio `api` para que relea el entorno. Si falta un dato o no es válido, solo se oculta ese bloque. No configures en estas variables un correo que no quieras publicar.

El correo interno del formulario se guarda por separado en Admin. No aparece en la API pública y nunca se usa como reemplazo del correo público.

## Comprobar en local

Desde `web`, con la Tienda Docker en `http://127.0.0.1:4200`:

```powershell
node --test e2e/storefront-support-pages.mjs
```

El recorrido prueba SSR sin JavaScript, recarga, títulos visibles al navegar desde el pie, restauración con Atrás, anclas, filtros de catálogo, teclado y diseño de Contactanos con y sin movimiento reducido. Guarda las capturas en `web/test-results/storefront-support-pages/`.

Para comprobar el formulario, usá una instancia de prueba con **un correo de soporte sintético** y SMTP hacia Mailpit. `POST /api/v1/contact` acepta nombre, correo, teléfono opcional y mensaje. El destinatario sale de Configuración; el correo provisto se usa solo para responder. La API devuelve 204 después de que el transporte acepta el mensaje, 422 por datos inválidos, 429 al superar cinco intentos por minuto e IP y 503 si falta el destinatario o falla el transporte. No hay un envío simulado ni un reintento automático.

Con esa instancia y su buzón activos, el mismo recorrido prueba el formulario si definís `CAMBA_CONTACT_STORE`, `CAMBA_CONTACT_MAILPIT` y `CAMBA_CONTACT_RECIPIENT` con su URL de Tienda, su URL de Mailpit y el correo de soporte configurado, respectivamente. Comprueba el 204 y un único mensaje real al destinatario esperado con el `Reply-To` correcto.
