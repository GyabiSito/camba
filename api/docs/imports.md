# Review and apply a catalog import

Verified administrators can preview a CSV/XLSX, review what will be created or changed, and explicitly queue its valid rows. A preview never changes catalog products. New products start as drafts; an import cannot publish, archive, delete, or change an existing SKU.

## Quick path

1. Download the CSV template from `GET /api/v1/admin/catalog-imports/template`.
2. Send `POST /api/v1/admin/catalog-imports` with a multipart `file` part. A new preview returns 201; uploading the same bytes again returns its existing ledger (200).
3. Review `data.rows`, including `action` (`create` or `update`), `values`, and row-specific `errors`. Check `data.counts` before confirming; invalid rows stay excluded.
4. Call `POST /api/v1/admin/catalog-imports/{id}/confirm` (202). Poll `GET /api/v1/admin/catalog-imports/{id}` for progress and final changes. A preview with no ready rows returns 409 if confirmed.

Use the existing first-party Sanctum session and CSRF for writes. Set `Accept: application/json` to receive JSON errors; a successful template request returns `text/csv`. The ledger is an admin operations record. It includes the uploader, the first confirming admin, and timestamps. Repeated confirmation does not replace that actor.

## Template rules

Use the eight template columns, in any order, without additional fields:

| Column | Accepted value |
| --- | --- |
| `codigo` | Case-insensitive SKU; normalized to uppercase. Starts with a letter or digit and uses at most 64 letters, digits, periods, dashes or underscores. All copies of a duplicate SKU in a file are invalid. Use text cells for SKUs with leading zeros. |
| `nombre`, `descripcion` | Product name (120 characters) and optional description (4,000 characters). |
| `precio_uyu` | Positive final UYU price; literal amount, at most two decimal places, no thousands separator. Accepts `12.34` or `12,34` (quote a decimal comma in CSV). Converted to exact integer cents without floating point. |
| `stock` | Whole units, from 0 to 2,147,483,647. Zero is an explicit update. |
| `categoria`, `marca` | Existing **active** classification slugs; the brand is optional. Unknown names/slugs are reported rather than created. |
| `fotos` | Optional `\|`-separated references to up to 12 already-uploaded photos owned by the target SKU, in the form `products/optimized/<product-id>/<uuid>.webp`. The original and thumbnail must both exist on the public disk. References validate the existing gallery; no image is fetched, copied, or removed. Upload photos for a new SKU through its gallery after the draft is created. |

For new SKUs the name, price, stock and category must be present. On updates, blank cells leave existing values unchanged. The import does not offer a clear-value operation.

File limit: 2 MiB and 500 data records/rows. CSV uses UTF-8 (optional BOM), commas and standard double-quote escaping, with the header first. XLSX accepts one ordinary worksheet with text or plain numeric cells. Formulas and cached formula results are never consumed. Archives are not extracted; ZIPs with unsupported entries, encrypted files, external workbook links, or unsafe paths are rejected. XLSX allows up to 128 archive entries, 12 MiB declared decompressed size, and 512 KiB for each inspected XML part. PHP needs the native `zip` extension for XLSX.

## Progress and recovery

Import statuses are `preview`, `queued`, and `completed`. Rows report `ready`, `invalid`, `applied`, or `failed`. Applied rows report exact field changes as `{"price_cents":{"before":100,"after":1234}}`. Unspecified fields are never written. If an included field, SKU, taxonomy availability, or photo reference changed after preview, the row fails without overwriting the newer state.

Each product update, audit entry and successful row state commit together. Repeating a job skips committed rows. A runtime interruption leaves remaining rows ready; repeat confirmation to enqueue unfinished work. If the queue is unavailable, confirmation is retained and the request returns 503. Terminal validation failures are not retried automatically: correct the source data and upload a changed file to generate a new preview. Exact-byte deduplication is not based on the file name.

An import is **not** an all-or-nothing transaction for the entire file. There is no automatic rollback of applied rows. Review the ledger and correct values with a new import or an audited admin edit; review a draft before explicit publication.
