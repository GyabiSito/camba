# Checkout Pro de prueba: «Pagar» sigue deshabilitado después de ingresar una tarjeta nueva

**Aplicación:** CambaTest. **Producto:** Checkout Pro vía Preferences API. **País y moneda:** Uruguay (MLU), UYU. **Fecha:** 26/11/2026; todos los horarios de abajo son de Uruguay (UTC−03:00).

## Reproducción principal

1. Desde la Tienda por HTTPS, abrir Checkout Pro con el `init_point` que devolvió Mercado Pago. Se generó una sola preferencia para una compra de **451 UYU**, en modo binario y con una cuota.
2. Iniciar sesión con el comprador de prueba. Elegir **Elegir otro medio de pago → Nueva Tarjeta** e ingresar la Mastercard de prueba publicada por Mercado Pago para el escenario de aprobación. No seleccionar una tarjeta guardada.
3. Avanzar a la revisión. **Esperado:** que «Pagar» quede habilitado. **Observado:** la revisión muestra Mastercard y el botón sigue nativamente deshabilitado, sin un mensaje visible que explique el motivo.

| Evidencia | Resultado |
| --- | --- |
| Preferencia de la reproducción | `2423847653-5c9064f2-43a7-400f-b7d7-c7d22845ee8b`; vigente de 16:08:42 a 16:18:42 |
| Primera revisión autenticada, 16:13:42.812 | `GET /checkout/v1/payment/redirect/{id}/review/` → HTTP 200; `x-request-id` `f4451058-80f0-4014-ab7a-76d5b9d0498b` |
| Formulario de tarjeta nueva | `card-form/tokenization` → HTTP 200 a las 16:14:04.170; `card-form/association` → HTTP 200 a las 16:14:29.291 |
| Revisión después de ingresar la tarjeta, 16:15:36.527 | «Pagar» sigue deshabilitado (`disabled=true`) |
| Búsqueda de pagos por referencia exacta | HTTP 200, **0 pagos**; `x-request-id` `3a21300e-37bd-4fbf-b556-d84f42644688`. No hubo envío de pago, ID ni estado de pago. |

El vendedor identificado por la API es una cuenta de prueba uruguaya y coincide con el vendedor de la preferencia. La API mostró Visa y Mastercard activas, con mínimo de 1 UYU; 451 UYU estaba dentro de los límites reportados.

## Incidente original y comparación

- **15:02:** preferencia original `2423847653-e480cf8b-773e-4211-8c12-cc96391c5290`; `router-request-id` `a3a6a428-5022-49fe-9183-ed3b4c587b34`. Estaba vigente y la búsqueda no encontró ningún pago.
- **Prueba A/B:** se usaron el mismo vendedor, comprador autenticado, tarjeta de prueba guardada, importe y moneda. La variante Camba (`2423847653-44e1cbf7-faea-4b32-bab9-7c13cc3113c3`) conservó vigencia explícita y notificación por preferencia. La variante que reproduce Komorebi (`2423847653-6cfa4892-fd7e-4d8a-adbb-967df3566db0`) omitió ambas y usó retornos diferenciados. **Las dos dejaron «Pagar» deshabilitado.**
- **Identificadores de las dos revisiones A/B:** a las 15:58:42.015, HTTP 200, `x-request-id` `f88efb0b-98dd-48d7-9903-702b9e34d929`; a las 15:59:13.063, HTTP 200, `x-request-id` `5b296f0b-d470-40ad-969e-d3dcc45af69d`. Esas respuestas no incluyeron `router-request-id`.
- **Observación de navegador:** durante la comparación, a las 15:58:41.562, Chromium registró un bloqueo CORS para `POST https://www.mercadolibre.com/jms/lgz/background/automation` (`net::ERR_FAILED`, sin status HTTP ni ID expuestos). La solicitud volvió a fallar en la reproducción con tarjeta nueva a las 16:13:20.290. **No se comprobó que ese fallo sea la causa del bloqueo.**

**Consulta a soporte:** ¿qué regla o condición de elegibilidad deshabilitó «Pagar» para este comprador de prueba? ¿La falla de la solicitud de fondo está relacionada, o es independiente?

Este caso no incluye credenciales, cookies, documentos, datos de tarjeta ni cuerpos completos de solicitudes o respuestas.
