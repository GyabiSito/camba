# Admin homepage workflow and classification filters
Branch `feat/camba-v2` · delivery `ask-on-risk` · Angular builds, Laravel/PostgreSQL fixtures, Playwright in local Docker.
Parallel writers: preview/render integration, section-edit workflow, and classification queries/UI have disjoint edit surfaces; parent wires the Admin routes and verifies actual Docker.

## Specs

- S1 — «Mové «Vista previa» a `/portada/vista-previa` en Admin (4300), dentro del panel y con un enlace «Volver a Portada». Desde ahí se debe poder alternar entre escritorio y móvil.» «Reutilizá los componentes visuales del home para que el borrador se vea como quedaría publicado. Quitá la ruta de vista previa del storefront (4200). El borrador se carga mediante la API administrativa y requiere permisos de admin, incluso al entrar por URL directa. La tienda pública sigue mostrando únicamente lo publicado.»
- S2 — «Dejá `/portada` como resumen compacto de secciones, con miniatura, visibilidad, orden y «Editar». Al pulsar «Editar», navegá a una página dedicada, por ejemplo `/portada/secciones/hero`. Sacá el formulario expandido que hoy aparece dentro del listado.» «En la página de edición, agrupá los campos en bloques claros y poné «Guardar borrador» y «Volver a Portada». Al volver o recargar, recuperá lo guardado. Si hay cambios sin guardar, avisá antes de perderlos. La publicación se sigue haciendo desde el resumen de Portada.»
- S3 — «En ambas tablas, agregá una barra como la de Productos: «Buscar por nombre o identificador», «Estado» con Todas, Activas e Inactivas, y «Limpiar filtros».» «Aplicá búsqueda y estado en PostgreSQL antes de paginar. Volvé a la página 1 al cambiar filtros y mostrá el total filtrado. Conservá filtros y página en la URL al recargar. Reutilizá la tabla y el paginador existentes, así como los contratos de los selectores que usa la edición de productos y de portada.»
- S4 — «Probá editar y guardar una sección desde su propia ruta, ver el borrador en 4300 y confirmar que 4200 sigue mostrando lo publicado. Verificá que la antigua URL de vista previa en 4200 devuelva 404. En Categorías y Marcas, probá búsqueda y estado combinados con más de una página. Confirmá en Network que cada respuesta trae solo la página filtrada.»

## Tasks

- T1 · S1 · delegated · verified · protected Admin-only responsive preview and Store HTTP 404 (risk 2, draft isolation).
- T2 · S2 · delegated · verified · dedicated edit routes and guarded unsaved/pending operations, same revision/save contract (risk 4).
- T3 · S3 · delegated · verified · classification filters, URL, PostgreSQL and Playwright Network checks (risk 4).
- T4 · S1–S4 · inline · verified · route wiring, docs, independent check and actual Docker. Changes left local; no native review receipt.

## Log

- L1 · User request:

  Corregí la implementación actual de Portada, Categorías y Marcas.

  1. VISTA PREVIA DENTRO DEL ADMIN

  Mové «Vista previa» a `/portada/vista-previa` en Admin (4300),
  dentro del panel y con un enlace «Volver a Portada». Desde ahí se
  debe poder alternar entre escritorio y móvil.

  Reutilizá los componentes visuales del home para que el borrador
  se vea como quedaría publicado. Quitá la ruta de vista previa del
  storefront (4200). El borrador se carga mediante la API administrativa
  y requiere permisos de admin, incluso al entrar por URL directa.
  La tienda pública sigue mostrando únicamente lo publicado.

  2. UNA PÁGINA DE EDICIÓN POR SECCIÓN

  Dejá `/portada` como resumen compacto de secciones, con miniatura,
  visibilidad, orden y «Editar». Al pulsar «Editar», navegá a una página
  dedicada, por ejemplo `/portada/secciones/hero`. Sacá el formulario
  expandido que hoy aparece dentro del listado.

  En la página de edición, agrupá los campos en bloques claros y poné
  «Guardar borrador» y «Volver a Portada». Al volver o recargar, recuperá
  lo guardado. Si hay cambios sin guardar, avisá antes de perderlos.
  La publicación se sigue haciendo desde el resumen de Portada.

  3. FILTROS EN CATEGORÍAS Y MARCAS

  En ambas tablas, agregá una barra como la de Productos:
  «Buscar por nombre o identificador», «Estado» con Todas, Activas e
  Inactivas, y «Limpiar filtros».

  Aplicá búsqueda y estado en PostgreSQL antes de paginar. Volvé a
  la página 1 al cambiar filtros y mostrá el total filtrado. Conservá
  filtros y página en la URL al recargar. Reutilizá la tabla y el
  paginador existentes, así como los contratos de los selectores
  que usa la edición de productos y de portada.

  VALIDACIÓN

  Probá editar y guardar una sección desde su propia ruta, ver el
  borrador en 4300 y confirmar que 4200 sigue mostrando lo publicado.
  Verificá que la antigua URL de vista previa en 4200 devuelva 404.
  En Categorías y Marcas, probá búsqueda y estado combinados con más
  de una página. Confirmá en Network que cada respuesta trae solo
  la página filtrada.

- L2 · Baseline `4a0453f` plus inherited renderer/classifications working changes; no resets or live catalog fixtures. Existing `/api/v1/admin/homepage/preview` keeps verified administrator permission and private/no-store. Classification table endpoint may add `q`/`status=active|inactive`; unpaged selector contracts stay unchanged.
- L3 · RED: old Store URL 200, no native edit link from summary, and unfiltered total 26 instead of 13 in fixture. GREEN: Admin/Store production builds (CSS size advisories only); 6 Store Node checks; Admin mocked route/edit Playwright; PostgreSQL Homepage + ClassificationFilters 10/277, Catalog + ClassificationFilters 15/389; OpenAPI syntax and whitespace checks.
- L4 · Actual Docker Admin/Store Playwright: save/reload dedicated hero, unsaved confirmation, private desktop/mobile preview and admin 390px without overflow, protected entry when anonymous/unqualified, old 4200 path HTTP 404 even with Admin session, published doc/version untouched. Discarded only the test draft. Independent source and GET readback corroborated 401/404 and scope; no blocker.
- L5 · Isolated Laravel Playwright Network: both Categories and Brands, active and inactive, 13 matches / 12 first page / 1 exact row on page 2, q/status/page retained on reload, resetting after filter/mutation, no requests to selector endpoints. Actual 4300 picked demo terms at 1440/390, matched response filters/totals, retained URL on reload, and cleared them. Screenshots and four page-2 JSON captures under `web/dist/artifacts/admin-portada/`.
- L6 · Verified local Docker stack remains running. Existing dirty classification and Store renderer changes intermingle with this feature; did not stage them into a partial/broken commit. Native assessment returned `unassessable` until inherited untracked paths have a bound declaration; no native approval/receipt and no push. Functional and independent checks above are separate evidence.
