# Catalog API

All paths below are relative to `/api/v1`. Requests and responses use JSON. Collections and objects wrap their contents in `data`; product collections also include Laravel pagination `links` and `meta`.

## Public

| Method and path | Result |
| --- | --- |
| `GET /products` | Published products, including sold-out products. |
| `GET /products/{slug}` | One published product; unknown, draft, and archived slugs all return 404. |
| `GET /categories`, `GET /brands` | Active classifications for filter controls. |

For example, `GET /products?q=glass&category=home&brand=senda&sort=price_asc&per_page=12&page=2` searches product names and SKUs. The category and brand filters use slugs and combine with the search. Sort choices are `newest` (default, highest created ID first), `name`, `price_asc`, and `price_desc`. The default page size is 24; callers can request 1–100. Invalid parameters return 422.

Products include `id`, `sku`, `slug`, `name`, `description`, `price_cents`, `currency` (`UYU`), `stock`, `in_stock`, `category`, `brand` (nullable), and ordered `images`. Classifications expose `id`, `slug`, and `name`; image entries expose `id`, `url`, and `alt`.

## Administration

Use the existing first-party Sanctum cookie session, with CSRF on writes. Only verified administrators can use these routes (401 without a session, 403 if the session lacks admin access).

| Method and path | Result |
| --- | --- |
| `GET /admin/products` | Same browse parameters as public, plus optional `status=draft\|published\|archived`. |
| `POST /admin/products` | Create a draft (201) and generate its permanent SKU and slug. An identifier collision returns 409; the existing product is unchanged. |
| `GET /admin/products/{id}`, `PATCH /admin/products/{id}` | View or edit a product by numeric ID without changing its SKU, slug, or status. |
| `POST /admin/products/{id}/publish`, `POST /admin/products/{id}/archive` | Publish a draft or archived product, or archive a draft or published product. Repeating the current state returns 409. |
| `GET /admin/categories`, `GET /admin/brands` | List active and inactive classifications. |
| `POST /admin/categories`, `POST /admin/brands` | Create a classification (201). Send `name` and optionally `active` (defaults to true). |
| `PATCH /admin/categories/{id}`, `PATCH /admin/brands/{id}` | Rename, activate, or deactivate. The filter slug remains stable on rename. |

Admin product responses include `status`; admin classification responses include `active`. Use real JSON integers for IDs, price, and stock: for example, `{"name":"Glass","price_cents":12050,"stock":4,"category_id":1,"brand_id":null}` sets the final price to UYU 120.50. Price must be positive, stock starts at zero and cannot be negative, and both values are capped at 2,147,483,647. Drafts can omit the name, price, and category. Publishing requires a name, a price, an active category, an active brand if assigned, and at least one image. Edits to published products must preserve the same requirements. Missing requirements return field-specific 422 errors.

Classifications are flat. Deactivation returns 409 while any published product uses the classification. Reassign or explicitly archive those products first. Drafts and archives keep their original references. No product or classification removal is exposed.

Image rows represent already-ingested assets. This API does not accept paths or image metadata on product writes. The upload, content validation, optimization, and bulk tools are separate work; fixture rows used in tests do not demonstrate those capabilities or live image serving.
