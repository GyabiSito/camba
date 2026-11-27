# Checkout Pro payment lifecycle

Camba saves the order and reserves stock before connecting to Mercado Pago. The buyer's browser is never payment evidence. A durable webhook inbox and the scheduler both re-fetch payment records through the [Checkout Pro adapter](payments.md).

## Start or resume checkout

| Request | Result |
| --- | --- |
| `POST /api/v1/orders/{reference}/payments` | Requires the owning buyer's first-party session, CSRF token and a UUID `Idempotency-Key` header. The body is empty. |
| `POST /api/v1/orders/{reference}/payments/refresh` | Owner only; `202` queues or preserves a scheduled server lookup. |
| `POST /api/v1/orders/{reference}/payments/cancel` | Owner only. Orders only; `200` for a final result, `202` while still unconfirmed. |
| `POST /api/v1/admin/orders/{reference}/payments/refresh` | Verified administrator only; the same `202` behavior. |
| `GET /api/v1/orders/{reference}` | The owner reads the latest order status. Polling this route never contacts the provider. |

Start returns `data.status`, `data.checkout_url` and `data.expires_at`. A new ready checkout returns `201`; resuming a ready attempt returns its existing URL with `200`. `202` means creation is in progress. An uncertain creation returns `409` with no redirect. An Orders retry during the reservation can replay only the persisted key and body; ambiguous legacy Preferences are not posted again. Another owner's order remains `404`. Redirect responses are private and cannot be stored by HTTP caches.

There is at most one active attempt per order. Changing the incoming key does not bypass that bound. A replacement after a confirmed terminal result keeps the same payment aggregate and re-reserves stock only if available.

## Webhook and unattended reconciliation

1. Register **Order (Mercado Pago)** in the test environment and retain the legacy **payment** receiver at `POST /api/v1/webhooks/mercadopago`. Preserve the literal `data.id` query parameter and the signed headers. A valid delivery receives `200` only after the inbox write; the handler performs no provider request inline.
2. Run Laravel's scheduler in the background. It calls `camba:reconcile-payments` once per minute. The same command runs one bounded inbox/order batch from a trusted shell; it is safe to repeat. Do not direct it to real credentials during tests.
3. Orders uses `GET /v1/orders/{order_id}`; if creation lost its response, search for the exact attempt reference first. Preferences still search the reference and re-fetch numeric payment IDs. The adapter checks collector, mode and currency; Camba checks the attempt, reference and exact amount. Lookup errors reschedule with bounded backoff. A known Orders checkout must reach a terminal state before an unpaid reservation is released, even after the local deadline.

Refresh requests never make a provider call inline or bypass a scheduled backoff. A browser return can request a refresh and read the owned order instead of trusting a query parameter. A chargeback or refund is saved and flagged for review, not automatically restocked or refunded again.

## Inventory and incident handling

| Observation | Local result |
| --- | --- |
| First authoritative approval with the original reservation | `paid`; no second deduction |
| Another approved payment for the same order | Both payment IDs remain in the ledger; `multiple_approved_payments` flags review without changing stock |
| Expiry with complete evidence fetched after expiry and a one-minute grace period | Release once, then mark `payment_expired`; a pending, authorized or in-process payment prevents release |
| Late approval with enough published stock | Reacquire once, record both release/reacquisition timestamps, and mark `paid` |
| Late approval without enough stock | Keep the payment, preserve stock, mark `payment_review` and flag `late_approval_without_stock` |
| Amount/reference conflict or inconsistent provider timestamps | Store a review issue; do not accept conflicting evidence or release the reservation automatically |

Expired orders with an attempt or known payment are checked every 15 minutes for up to 24 hours after the reservation deadline. Later webhook deliveries still work; an administrator can also request a new lookup. Older or repeated observations cannot reopen an approved order, and the first recorded approved payment ID remains fixed.

Monitor due rows, inbox `result`, and order `payment_reconcile_result` / `payment_issues`. A `provider_candidate_limit` result means more than 12 IDs must be checked manually rather than dropping candidates or treating the search as empty. Only allowlisted ledger fields and sanitized result codes are stored; raw provider bodies, signatures and payer details are not stored in the payment ledger. Checkout redirects are encrypted at rest.

The repository tests use a blocking HTTP fake. Real preference creation/retry, public-TLS webhook delivery, provider search consistency, and in-production reconciliation remain separate acceptance steps.
