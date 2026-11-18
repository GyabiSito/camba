# Checkout Pro verification boundary

Camba follows the existing Komorebi Checkout Pro **Preferences** and authoritative Payments API pattern. Do not infer that examples for Checkout Pro Orders have the same payloads. Primary references: [create preference](https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [get payment](https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/get-payment/get), [search payments](https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/search-payments/get), and [webhook signature](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro-preferences/additional-settings/optional-notifications?scope=prod).

| Runtime setting | Purpose |
| --- | --- |
| `CAMBA_MP_ACCESS_TOKEN` | Server-side Mercado Pago access token for the chosen environment. |
| `CAMBA_MP_COLLECTOR_ID` | Numeric seller account ID expected in preference and payment responses. |
| `CAMBA_MP_WEBHOOK_SECRET` | Webhook signing secret for the same application. |
| `CAMBA_MP_LIVE` | Boolean; defaults to `false`, uses the provider sandbox redirect and requires non-live payment evidence. |
| `APP_URL` | Public HTTPS storefront origin, without a path or query. Used for browser return and webhook URLs. |

Never expose these credentials through the storefront or build arguments. Use a private runtime env file. The adapter sends only line snapshots, delivery cost, expiry and the opaque order reference; it does not submit payer contact information. It does not retry preference creation automatically. A network timeout is not evidence that the provider did not create the preference.

An HTTP notification must carry a matching HMAC over the payment ID, request ID, and provider timestamp. Preserve the literal `data.id` query parameter at the edge. The provider may deliver old notifications again, so payment state, uniqueness, and stale-event protection must be enforced in the durable synchronization layer; a valid signature only identifies which payment to fetch. Browser return values and search results are not authority. Re-fetch each payment by its ID and compare exact order reference and total before making an order change.

The current adapter and signature tests use Laravel's blocking HTTP fake; tests cannot send to any real provider. Approving a purchase, webhook delivery over public TLS, and reconciliation with a real Mercado Pago test account are not yet verified.
