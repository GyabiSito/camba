# Camba fashion-editorial home

## Run locally

From `web/`, start the catalog-only demo with `npm run start:demo:store` and open [the home](http://127.0.0.1:44822/). The normal local server and the [existing demo account setup](DEVELOPMENT.md#frontend-only-design-demo) are unchanged. This work does not require Laravel, a database, Redis or mail. The demo does not exercise order submission or payment.

| Check | Command from `web/` |
|---|---|
| Optimized demo SSR | `npm run build -- store --configuration production,demo`, then `npm run serve:ssr:store` |
| Demo home with the built server listening | Set `CAMBA_DEMO_STORE` to that server URL and run `node --test e2e/home-editorial.mjs` |
| Normal SSR, isolated error / empty / sparse catalog | `npm run build -- store --configuration production` then `node --test e2e/home-editorial-real.mjs` |
| Existing demo roles and session reload | With both development demo servers running, `node --test e2e/frontend-demo.mjs` |

## Home motion

The hero copy enters once, from 28 px down and 60% opacity, over 550 ms with a 90 ms stagger after the current photo can paint. The image itself stays still and the SSR heading and link are fully available before JavaScript. A filter change updates the products and pressed state first; the underline slides in 200 ms and the decoded photos rise 18 px from 70% opacity over 320 ms, 45 ms apart. A newer filter cancels the old effect and discards any older decode result. Reduced motion keeps the final state.

Normal-speed reloads followed by two filter changes are in `web/test-results/home-anime/home-1440.mp4` and `home-390.mp4` in the same directory; the accompanying JSON records live browser frames. The focused Playwright probes check both viewports, rapid filter changes, reduced motion and fixed hero photography.

## Current polish

If the local home shows a red campaign and broken editorial photos after an asset configuration change, fully restart `npm run start:demo:store`; hot reload is not enough. On the stale process at port 44822, the original `/demo-home/atelier-*.webp` requests returned HTML with status 404. The same URLs returned WebP on a fresh SSR build. All 18 source WebPs were present; no re-export or API change was needed. The home now tries the alternate responsive variant before giving up and compacts sections when a photo has been lost.

Local evidence for this pass is under `web/test-results/home-editorial-polish/`: `before-network.json`, `after-network.json`, before/after viewports and full pages at 1440×900 and 390×844, and `home-motion.mp4`. Playwright walked the page, verified 17 decoded images at 1440, 390 and 320 px, and exercised a synthetic HTML-200 image response, missing images, category/detail navigation, rapid filters, the footer help anchor and reduced motion. No images from the demo are copied into the regular build.

The initial Atelier implementation's captures and LCP comparison are under `web/test-results/home-editorial/`; those measurements are historical, not a measurement of this polish.

## Initial Atelier verification

| Evidence | Observed locally |
|---|---|
| Build | Optimized demo and regular storefront SSR, plus demo admin, compiled. Angular's 4 kB component warning still applies to `app.css` (5.90 kB) and `home.css` (6.63 kB); no budget was changed. |
| HTTP | Home, shop, category, product, account, cart, checkout and orders responded 200 in demo. In the regular build with a loopback fixture: unavailable returned 503/no-store; empty and sparse returned 200; demo photo returned 404. |
| Chromium | Three optimized home probes, the regular SSR fixture probe, and the existing development test for buyer/admin role reload passed. The optimized demo showed no hydration errors or browser API requests along the tested home purchase paths. |
| Visual | Verified 320, 390, 768, 1024 and 1440 px with no horizontal page scroll. The independent review's 320 px/200% contrast finding was resolved on a focused recheck by moving enlarged copy to a solid brick continuation. |
| Mobile LCP | Median **0.51 s before → 1.31 s after**. Three fresh Chromium Pixel 7 contexts per optimized SSR variant, cold browser caches, warm SSR, 150 ms latency, 1.6 Mbit/s down, 0.75 Mbit/s up and 4× CPU slowdown. Local lab, not production. The mobile image is 26–59 kB according to the chosen variant. |

The full backend-dependent suite and native review receipt were not run for this mixed working tree. No checkout or payment-provider success is inferred from route reachability.

## Files

- Home and motion: `web/projects/store/src/app/catalog/{home,home-editorial,browse,catalog-data,home-motion,product-media}.*`.
- Route-specific shell: `web/projects/store/src/app/app.{ts,html,css}`. The non-home header and search destinations were compared with the baseline.
- Demo assets and build: `web/projects/store/demo-assets/atelier-*`, `web/angular.json`.
- Checks: `web/e2e/home-editorial*.mjs`; the active storefront catalog spec now expects the new home headings.

## What informed the design

- [Kokoro home](https://kokoro.uy/) places a person wearing the clothes in a recognizable setting before presenting the assortment. Camba uses that sequence with its own atelier, moves from a campaign to category photographs, and closes with useful help. [Kokoro's Vestidos](https://kokoro.uy/collections/vestido) makes the front and alternate views useful for shopping; Camba's alternate photo belongs to the same catalog SKU.
- The [Kumo publisher's demo board](https://kumo-shreethemes.netlify.app/) shows larger category destinations before the product grid in Index 1 and different campaign proportions in Index 2. The [direct Index 2 route](https://kumo-shreethemes.netlify.app/home-2) returned 404. Camba uses three large links when present and alternates density rather than adding promotional tiles or hierarchies.
- The indexed [Cartzio Fashion Two](https://shreethemes.in/cartzio/layouts/index-fashion-two.html) separates its opening action, image-led collections, comparable products and later full-catalog action. Camba keeps one primary CTA and puts the full-catalog link beside a compact shelf. Both live previews, including [Home Modern](https://shreethemes.in/cartzio/layouts/index-modern.html), returned 402 in the browser; the indexed demo and the brief anchor the reading. No theme content or assets were reused.

The current local Camba screen was captured in the same demo checkout before any home source edits. The four Kokoro attachments mentioned in the brief were not present in this session; the online home and collection were used instead.

## Photography and publication

All new raster assets are WebP derivatives of original images made with the built-in ImageGen tool. Exact prompts, inputs and crop/resize parameters are in the adjacent `.webp.json` sidecars under `web/projects/store/demo-assets/`. Only demo builds copy `atelier-*.webp`.

- The wide and portrait hero are separately composed. Category panels and the story use frames from a contact sheet, not reference-site photography. The story's close-ups are crops of its accompanying category frames.
- The look uses the demo shirt and trouser packshots as garment references. It is an illustration of the combination, not a photograph of live inventory. Exact demo product links require the configured slug **and** corresponding demo cover. Missing pieces fall back to actual category destinations where available.
- Real mode does not request demo photography or invent product associations. It uses a short brick intro, linked text categories when no editorial photography is available, actual product media on the shelf, and the optional same-product gallery from the existing lookup.
- Before publication, approve or replace the campaign, category, look and story photography and explicitly confirm the production garment and category associations. Verify the published contact details in store settings; no FAQ, policies or commercial promises were invented.

## Editorial closing

The demo's full-bleed mosaic starts immediately after “Texturas y detalles”, with “Ver catálogo” below the Camba lockup on the wine fabric tile. The local Komorebi store's Instagram layout (`fa774fa`) served as a reference; no artwork or code was imported. The first photos contrast with the previous editorial. Camba's three category tiles use current catalog slugs, and the outfit opens the existing “Armá el look” chapter rather than a speculative product link.

The wine fabric is original ImageGen artwork with two responsive WebP sizes. The remaining tiles reframe local demo assets; sidecars beside `atelier-cierre-*` record the new derivatives. The gallery remains demo-only. The warm-paper home footer uses a vertical directory, inspired by the local Komorebi footer and the separate contact group of [Metalúrgica Fabál](https://metalurgicafabal.com.uy/). Help describes price and availability as rendered in the product detail and delivery choices as rendered before order confirmation. A contact column is only rendered when store settings supply a phone or email. No Instagram, legal, or pre-purchase policy routes were configured in this storefront.

Current captures of the footer directory are saved locally under `web/test-results/home-footer-directory/`. The preceding purchase panel is in `web/test-results/home-footer-layout/`.

