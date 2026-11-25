# Frontend feature architecture
Branch: `feat/camba-v2` · Baseline: `ee79579` · Delivery: ask-on-risk, local work-unit commits only.
Verification: Angular Store/Admin builds, Node/Playwright regressions and existing local Docker; forecast ~600 authored lines, excluding detected file moves.

## Specs

S1. «Refactorizá las dos aplicaciones web de Camba v2, Tienda y Admin, con arquitectura por feature, Clean Architecture y SOLID.» «Abrí C:\Users\Josec\OneDrive\Escritorio\komorebi\KomorebiStore y recorré src/app/features. Revisá los directorios reales de Contacto, Envíos, FAQ, Términos y Privacidad, además de cómo se registran las rutas y se organizan páginas, componentes y servicios. Tomá esa distribución como referencia para Camba. Usá el checkout activo y preservá los cambios locales.»

S2. «Reemplazá support-page.ts, support-page.html y support-page.css por cinco páginas independientes. Cada URL debe resolver su propio componente standalone mediante carga diferida:»

- «/contacto → features/contact»
- «/envios → features/shipping»
- «/preguntas-frecuentes → features/faq»
- «/terminos-y-condiciones → features/terms»
- «/politica-de-privacidad → features/privacy»

«Ajustá los nombres y la ubicación exacta a la convención que encuentres en Komorebi. Cada página debe tener su TypeScript, HTML y estilos juntos. El router selecciona la página. Eliminá SupportPage, el @switch por tipo de página y el estado que solo existía para sostener esa selección.» «Dejá el formulario, su validación y envío, la animación y los canales de atención dentro de Contacto. Envíos se encarga de mostrar modalidades, costos y seguimiento. FAQ tiene sus propias preguntas. Términos y Privacidad tienen su propio contenido y metadatos. Si comparten una presentación visual, extraé un componente que reciba el contenido de cada página. Conservá el noindex de los borradores legales.»

S3. «Tienda: separá Inicio y su contenido editorial, Catálogo, Ficha de producto, Carrito, Checkout, Cuenta y Pedidos. Header y Footer pertenecen al layout compartido.»

S4. «Admin: revisá Productos, Pedidos, Avisos, Usuarios y Configuración para separar páginas o responsabilidades que estén mezcladas. Seguí las funcionalidades que existan en el código.»

S5. «Dentro de cada feature, separá UI, lógica de aplicación y acceso a datos cuando tengan responsabilidades distintas. El HTTP y sus DTO quedan en el acceso a datos. Los componentes delegan operaciones y renderizan estado. Usá interfaces cuando exista una dependencia que aislar.» «Compartí solo piezas con consumidores reales. Conservá la instancia compartida de sesión y carrito. Evitá imports circulares y accesos a archivos internos de otra feature.»

S6. «Actualizá rutas, imports, estilos, assets, configuración de SSR y referencias de pruebas. Compilá Tienda y Admin y corré las pruebas existentes de los flujos movidos.» «En el Docker local, abrí las cinco páginas por URL directa y desde Header o Footer. Confirmá que cada una cargue su propio componente, que los enlaces abran arriba y que Contacto conserve su diseño, los datos del .env y el envío del formulario. Verificá también catálogo, ficha, carrito y las pantallas de Admin que hayas movido.»

S7. «Entregá el árbol final de ambas apps, la correspondencia entre las rutas y sus componentes y los resultados de compilación y pruebas. La entrega es el refactor aplicado en el checkout.»

## Tasks

- T1 — S1–S2, S5–S6 · inline first · verified · `6b53a9e`, support routes, regression and local smoke (see L3).
- T2 — S3, S5–S6 · Store writer (parallel app surfaces after T1) · integrated and built; Docker and suite evidence in Log.
- T3 — S4–S6 · Admin writer (parallel app surfaces after T1) · integrated and built; access and Docker evidence in Log.
- T4 — S5–S7 · parent integration, verification and route/tree inventory · in progress.

## Log

L1 — Original request (verbatim):

Refactorizá las dos aplicaciones web de Camba v2, Tienda y Admin, con arquitectura por feature, Clean Architecture y SOLID. Empezá por la pantalla de soporte de la Tienda, donde hoy cinco páginas comparten un componente y una plantilla que cambia de contenido con @switch (page).

## Revisá Komorebi antes de reorganizar

Abrí C:\Users\Josec\OneDrive\Escritorio\komorebi\KomorebiStore y recorré src/app/features. Revisá los directorios reales de Contacto, Envíos, FAQ, Términos y Privacidad, además de cómo se registran las rutas y se organizan páginas, componentes y servicios. Tomá esa distribución como referencia para Camba. Usá el checkout activo y preservá los cambios locales.

## Empezá por eliminar SupportPage

Reemplazá support-page.ts, support-page.html y support-page.css por cinco páginas independientes. Cada URL debe resolver su propio componente standalone mediante carga diferida:

- /contacto → features/contact
- /envios → features/shipping
- /preguntas-frecuentes → features/faq
- /terminos-y-condiciones → features/terms
- /politica-de-privacidad → features/privacy

Ajustá los nombres y la ubicación exacta a la convención que encuentres en Komorebi. Cada página debe tener su TypeScript, HTML y estilos juntos. El router selecciona la página. Eliminá SupportPage, el @switch por tipo de página y el estado que solo existía para sostener esa selección.

