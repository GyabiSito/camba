# Camba v2 — Admin access and operations redesign
Branch: `feat/camba-v2` · baseline `0d714d8` plus inherited worktree · local Docker PostgreSQL only · delivery: ask-on-risk.
Runners: Chromium via Playwright, existing isolated admin E2E, production Angular build; estimated >400 authored lines across UI units.

## Specs

- S1 — “Reproducí en el navegador el mensaje «La sesión no está disponible».” Trace CSRF, credential POST and protected session; check the active PostgreSQL account. Preserve data and guards. Verify clean, same-profile storefront, refresh, buyer and unverified admin denial.
- S2 — “una tarjeta compacta, marca visible y errores claros” and “navegación lateral en escritorio y menú accesible en móvil.” Preserve routes and active state.
- S3 — “Hacé visibles «Nuevo producto» y «Carga masiva».” Keep mobile essentials and filters. “Diferenciá guardar de publicar.” Preserve gallery, save, history and recovery.
- S4 — “Distinguí archivo recibido, vista previa, filas con errores, confirmación y resultado del procesamiento.” Make the photo and CSV/XLSX entry points clear and existing batch state visible on reload.
- S5 — “separá visualmente el estado de pago del de preparación, entrega o retiro.” Redesign order list/detail, notices, categories/brands, settings and history on real demo data.
- S6 — “ingreso → catálogo → edición → carga masiva con vista previa → pedidos → detalle.” Capture before/after 1440 and 390, assert 320 reflow, check error/empty/keyboard/focus, build Admin, check running Docker 4300 and Store 4200.

## Tasks

- T1 · S1 · inline, small implementation + independent authorization verification (risk 2: stateful origin allowlist) · `62f44f6` · functional and independent GREEN; native review approved and acknowledged.
- T2 · S2 · inline shell/shared design foundations · `f8759a7` · RED old mobile nav visible before disclosure; GREEN 2 focused Playwright tests; RDD medium/under budget.
- T3 · S3 + categories/brands portion of S5 · delegated UI-only catalog/editor unit · `ce6312c` · RED missing batch CTA; GREEN 3 focused tests plus live final readback; RDD medium/under budget.
- T4 · S4 · delegated UI-only batch entry unit · `73f6830` · GREEN 2 focused recovery/CSV/XLSX tests and live unconfirmed preview reload; RDD medium/under budget.
- T5 · S5 · delegated UI-only operations unit · `c0451f8` · GREEN 5 operations tests in full seam run; RDD medium/under budget. Initial RED runner hit a transient missing CSS while another unit was writing.
- T6 · S6 · live acceptance + isolated regressions + build · `34bae2c` · all 22 cases GREEN across two runs on final files; production build and final live/visual evidence GREEN; RDD medium/under budget.

## Log

L1 — Original request (demo password omitted; do not persist credentials):

