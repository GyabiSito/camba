# Operational settings

- `GET /api/v1/store-info` exposes only the store name, public support email/phone, pickup address and delivery cost. Public channels come from `CAMBA_PUBLIC_CONTACT_EMAIL` and `CAMBA_PUBLIC_CONTACT_PHONE` in Laravel runtime configuration, never from the internal settings record. A missing or invalid public channel is `null` and does not suppress the other channel.
- `GET /api/v1/admin/settings` returns all effective operational settings. The admin session must be verified.
- `PATCH /api/v1/admin/settings` changes only supplied fields through a first-party cookie session with CSRF. Unknown keys and wrong types are rejected. For example, `{"support_email":"help@example.test","delivery_cents":null}` changes the **internal contact form recipient** and disables delivery, even if the runtime fallback has a rate. The stored `support_phone` remains private for compatibility.
- `GET /api/v1/admin/settings/history` is newest-first with 25 changes per page. Each row includes the operator ID, timestamp, and before/after effective settings. Repeating an identical patch does not create a new audit row.

Checkout reads the same effective pickup/delivery values before quoting and reserving. Initially it falls back to `CAMBA_PICKUP_ADDRESS` and `CAMBA_DELIVERY_CENTS` until an admin sets those fields. Setting an option to null explicitly disables it.

The reminder toggles start off. Configured defaults are payment 10 minutes before reservation expiry, cart 24 hours after abandonment, low stock at 3 units, and fulfilment notice at 24 hours. Persisting these switches does not send a notification; the scheduler/workers implement delivery separately. No provider token, SMTP password or application secret can be read or edited here.