Dejá el formulario, su validación y envío, la animación y los canales de atención dentro de Contacto. Envíos se encarga de mostrar modalidades, costos y seguimiento. FAQ tiene sus propias preguntas. Términos y Privacidad tienen su propio contenido y metadatos. Si comparten una presentación visual, extraé un componente que reciba el contenido de cada página. Conservá el noindex de los borradores legales.

## Aplicá el criterio al resto de las webs

- Tienda: separá Inicio y su contenido editorial, Catálogo, Ficha de producto, Carrito, Checkout, Cuenta y Pedidos. Header y Footer pertenecen al layout compartido.
- Admin: revisá Productos, Pedidos, Avisos, Usuarios y Configuración para separar páginas o responsabilidades que estén mezcladas. Seguí las funcionalidades que existan en el código.
- Dentro de cada feature, separá UI, lógica de aplicación y acceso a datos cuando tengan responsabilidades distintas. El HTTP y sus DTO quedan en el acceso a datos. Los componentes delegan operaciones y renderizan estado. Usá interfaces cuando exista una dependencia que aislar.
- Compartí solo piezas con consumidores reales. Conservá la instancia compartida de sesión y carrito. Evitá imports circulares y accesos a archivos internos de otra feature.

## Terminá con código funcionando

Actualizá rutas, imports, estilos, assets, configuración de SSR y referencias de pruebas. Compilá Tienda y Admin y corré las pruebas existentes de los flujos movidos.

En el Docker local, abrí las cinco páginas por URL directa y desde Header o Footer. Confirmá que cada una cargue su propio componente, que los enlaces abran arriba y que Contacto conserve su diseño, los datos del .env y el envío del formulario. Verificá también catálogo, ficha, carrito y las pantallas de Admin que hayas movido.

Entregá el árbol final de ambas apps, la correspondencia entre las rutas y sus componentes y los resultados de compilación y pruebas. La entrega es el refactor aplicado en el checkout.

L2 — Checked the active Komorebi checkout at `fa774fa` read-only. Its Support features own `ui/<feature>.routes.ts` and colocated `ui/pages/<page>` files. Contact additionally separates a use case, outbound port, infrastructure adapter and UI form/state; legal/shipping/FAQ are simple UI-led features. Camba retains requested feature keys `terms` and `privacy`, using Komorebi-style descriptive page names internally. No product copy, policy, configuration values or business behavior imported.

L3 — T1 observed RED (old Store had no `store-shipping` component), then built and recreated only Docker Store. Live support and header suite: 9 pass, 1 conditionally skipped; separate no-recipient run passed HTTP 503. Real Mailpit delivered one QA message with verified Reply-To; the temporary local recipient was restored. A timing-sensitive Back assertion failed initially beside another browser run, then passed alone and in the full replay. SSR uses distinct hosts and preserves noindex. Contact kept the motion and env-supplied channels.

L4 — Store/Admin writers have disjoint app paths. The existing Admin home preview uses a stable Store entry point (`home-preview.ts`); neutral catalog/buyer contracts allow the shared demo to stop importing either app. Parent owns final integration and the shared layer. No Admin user-management route exists at baseline; do not invent a feature for it.

L5 — Store/Admin production builds pass, as does the Store development+demo build and the editorial SSR Docker image. Pre-existing CSS budget warnings remain (Store Home, Admin Dashboard and Homepage editor). The architecture and home-preview Node checks pass (11); they include feature ownership, sibling imports, cross-app seams, HTTP transport placement and the cycle check. Server render modes do not change. All app collaboration changes are limited to the web workspace; API and Compose files are unchanged.

L6 — Final Docker Store 4200: 9 passed in the support/layout run with a separate HTTP 503 check with no recipient. All five routes rendered their own component, titles were visible at the top, Back and anchor scrolling worked, legal drafts remained noindex, and catalog filters retained scroll. The Contact layout and two env-backed links worked at desktop and mobile sizes; one real Mailpit delivery and exact Reply-To were verified. The synthetic internal recipient was restored to its original unset value. PostgreSQL Store/Admin smoke passed, covering catalog, gallery, Guest Cart + Checkout, held buyer cart, account and orders, Admin Products, Orders, Notices, Settings and Homepage preview. The live demo buyer's cart was already empty; the smoke used a fresh guest cart instead and did not change the buyer's cart.

L7 — Risk item 2 (session/guard wiring moved and account HTTP extracted without intentional authentication changes). Independent browser checks of the actual Admin canvas and Products with guest and buyer sessions passed; guard body matches the baseline after whitespace normalization. The shared buyer session survives the failed access; no outside requests. Incorporated the access regression in the existing Docker test; this test and the explicit admin/CSRF/session checks passed. No independent scratch was written inside the checkout.

L8 — Combined Playwright run initially observed 44 pass, 4 environment-conditioned skips and five failures. The shared login fixture returned HTTP 429 during one Admin case. Store traces showed a Vite overlay during interactive tests; a subsequent build exposed a dangling Checkout import created during cleanup, now repaired. Also aligned the stale Store header test with the existing Contact route and handled native vs. hydration-replayed Catalog form/link cancellation. Added a resolvable-import architecture check; combined Node verification now has 12 passing tests. No production or API threshold was changed.
