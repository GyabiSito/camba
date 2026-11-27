# Checkout Pro vía Orders — validación local de CambaTest

**Resultado:** el Docker habitual abre Orders. Se verificaron la reanudación, la cancelación real y su webhook. **La acreditación y el rechazo reales no quedaron validados:** el checkout alojado mostró un error antes de que Mercado Pago registrara una transacción.

Fecha de prueba: **26/11/2026**, horarios de Uruguay. Todas las órdenes y tarjetas fueron de prueba.

## Evidencia del proveedor

| Caso | Orden de Mercado Pago / Camba | Resultado observado |
| --- | --- | --- |
| Contrato e idempotencia | `ORDTST01M8CNM554AA2N9KGGJBWNM6H4`, sin pedido comercial | `POST /v1/orders` → 201, `x-request-id` `771a1ec9-c29b-4b7e-8d8d-c5efadc0ece9`. La misma clave y cuerpo devolvieron el mismo ID. El GET confirmó 451 UYU, manual, captura automática, una cuota y `PT10M`. El vencimiento posterior fue `canceled/expired`. |
| APRO | `ORDTST01M8CPEG85JY4Q2TW8C5JXYCD9`, pedido 62 / intento 29 | Checkout abierto y «Pagar» habilitado sin sesión. A las 16:48:25, pantalla `/congrats/recover/error/`. El GET devolvió `created`, sin transacciones, `x-request-id` `8e6f4be0-1bb1-4ad8-a936-a47ed56ddfe6`. No es una aprobación ni un rechazo. |
| OTHE | `ORDTST01M8CPMF8QKZJTVR0T1B8VSZJX`, pedido 63 / intento 30 | Checkout abierto en otro contexto de incógnito. A las 16:49:40, `PUT /checkout/v1/payment/api/flow/{flow}` → HTTP 200 con `status: recover` y `group_congrats_recover`; `x-request-id` `789b7328-ef53-4554-a738-22edd199a9b7`. El GET anterior a la cancelación devolvió `created`, cero transacciones, `x-request-id` `350263ea-7173-47a1-ae92-fc01c89d8e11`. No se registró un rechazo. |
| Cancelación explícita del pedido 63 | La misma orden OTHE; no se abrió un nuevo checkout | El GET del proveedor confirmó `canceled`, cero transacciones, `x-request-id` `0740ccde-3478-4b2a-a71c-7d9c90bf5462`. Camba devolvió 200, `payment_expired`. Un webhook real de Orders quedó procesado con resultado `verified`. Quedó 1 línea en el carrito; stock 7 → 8, una sola liberación. |

La primera creación del pedido 62 mostró un detalle del contrato real: el proveedor devolvió 201 y `status: created` sin `status_detail` (readback idempotente `9f9261f8-9cce-4486-ac16-77e63138d188`). Laravel lo había tratado como incierto. Se agregó una regresión y se aceptó la omisión solo para `created`; las pruebas de acreditación siguen exigiendo el detalle y los importes completos. La reapertura reutilizó el intento 29 y el mismo ID.

## Tienda, proxy y log

- **Reanudación:** con stock general en cero, el carrito del pedido 62 mostró «Continuar pago». El POST de reanudación devolvió 200 y abrió el `checkout_url` de la misma orden, sin otro intento ni otra reserva.
- **Retorno:** después de OTHE, «Volver al sitio» abrió el detalle de ese pedido bajo el mismo origen HTTPS, con la sesión de invitado. A 320 px, el control de cancelación se abrió con teclado, conservó foco y no produjo desborde horizontal.
- **Firma y duplicado:** una prueba controlada separada por el HTTPS público devolvió 401 para firma inválida, 200 para firma válida y 200 al repetirla; el scheduler procesó una sola fila. No se usó esa prueba para simular un pago o para atribuir una entrega a Mercado Pago.
- **Persistencia:** `api/storage/logs/pagos/26112026.log` conserva `payment.started`, `payment.order.created`, `payment.resumed`, y `checkout.stock_released` para el pedido 63 a las 16:52:43. La cancelación explícita no equivale a un rechazo OTHE.
- **Entorno:** Tienda 4200, Admin 4300 y API 8000 siguieron respondiendo; Orders quedó habilitado en el Compose local con `CAMBA_MP_LIVE=false`. Se recrearon API, worker, scheduler y Store. No se recreó PostgreSQL ni se borraron volúmenes.

Sin una transacción de Mercado Pago no hubo compra pagada que confirmar en Tienda o Admin ni webhook de acreditación o rechazo que validar. Esos recorridos sí se cubren con proveedor simulado en PostgreSQL aislado.

## Archivos de esta migración

- Proveedor: `api/app/Payments/CheckoutProClient.php`, `PaymentWebhookSignature.php`.
- Flujo y persistencia: `api/app/Actions/Payments/{StartPayment,ReconcilePayments,ApplyPaymentEvidence}.php`, `api/app/Models/{Order,PaymentAttempt}.php`, `api/database/migrations/2026_11_26_200000_add_checkout_pro_orders_identity.php`.
- HTTP: `api/app/Http/Controllers/Payments/{OrderPaymentController,PaymentWebhookController}.php`, `api/app/Http/Resources/Orders/OrderResource.php`, `api/routes/payments.php`, `api/openapi.yaml`.
- Tienda: `web/projects/store/src/app/features/orders/{order.ts,order.html,data-access/order.models.ts,data-access/orders.api.ts}`.
- Entorno, pruebas y operación: `api/config/mercadopago.php`, `api/.env.example`, `infra/compose.dev.apps.yml`, `api/tests/Feature/Payments/PaymentLifecycleTest.php`, `api/docs/{payments,payment-lifecycle}.md`, `odd/tasks/checkout-pro-orders.md`. El ajuste efectivo `CAMBA_DEV_MP_CHECKOUT_ORDERS=true` está en el archivo local ignorado `infra/dev/demo.env.local`.

