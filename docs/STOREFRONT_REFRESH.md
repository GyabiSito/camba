# Camba storefront refresh

[Open the before/after gallery](../web/test-results/storefront-refresh/index.html). Captures are local Playwright artifacts, not tracked by Git. The comparison uses the same catalog and shopper fixtures, viewport and reduced-motion setting on both builds. The starting `/tienda` is captured from the unchanged local build.

| Existing route | Screens and states |
| --- | --- |
| `/` | Approved home, shared header and light footer, home-only editorial mosaic |
| `/tienda` (`/catalogo` redirects here) | Catalog, search, category, brand, ordering, pagination, no results, loading and failure |
| `/producto/:slug` | Gallery, single image, unavailable stock, quantity and add-to-cart, missing product |
| `/carrito` | Lines and totals, quantity, removal and empty cart |
| `/checkout` | Guest contact, pickup or delivery, summary, empty cart, validation and submission status |
| `/cuenta` | Sign-in, registration, forgot-password, verification, profile, session expired, addresses and empty addresses |
| `/cuenta/restablecer` | Password reset, incomplete link, validation and completion/error |
| `/pedidos` | Order reference, date, amount, status, details and empty order history |
| `/pedidos/:reference` | Pending and confirmed payment, existing error/retry and fulfillment states, missing order |
| `/envios`, `/preguntas-frecuentes`, `/contacto`, `/politica-de-privacidad`, `/terminos-y-condiciones` | Shared help and legal directory; `#contacto` remains a legacy footer anchor |
| Unmatched paths | Storefront 404 |

## Verification boundaries

- Build the storefront in production and `production,demo` configurations. Public entry points retain SSR; existing client-rendered purchase and member routes retain their rendering mode.
- Browser evidence: matching full pages at 1440 × 900 and 390 × 844; 320 px reflow and keyboard checks through the focused E2Es. The full checkout and account journeys use the same deterministic local HTTP fixtures and browser stubs for both builds. No provider or real account was contacted and no actual order, email or payment was created.
- Demo verifies catalog, gallery, listing URL state, visual home invariance and sample-user sign-in. The checked-in demo intentionally does not implement cart, order or payment mutations. The fixture runner exercises the existing normal-build storefront integration without extending that demo or changing backend contracts.

The standalone Playwright checks live in `web/e2e/storefront-{shell,catalog,purchase,members,journeys}-refresh.mjs`. The journeys script accepts `CAMBA_CAPTURE_PHASE`, `CAMBA_DEMO_STORE` and `CAMBA_REAL_SSR` and writes full-page evidence to `web/test-results/storefront-refresh/`.

## Observed results

| Check | Result |
| --- | --- |
| Angular production and production/demo SSR builds | Passed; the two existing home CSS size warnings remain |
| Unhydrated HTTP responses | `200` for home, catalog, filtered catalog and a product; `/catalogo` returned `302` to `/tienda`; missing product and unmatched route returned `404` |
| Browser automation | 14 focused checks plus the purchase probe and complete catalog-to-payment and login-to-orders journeys passed. The checkout probe covers delivery and pickup; the journey covers a failed payment opening, retry with the same idempotency key, and a return URL that cannot override the real pending status. |
| Visual comparison | 56 matched capture pairs across 28 page/state combinations and two widths; 320 px reflow passed. The before/after home PNGs have identical SHA-256 hashes at both widths. |
| Backend/provider checks | `api/` unchanged. The separate API-backed account suite could not start its local server on port 43819. Real email delivery and external payment confirmation were not tested. |
