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

Unlike Komorebi, Camba stores the order and reserves inventory before opening Checkout Pro. The checkout button opens or resumes a preference for that same order; if the provider does not open, the buyer lands on the existing order. All return outcomes go to that private order detail. The query parameters only identify a browser return; the current order and payment state come from authenticated provider evidence. An unconfirmed return requests reconciliation and checks for the result for up to about 25 seconds. Pending evidence prevents starting another payment; a verified rejection can be retried on the same order while its reservation remains valid. Camba retains pending outcomes rather than copying Komorebi's binary mode.

`GET /api/v1/store-info` publishes only the `checkout_pro_available` configuration boolean. A missing token, collector, signing secret, or public HTTPS origin makes it false. This does not probe Mercado Pago. The same configuration check guards new payment attempts so correcting missing configuration can resume the same order without an uncertain provider attempt.

Before redirecting, the browser remembers an opaque fingerprint of any already-verified rejections. A return never treats the same rejection as the outcome of a retry. After the check, someone who returned without completing a payment can reopen the same checkout from the order; a return that indicates a submitted payment stays in confirmation until the server has a result.

An HTTP notification must carry a matching HMAC over the payment ID, request ID, and provider timestamp. Preserve the literal `data.id` query parameter at the edge. The provider may deliver old notifications again, so payment state, uniqueness, and stale-event protection must be enforced in the durable synchronization layer; a valid signature only identifies which payment to fetch. Browser return values and search results are not authority. Re-fetch each payment by its ID and compare exact order reference and total before making an order change.

The current adapter and signature tests use Laravel's blocking HTTP fake; tests cannot send to any real provider. Approving a purchase, webhook delivery over public TLS, and reconciliation with a real Mercado Pago test account are not yet verified.

Komorebi recovers missing notifications when its return controller checks the checkout session: it searches by external reference, fetches the payment by ID and uses the same synchronizer as the signed webhook. Its inspected scheduler has no payment job. Camba uses the equivalent server-side search in `camba:reconcile-payments` every minute, even if the tab closes. The browser can request that check but its status/IDs never confirm an order. The webhook is sent to the configured `APP_URL` plus `/api/v1/webhooks/mercadopago`; that public origin must route `/api` to the same Laravel environment.

For a simulated checkout on an isolated database, run the Laravel suites in `tests/Feature/Payments` and `tests/Feature/Orders`. From `web/`, run `npx playwright test --project=store e2e/store-checkout-payment.spec.ts` for the buyer journey and captures. The real HTTP adapter and the browser's hosted checkout are faked only by the test harness. See [the pagos log guide](../../docs/PAGOS_LOGS.md) for the local file, event fields, and redaction rules.
