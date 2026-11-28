# Camba Checkout Pro parity with Komorebi
Branch feat/camba-v2 · local baseline bc0debb plus independently changing logging work · ask-on-risk for publication (not requested) · forecast ~390 authored lines.
Runners: Laravel PHPUnit with blocking HTTP fake and isolated SQLite; Angular build; Chromium in local Docker without real charges.

## Specs

- S1. Seguí primero el flujo real de Komorebi, desde el botón de pagar hasta que el pedido queda confirmado. Revisá el frontend y el backend para identificar qué modalidad de Mercado Pago usa, cómo inicia el pago, adónde vuelve el comprador, cómo procesa el webhook y cómo actualiza el pedido. Usá esa implementación como base y aprovechá lo que ya exista en Camba para pagos, pedidos y conciliación.
- S2. Reproducí en Camba la experiencia de Komorebi. Adaptá el botón, la redirección y las pantallas de retorno para pago aprobado, pendiente o rechazado. Conservá la jerarquía visual, los mensajes y las acciones disponibles en cada estado, con los colores y componentes de Camba. El comprador tiene que poder consultar el estado desde su pedido, incluso si vuelve antes de que llegue el webhook.
- S3. Adaptá la integración a los pedidos y reservas de stock de Camba. Calculá el importe en el servidor con los datos del pedido. Confirmá el pago después de verificar con Mercado Pago el estado, importe, moneda y referencia del pedido. Validá la firma del webhook y hacé idempotente su procesamiento para que un reintento no duplique cobros, cambios de stock ni avisos. El estado confirmado tiene que verse en Tienda y Admin.
- S4. Configurá las credenciales, el secreto del webhook y las URLs de Camba mediante su entorno. Documentá los nombres de las variables en el `.env.example`. Usá el canal `pagos` de Camba para registrar la creación del pago, los cambios de estado y los errores en `storage/logs/pagos/DDMMAAAA.log`, con el ID de pedido y el ID de correlación. Excluí credenciales, datos personales y respuestas completas del proveedor.
- S5. Probalo en Docker local con el entorno de prueba de Mercado Pago. Verificá desde la Tienda en 4200 un pago aprobado, uno pendiente o rechazado, el retorno antes del webhook y el procesamiento de una notificación repetida. Comprobá el resultado en el detalle del pedido de Admin y en el log de pagos. Si faltan credenciales de prueba, completá la implementación y las pruebas automatizadas con el proveedor simulado y dejá indicado qué parte del recorrido real queda por verificar.
- S6: “En el `.env` que usa la API de Camba en Docker, agregá estas variables con estos nombres exactos:” `MERCADOPAGO_PUBLIC_KEY=X`, `MERCADOPAGO_ACCESS_TOKEN=X`. “Usá `X` como marcador hasta tener las credenciales de prueba. Si las variables ya tienen valores, conservalos. Documentá ambos nombres en `.env.example` con valores de ejemplo.” “Leé ambas variables desde la configuración de Laravel. Pasá la clave pública a Angular solo si el checkout la necesita. El access token queda exclusivamente en el backend y fuera de Git, los logs y las respuestas de la API. Verificá que el contenedor lea la configuración sin imprimir las claves.”
- S7: “Entregá las capturas del checkout y del retorno, las pruebas ejecutadas y las diferencias con Komorebi que hayan sido necesarias por el modelo de pedidos de Camba. El alcance termina con la validación local y de prueba.”

## Tasks

- T1 · S4/S6 · inline · implemented and verified: RED→GREEN, independent synthetic probes and real container config (booleans only). Risk: item 2.
- T2 · S1–S5/S7 · delegated read-only mapping, inline implementation, independent verification; simulated payment journey verified, real sandbox blocked on test credentials and authorized HTTPS. Risk: items 2, 4 and 5 (browser-return evidence, payment orchestration and runtime opt-in).
- T3 · S2/S3/S5 · bounded inline correction to `be44fce` from native review; RED→GREEN for historical rejection and abandonment. Risk: items 2 and 4 (reopening while confirmation is unresolved).

## Log

### L1 — User request

Implementá Mercado Pago en Camba v2 trasladando la integración que ya funciona en Komorebi. Quiero que el checkout de Camba siga el mismo recorrido y se vea lo más parecido posible, con la identidad visual de Camba.

Origen: C:\Users\Josec\OneDrive\Escritorio\komorebi
Destino: C:\Users\Josec\camba

1. Seguí primero el flujo real de Komorebi, desde el botón de pagar hasta que el pedido queda confirmado. Revisá el frontend y el backend para identificar qué modalidad de Mercado Pago usa, cómo inicia el pago, adónde vuelve el comprador, cómo procesa el webhook y cómo actualiza el pedido. Usá esa implementación como base y aprovechá lo que ya exista en Camba para pagos, pedidos y conciliación.

