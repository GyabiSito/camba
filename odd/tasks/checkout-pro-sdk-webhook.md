# Checkout Pro SDK and webhook parity
Branch: feat/camba-v2 · baseline acab374 plus preserved local checkout fixes · local delivery only.
Runner: habitual Compose, isolated Laravel Payments tests, authorized CambaTest. Forecast: 170–300 authored lines.

## Specs

S4. Implementá en Camba la integración de Checkout Pro que funciona en Komorebi, de punta a punta. Usá como fuente C:\Users\Josec\OneDrive\Escritorio\komorebi y aplicá los cambios en C:\Users\Josec\camba. Trabajá exclusivamente con CambaTest, `CAMBA_MP_LIVE=false` y comprador y tarjeta de prueba.

S1. Portá la creación de la preferencia desde `CreateMercadoPagoPreferenceAction.php` de Komorebi. Usá `PreferenceClient` del SDK oficial y reproducí la configuración de items, modo binario, una cuota, retorno y redirección por `init_point`. Adaptá la vigencia a la reserva de stock de Camba. Verificá el payload efectivo que recibe Mercado Pago.

S2. Portá las validaciones de `MercadoPagoWebhookController.php` y `MercadoPagoWebhookSignatureValidator.php`. Verificá que el proxy entregue a Laravel `x-signature`, `x-request-id` y el `data.id` firmado en la URL. Reproducí el parseo y la verificación HMAC, incluida la tolerancia temporal, contemplando segundos y milisegundos. Probá en Docker una firma válida, una inválida y una entrega repetida. Usá una sola lógica de conciliación para el webhook y el fallback.

S3. Aplicalo a la Tienda habitual y probá el flujo con CambaTest. La prueba pasa cuando «Pagar» se habilita y Mercado Pago devuelve un ID y un estado. Verificá que una aprobación confirmada aparezca en «Tus compras», que un rechazo libere el stock una sola vez y que cada intento quede trazable en `pagos`.

S5. Entregá qué código portaste de Komorebi y la evidencia del recorrido. Si «Pagar» sigue gris, entregá el resultado de `/review` y el `router-request-id`. La apertura de Checkout Pro por sí sola es una prueba parcial.

S6. El canal diario pagos debe conservar inicio, preferencia, resultado y movimientos de stock después de que actúen API, worker y scheduler.

## Tasks

- [x] T1 · S1/S4 · inline (existing bounded client and fixtures) · Risk: item 5 (SDK dependency).
- [x] T2 · S2/S4 · inline (existing controller, signer, and tests) · Risk: item 2 (signature boundary).
- [ ] T3 · S3/S4/S5 · inline verification · partial: authenticated CambaTest review blocks payment for both Camba and Komorebi-equivalent preferences; no provider payment ID/state.

- [x] T4 · S6 · inline · log preference creation once after commit; RED reproduced, GREEN: 55 tests/693 assertions; mixed-process append verified on the shared bind.

## Log

L1.

Implementá en Camba la integración de Checkout Pro que funciona en Komorebi, de punta a punta. Usá como fuente C:\Users\Josec\OneDrive\Escritorio\komorebi y aplicá los cambios en C:\Users\Josec\camba. Trabajá exclusivamente con CambaTest, `CAMBA_MP_LIVE=false` y comprador y tarjeta de prueba.

1. Portá la creación de la preferencia desde `CreateMercadoPagoPreferenceAction.php` de Komorebi. Usá `PreferenceClient` del SDK oficial y reproducí la configuración de items, modo binario, una cuota, retorno y redirección por `init_point`. Adaptá la vigencia a la reserva de stock de Camba. Verificá el payload efectivo que recibe Mercado Pago.

2. Portá las validaciones de `MercadoPagoWebhookController.php` y `MercadoPagoWebhookSignatureValidator.php`. Verificá que el proxy entregue a Laravel `x-signature`, `x-request-id` y el `data.id` firmado en la URL. Reproducí el parseo y la verificación HMAC, incluida la tolerancia temporal, contemplando segundos y milisegundos. Probá en Docker una firma válida, una inválida y una entrega repetida. Usá una sola lógica de conciliación para el webhook y el fallback.

3. Aplicalo a la Tienda habitual y probá el flujo con CambaTest. La prueba pasa cuando «Pagar» se habilita y Mercado Pago devuelve un ID y un estado. Verificá que una aprobación confirmada aparezca en «Tus compras», que un rechazo libere el stock una sola vez y que cada intento quede trazable en `pagos`.

Entregá qué código portaste de Komorebi y la evidencia del recorrido. Si «Pagar» sigue gris, entregá el resultado de `/review` y el `router-request-id`. La apertura de Checkout Pro por sí sola es una prueba parcial.

L2 (2026-11-26). SDK `mercadopago/dx-php` pinned to 3.8.0 as in Komorebi. Real `PreferenceClient::create` builds and serializes the request; Camba retains a fixed-origin, no-redirect/no-retry Laravel HTTP transport and request-scoped credentials. The normalized raw response must still match the configured collector, preference ID and permitted HTTPS `init_point`. Provider CambaTest probe POST 201/GET 200 persisted exact UYU amount, one installment, binary, explicit expiry, no payer, SDK UA and header checks. Preference `2423847653-72494191-6184-4a57-be13-956533ad2c81`.