## Seguimiento del cierre — 19:44 UY, 26/11/2026

La [creación de Orders](https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-orders/create-order), [los retornos](https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-orders/web-integration/configure-back-urls) y [el webhook](https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-orders/notifications) se contrastaron con el MCP oficial para Uruguay. `capture_mode: automatic` sigue activando el modo binario. No se cambió el payload por el bloqueo: ambos controles externos, `automatic` y `automatic_async`, ya lo habían reproducido sin transacciones.

| Caso | Resultado y entorno |
| --- | --- |
| Creación y abandono | Sandbox: pedido local **65**, referencia `fccfe1fc-a215-44af-9d15-a373b92486ef`; un solo alta local y una orden de **451 UYU**. Con stock en cero, «Continuar pago» reabrió el mismo `checkout_url` sin otra reserva. |
| APRO | Sandbox: orden `ORDTST01M8D0MTBXTBH2FXHFP9AFPNFD`, intento local 33. El `PUT /checkout/v1/payment/api/flow/{flow}` devolvió HTTP **200** con `status: recover` a las **19:44:48.155 UY**. **`x-request-id`: `47e9c73d-d299-433b-85b0-9e8fb2c10109`**. El GET de Orders `5b8895c8-6533-40fb-b6b7-9fa6f4327ffb` confirmó `created`, sin detalle ni transacciones. |
| Retorno y cancelación | Sandbox: el retorno HTTPS conservó la sesión de invitado y solicitó una consulta con 202. La cancelación explícita confirmó `canceled` en un GET, liberó la unidad **0 → 1** y dejó la línea en el carrito. El pedido no apareció en compras. Se recibió y procesó un webhook real de cancelación. |
| Reintento | Sandbox: «Reintentar pago» abrió `ORDTST01M8D0SJ97N4GE3H6KZ34J1N52`, intento **34**, bajo el mismo pedido 65, sin otro POST de creación de compra. No se envió a pagar; se canceló al terminar la prueba. El log registra una sola liberación por intento (33 a las 19:46:11 UY, 34 a las 19:48:33 UY). |
| Webhook repetido | Prueba controlada por el HTTPS de Docker: firma inválida **401**; firma válida **200**, repetición **200**, una sola fila para la entrega controlada del intento anterior. El scheduler la verificó a las 19:48:01 UY sin alterar el intento 34 ni su reserva. La prueba controlada no se contabiliza como pago informado por Mercado Pago. |
| Vencimiento y estado en proceso | Sandbox: hay vencimiento anterior confirmado por Orders en el pedido 62. Simulación: `processing` sin transacción no ofrece reabrir ni libera la última unidad aunque ya haya vencido el plazo local. El vencimiento confirmado por el proveedor libera una sola vez. |
| Acreditación, rechazo y recuperación sin webhook | Simulación: acreditación visible una vez en Tienda/Admin y un aviso; rechazo conserva carrito y libera una sola vez; un rechazo antiguo no altera la reserva del nuevo intento. Timeout repite clave y cuerpo en una reapertura y, en otro escenario, el scheduler recupera por referencia y GET la acreditación sin webhook ni otro POST. |

El cambio de este cierre oculta la reapertura si un Orders verificado ya está en proceso, distingue vencimiento de cancelación por el detalle del proveedor, muestra el intento más reciente en Admin y renueva la clave del navegador al reintentar un intento terminal confirmado. **Acreditación y rechazo de pagos reales siguen pendientes del sandbox**: `recover` sin transacción no es ninguno de los dos.

Validación final: **96 pruebas / 1413 aserciones** (Payments, Orders, Cart, Notices en PostgreSQL aislado), **Pint** y build SSR de Tienda. Solo se reconstruyó la Tienda. El túnel existente volvió a apuntar a su proxy de 4200; el dominio y la ruta de webhook se mantuvieron. Las transiciones de stock están en `api/storage/logs/pagos/26112026.log`, filtradas por la referencia del pedido.

Para reproducir la suite sin usar las credenciales del Docker habitual:

```powershell
docker exec -e APP_ENV=testing -e DB_DATABASE=camba_v2_demo_test -e SANCTUM_STATEFUL_DOMAINS=localhost -e CAMBA_MP_CHECKOUT_ORDERS=false -e MERCADOPAGO_ACCESS_TOKEN=X -e CAMBA_MP_ACCESS_TOKEN=X -e CAMBA_MP_COLLECTOR_ID= camba-v2-demo-pg-api-1 php artisan test tests/Feature/Payments tests/Feature/Orders tests/Feature/Cart tests/Feature/Notices
```

Verificación independiente: inspección estática de la guardia de reserva; se incorporó y ejecutó su regresión de `processing` después del plazo local. El análisis nativo quedó sin resolución porque el checkout tiene archivos no rastreados y requiere declarar el alcance; no se modificó el índice de Git ni se creó un commit con cambios mezclados.
