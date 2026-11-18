# Rehearse the legacy catalog migration

Run the planner against **an isolated, frozen copy** of the legacy catalog and photos. It reads local files, prints a report and never connects to either database or writes catalog data. A clean report is an input to a staging rehearsal, not approval for migration or publication.

## Run and review

From `api/`, run:

```sh
php artisan camba:plan-legacy-catalog /isolated/export.json /isolated/mapping.json --photos=/isolated/photos --no-ansi
```

- Exit **0**: JSON candidate rows are ready to review; repeat on the same inputs to obtain the same output.
- Exit **1**: fix all reported issues and rerun. JSON validation reports include `errors` and withhold all rows. Unreadable files, invalid JSON and a missing photo directory yield an input diagnostic instead.
- `counts` gives source product count, proposed row count, proposed total stock and unique verified photo paths. On failure the proposed counts are diagnostic only; do not reconcile from them.

## Inputs

Prepare UTF-8 files outside the repository and keep customer information and credentials out of the catalog export. The planner uses a normalized projection, not a raw SQL dump. Record the snapshot, source counts and explicit criteria separating real catalog records from test data. Include all sellable descendants even at zero stock; preserve soft-deleted records and their IDs separately for historical references.

`export.json`:

```json
{
  "version": 1,
  "products": [{
    "id": 42,
    "title": "Lamp",
    "sku": "LAMP-42",
    "slug": "lamp",
    "description": "Warm light",
    "price_uyu": "1490.50",
    "stock": 9,
    "published": true,
    "department_id": 2,
    "category_id": 8,
    "subcategory_id": null,
    "brand_slug": null,
    "cover": "42/cover.webp",
    "gallery": ["42/detail.webp"],
    "variations": [{
      "id": 91,
      "label": "Blue",
      "stock": 9,
      "subvariations": [{"id": 201, "label": "Tall", "stock": 7}]
    }]
  }]
}
```

- Use original positive IDs and integer stock for each level. Join legacy attributes/properties into the human-readable `label` of each unit. Keep `variations`, `subvariations` and `gallery` explicit, using `[]` when empty. A product without photos uses `"cover": null` and `"gallery": []`.
- Use the original `DECIMAL(10,2)` value as a **string** with two decimal places; do not go through a floating-point spreadsheet cell. The v2 range is 1–2,147,483,647 UYU cents. Export plain-text descriptions, original SKU/slug, and the boolean legacy publication state. Use the corresponding flat brand slug or `null`.
- Export the product's cover separately from gallery rows. List galleries in the reviewed legacy order (fall back to increasing image ID). Use regular files inside the isolated photo root, with relative paths separated by `/`; traversal and symlink/junction aliases are rejected. A SHA-256 digest proves which bytes were read. Check image decoding, dimensions, visual results and derivatives during staged upload.

`mapping.json`:

```json
{
  "version": 1,
  "categories": [
    {"department_id": 2, "category_id": 8, "subcategory_id": null, "slug": "lighting"}
  ],
  "residuals": [
    {"unit": "variation:91", "stock": 2, "label": "Standard"}
  ]
}
```

| Review area | Rule |
| --- | --- |
| Classification | Each exact department/category/subcategory tuple in the export maps to one flat category slug. Use explicit `null` for absent levels, not wildcards. More than one tuple may map to the same flat category. |
| Stock | Only the most-specific sellable rows get their stock. A parent stock is a cap: children above it fail, and a positive remainder requires an explicit mapping for that exact number of units. A mapped remainder gets its own sellable row rather than increasing another row's stock. Stale or duplicate residual mappings fail. |
| Identity | A simple product retains its original SKU and slug. A derived row gets `LEGACY-V-{id}` or `LEGACY-S-{id}`; a root residual gets `LEGACY-P-{id}`. Derived slugs append the same suffix in lowercase, trimmed to the length limit. Duplicate source and output SKU/slugs, including case-only collisions, block the report. |
| Traceability | Each row keeps the source product/variation/subvariation IDs plus original SKU and slug. Group by `legacy_slug` to reconcile old `/product/:slug` links; a fan-out requires an explicit destination decision. Source publication state is evidence, not a publish command. |

The example yields seven `Lamp / Blue / Tall` units and two `Lamp / Blue / Standard` units, not 18. The original product and variation stock of nine count as caps, not extra rows.

## Before applying anything

1. Compare snapshot and candidate totals by source product; review excluded records, optional brands, exact money, photos and legacy links. Create or verify target categories/brands in staging before using the rows.
2. Confirm how staged application preserves exact legacy SKUs and slugs. The [ordinary catalog importer](imports.md) uppercases SKUs and generates slugs; it is not a drop-in apply step for this report. Do not lose those identifiers through a blind CSV conversion. Keep a reviewed source-to-target identity ledger and rehearse applying it twice with unchanged counts.
3. Separately reconcile historical users, addresses, orders, payments and sales against a real authorized snapshot; preserve historical prices, promotion snapshots and links without reintroducing promotion features. Check supported password hashes on isolated samples, or plan a reset rather than assuming compatibility. Neither those datasets nor historical comparisons are supplied by this catalog command.
4. Rehearse backup, cutover and rollback on staging. Review photos and old links against the staged storefront. Never roll back by restoring an old database over new orders or accounts; preserve new operations and reconcile them before rollback.
