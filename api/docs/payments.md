# Checkout Pro verification boundary

Camba follows the existing Komorebi Checkout Pro **Preferences** and authoritative Payments API pattern. Do not infer that examples for Checkout Pro Orders have the same payloads. Primary references: [create preference](https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [get payment](https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/get-payment/get), [search payments](https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/search-payments/get), and [webhook signature](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro-preferences/additional-settings/optional-notifications?scope=prod).

| Runtime setting | Purpose |
| --- | --- |
| `MERCADOPAGO_PUBLIC_KEY` | Public key for the chosen environment. Checkout Pro redirects to the provider, so Angular does not receive or use this key. |
| `MERCADOPAGO_ACCESS_TOKEN` | Server-side access token. A nonempty value other than `X` takes precedence over the legacy `CAMBA_MP_ACCESS_TOKEN`. |
| `CAMBA_MP_COLLECTOR_ID` | Numeric seller account ID expected in preference and payment responses. |
| `CAMBA_MP_WEBHOOK_SECRET` | Webhook signing secret for the same application. |
| `CAMBA_MP_LIVE` | Boolean; defaults to `false`, uses the provider sandbox redirect and requires non-live payment evidence. |
| `APP_URL` | Public HTTPS storefront origin, without a path or query. Used for browser return and webhook URLs. |

Never expose these credentials through the storefront or build arguments. Use a private runtime env file. The adapter sends only line snapshots, delivery cost, expiry and the opaque order reference; it does not submit payer contact information. It does not retry preference creation automatically. A network timeout is not evidence that the provider did not create the preference.

## Local Docker

The API reads the two keys, `CAMBA_MP_COLLECTOR_ID`, and `CAMBA_MP_WEBHOOK_SECRET` from the ignored `api/.env` in its source bind mount. Leave keys that are not supplied as `X`. Local Compose always sets `CAMBA_MP_LIVE=false` and defaults to allowing payment actions when Laravel is configured. Set `CAMBA_DEV_ENABLE_PAYMENTS=false` to build an explicitly disabled Store instead.

For a real sandbox run, set the test credentials, seller ID and webhook secret in `api/.env`. In the private Compose environment (`infra/dev/demo.env.local`):

- Set `CAMBA_DEV_APP_URL` to an authorized public HTTPS origin that routes to this same test Store and webhook. Mercado Pago does not accept loopback return URLs. Open the checkout at that **same origin** to retain the buyer or guest session on return.
- Set `CAMBA_DEV_STATEFUL_DOMAINS` to include that host and the local hosts you still use.
- Use `CAMBA_DEV_ENABLE_PAYMENTS=true` (the default). Rebuild/recreate Store and recreate the API, worker, and scheduler after changing the Compose environment. Use this setup only in the test environment.

## Buyer journey

Like Komorebi, Camba sends `binary_mode: true`. Camba keeps an internal order snapshot and a 10-minute technical reservation so prices, shipping and stock remain consistent across the redirect. New Checkout Pro snapshots are private to the buyer's checkout detail, not listed in purchases and not announced as orders before verified approval. Approval moves the purchase to preparation and removes the purchased quantities from the cart. Existing orders and the no-provider demo retain their original behavior.

One order has many `order_items` and an `orders.payment_id` foreign key to one `order_payments` aggregate. Each preference has a durable `payment_attempts.payment_id` pointing to that aggregate. Verified provider transactions remain in the separate `payments` ledger, with an optional attempt FK and existing payment observations. The migration backfills legacy links without changing status, reservations, references, or ledger history. The provider's external reference for a new attempt identifies both the order and the attempt; Camba resolves and verifies both before applying evidence.

Verified rejection/cancellation or a definitive preference refusal closes the attempt and releases stock once without discarding the cart. A new key can then open a fresh preference on the same aggregate, after reserving the original quantities again. An ambiguous response (timeout, provider error page or tab closure) is not a rejection. The scheduler checks for verified provider payments before releasing an expired reservation. A late approval may reacquire inventory; if none is available, the order enters payment review and operations receives an issue rather than a preparation notification. An already accepted charge stays auditable and is never silently treated as unpaid.

`GET /api/v1/store-info` publishes only the `checkout_pro_available` configuration boolean. A missing token, collector, signing secret, or public HTTPS origin makes it false. This does not probe Mercado Pago. The same configuration check guards new payment attempts so correcting missing configuration can resume the same order without an uncertain provider attempt. If the capability lookup itself fails, the Store lets the payment endpoint decide instead of treating the failure as a disabled configuration.

Before redirecting, the browser remembers an opaque fingerprint of any already-verified rejections. A return never treats the same rejection as the outcome of a retry. Someone who returned without a submitted payment can reopen a still-active preference; once the reservation has safely closed the detail offers another attempt on the same Checkout Pro order.

An HTTP notification must carry a matching HMAC over the payment ID, request ID, and provider timestamp. Preserve the literal `data.id` query parameter at the edge. The provider may deliver old notifications again, so payment state, uniqueness, and stale-event protection must be enforced in the durable synchronization layer; a valid signature only identifies which payment to fetch. Browser return values and search results are not authority. Re-fetch each payment by its ID and compare exact order reference and total before making an order change.

The current adapter and signature tests use Laravel's blocking HTTP fake; tests cannot send to any real provider. Approving a purchase, webhook delivery over public TLS, and reconciliation with a real Mercado Pago test account are not yet verified.

Komorebi recovers missing notifications when its return controller checks the checkout session: it searches by external reference, fetches the payment by ID and uses the same synchronizer as the signed webhook. Its inspected scheduler has no payment job. Camba uses the equivalent server-side search in `camba:reconcile-payments` every minute, even if the tab closes. The browser can request that check but its status/IDs never confirm an order. The webhook is sent to the configured `APP_URL` plus `/api/v1/webhooks/mercadopago`; that public origin must route `/api` to the same Laravel environment.

For a simulated checkout on an isolated database, run the Laravel suites in `tests/Feature/Payments` and `tests/Feature/Orders`. From `web/`, run `npx playwright test --project=store e2e/store-checkout-payment.spec.ts` for the buyer journey and captures. The real HTTP adapter and the browser's hosted checkout are faked only by the test harness. See [the pagos log guide](../../docs/PAGOS_LOGS.md) for the local file, event fields, and redaction rules.