> Corregí el acceso al Admin de Camba v2 y después rediseñá su interfaz
> completa. Trabajá sobre el Docker local con PostgreSQL y los datos
> demo que ya están cargados.
>
> Admin: http://127.0.0.1:4300/
> Usuario: admin.diseno@camba.test
> Contraseña: [omitted]
>
> Hay otra sesión refactorizando el storefront. Aislá tus cambios en el
> admin. Si encontrás que el acceso requiere tocar configuración o código
> compartido, hacé el cambio mínimo y verificá también la tienda en 4200.
> Preservá los datos, volúmenes y cambios en curso.
>
> FASE 1 — ENCONTRÁ Y CORREGÍ LA FALLA DE ACCESO
>
> Reproducí en el navegador el mensaje «La sesión no está disponible».
> Primero usá un perfil limpio. Después repetí con la tienda abierta en
> el mismo perfil para comprobar si la sesión entre 4200 y 4300 influye.
>
> Seguí las solicitudes que realmente hace el formulario. Identificá
> cuál falla entre la preparación de CSRF, el envío de credenciales y
> la consulta de sesión posterior. Revisá código HTTP, tipo de respuesta,
> cookies, proxy y logs del contenedor correspondiente. El mensaje de
> la pantalla es genérico. Confirmá la causa con evidencia.
>
> Verificá en la base PostgreSQL que usa la API activa que la cuenta demo
> exista, tenga rol administrativo, correo verificado y que coincida
> la contraseña documentada. Si el problema está en el seed, corregí
> primero esa cuenta con el mecanismo existente del proyecto. Si está
> en el proxy, la sesión o la configuración, corregí esa causa y
> recreá únicamente los servicios necesarios.
>
> Preservá los controles de autorización, CSRF y verificación de correo.
> Comprobá que el admin entra en 4300, abre una ruta protegida y sigue
> autenticado después de recargar. Verificá también que un comprador y
> un admin sin correo verificado no puedan acceder al panel. Dejá
> registradas la causa exacta y la prueba que demuestra la corrección.
>
> FASE 2 — REDISEÑÁ EL ADMIN PARA LAS TAREAS DEL NEGOCIO
>
> Inventariá las pantallas y recorridos existentes antes de editar.
> Reutilizá la identidad de Camba: lazo, bordó, papel cálido y controles
> legibles. Diseñá el panel para operar con listas, formularios y estados
> fáciles de escanear. La estética editorial queda en el storefront.
>
> 1. Ingreso y navegación. Rediseñá el login de la captura con una tarjeta
>    compacta, marca visible y errores claros. Armá un layout compartido
>    con navegación lateral en escritorio y menú accesible en móvil.
>    Usá las secciones reales del panel y marcá bien la ruta activa.
>
> 2. Catálogo. Hacé visibles «Nuevo producto» y «Carga masiva». Priorizá
>    miniatura, nombre, SKU, precio, stock y estado. Mantené los filtros
>    útiles y dejá la acción de editar fácil de encontrar. En móvil,
>    usá filas compactas que conserven los datos y acciones principales.
>
> 3. Alta y edición. Ordená el formulario en datos del producto, precio
>    y stock, y fotos. Diferenciá guardar de publicar. Mostrá errores
>    junto al campo o foto correspondiente. Conservá los flujos actuales
>    de galería, orden, portada y recuperación de subidas.
>
> 4. Carga masiva. Hacé fácil encontrar la vía por fotos y la de CSV/XLSX.
>    Distinguí archivo recibido, vista previa, filas con errores,
>    confirmación y resultado del procesamiento. Mostrá la acción
>    siguiente y mantené visible el estado del lote al recargar.
>
> 5. Pedidos y demás pantallas existentes. En pedidos, separá visualmente
>    el estado de pago del de preparación, entrega o retiro. En el detalle,
>    destacá referencia, productos, total y acciones disponibles. Aplicá
>    el mismo sistema visual a categorías, marcas y configuración donde
>    existan. Usá datos reales de la demo para revisar cada vista.
>
> Separá layout, navegación y piezas repetidas con responsabilidades
> claras. Reutilizá los servicios y componentes existentes. Evitá crear
> un componente por cada botón. Conservá las rutas, los contratos y la
> lógica operativa aprobada.
>
> FASE 3 — VALIDÁ Y DEJÁ EL ADMIN CORRIENDO
>
> Probá con Playwright sobre 4300: ingreso → catálogo → edición → carga
> masiva con vista previa → pedidos → detalle. Revisá también errores,
> estados vacíos, foco y teclado. Capturá antes y después a 1440 y 390 px
> y comprobá reflow a 320 px.
>
> Corré el build del admin, verificá el resultado en el Docker que voy a
> usar y comprobá que la tienda sigue operativa en 4200. Entregá la causa
> del fallo de login, las pantallas rediseñadas, capturas y resultados
> de pruebas. Dejá el panel corriendo en 4300 con el usuario demo listo.

L2 — Clean and storefront-open browser profiles at 127.0.0.1 both succeeded without changes. Localhost reached the same Admin dev proxy and Laravel; CSRF 204 and XSRF header present, but login POST 400 JSON with the exact reported error and no follow-up session query. The active Laravel Sanctum allowlist contained only 127.0.0.1 for both ports. Verified the seeded role, email verification and password read-only against the running PostgreSQL connection; zero unverified admins exist in the shared demo. No evidence establishes which hostname the original incident used.

L3 — Design direction: operate, not editorial. Warm ruled work surfaces, burgundy action/selection, original mark, fixed type scale, compact mobile rows, context-first navigation; preserve existing forms, state machines and service calls. Scope geometry and tokens to Admin; the storefront’s concurrently edited design remains untouched.

