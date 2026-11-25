# Commerce notices and reminder preferences

Camba projects committed orders, payment issues, stock, and import outcomes into a durable notice ledger. An order or payment is not rolled back when delivery fails. The API never exposes recipient details in the admin notice feed.

## Buyer preferences and admin feed

| Method | Path | Access and result |
| --- | --- | --- |
| GET/PATCH | `/api/v1/account/reminder-preferences` | Verified buyer, own preferences only. `data.payment_reminders` and `data.cart_reminders` are independent booleans and default to false. PATCH accepts either field without resetting the other. |
| GET | `/api/v1/admin/notices` | Verified administrator, 25 records per page. Optional `state=active\|resolved\|failed\|uncertain`. Shows panel notices and exceptional mail states, without names, emails, guest or account identifiers, or raw SMTP errors. |

Use the first-party Sanctum session and CSRF for writes. The feed reports `kind`, `channel`, `subject_type`, `subject_id` (null for cart), `state`, `issue`, `error_code`, `attempts`, and timestamps. Order and import IDs are operational references, not guest access credentials. Low-stock and overdue notices resolve when their condition clears and reopen the same record if it returns.

The Admin table opens on `state=active`; **Todos** omits the state filter. Combine `kind`, `q`, `date_from` and `date_to` before pagination. `kinds` supplies the display/search labels. Search accepts a title, a full order UUID or the displayed eight-character prefix, or a product/import ID. Dates apply to the displayed `updated_at` day (inclusive in the configured store timezone). Results are ordered newest first with descending ID as a tie-breaker; `meta.total` is the complete filtered count. Source links return to the fixed notice route with the prior filters and page.

For a read-only browser check of the local Admin at `4300`, run `node e2e/admin-notice-table-docker.mjs` from `web` with the documented Docker `CAMBA_DEMO_PASSWORD` and at least 26 visible notices, including an order notice on page two. The script verifies the cross-page search, combined filters and source returns, and saves captures under `web/test-results/admin-notice-table-docker/`.

## What gets noticed

See [Camba transactional mail](../../docs/CORREOS_TRANSACCIONALES.md) for the shared template, complete inventory and local SMTP capture procedure.

- **Transactional mail:** order received, payment confirmed, ready for pickup, and shipped. Fulfilment email requires a committed event and a matching current state. Buyer email uses the currently verified account address; guest transactional email uses the order’s stored checkout address. No guest cart email is collected or used.
- **Payment reminder:** one per order, only in the configured window before the reservation expires, while payment remains pending and unambiguous. Both the store switch and a verified buyer’s opt-in must be enabled. Default lead: 10 minutes; off by default.
- **Cart reminder:** a nonempty cart with purchasable stock, unchanged for the configured inactivity window, for a verified and opted-in buyer. No message after a newer checkout for that revision; no cart messages more than once in seven days, including after uncertain sends. Default inactivity: 24 hours; off by default. Carts older than 30 days are not contacted.
- **Panel:** new and paid orders, fixed payment or stock issue codes, low published stock (default at or below three), paid orders still awaiting preparation or pickup (default 24 hours), and completed imports. Partial imports have a distinct completion kind. An import still unfinished one hour after confirmation is shown as stalled, not conclusively failed.

Store switches, reminder intervals, and operational thresholds use the existing Store Settings API. The projection limits each scan and avoids replaying transactional email events older than seven days. It checks current state and preferences again immediately before invoking the mail transport. A state change after the transport begins cannot recall that message.

## Delivery and recovery

The scheduler runs `php artisan camba:notices` each minute. It inserts uniquely keyed SQL records and queues due mail after commit. Repeated projection or job execution cannot send a second message for the same record. Use one configured Laravel delivery transport; automatic failover/round-robin transports are disabled for commerce notices. Use the array transport or Mailpit for isolated verification; do not use log/array as the production delivery transport.

| Mail state | Meaning |
| --- | --- |
| `pending` | Due or scheduled for a safe retry. Preparation failures retry after two and four minutes, up to three preparation attempts. |
| `sending` | Worker has durably claimed the attempt. Other jobs must not send it. |
| `sent` | The configured transport returned without error. This is not proof of inbox delivery. |
| `cancelled` | Recipient, preference, source state or timing ceased to be eligible. |
| `failed` | Known preparation failure exhausted its retry allowance. Investigate mail configuration. |
| `uncertain` | Transport raised an error after submission began, or a worker left an in-flight claim for 15 minutes. Acceptance is unknown. Never automatically resend. |

For an uncertain result, consult the configured provider with the message ID `camba-notice-<ledger-id>@<app-url-host>`. Do not assume an SMTP timeout proves rejection. There is no force-resend route. The focused test suite uses fake mail and Laravel’s array transport; real provider delivery and concurrency under MySQL/Redis are separate checks.