L3. Ported Komorebi parsing normalization and ±300s timestamp tolerance; 10-digit seconds and 13-digit milliseconds are compared as milliseconds, original token is retained in the HMAC manifest. Raw query `data.id` only, numeric, no duplicates; Camba's existing signed webhook inbox, payment-only deduplication and shared `ApplyPaymentEvidence` are unchanged. Store proxy internal and HTTPS: valid seconds/milliseconds and repeated signed non-payment smoke delivered 200; bad HMAC, altered query ID and stale valid HMAC 401. Payment duplicate/rejection/stock/approval tests ran in isolated PostgreSQL, not a synthetic payment injected into the live queue. Results: 48 tests, 513 assertions; Pint and diff check pass; 25 independent probes pass. Composer audit lists 5 existing Symfony advisories, none for the SDK. Native review cannot assess this mixed worktree without explicit untracked scope; no review session opened and no unrelated files staged.

L4. One new real CambaTest HTTPS checkout: order 55 / attempt 20 / reference `e78c583e-02e3-499f-816d-b6d946655b2d`, preference `2423847653-482fe101-72bd-49e6-9f36-5b9d25d159c2` at 15:13:04 UY, expiry matches reserve at 15:23:04. Browser initial redirect 302 → 200, request ID `4fce65b0-9678-439f-a072-798879a42d14`, payment-options page only. `pagos/26112026.log`: initiating → ready. Exact-reference provider search returned zero payments; no payment ID, matching signed delivery or authenticated /review observed. Incomplete: sign in as test buyer, submit only official test card, verify provider status and /review as appropriate.

L5. Closure continued from existing live worktree; preserve the cart fix and ABI. Live historical attempt and controlled CambaTest provider metadata compared first. Synthetic checkout variants have no local order/reservation; do not pay those preferences. HTTPS guest return checked separately.

L6. Original hosted-checkout incident (15:02 UY) used a valid CambaTest MLU preference, UYU 451, binary mode and one installment; exact provider payment search returned zero and the scheduler expired attempt 19, rather than receiving a rejection. Original router request: a3a6a428-5022-49fe-9183-ed3b4c587b34. Isolated CambaTest A/B preferences 2423847653-44e1cbf7-faea-4b32-bab9-7c13cc3113c3 (Camba) and 2423847653-6cfa4892-fd7e-4d8a-adbb-967df3566db0 (Komorebi-like) used the same seller, authenticated test buyer, UYU 451 item and test card. Both kept Pagar natively disabled. Review responded 200, with x-request-ids f88efb0b-98dd-48d7-9903-702b9e34d929 (15:58:42 UY) and 5b296f0b-d470-40ad-969e-d3dcc45af69d (15:59:13 UY), no router-request-id on those responses and no explicit eligibility/rejection code observed. The earliest measured failure was a cross-origin provider background POST blocked by CORS / net::ERR_FAILED at 15:58:41.562 UY; there was no HTTP response or request ID exposed, and causation was not established. No preference policy changed on this evidence; real approval, rejection and payment webhook remain unverified. Camba same-origin HTTPS guest return successfully retained order visibility (200 pre/post); localhost-to-HTTPS guest return did not share cookies (404). Isolated worker/API/scheduler file probe on the working pagos bind retained all appends. payment.preference.created now records safe correlation context only, after the attempt is saved and only when it is created, not on resume.

L7. Amount/environment checked on the token actually loaded by Docker Laravel, without printing its value. Effective variable MERCADOPAGO_ACCESS_TOKEN; CAMBA_MP_LIVE=false. Mercado Pago /users/me returned HTTP 200, site MLU/country UY, test_user and exact configured collector match. The original preference GET 200 returns one unit at UYU 451 and the same collector; live_mode is not present in this preference response. The real /v1/payment_methods endpoint returns active Visa and Mastercard credit/debit and minimum 1, maximum at least 300000 for the returned entries. UYU 451 is in range for every returned matching entry. Mercado Pago Checkout Pro Preferences officially documents APP_USR for test seller tokens; the prefix alone does not identify production. The provider browser closed before the independent new-card check could enter the form; not counted as passed or failed.

L8. The previously interrupted same-buyer new-card verification completed. One real HTTPS Camba checkout made order 61 / attempt 28, reference 1e635b95-ebdb-42c7-b511-3f5f5bd24b4e, preference 2423847653-5c9064f2-43a7-400f-b7d7-c7d22845ee8b valid 16:08:42-16:18:42 UY. After authenticated login, explicitly selected Nueva Tarjeta and entered official Uruguay Mastercard fixture; tokenization and association returned 200; at 16:15:36.527 UY /review still rendered Pagar disabled. Exact provider payment search 200 with zero results; Camba no payment. The real Windows daily log contains payment.started, payment.preference.created and attempt ready for 28. Local support draft docs/MERCADO_PAGO_CASO_SOPORTE.md includes original, A/B and new evidence; not sent. No payment code change and no payment/webhook validation possible from this run.
