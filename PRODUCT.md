# Product

<!-- impeccable:product-schema 1 -->

Camba is primarily a clothing shop with a complementary assortment of accessories, jewelry, necklaces, perfumes and items the owner calls "tarjetas cuantticas". This record combines the owner's answers on 2026-11-18 with the [implementation brief](docs/IMPLEMENTATION_BRIEF.md). It describes product intent; [PROGRESS.md](docs/PROGRESS.md) tracks implemented capabilities, verified behavior and outstanding production checks.

## Platform

web

## Stack

The monorepo includes a Laravel 13 API and an Angular 22 workspace: an SSR storefront with hydration and a CSR admin. MySQL and Redis are part of the Docker development and production-style environments; the isolated browser runner uses a disposable SQLite database. Production provider and deployment acceptance are separate from those local environments.

## Users

- The shop owner needs to add and publish products, update prices and stock, and prepare orders without technical assistance, including product entry from phone photos or spreadsheets.
- Shoppers need to browse the assortment, understand price and availability, and complete a purchase with delivery or pickup.
- The specific buyer segment, demographics and shopping motivations have not been confirmed. Do not assume a gender, age group, price tier or fashion niche.

## Product Purpose

Make Camba straightforward to shop from and simple for its owner to operate. Success means the owner can manage products and orders independently, while customers can complete purchases with clear prices, availability and reliable payment status.

## Positioning

The owner confirmed a clothing-led shop with a complementary assortment. A distinctive commercial promise has not been established. Do not invent exclusivity, quality guarantees, sustainability credentials, customer counts or other marketing claims.

## Operating Context

- The project targets Uruguay, with final prices in UYU and local presentation of dates and delivery information.
- The owner manages Products, Orders and Settings; imports, audit information and operational notices belong in context rather than an expanding main menu.
- Individual entry, batches of phone photos and CSV/XLSX imports must share product rules and preserve work after errors.
- Checkout supports guest purchasing and optional customer accounts. Mercado Pago is the specified payment provider; delivery/pickup terms must follow the real shop operation.
- An earlier Camba installation is a migration source, not a disposable development environment. Existing data, photos and order history must be protected.

## Capabilities and Constraints

- Sell simple SKU-based products with photos, name, exact final price, stock, one flat category and an optional brand. Preserve existing independently stocked sellable units during migration.
- Support search, category/brand filters, product details, cart, checkout, customer accounts and order handling.
- Support drafts, publishing and archiving, plus individual and batch product entry with previews, progress and actionable errors.
- Treat server-verified payments as authoritative. Recover payment status when a webhook is absent; notifications must not duplicate or undo a recorded payment.
- Exclude discounts, offers, coupons, campaigns, tags, catalog departments, category hierarchies, a generic variant builder, wishlists, comparisons and reviews. The implementation brief remains authoritative for the full exclusions and acceptance criteria.
- The exact catalog name and meaning of "tarjetas cuantticas" remain to be confirmed. Preserve this as an owner-provided item name; do not infer properties, benefits or health claims.
- Delivery coverage, shipping charges, contact details and actual product-level content remain unconfirmed.

## Brand Commitments

Preserve the Camba name and recognizable identity, as required by the existing brief. Do not invent a new brand story or copy another company's logos or assets. Brand voice and supplied identity assets have not yet been confirmed.

## Evidence on Hand

- [Implementation brief](docs/IMPLEMENTATION_BRIEF.md): requested scope, exclusions and acceptance criteria.
- [Reference notes](docs/REFERENCES.md): earlier findings and local-review requirements; they do not prove that reference code was inspected in this session.
- [Progress](docs/PROGRESS.md): implementation checkpoint and outstanding external requirements.
- Owner's product description, verbatim: "Tienda de ropa principalmente, y alguna que otra variedad como tarjetas cuantticas, accesorios, joyas, collares, perfumes".
- This checkout contains no application, catalog dataset, product photographs or brand asset set yet. Do not fabricate product listings, testimonials or operating results.

## Product Principles

1. Prioritize the owner's routine work over optional commerce features.
2. Keep classification simple: one flat category and an optional brand.
3. Preserve customer and operational work through failures and retries.
4. Present real product, stock and payment information without invented urgency or claims.

## Accessibility & Inclusion

Follow WCAG 2.2 AA: associated labels, meaningful text alternatives, keyboard operation, visible focus and sufficient contrast. Support reduced motion and usable layouts from 320 px. Loading indicators must correspond to real asynchronous work; error recovery must preserve entered information.
