# Docker storefront editorial parity
Branch: feat/camba-v2 · baseline 89a6229 plus existing storefront worktree · local stack only.
Runner: immutable reference SSR vs Docker SSR, Chromium at 1440 and 390, named PostgreSQL fixture check · local delivery, no publish · forecast ~300–450 lines.

## Specs

### S1
> Corregí la tienda Docker en http://127.0.0.1:4200/. La referencia visual
> es la versión que ya funciona en http://127.0.0.1:44862/. Quiero esa misma
> versión en Docker, usando la API y PostgreSQL del stack. Conservá las
> cuentas y los datos demo de compra que ya cargaste.

### S2
> 1. Compará las dos instancias antes de editar. Mantené 44862 levantada
>    mientras trabajás. Capturá ambas al 100% de zoom, con el mismo viewport.
>    Identificá qué checkout, configuración Angular y recursos sirve 44862.
>    Comparalos con el código y los archivos que realmente ejecuta el
>    contenedor de tienda, incluidos los cambios locales del último rediseño.

### S3
> 2. Encontrá por qué falta cada bloque en 4200. Revisá las URLs que pide
>    el navegador para el hero, las categorías, el look y el mosaico. Confirmá
>    que los WebP estén en la imagen final, que las rutas coincidan en Linux
>    y que cada respuesta se pueda decodificar como imagen. Revisá el
>    contexto de build, las reglas de exclusión y el copiado de assets en
>    Docker. Si alguna sección depende de slugs o SKU del catálogo demo,
>    comprobá que existan en PostgreSQL y corregí las asociaciones del seed.

### S4
> 3. Llevá a Docker el build y los assets de la versión aprobada. Si la
>    configuración de 44862 activa a la vez assets y mocks, separá esas dos
>    cosas para esta demo. Las fotos editoriales tienen que estar disponibles
>    en Docker y catálogo, stock, carrito, cuenta y pedidos tienen que seguir
>    consultando la API conectada a PostgreSQL. Reconstruí y recreá el
>    servicio de tienda conservando los volúmenes y datos del stack.

### S5
> 4. Verificá el resultado real en 4200, a 1440 y 390 px. Compará con 44862:
>    hero con foto, categorías con imágenes, «Armá el look», «Texturas y
>    detalles», el mosaico de seis fotos con sus recortes y enlaces, y el
>    footer claro. Revisá también la ficha, la modal al agregar y las
>    miniaturas del carrito. Confirmá que Admin en 4300 sigue viendo los
>    mismos datos y que el carrito demo queda con sus dos productos.
>
> Entregá la causa concreta, las capturas comparativas y el resultado de
> las pruebas. Cuando 4200 coincida con la referencia y funcione de forma
> independiente, bajá 44862 si es la demo anterior iniciada por CMD.

## Tasks

- [x] T1 · S1–S3 · inline · baseline captures, flag/assets split, optimized local Docker storefront and fixed-origin API routing; built and running from the existing storefront worktree.
- [x] T2 · S2–S3 · delegated direct · match the two editorial product identities with a narrowly scoped, idempotent demo catalog seeder; PostgreSQL 3 tests/46 assertions · commit `0d714d8`.
- [x] T3 · S4–S5 · inline · browser comparison, actual API journeys, unchanged data fingerprints, independent risk verification and CMD reference retired.

## Log

### L1 — User request
Corregí la tienda Docker en http://127.0.0.1:4200/. La referencia visual
es la versión que ya funciona en http://127.0.0.1:44862/. Quiero esa misma
versión en Docker, usando la API y PostgreSQL del stack. Conservá las
cuentas y los datos demo de compra que ya cargaste.

1. Compará las dos instancias antes de editar. Mantené 44862 levantada
   mientras trabajás. Capturá ambas al 100% de zoom, con el mismo viewport.
   Identificá qué checkout, configuración Angular y recursos sirve 44862.
   Comparalos con el código y los archivos que realmente ejecuta el
   contenedor de tienda, incluidos los cambios locales del último rediseño.

2. Encontrá por qué falta cada bloque en 4200. Revisá las URLs que pide
   el navegador para el hero, las categorías, el look y el mosaico. Confirmá
   que los WebP estén en la imagen final, que las rutas coincidan en Linux
   y que cada respuesta se pueda decodificar como imagen. Revisá el
   contexto de build, las reglas de exclusión y el copiado de assets en
   Docker. Si alguna sección depende de slugs o SKU del catálogo demo,
   comprobá que existan en PostgreSQL y corregí las asociaciones del seed.

