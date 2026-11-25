---
version: 1
slug: "web-projects-store-src-app-catalog-home-html"
primary_target: "web/projects/store/src/app/features/home/home.html"
related_targets: ["web/projects/store/src/app/features/home/home.css","web/projects/store/src/app/features/home/home.ts"]
---

# Public storefront home

Scope: public `/` only; Persuade. New shoppers can start with a published category immediately; search, account, and cart retain their current routes. Product truth belongs to the active catalog.

## Direction contract — Vestite distinto, the atelier

**THESIS:** An afternoon at the atelier moves from the person wearing the clothes to the visitor finding a way to wear them.

**OWN-WORLD:** Hard side light, warm plaster, dark brick, bone and sand cloth. Georgia display, Manrope utilities, an original centered red Camba bow, burgundy actions and warm paper.

**STORY:** One shop entry, three category doors, a four-up comparison, two actual demo pieces in a full-body look, a quieter scene in three frames, then help.

**FIRST VIEWPORT:** 72-pixel masthead; one full-bleed scene of about 612 pixels at 1440, headline and CTA in the left shadow. At 390 the dedicated portrait leaves space below the face and upper garment for a 490-pixel scene.

**FORM:** User-pinned code-led direction, no approved comp or seed. Signature: the shelf underline tracks the pressed filter; a short arrow nudge points to the next chapter or product.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Atelier — built result and provenance

**Current result: local visual ship for `/` only.** The independent Impeccable finish review found one material defect: at 320 px with 200% text, the cream hero copy overlapped the model and crossed light plaster. The final captures put the portrait above the copy on dark brick (sampled contrast at least 10.8:1), with no face overlap and no regression reported at standard 320 or 390 px. The reviewer rechecked that finding only and marked it resolved. This is not an RDD receipt, comp approval, or production sign-off.

### What the home does

- The masthead keeps the original centered Camba bow, with menu, search, account and cart on existing routes. The demo opens with “Vestite distinto.” on one fixed, full-bleed scene. The wide hero is 612 px tall at 1440 px, and a separately composed portrait is 491 px tall at 390 px. See [DESIGN.md](../../DESIGN.md) for the route-only typography, colors and spacing.
- Three photographic doors lead to actual flat-category results in `/tienda`; on phones the first is full width and the next two sit side by side. “Selección de Camba” shows four products when available (four columns on desktop, two on phones). Its pressed filter and underline apply only to the selection, not the full catalog. Existing cards keep catalog names, UYU prices, availability and same-item alternate views when present. The underline and arrow nudge are optional; links and content do not depend on motion.
- “Armá el look” pairs a full-body photograph with the demo shirt and trousers; links to specific products require a matching slug and cover, otherwise available category links are used. “Texturas y detalles” follows with one scene and two crops, then real help routes and a deep-red footer. Contact stays truthful when no channel is published.

### Photography and release boundary

The 18 new `atelier-*.webp` files are demo-only ImageGen derivatives with adjacent `.webp.json` sidecars recording the exact prompts, inputs and crop/resize steps. The look references mock shirt and trouser packshots; it is not a photograph of live stock. The provenance scan found sidecars for all 26 demo WebPs. Normal builds use a short brick intro, actual catalog media and photo fallbacks, and an optional second photo of the same published product. Review or replace the demo imagery, verify production garment/category associations, and confirm contact details before publication. See the [home runbook](../../docs/HOME_EDITORIAL.md).

### Local evidence

- **Visual:** [1440 px](../../web/test-results/home-editorial/after-1440.png), [390 px](../../web/test-results/home-editorial/after-390.png), [320 px / 200% text](../../web/test-results/home-editorial/after-320-text200.png), and full-page captures at [1440](../../web/test-results/home-editorial/after-full-1440.png) and [390](../../web/test-results/home-editorial/after-full-390.png). The local overviews show the sequence at [1440](../../web/test-results/home-editorial/review-overview-1440.png) and [390](../../web/test-results/home-editorial/review-overview-390.png). Every image decoded in the full-page captures; the static detector's missing-`src` warning was on Angular's `[src]` binding.
- **Build and browser automation:** optimized demo and normal storefront SSR builds succeeded with CSS budget warnings. Chromium passed 3/3 optimized demo cases, 1/1 normal SSR case using an isolated loopback catalog fixture, and 1/1 existing development demo roles/session case.
- **Performance:** [local Chromium data](../../web/test-results/home-editorial/visual-and-lcp.json) records no horizontal overflow at 320, 390, 768, 1024 and 1440 px. Mobile LCP median was 1.308 s (1.276–1.416 s) versus 0.508 s before: slower than the previous composition, still below the 2.5 s local target. Three Pixel 7 emulation runs per build used a cold browser cache, 4× CPU slowdown and 150 ms / 1.6 Mb/s download emulation. These are local measurements, not field data.

