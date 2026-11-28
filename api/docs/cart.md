# Persistent cart API

Only signed-in buyers can read or change their cart. Send the [first-party session](../README.md) cookie and the CSRF token with mutations. The client never supplies a cart ID or guest token.

| Method and path | Request | Success |
| --- | --- | --- |
| `GET /api/v1/cart` | — | `200` with the current cart |
| `POST /api/v1/cart/items/{product}` | — | `200` with one unit added to the updated cart |
| `PUT /api/v1/cart/items/{product}` | `{"quantity":2}` | `200` with the updated cart |
| `DELETE /api/v1/cart/items/{product}` | — | `204`, even if the item was already absent |
| `POST /api/v1/cart/checkout/{reference}/resume` | — | `200` with the current payment state and the original link only if ready |

`{product}` is the numeric catalog product ID. POST adds exactly one unit atomically and does not use a request body. If its outcome is unknown, check the cart before another POST. PUT sets the quantity, not a delta, so retrying it does not add units. Its quantity must be a JSON integer from 1 through 2147483647; it rejects client-supplied ownership and body product IDs. Neither write can exceed current stock, and pricing always comes from the catalog.

```json
{
  "data": {
    "currency": "UYU",
    "items": [{
      "product_id": 12,
      "quantity": 2,
      "available": true,
      "product": {"name": "Example item", "slug": "example-item", "price_cents": 12345, "stock": 4}
    }]
  }
}
```

Items are ordered by product ID. Empty carts return `items: []`. A product that became unpublished stays removable but returns `product: null` and `available: false`. A published product with insufficient stock also returns `available: false`. This response does not reserve inventory. Checkout must revalidate products and stock and compute the authoritative total on the server.

## Login and isolation

A line can have `reserved: true` while a checkout holds its inventory. This never exposes another buyer's checkout. The optional `checkout` object shows a matching owner payment as `ready` (can resume) or `checking` (query its status). Resuming requires a buyer session and rechecks ownership, cart identity and quantities without creating a new payment. If approval races with a resume, that response can return `paid` so the client opens the order detail; the cart itself never shows payment confirmation.

Pending, failed or cancelled payments leave the items in the cart. After verified approval, only the purchased quantities are removed, once. Navigation or removing a cart line does not cancel an open payment or release its stock.

If an older guest cart already exists for the browser session, buyer login imports it once before rotating the session ID. It preserves the buyer's items and adds available legacy units up to current stock. Login does not create a guest cart when none exists. Logging out preserves the buyer cart but makes it inaccessible until sign-in. Cart responses are not stored in HTTP caches.

## Failures

- `400`: no first-party session.
- `401`: no signed-in buyer session; cart data is unchanged.
- `403`: the signed-in account does not have the buyer role.
- `404`: POST or PUT targets a missing or non-public product.
- `419`: missing or invalid CSRF token.
- `422`: invalid payload or quantity above current stock. See `errors.quantity` for quantity errors.
