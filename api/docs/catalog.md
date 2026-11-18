# Catalog API

All paths below are relative to `/api/v1`. Requests and responses use JSON. Collections and objects wrap their contents in `data`; product collections also include Laravel pagination `links` and `meta`.

## Public

| Method and path | Result |
| --- | --- |
| `GET /products` | Published products, including sold-out products. |
| `GET /products/{slug}` | One published product; unknown, draft, and archived slugs all return 404. |
| `GET /categories`, `GET /brands` | Active classifications for filter controls. |

For example, `GET /products?q=glass&category=home&brand=senda&sort=price_asc&per_page=12&page=2` searches product names and SKUs. The category and brand filters use slugs and combine with the search. Sort choices are `newest` (default, highest created ID first), `name`, `price_asc`, and `price_desc`. The default page size is 24; callers can request 1–100. Invalid parameters return 422.

Products include `id`, `sku`, `slug`, `name`, `description`, `price_cents`, `currency` (`UYU`), `stock`, `in_stock`, `category`, `brand` (nullable), and ordered `images`. Classifications expose `id`, `slug`, and `name`; image entries expose `id`, `url`, `thumbnail_url`, and `alt`. The first image is the cover; public and admin lists load only that image. Detail and writes include the full gallery.

## Administration

Use the existing first-party Sanctum cookie session, with CSRF on writes. Only verified administrators can use these routes (401 without a session, 403 if the session lacks admin access).

| Method and path | Result |
| --- | --- |
| `GET /admin/products` | Same browse parameters as public, plus optional `status=draft\|published\|archived`. |
| `POST /admin/products` | Create a draft (201) and generate its permanent SKU and slug. An identifier collision returns 409; the existing product is unchanged. |
| `GET /admin/products/{id}`, `PATCH /admin/products/{id}` | View or edit a product by numeric ID without changing its SKU, slug, or status. |
| `GET /admin/products/{id}/history` | Newest-first, paginated price and stock adjustments for this product. |
| `POST /admin/products/{id}/publish`, `POST /admin/products/{id}/archive` | Publish a draft or archived product, or archive a draft or published product. Repeating the current state returns 409. |
| `GET /admin/categories`, `GET /admin/brands` | List active and inactive classifications. |
| `POST /admin/categories`, `POST /admin/brands` | Create a classification (201). Send `name` and optionally `active` (defaults to true). |
| `PATCH /admin/categories/{id}`, `PATCH /admin/brands/{id}` | Rename, activate, or deactivate. The filter slug remains stable on rename. |

Admin product responses include `status`; admin classification responses include `active`. Use real JSON integers for IDs, price, and stock: for example, `{"name":"Glass","price_cents":12050,"stock":4,"category_id":1,"brand_id":null}` sets the final price to UYU 120.50. Price must be positive, stock starts at zero and cannot be negative, and both values are capped at 2,147,483,647. Drafts can omit the name, price, and category. Publishing requires a name, a price, an active category, an active brand if assigned, and at least one image. Edits to published products must preserve the same requirements. Missing requirements return field-specific 422 errors.

Classifications are flat. Deactivation returns 409 while any published product uses the classification. Reassign or explicitly archive those products first. Drafts and archives keep their original references. No product or classification removal is exposed.

Price and stock edits record old/new values, actor ID, and timestamp in the same transaction. Rejected and no-op edits leave no audit rows. The history response has `data`, `current_page`, and `last_page`; `data` contains `old_price_cents`, `price_cents`, `old_stock`, `stock`, `actor_id`, and `created_at`.

### Gallery

POST `/admin/products/{id}/images` accepts multipart `photos[]` (up to 12 per request). Each file must decode as JPEG, PNG, or WebP, fit within 4096 × 4096 pixels, and weigh at most 10 MiB. Invalid files are reported by zero-based index (`photos.0`, for example) and nothing is added on validation failure. JPEG orientation is normalized; only WebP derivatives are stored (1600 and 400 px on the long edge, without enlargement).

Send an optional UUID `Idempotency-Key` header once per intended batch. If the response is uncertain (timeout, lost connection, or server error), resend the same key and the same files in the same multipart order, even if the original request may still be running. The initial upload and a successful replay both return 201 with the current product and gallery; a replay never appends again. Reusing the key with different bytes or order returns 409; filenames do not matter. A malformed key returns 422 (`idempotency_key`). Keys are scoped to the product and do not expire while it exists. Without a key, every successful POST appends, so retrying an uncertain upload may duplicate photos. Use a new key for an intentional new batch.

For recovery-capable clients, use POST `/admin/products/{id}/images/uploads` with the same multipart body and a **required** key. An older API rejects this route without writing, so the admin never falls back to the older endpoint during a rollout or rollback. The first route remains compatible with existing callers.

PUT `/admin/products/{id}/images/order` accepts `{"ids":[2,1]}` with every current image ID once. The first ID becomes the cover. A stale list or ID from another product returns 422 and preserves the existing order.

Local serving needs `php artisan storage:link` and the process's `APP_URL` set to the gateway origin. Set reverse proxy and PHP body limits consistently for the supported upload batch. The fixture gallery tests simulate the media disk; they do not prove gateway delivery.