L4 — RED `node e2e/admin-docker-access.mjs`: canonical succeeded; localhost POST 400 exact error. Added only `localhost:${CAMBA_DEV_ADMIN_PORT:-4300}` to the demo allowlist. Recreated the local API alone; vanilla startup found no outstanding migrations. PostgreSQL, Admin and Store container IDs stayed identical. GREEN script: both hostnames reach protected catalog and survive refresh; same-profile 4200 catalog HTTP 200, verified buyer session is denied 403 in Admin and valid in Store; same-host Admin sign-in replaces the shared identity. Existing Laravel guard test ran in isolated SQLite `:memory:` inside the Docker PHP image: one test/10 assertions, unverified admin denied. Initial host PHP attempt lacked the enabled SQLite extension; no demo accounts were created or updated.

L5 — Captured all existing views before redesign at 1440 and 390 in `web/test-results/admin-redesign/`. Route inventory: login; Productos list/new/edit/history, classifications, photo intake, spreadsheet intake and resume; Pedidos list/detail/notices; Configuración/edit/history. Route, authorization, API and operational logic stay owned by existing code. Parallel independent visual routes: T3 catalog/editor/classifications; T4 imports; T5 orders/settings. Parent owns shell/global tokens and seam execution.

L6 — Independent access verifier reconfirmed browser login/reload and same-profile Store/Admin authorization. For both origins: anonymous session 401; CSRF initialization 204 and credential POST without XSRF 419; POST without Origin/Referer remains 400 with the exact message. Isolated guard test passed again (1/10). A transient 429 during repeated live logins cleared with the normal rate window; no limits/caches were changed.

L7 — Shell test first failed because mobile navigation was visible without disclosure; after introducing the responsive shared layout, both focused Admin shell tests passed. Admin-only tokens and logo documented in `web/projects/admin/DESIGN.md`. The dev server retained a transient missing-style error across file replacement; a targeted Admin restart restored a fresh build without changing services or data. First live UI journey passed against PostgreSQL including real preview and reload at `/productos/importar/2`; the preview was not confirmed. A visual pass found catalog row wrapping/density and the active preview below the file form. Both fixes were routed to their original units before the final evidence round.

L8 — Final live Playwright on Docker: login, catalog, empty search, editor gallery with decoded photo, new product form, both import entry modes, CSV preview with an invalid row, unchanged preview URL after reload, orders/detail, notices, classifications, settings and history. Keyboard Enter/Tab/Escape and 320 px layout passed; original layout and final UI captured at 1440/390 for 12 views each plus supplemental states. The capture gallery and 55 PNGs were packaged into `web/test-results/admin-redesign.zip`. Storefront `/tienda` and JSON product catalog returned 200, and the known product was present. Production Admin build and `git diff --check` passed. Detector warnings on `<img>` were false positives on existing Angular `[src]` bindings; real catalog/gallery images decoded in Chromium. No API source or shared styles changed.

L9 — First full isolated Admin suite ran 22 checks: 21 passed, the optional-brand test was stopped by Laravel's existing five logins/minute per account/IP (HTTP 429), before its business assertions. The focused brand test had passed. The catalog fixture now reuses cookies from one verified UI login per worker in new isolated browser contexts; the login's own tests stay independent and unchanged in coverage. No application throttle or product assertions changed; the full suite was relaunched.

L10 — On final files, all 16 catalog/operations tests passed in the rerun. Its disposable PHP listener stopped responding after test 16 (`ECONNRESET` followed by `ECONNREFUSED` on the test port); the six remaining cases were rerun with dedicated ports and all six passed. This gives 22/22 passing across two runs, not one uninterrupted invocation. Live Docker remained healthy. Supplemental Chromium check: store home, catalog and `/producto/camisa-liviana-blanca` each returned HTTP 200, and the detail photo decoded. Risk: item 2 for the local Sanctum allowlist only; Admin UI and test changes: none.

L11 — User chose native review for the isolated access commit `62f44f6`. Risk and reliability captures reviewed the two immutable changed files concurrently. Native review approved without blockers or correction. Exact acknowledgement returned `authority: burned`; the lifecycle is closed. Informational R3-001: `admin-docker-access.mjs` uses the requested default ports 4200/4300; a future extension can read the Compose port overrides if custom-port support is needed. No candidate files changed after review and nothing was published.