3. Llevá a Docker el build y los assets de la versión aprobada. Si la
   configuración de 44862 activa a la vez assets y mocks, separá esas dos
   cosas para esta demo. Las fotos editoriales tienen que estar disponibles
   en Docker y catálogo, stock, carrito, cuenta y pedidos tienen que seguir
   consultando la API conectada a PostgreSQL. Reconstruí y recreá el
   servicio de tienda conservando los volúmenes y datos del stack.

4. Verificá el resultado real en 4200, a 1440 y 390 px. Compará con 44862:
   hero con foto, categorías con imágenes, «Armá el look», «Texturas y
   detalles», el mosaico de seis fotos con sus recortes y enlaces, y el
   footer claro. Revisá también la ficha, la modal al agregar y las
   miniaturas del carrito. Confirmá que Admin en 4300 sigue viendo los
   mismos datos y que el carrito demo queda con sus dos productos.

Entregá la causa concreta, las capturas comparativas y el resultado de
las pruebas. Cuando 4200 coincida con la referencia y funcione de forma
independiente, bajá 44862 si es la demo anterior iniciada por CMD.

### L2 — Baseline evidence before source edits
- 44862 was stopped by the previous requested cleanup. Restored exactly `web/dist/storefront-polish-final/server/server.mjs` with CMD on 44862, no rebuild. Its Angular configuration was optimized `production,demo`. In contrast, the Docker store used a host bind of this checkout's `web/` and `ng serve store` in normal development.
- At 1440 and 390, same viewport / 100% zoom, reference decoded 15 editorial image uses and showed six mosaic tiles. Docker rendered no editorial WebP and zero mosaic tiles. The same four representative /demo-home URLs returned 200 WebP on the reference and 404 HTML on Docker. Evidence: `web/test-results/docker-editorial/antes-network.json` plus full-page and first-screen PNGs.
- Normal Angular config neither copies /demo-home nor enables blocks controlled by demoMode. The Docker context includes projects/**; the active container did not use the Dockerfile build. Current PostgreSQL includes `pantalon-pinzas-arena` with storage WebP but no `camisa-liviana-blanca`. No reason to change existing cart/order/account records.
- Independent write units: parent owns frontend/Compose/runtime; T2 writer only owns local editorial seed/test, which uses the published product/cover contract and does not depend on frontend edits. Existing production deploy and older containers are out of scope.

### L3 — Implementation and observed checks
- Docker's optimized `production,editorial` build separates the visual flag and assets from offline mocks. Its local wrapper serves the SSR app and sends Laravel requests to fixed `api:8000` on the storefront origin. No source mount is used. Only the `store` service was replaced; other service IDs and health are unchanged. Ports 4200 and 4300 bind to loopback.
- Ran only `php artisan db:seed --class=LocalEditorialCatalogSeeder --force` against the running demo. The narrowly scoped seed adds/repairs the white shirt and its cover; `pantalon-pinzas-arena` was already present. Both isolated seeder files passed (3 tests, 46 assertions). Fingerprints before and after match for both accounts, both addresses, all three orders and lines, the original eight catalog entries, and the two original cart lines (same quantities). Public OpenAPI has no diff.
- Linux Docker SSR, ordinary Angular production SSR and offline demo SSR compiled; the only warnings were existing CSS budgets. The normal SSR empty/sparse/unavailable test passed. All 22 packaged editorial WebPs match the reference's SHA-256 and decode in Chromium. The complete home comparison matches the campaign, three photo panels, look, story, mosaic and light footer at 1440/390 at 100%; product shelf and amounts are the real API data by design.
- `node e2e/docker-editorial-parity.mjs` passed with the live reference enabled: exact editorial crop/size/image/link geometry and footer gradient, live product page and confirmation modal at both widths, Escape restores focus, cart thumbnails decode, and cleanup removes only the new item. `node e2e/postgres-local-demo.mjs` passed for two addresses, three order states, checkout options and admin product/order checks. No order or payment was created by these checks.
- Independent risk item 5 verification found no reproduced blocker. Native assessment could not assess the overlapping worktree without declaring its inherited untracked inventory; no review receipt is claimed. Commit only the standalone seed unit, leaving storefront edits in the existing worktree rather than bundling inherited changes.
- Confirmed the port 44862 listener was the exact saved build under CMD, then stopped it. Afterward 4200 and 4300 returned 200; a fresh Chromium page at each review width still decoded every rendered editorial photo without requesting any other origin. Evidence: `web/test-results/docker-editorial/comparativa-{1440,390}.png`, full-size captures, `comparacion-network.json`, and modal/cart PNGs.