2. Reproducí en Camba la experiencia de Komorebi. Adaptá el botón, la redirección y las pantallas de retorno para pago aprobado, pendiente o rechazado. Conservá la jerarquía visual, los mensajes y las acciones disponibles en cada estado, con los colores y componentes de Camba. El comprador tiene que poder consultar el estado desde su pedido, incluso si vuelve antes de que llegue el webhook.

3. Adaptá la integración a los pedidos y reservas de stock de Camba. Calculá el importe en el servidor con los datos del pedido. Confirmá el pago después de verificar con Mercado Pago el estado, importe, moneda y referencia del pedido. Validá la firma del webhook y hacé idempotente su procesamiento para que un reintento no duplique cobros, cambios de stock ni avisos. El estado confirmado tiene que verse en Tienda y Admin.

4. Configurá las credenciales, el secreto del webhook y las URLs de Camba mediante su entorno. Documentá los nombres de las variables en el `.env.example`. Usá el canal `pagos` de Camba para registrar la creación del pago, los cambios de estado y los errores en `storage/logs/pagos/DDMMAAAA.log`, con el ID de pedido y el ID de correlación. Excluí credenciales, datos personales y respuestas completas del proveedor.

5. Probalo en Docker local con el entorno de prueba de Mercado Pago. Verificá desde la Tienda en 4200 un pago aprobado, uno pendiente o rechazado, el retorno antes del webhook y el procesamiento de una notificación repetida. Comprobá el resultado en el detalle del pedido de Admin y en el log de pagos. Si faltan credenciales de prueba, completá la implementación y las pruebas automatizadas con el proveedor simulado y dejá indicado qué parte del recorrido real queda por verificar.

Entregá las capturas del checkout y del retorno, las pruebas ejecutadas y las diferencias con Komorebi que hayan sido necesarias por el modelo de pedidos de Camba. El alcance termina con la validación local y de prueba.En el `.env` que usa la API de Camba en Docker, agregá estas variables con estos nombres exactos:

MERCADOPAGO_PUBLIC_KEY=X
MERCADOPAGO_ACCESS_TOKEN=X

Usá `X` como marcador hasta tener las credenciales de prueba. Si las variables ya tienen valores, conservalos. Documentá ambos nombres en `.env.example` con valores de ejemplo.

Leé ambas variables desde la configuración de Laravel. Pasá la clave pública a Angular solo si el checkout la necesita. El access token queda exclusivamente en el backend y fuera de Git, los logs y las respuestas de la API. Verificá que el contenedor lea la configuración sin imprimir las claves.

### L2 — Reference and boundary

Komorebi local HEAD 50987b3 uses Checkout Pro Preferences, validated hosted navigation, success/pending/failure return URLs, a bounded finalization poll and verified evidence before order creation. Camba already uses the same preference modality and verified webhook plus reconcilers; it reserves and records its order first and keeps that same order visible after retry. Do not copy post-payment-only order creation, provider query authority, partial scope of the original webhook configuration, or binary mode because pending is required. Keep all provider fakes out of runtime code.

### L3 — Local acceptance

- The Docker API loaded both exact key names, rejected placeholders as credentials, and resolved nonempty synthetic credentials in an isolated CLI invocation with no secrets in stdout. The development compose's default keeps the payment UI off; the opt-in keeps sandbox mode. Both Store Docker variants built. The normal Store was recreated by itself and was healthy; live Store 4200 and Admin 4300 returned HTTP 200. No live database or volume changes.
- Docker API ran Laravel Payments and Orders suites on in-memory SQLite: 46 tests / 720 assertions. This covers non-owner access, amount/stock and authoritative state, signed webhook replay, reconciliation before webhook, admin order detail and correlated, sanitized log events. Pint and the UI detector passed. Independently verified 25 verified-evidence-vs-rejection combinations and performed the parent spot check.
- Browser proof: 2 Chromium journeys (isolated API and raw payment navigation stub); only one order, failed opening stays on that order, browser “approved” before evidence is not confirmation, no pay action while pending, same-order rejection retry, paid once server evidence changes. Inspected 1586/1280 desktop and 390px mobile screenshots under `web/test-results/mercado-pago-checkout/`; no actual external provider calls.
- Live `storage/logs/pagos/25112026.log` has correlated creation, start, status, and provider error records; verified by aggregate counters only. Sandbox preference validity/reuse, callbacks and signed delivery over public HTTPS remain provider acceptance work; do not turn on live payments.

### L4 — Native correction

- Four reviewers returned two distinct blockers: an earlier rejected payment hid reconciliation of a later attempt, and an abandoned checkout could never reopen the same preference from the return page. The API supplies an opaque fingerprint of already-verified rejection records; the return still requests reconciliation, ignores the old rejection, and only offers voluntary reopening after the bounded check when no submitted payment was indicated. The server's ownership, eligibility and one-preference checks are unchanged.
- Both Chromium regressions and the API check failed before the fix. After it: Docker Laravel Payments and Orders (46 tests / 726 assertions), Pint and three Chromium checkout tests passed. The default Store Docker image rebuilt; no real provider calls or live database changes.