## Atelier polish — restored media and practical motion

The stale demo watcher returned HTML 404s at the Atelier image URLs; the original WebPs were present and the fresh demo build still copied all 18. The local demo was restarted. Early browser decode failures now retry the other responsive crop size, and empty media slots reflow instead of showing broken-image icons or unrelated category packshots. The full-bleed campaign keeps the art-directed crops and now leads with a solid cream action. Category shade sits behind its labels, shelf prices align per row, the look favors the photo, and the story has a narrower brick frame. The home footer's no-contact branch links to existing help destinations.

The underline uses a 200 ms interruptible slide and width change. The secondary editorial crops enter once, from 12 px down and 50 ms apart. Both effects are confined to the home and reduce to their final state without animation. [Current runbook and browser evidence](../../docs/HOME_EDITORIAL.md#current-polish). The Atelier visuals are still demo-only.

## Direction contract — category-first mosaic

**THESIS:** The Camba shop window is three doors you can walk through, not an editorial banner to scroll past.

**OWN-WORLD:** Keep the local bow, dark red Georgia masthead, Manrope shopping controls, paper and restrained burgundy. Move the solid brick plane below the product grid.

**STORY:** Recognize Camba; pick a category by name and dress context; compare prices and stock; see a closer view of one actual item; find shop, contact and account destinations in the footer.

**FIRST VIEWPORT:** One compact masthead, then the actual 6/3/3 photo-backed category links. The first product row starts in the desktop viewport. On a phone show the main photo first and two shorter panels next, without a separate non-shopping visual.

**FORM:** User-pinned own composition, code-led; no seed or approved comp. Kumo supplies the category-first idea and later rhythm; Cartzio supplies comparable product frames and direct utilities. One underline and arrow gesture per category on intent, one decorative accent in the lower editorial.

**FINISH:** Inspect the rendered before/after home, compare desktop and mobile, test real category links, record provenance and independent finish verdict.

## Category-first mosaic — built result and provenance

- The original Camba bow and wordmark are unchanged; see the source pin in the brick revision below. The compact Georgia masthead leads into 6/3/3 category links (one full-width lead and two shorter panels on phones). Each opens `/tienda` filtered to that flat category. The selection reuses the product cards and preserves prices and availability from the active catalog: up to eight items, preferring distinct covers. The demo shows seven distinct fixture covers.
- “De cerca” follows the selection only when a single optional public product detail provides a distinct second gallery image. Its name, image and link belong to the same SKU. The dark footer keeps Tienda and Mis pedidos, adds Mi cuenta (`/cuenta`) on home, and links to configured contact channels or states “No hay datos de contacto publicados.”
- **Demo category imagery:** [desktop](../../web/projects/store/demo-assets/camba-escaparate-desktop.webp) and [mobile](../../web/projects/store/demo-assets/camba-escaparate-mobile.webp) are crops of the same ImageGen crewneck scene for Remeras. Camisas reuses the generated [brick mobile scene](../../web/projects/store/demo-assets/camba-ladrillo-mobile.webp). The [Pantalones crop](../../web/projects/store/demo-assets/camba-escaparate-pantalones.webp) comes from the mock fixture `assets/plates/image-straight.png`.
- **Demo editorial imagery:** the [detail crop](../../web/projects/store/demo-assets/camba-escaparate-detalle.webp) comes from the mock fixture `assets/plates/detail-photo.png` and is used only when the published SKU references that second image. These rasters live in `web/projects/store/demo-assets`, each with an adjacent `.webp.json` provenance sidecar. Only demo builds copy them; API mode uses catalog photography when available.
- Angular renders the composition with component CSS, without Tailwind. Anime.js 4.5.0 loads in the browser on category intent or as the lower editorial approaches; reduced motion skips it. The server-rendered content and link behavior do not depend on animation.
- Local full-page evidence is in `web/test-results/home-mosaic/` at 1440 and 390 px, alongside the before captures. No new visual world or storefront comp was approved.

- Finish verdict: **ship** for the two corrections independently rechecked: the home footer exposes account and names missing contact data, and the home-only documentation matches the shipped composition. No storefront comp was approved.

## Previous direction contract — brick revision

**THESIS — brick revision:** the remembered Camba bow opens a compact editorial window onto a real buying path, not a generic white shop with a red button.

**OWN-WORLD:** unchanged Manrope utilities; quiet Georgia display over warm cream, real deep-red mark, burgundy action, brick as photographic material. The theme applies only on `/`.

**STORY:** recognize a clothing-led shop, find search immediately, pick a published category and reach a priced, available product without competing marketing.

**FIRST VIEWPORT:** compact white shop header, cream copy plane beside a single broad brick scene, forest-free CTA, and immediately scannable category tiles; on mobile copy precedes the responsive scene. The first cards follow without breaking rhythm.

**FORM:** user-pinned storefront revision, existing commerce primitives. One optional arrow nudge on intent, one brief category arrow sequence at entry; no animation gates content. No new comp or seed assignment.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Brick revision — built result and provenance

- The home-only shell uses the SVG artwork from `cambalacheFront` at CambaProd pin `eb3b407870c8a` (`public/assets/img/logo/logo-color.svg`). The original geometry and color were preserved; the legacy XML prologue and external DTD were omitted.
- The demo atmosphere is one ImageGen scene with [desktop](../../web/projects/store/demo-assets/camba-ladrillo-desktop.webp) and [mobile](../../web/projects/store/demo-assets/camba-ladrillo-mobile.webp) crops. Each crop has its generation prompt in an adjacent `.webp.json` sidecar. Production does not copy these photographs; they do not represent a SKU.
- Playwright builds the current before/after evidence in `web/test-results/home-brick/`: 1440×900, 390×844, plus 320 px and full-page after captures. The first Impeccable pass requested a clearer label/arrow gap and current documentation. The reduced-motion and non-home navigation paths stay independent of the animation.
- Final Impeccable verdict: **ship** for the two reviewed fixes only—the updated home documentation and the wider mobile category label–arrow gap. The follow-up checked desktop (1440 px) and mobile (390 and 320 px). No new storefront comp was approved.

## Previous editorial iteration

**THESIS:** A warm fashion editorial that opens into a short buying path. No dominant green block, carousel or amplified product card.

**OWN-WORLD:** Existing warm paper and Manrope, forest only for actions. Fabric, mineral light, and generous but legible changes of scale.

**STORY:** Recognize Camba, take one step to the store or choose a category, then read a small selection with honest prices and availability.

**FIRST VIEWPORT:** Left-aligned two-line display and visible CTA, with one broad image on the right. On mobile the copy and CTA precede a crop of the same scene. Category headings/links give the next step, not a second hero.

**FORM:** Editorial split followed by a row of real category links and four reused product cards. User-pinned brief; no seed or storefront comp approval. Incumbent storefront before/after evidence, not the admin comp, measures the result.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Previous built result and provenance (historical)

- The home keeps the shared Manrope, warm paper and forest action styling. The desktop split becomes copy and CTA first on mobile, followed by flat category links and up to four cards from the existing product grid.
- The editorial is one ImageGen scene: a [3:2 desktop WebP](../../web/projects/store/demo-assets/vestite-distinto-desktop.webp) and a [4:3 mobile WebP](../../web/projects/store/demo-assets/vestite-distinto-mobile.webp) outpainted for headroom, each with its prompt in an adjacent `.webp.json` file. The pair ships only in demo builds and does not depict a catalog SKU. API mode uses catalog photography when available.
- The [home probe](../../web/e2e/home-demo.mjs) covers SSR, mobile image selection, keyboard category browsing, and narrow-screen reflow. Local captures are in `web/test-results/home-redesign/`: before/after at 1440 and 390 px, and after at 320 px. The follow-up verdict confirmed the corrected mobile headroom at 390 and 320 px; it did not reopen the rest of the review.
