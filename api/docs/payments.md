# Checkout Pro verification boundary

Camba keeps Komorebi's hosted redirect and confirms a purchase only after a provider lookup. New checkouts can use [Checkout Pro Orders](https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-orders/create-order); in-flight Preferences keep using the [Payments API](https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/get-payment/get). The protocol is fixed on each attempt, not selected again during reconciliation.

| Runtime setting | Purpose |
| --- | --- |
| `MERCADOPAGO_PUBLIC_KEY` | Public key for the chosen environment. Checkout Pro redirects to the provider, so Angular does not receive or use this key. |
| `MERCADOPAGO_ACCESS_TOKEN` | Server-side access token. A nonempty value other than `X` takes precedence over the legacy `CAMBA_MP_ACCESS_TOKEN`. |
| `CAMBA_MP_COLLECTOR_ID` | Numeric seller account ID expected in preference and payment responses. |
| `CAMBA_MP_WEBHOOK_SECRET` | Webhook signing secret for the same application. |
| `CAMBA_MP_LIVE` | Boolean; defaults to `false`. Requires test Orders IDs or non-live legacy payment evidence, as applicable. |
| `CAMBA_MP_CHECKOUT_ORDERS` | Boolean; opt-in for new managed checkouts. Turning it off does not stop reconciliation of existing Orders. |
| `APP_URL` | Public HTTPS storefront origin, without a path or query. Used for browser return and webhook URLs. |

Never expose these credentials through the storefront or build arguments. Use a private runtime env file. The adapter sends only line snapshots, delivery cost, expiry and the opaque order reference; it does not submit payer contact information. It does not retry preference creation automatically. A network timeout is not evidence that the provider did not create the preference.

## Local Docker

The API reads the two keys, `CAMBA_MP_COLLECTOR_ID`, and `CAMBA_MP_WEBHOOK_SECRET` from the ignored `api/.env` in its source bind mount. Leave keys that are not supplied as `X`. Local Compose always sets `CAMBA_MP_LIVE=false` and defaults to allowing payment actions when Laravel is configured. Set `CAMBA_DEV_ENABLE_PAYMENTS=false` to build an explicitly disabled Store instead.

For a real sandbox run, set the test credentials, seller ID and webhook secret in `api/.env`. In the private Compose environment (`infra/dev/demo.env.local`):

- Set `CAMBA_DEV_APP_URL` to an authorized public HTTPS origin that routes to this same test Store and webhook. Mercado Pago does not accept loopback return URLs. Open the checkout at that **same origin** to retain the buyer or guest session on return.
- Set `CAMBA_DEV_STATEFUL_DOMAINS` to include that host and the local hosts you still use.
- Use `CAMBA_DEV_ENABLE_PAYMENTS=true` (the default) and `CAMBA_DEV_MP_CHECKOUT_ORDERS=true` for CambaTest. Apply the additive migration, then recreate API, worker, and scheduler. Rebuild Store when its source or build setting changes. Leave the Orders flag off in other environments until they are ready.
- In **CambaTest → Prueba → Webhooks**, configure **Order (Mercado Pago)** at `https://<sandbox-store>/api/v1/webhooks/mercadopago`. Leave the existing payment receiver available for prior preferences. The provider configures the Orders topic [at the application level](https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-orders/notifications), not in the create payload.

## Buyer journey

Orders uses `type: online`, `processing_mode: manual`, `capture_mode: automatic` (binary), and `config.payment_method.max_installments: 1`. The total is a decimal string in UYU, checked against the snapshot items and delivery. The reservation starts at ten minutes and is aligned to the provider's creation time and accepted duration before redirecting. The checkout is private and is not listed in purchases or announced before verified accreditation. Approval moves the purchase to preparation and removes its quantities from the cart.

One order has many `order_items` and one `order_payments` aggregate. Each attempt points to that aggregate. `payment_attempts.provider_order_id` stores the provider Orders ID; `payments.provider_payment_id` stores its transaction ID (or a numeric legacy payment ID). The encrypted create payload and the unique provider idempotency key are persisted before the HTTP call. A timeout replays that exact body/key on a buyer retry; unattended reconciliation searches by exact reference if an ID was never returned.

Verified rejection, cancellation, or expiry closes the attempt and releases stock once without discarding the cart. A known Orders ID still reported open by the provider is not released merely because the local timer passed. An explicit cancellation is confirmed with a fresh GET before stock changes. For legacy Preferences, wait for the deadline and the existing complete evidence check. An ambiguous response (timeout, error page or tab closure) is not a rejection. A late approval may reacquire stock; if none is available, the order goes to payment review.

`GET /api/v1/store-info` publishes only the `checkout_pro_available` configuration boolean. A missing token, collector, signing secret, or public HTTPS origin makes it false. This does not probe Mercado Pago. The same configuration check guards new payment attempts so correcting missing configuration can resume the same order without an uncertain provider attempt. If the capability lookup itself fails, the Store lets the payment endpoint decide instead of treating the failure as a disabled configuration.

Before redirecting, the browser remembers an opaque fingerprint of any already-verified rejections. A return never treats the same rejection as the outcome of a retry. An owned, unchanged cart can reopen its still-active checkout URL; after a verified release, the same local order can start a fresh attempt.

An HTTP notification must carry a matching HMAC over the resource ID (lowercased for Orders), request ID, and provider timestamp. Preserve the literal `data.id` query parameter at the edge. A valid signature or browser return never confirms payment. Re-fetch `GET /v1/orders/{id}` and require the correct test/live ID, seller, reference, currency, total and accredited transaction. Legacy numeric payment notifications still use Payments GET.

The current adapter and signature tests use Laravel's blocking HTTP fake; tests cannot send to any real provider. Approving a purchase, webhook delivery over public TLS, and reconciliation with a real Mercado Pago test account are not yet verified.

Komorebi recovers missing notifications when its return controller checks the checkout session: it searches by external reference, fetches the payment by ID and uses the same synchronizer as the signed webhook. Its inspected scheduler has no payment job. Camba uses the equivalent server-side search in `camba:reconcile-payments` every minute, even if the tab closes. The browser can request that check but its status/IDs never confirm an order. The webhook is sent to the configured `APP_URL` plus `/api/v1/webhooks/mercadopago`; that public origin must route `/api` to the same Laravel environment.

For a simulated checkout on an isolated database, run the Laravel suites in `tests/Feature/Payments` and `tests/Feature/Orders`. From `web/`, run `npx playwright test --project=store e2e/store-checkout-payment.spec.ts` for the buyer journey and captures. The real HTTP adapter and the browser's hosted checkout are faked only by the test harness. See [the pagos log guide](../../docs/PAGOS_LOGS.md) for the local file, event fields, and redaction rules.
