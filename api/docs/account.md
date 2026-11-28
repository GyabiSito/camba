# Buyer account API

These endpoints use the same first-party Sanctum session and CSRF protection as the [identity API](../README.md). Paths below are relative to `/api/v1/account`.

| Method and path | Request body | Success |
| --- | --- | --- |
| `GET /profile` | — | `200`, current profile in `data` |
| `PATCH /profile` | `{"name":"Updated Name"}` | `200`, updated profile in `data` |
| `GET /addresses` | — | `200`, current account's addresses in `data`, oldest ID first |
| `POST /addresses` | Address input | `201`, new address in `data` |
| `GET /addresses/{address}` | — | `200`, address in `data` |
| `PATCH /addresses/{address}` | Address fields to change | `200`, updated address in `data` |
| `DELETE /addresses/{address}` | — | `204`, no body |

## Profile

The profile includes `id`, `name`, `email`, `role`, and `email_verified`, like `/api/v1/auth/me`. On update, `name` must be a non-blank string of at most 120 characters. Sending `email`, `password`, `password_confirmation`, `role`, or `user_id` fails validation; credential changes are outside this API.

## Addresses

Creation requires non-blank strings for `recipient` (120 characters), `department` (80), `locality` (120), `street` (160), and `number` (20). The optional strings `details` (255), `phone` (30), and `postal_code` (12) are nullable. Numbers and postal codes are strings to preserve letter suffixes or leading zeroes.

```json
{
  "recipient": "Example Buyer",
  "department": "Canelones",
  "locality": "Ciudad de la Costa",
  "street": "Giannattasio",
  "number": "123A",
  "details": "Apartment 2"
}
```

A partial update changes only the supplied fields; send `null` to clear an optional field. A returned address adds the numeric `id` and includes any unset optional fields as `null`. Ownership comes from the session and cannot be set or changed by the caller; `user_id` is rejected even when null and is never returned.

Address creation is not idempotent. If a save times out after submission, refresh the address list before retrying; the first request may already have saved it.

## Failures

- `401`: no authenticated session.
- `404`: the address ID does not exist or belongs to another account. The response does not distinguish these cases.
- `419`: missing or invalid CSRF token on a first-party mutation.
- `422`: invalid body; read field-specific messages from `errors` (e.g., `errors.recipient`).
