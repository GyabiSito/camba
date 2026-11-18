# Persistent cart API

Guests and buyers use the same cart endpoints. Start the first-party Sanctum session as described in the [API setup](../README.md); send its cookie and CSRF token with mutations. No cart ID or guest token is sent by the client.

| Method and path | Request | Success |
| --- | --- | --- |
| `GET /api/v1/cart` | — | `200` with the current cart |
| `PUT /api/v1/cart/items/{product}` | `{"quantity":2}` | `200` with the updated cart |
| `DELETE /api/v1/cart/items/{product}` | — | `204`, even if the item was already absent |

`{product}` is the numeric catalog product ID. PUT sets the quantity, not a delta, so retrying it does not add units. Quantity must be a JSON integer from 1 through 2147483647 and cannot exceed current stock. Client-supplied ownership and body product IDs are rejected; pricing comes from the catalog.

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

Guest carts belong to the current first-party session. A successful buyer login consumes the guest cart once, before the session ID rotates. It adds available guest units up to current stock, preserves quantities already held by the buyer, and discards guest units that cannot be added. Signing in while already authenticated does not import the other account's cart. Logging out preserves the account cart but starts a fresh guest session. Cart responses are not stored in HTTP caches.

## Failures

- `400`: no first-party session.
- `404`: PUT targets a missing or non-public product.
- `409`: an old guest session tries to write to a cart that was already associated. Refresh with the active session.
- `419`: missing or invalid CSRF token.
- `422`: invalid payload or quantity above current stock. See `errors.quantity` for quantity errors.
