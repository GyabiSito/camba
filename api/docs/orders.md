# Quote and reserve an order

Guests can browse, but only a signed-in buyer can use the cart and create an order. Send the [first-party session](../README.md) cookie and CSRF token with mutations. Historical guest orders remain accessible from their original unexpired session. Do not send buyer IDs or guest credentials in the body or URL.

## Checkout

1. **Quote:** `POST /api/v1/checkout/quote` with `{"items":[{"product_id":12,"quantity":2}]}`. Submit 1–50 distinct catalog IDs, each with an integer quantity of 1–1,000. The API checks publication and stock and returns live prices and the configured shipping options. Include `address: {department_id, locality_id}` to validate destination and quote the final delivery price. If delivery is available, a configured free-delivery threshold compares against the live product subtotal, inclusive. The preliminary quote without an address uses the base rate. A quote does not reserve stock.
2. **Choose an option:** Display its `total_cents` and confirm the buyer's contact details and delivery address, if applicable.
3. **Confirm:** `POST /api/v1/orders` with the same items, `shipping_method`, the option's `quote_token`, and contact details. Send a UUID in the `Idempotency-Key` header. Reuse it for retries of the same checkout, not for a new order.

The quote includes `currency` (`UYU`), `subtotal_cents`, `items`, and `shipping_options`. Each item includes `product_id`, `sku`, `name`, `quantity`, `unit_price_cents`, and `line_total_cents`. Each option includes `method`, `shipping_cents`, `total_cents`, `pickup_address` (null for delivery), and the opaque token. `free_delivery_applied: true` is present only on a delivery option eligible for the threshold; an existing zero base rate and pickup are unaffected. Prices are integer cents; do not send amounts back as input. When confirming, the server recalculates and rejects a stale price before reserving stock. Payment uses the stored order total, even if the threshold changes later.

Example delivery body (replace the token with the returned value):

```json
{
  "items": [{"product_id": 12, "quantity": 2}],
  "shipping_method": "delivery",
  "quote_token": "<token returned by the selected shipping option>",
  "contact": {"name": "Test Buyer", "email": "buyer@example.test"},
  "address": {
    "recipient": "Test Buyer",
    "department_id": 10,
    "locality_id": 1051,
    "street": "Example street",
    "number": "123A"
  }
}
```

`contact` requires `name` and `email`; `phone` is optional. Delivery requires a complete address; `details` and `postal_code` are optional strings. Omit the address for pickup.

## Order status and access

| Request | Result |
| --- | --- |
| `POST /api/v1/orders` | `201`: created and reserved; `200`: same-owner retry returned the previous order |
| `GET /api/v1/orders` | `200`: the current buyer or guest's order summaries, newest first, 20 per page |
| `GET /api/v1/orders/{reference}` | `200`: the current buyer or guest's order detail |

Order summaries include the opaque `reference`, `status`, `created_at`, `reservation_expires_at`, `currency`, `shipping_method`, `subtotal_cents`, `shipping_cents`, and `total_cents`. Detail adds snapshotted `items`, `contact`, `address`, `pickup_address`, and `guest_access_expires_at`. Authenticated orders return null for that last field. Contact and address are encrypted at rest; retain the Laravel encryption key and previous keys when rotating it.

A reference is not proof of ownership. Missing, foreign, and expired orders all return `404`. A guest can use the original session for up to 24 hours; an earlier cookie expiry, logout or login can end access sooner. Guest orders do not move to an account on login. Successful responses are private and not stored by HTTP caches.

Placing an order snapshots the amount and decreases available stock atomically. The initial status is `pending_payment`, not payment approval. The 30-minute reservation expiry is stored for provider-aware reconciliation; reaching that timestamp alone does not release stock. Do not enable checkout in production before payment and expiry reconciliation are in place.

## Shipping configuration and errors

| Setting | Effect |
| --- | --- |
| `CAMBA_PICKUP_ADDRESS` | Non-empty pickup instructions (at most 255 characters) enable pickup at zero shipping cost. |
| `CAMBA_DELIVERY_CENTS` | A non-negative integer from 0 to 2147483647 enables delivery at that flat UYU-cent rate. |

Unset or invalid values disable that method. If neither is configured, the quote returns no options and checkout cannot reserve stock. Supply the store's actual settings; the app does not invent a pickup address or delivery rate.

- `400` / `419`: no first-party session or invalid CSRF token.
- `409`: prices or shipping changed, the guest session changed, or the idempotency key cannot be reused. Request a fresh quote when details changed; do not automatically create a second order after an uncertain response.
- `422`: invalid input, unavailable product/quantity, or unavailable shipping method. Field messages appear in `errors`.

## Administrative fulfilment

Verified administrators can list orders at `GET /api/v1/admin/orders`, filter by payment `status` or `fulfilment_status`, and read a private snapshot and event history at `GET /api/v1/admin/orders/{reference}`.

Use `PATCH /api/v1/admin/orders/{reference}/fulfilment` with `status` and an optional private `note`. A paid order moves from `unstarted` to `preparing`, then to `ready_for_pickup` (pickup) or `shipped` (delivery), then to `completed`. Delivery may add `tracking` on the shipped transition. Other jumps or orders not currently paid return 409. Every accepted change records the operator and transition in the same transaction. Notes are encrypted and never returned to buyers.
