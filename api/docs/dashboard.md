# Admin dashboard

`GET /api/v1/admin/dashboard` returns the operational summary for a verified administrator. The response is private and not cacheable. Recent orders use the existing list summary (maximum five, newest first); they do not include contact data, addresses or item details.

## Drilldowns

| Priority | List parameters |
| --- | --- |
| Pending payment | Orders: `status=pending_payment` |
| Paid, still needs preparation | Orders: `status=paid&fulfilment_status=needs_preparation` |
| Ready for pickup | Orders: `status=paid&fulfilment_status=ready_for_pickup` |
| Published without available stock | Products: `status=published&availability=out_of_stock` |
| Withdrawals awaiting review (`received_withdrawals`) | Withdrawals: `status=received` |

`needs_preparation` is a list filter for `unstarted` and `preparing`, not a fulfilment state. `out_of_stock` uses the same available stock value as the product resource. Existing filters and state transitions are unchanged.

`GET /api/v1/admin/withdrawals` accepts an optional `status` (`received`, `reviewing`, `closed`, `refunded`) and an optional exact receipt UUID in `reference`. The filters apply before pagination, so `meta.total` for `status=received` counts the same records as `received_withdrawals`, including cases beyond the first page. An invalid filter returns `422`. When returning to a case after a status change, query by `reference` alone to reopen it outside the original list filter.

## Confirmed sales

Amounts are integer UYU cents, based on the order's `paid_at` confirmation and current `paid` status. Each order counts once regardless of payment evidence count. Pending, expired, refunded, charged-back and review orders are excluded.

`CAMBA_STORE_TIMEZONE` configures the reporting calendar (default `America/Montevideo`); persisted timestamps stay in UTC. The 30-day figures cover today and the previous 29 calendar days up to the request time. The monthly series covers the current and previous five calendar months, including zero months. The response includes both date labels and the reporting timezone.
