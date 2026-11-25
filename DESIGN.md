# Camba interface direction

The selected `.impeccable/mocks/mesa-catalogo.png` is the visual reference. Preserve its chalk surface, forest action color, dark type, quietly ruled inventory and selected-product side panel. Shop and admin share materials and interaction language, not the same page composition. This document records decisions; it does not certify the Impeccable hero.

| Token | Use |
| --- | --- |
| `--paper` | Warm backdrop, `#f6f5f1` |
| `--surface` | Near-white panel, `#fdfcf9` |
| `--ink` / `--muted` | Text, `#272b23` / `#5d6156` |
| `--forest` / `--accent` | Primary action and quiet tint, `#204936` / `#e4ebe0` |
| `--line` | Subtle separators, `#d9d9cf` |
| `--danger` | Text explanation for failures, `#932d21` |

Use a clear sans, close-packed headings and tabular numerals for stock and money. Give the shop larger product photography and more breathing room. Use only actual catalog data in normal operation; synthetic merchandise is allowed in isolated tests. No invented stock, claims, discounts, urgency or fake links.

In admin keep Productos, Pedidos and Configuración at the top level. Catalog search/filtering precedes inventory; selection shows useful product detail without hiding the table. Imports, history and notices are contextual. Use native details/disclosure and keyboard-operable controls; don't put ordinary tasks in modals. On narrow screens, linearize without hiding actions or using color as the only status cue.

Use written labels and field errors in Uruguayan Spanish, clear focus, high contrast, and reduced-motion-safe transitions. Retain form values on failure. Only show loading for real asynchronous work. Use a 320 px layout and a capture at the comp's 1586×992 size when the browser runner can produce evidence.

## Public storefront — fashion editorial

The public home has its own photographic world. Open at full bleed with window light, worn garments and a cream Georgia headline on the shadow side; use a separate portrait for phones. Manrope stays on navigation, filters, product names, money and help. The centered original Camba mark, previous brick/burgundy tokens and high-contrast focus are retained.

Set the rhythm with three category photographs, a four-card paper shelf, an image-led look and a thin brick frame for the asymmetric story. The cream hero button is the primary action. Category labels use a short local shade rather than tinting the photograph. The shelf filters the server's bounded sample, not the whole catalog. Motion stays on the hero copy, shelf underline and photos, and secondary editorial crops. The hero photo and the shelf layout remain stable, with no animation under the reduced-motion preference. The help and footer point at existing services, not unconfirmed policies.

New home surface tokens: `--home-shelf` = `#f8f3eb` (commercial paper); `--home-gutter` = `clamp(1rem, 3.2vw, 2.9rem)`. Existing colors below still apply, except `--home-control` is no longer required by the home header. Editorial photography is enabled in the local Docker preview and offline demo only; default production builds show a compact brick campaign until a production asset set is approved. See the [surface brief](.impeccable/surfaces/web-projects-store-src-app-catalog-home-html.md).

The demo's full-bleed mosaic follows “Texturas y detalles” directly. The original lockup in cream and “Ver catálogo” below it share a wine-fabric tile that takes two of five columns and both rows. Darker and warmer crops go first to contrast with the bright editorial. On phones the brand spans the width with two photo columns below. The paper footer is a compact directory: a wider brand and “Armá el look” column, a vertical shop list, and a dedicated `#contacto` help column. A separate contact column appears only when a channel is published. A thin rule separates the copyright and circled back-to-top arrow. The mosaic CSS moves only linked tiles on pointer or focus and respects reduced motion.

The masthead, light footer and warm paper are shared by the storefront; the six-photo mosaic remains exclusive to the home. Contactanos reuses the wine-fabric photo for its full-width banner in editorial builds and keeps a solid burgundy banner otherwise. Its form and support channels sit on the catalog’s `--paper` cream, stacked form-first on phones. The blush gradient starts in the shared footer. Use Georgia for page titles, Manrope for controls and amounts, burgundy for primary actions, and thin rules to group related information. In purchase and account views, use plain-language labels for errors, availability and payment status rather than color alone. The header links directly to Inicio, Tienda and Contacto; the full help directory remains in the footer. Editorial links from other routes identify the home explicitly. Admin keeps its existing palette.

## Historical reference — previous category-first mosaic

The `/` shell uses the original Camba bow and wordmark, Georgia for “Vestite distinto.” and Manrope for shopping controls. A compact masthead gives way to three flat category links in a 6/3/3 photo mosaic; on phones the lead spans both columns and the two shorter panels sit below. The category paths come before a comparable grid of catalog cards. A lower brick editorial shows one item's second gallery photo when available and links to that same product. A dark brand-red footer closes the page. These colors cover the home header, main and footer only; other store routes and admin keep the shared palette above.

| Role | Token | Color |
| --- | --- | --- |
| Editorial accent | `--home-brick` | `#911d1d` |
| Action and focus | `--home-action` | `#821f40` |
| Brand masthead and footer | `--home-brand` | `#720f12` |
| Text and focus on dark planes; pressed category label | `--home-cream` | `#f5f5dc` |
| Surface / paper | `--surface` / `--paper` | `#fff` / `#fcfaf6` |
| Text / secondary | `--ink` / `--muted` | `#24201e` / `#635956` |
| Separator / control border | `--line` / `--home-control` | `#e8deda` / `#89736d` |

Motion is optional: a category's underline and arrow respond to pointer or keyboard intent, and the lower editorial's accent moves once. Reduced motion keeps them static; content, focus and links never depend on the animation. See the [public home surface brief](.impeccable/surfaces/web-projects-store-src-app-catalog-home-html.md) for demo image provenance and implementation details.
