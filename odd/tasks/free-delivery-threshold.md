# Free delivery subtotal threshold
feat/camba-v2 · base 4c13350 · local work-unit; no remote release.
Runners: isolated Laravel with a captured Mercado Pago Orders mock, real Playwright Admin and Store; forecast 300–460 authored lines.

## Specs

### S1
- En Configuración, dentro de Envíos, agregá «Activar envío gratis desde un monto» y «Monto mínimo (UYU)».
- El administrador debe poder activarlo, cambiar el monto y desactivarlo. Al activarlo, validá que el monto sea mayor a cero y tenga hasta dos decimales. Guardalo en centésimos.
- Dejá la opción desactivada por defecto para las instalaciones existentes. Reutilizá la configuración y los permisos de Admin.

### S2
- Usá el subtotal de productos que calcula el servidor, antes de sumar el envío. Si el subtotal es igual o mayor al mínimo y la dirección admite entrega, el envío cuesta UYU 0.
- Ejemplo con un mínimo de UYU 2.500. Un subtotal de UYU 2.499,99 paga la tarifa normal. Desde UYU 2.500, el envío es gratis.
- Aplicá la regla sobre las modalidades de entrega disponibles para la dirección. Conservá los controles de cobertura y el flujo de retiro.
- Calculá el beneficio en Laravel, dentro de la cotización existente. La Tienda debe mostrar la tarifa devuelta por la API. Al confirmar, respetá la validación y vigencia de la cotización, y guardá el costo de envío en el pedido para que cambios futuros del mínimo no alteren compras ya creadas.

### S3
- En el checkout, mostrá «Envío gratis» en la línea de entrega cuando la cotización aplique el beneficio. El total y el importe a cobrar deben coincidir con el pedido guardado.
- Probá guardar, recargar y desactivar la opción desde Admin. Cubrí montos por debajo, justo en el mínimo y por encima, cambios de cantidad, direcciones fuera de cobertura y retiro.
- Verificá de punta a punta que un pedido con envío gratis quede guardado con costo de entrega cero y que se envíe el importe correcto a la integración de pago de prueba.

### S4
Implementalo en la rama local. Al terminar, indicá dónde se configura y qué pruebas pasaron. Dejá el cambio listo para revisar localmente.

## Tasks

- [x] T1 · S1–S3 · inline: existing settings, guarded patch, authoritative quote and order/provider regression tests. RED → GREEN in Laravel; 3 tests/112 assertions in PostgreSQL 18.7. Risk: item 4 (settings updates and stable checkout totals).
- [x] T2 · S1–S4 · inline, depends on T1 response: Admin fields/validation, Store confirmation of API rate, browser verification and docs; both production builds and Playwright passed.
- [x] T3 · S3/S4 · independent static review plus isolated checkout/provider spot-check (1/20) and API patch rollback regression.

## Log

### L1 · Original request

Trabajá en el repo local de Camba. Implementá «Envío gratis a partir de un monto» configurable desde Admin, usando el flujo de cotización y checkout que ya existe.

## Configuración en Admin

- En Configuración, dentro de Envíos, agregá «Activar envío gratis desde un monto» y «Monto mínimo (UYU)».
- El administrador debe poder activarlo, cambiar el monto y desactivarlo. Al activarlo, validá que el monto sea mayor a cero y tenga hasta dos decimales. Guardalo en centésimos.
- Dejá la opción desactivada por defecto para las instalaciones existentes. Reutilizá la configuración y los permisos de Admin.

## Regla de envío

- Usá el subtotal de productos que calcula el servidor, antes de sumar el envío. Si el subtotal es igual o mayor al mínimo y la dirección admite entrega, el envío cuesta UYU 0.
- Ejemplo con un mínimo de UYU 2.500. Un subtotal de UYU 2.499,99 paga la tarifa normal. Desde UYU 2.500, el envío es gratis.
- Aplicá la regla sobre las modalidades de entrega disponibles para la dirección. Conservá los controles de cobertura y el flujo de retiro.
- Calculá el beneficio en Laravel, dentro de la cotización existente. La Tienda debe mostrar la tarifa devuelta por la API. Al confirmar, respetá la validación y vigencia de la cotización, y guardá el costo de envío en el pedido para que cambios futuros del mínimo no alteren compras ya creadas.

## Tienda y verificación

- En el checkout, mostrá «Envío gratis» en la línea de entrega cuando la cotización aplique el beneficio. El total y el importe a cobrar deben coincidir con el pedido guardado.
- Probá guardar, recargar y desactivar la opción desde Admin. Cubrí montos por debajo, justo en el mínimo y por encima, cambios de cantidad, direcciones fuera de cobertura y retiro.
- Verificá de punta a punta que un pedido con envío gratis quede guardado con costo de entrega cero y que se envíe el importe correcto a la integración de pago de prueba.

Implementalo en la rama local. Al terminar, indicá dónde se configura y qué pruebas pasaron. Dejá el cambio listo para revisar localmente.

### L2 · Starting point

Existing settings are one locked JSON row; the server quotes checkout twice with current prices and signs validated totals. Quote requests with a destination and order placement use the same department/locality validation; no separate destination tariff tiers are present. Both UI surfaces use the current app styles. Use the existing Laravel HTTP fake for the outbound Orders contract; no real provider or charges. Preserve the already staged logs ignore file, local Admin customer notes and untracked environment file.

### L3 · Observed proof

SQLite RED: the new fields were absent and an eligible quote still returned the configured rate. GREEN: focused 3/112 on SQLite and PostgreSQL 18.7; broader Settings, OrderCheckout and PaymentLifecycle SQLite run reported 70 cases, 1557 assertions and one legacy upgrade test skipped on SQLite. The real Laravel routes reject a stale price before reserving stock, then store an order with zero delivery and send a single UYU 2500.00 request (two units at 1250.00, no delivery item) to the local Orders HTTP fake even after disabling the rule. No live Mercado Pago transaction.

Playwright exercised the real Admin settings and Store quote, check/reload/update/off, input errors, delivery label and total, and preserved pickup. Checked the Admin layout at 320 px and Store at desktop in the browser. Production Angular builds, Pint, and OpenAPI YAML parsing passed. The free-delivery label does not enter the signed pricing payload; the existing signed fields, including the actual shipping fee, are unchanged.

Independent static review found no scoped defect. Its scratch bootstrap failed because of Windows drive-letter Laravel cache paths; the parent reran on the same env-free copy with relative cache paths and passed 1 test/20 assertions. The independent rollback probe was added to the existing settings feature test: invalid activation does not persist any field or audit row (final focused 1/37 passed). No release or live charge was attempted.
