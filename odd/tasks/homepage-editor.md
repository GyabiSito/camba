# Homepage editor
Branch: `feat/camba-v2` · delivery: `ask-on-risk` · PostgreSQL feature tests, Angular builds, real Docker Playwright.
Parallel writers: isolated API, public renderer, and Admin surfaces; each requires substantial independent implementation. Integration, docs, and verification stay with the parent.

## Specs

- S1 — «Migrá la portada actual como primera versión publicada». «Al aplicar la migración, la portada debe verse como hoy, con el hero «Vestite distinto.», las categorías, la selección, el look, el editorial y el mosaico completo de seis fotos. Conservá sus recortes y enlaces.»
- S2 — «Hero. Imagen de escritorio y variante móvil opcional, punto de recorte, título, descripción y botones. Permití elegir el destino desde el catálogo, una categoría, un producto o una sección de la portada.» «Categorías. Elegí categorías existentes, su orden, foto de portada y etiqueta opcional. Permití agregar y quitar tarjetas.» «Selección de Camba. Elegí y ordená productos publicados, o usá una selección automática por categoría. Precio y stock vienen siempre del catálogo. Permití cambiar el título y el enlace de la sección.»
- S3 — «Armá el look. Cambiá foto, título y texto. Asociá las prendas desde el catálogo y mostrá sus precios y enlaces vigentes.» «Texturas y detalles. Editá foto principal, recortes, título, texto y destino de la acción.» «Mosaico final. Editá la foto de fondo del panel de marca y su botón. Para cada casilla, elegí foto, posición y enlace opcional.» «Permití mostrar, ocultar y reordenar los bloques compatibles.»
- S4 — «Mostrá las secciones en el mismo orden en que aparecen en la tienda, con miniatura y nombre. Cada sección tiene «Editar», visibilidad y controles para subir o bajar. En los selectores de categorías y productos, mostrá nombre y foto para que se puedan reconocer.» «Permití subir imágenes desde el dispositivo y reutilizar las ya cargadas. Mostrá el recorte en escritorio y móvil. Validá formato y tamaño con el mecanismo existente. Conservá las imágenes usadas por una versión publicada aunque se reemplacen en un borrador.»
- S5 — «Separá «Guardar borrador», «Vista previa» y «Publicar». La vista previa debe usar los mismos componentes visuales que la tienda, dentro de un acceso administrativo. Mostrá la versión publicada al abrir `/`. Si una publicación falla, mantené visible la versión anterior. Permití descartar el borrador y volver a lo publicado.» «Guardá la configuración en PostgreSQL. La API pública entrega solo la versión publicada. Usá identificadores de categorías y productos existentes y resolvé sus enlaces actuales. Si después se despublica un producto o categoría, la tienda debe seguir renderizando con un comportamiento definido para esa tarjeta.»
- S6 — «Probá en Playwright con el Docker real: entrar a Admin, cambiar la foto del hero, elegir otras categorías, reordenar productos y editar una casilla del mosaico. Verificá que el borrador no aparezca en Tienda. Publicá y confirmá los cambios en 4200 desde otra sesión, incluso al recargar y después de reiniciar los servicios.» «Revisá escritorio y móvil, permisos del editor y el caso de una imagen inválida. Dejá el stack corriendo y documentá en el README cómo entrar al editor, previsualizar y publicar. Entregá capturas del editor y del resultado en la tienda.»

## Tasks

- T1 · S1/S4/S5 · delegated API · verified · `b29f161` · PostgreSQL singleton, revision CAS, and published-media isolation (risks 1, 2, 4).
- T2 · S1–S3/S5 · delegated Store · verified in Docker · working-tree delta on top of the inherited, uncommitted storefront assets and renderer; not staged (risk 2).
- T3 · S2–S5 · delegated Admin · verified · `4a0453f` · responsive editor, live catalog pickers, crop library, draft actions and private preview (risk 4).
- T4 · S1–S6 · inline integration · verified in Docker · feature-only docs, tests, and captures; native review has no receipt (see Log).

## Log

- L1 · User request:

  Implementá un editor completo de la portada de Camba v2 en el Admin.
  Tiene que ser usable desde el celular y permitir cambiar el contenido
  de la tienda sin editar archivos ni reconstruir Docker.

  Trabajá sobre el stack actual: Admin en 4300, Tienda en 4200, API Laravel
  y PostgreSQL. Los cambios de API y base quedan acotados a la gestión
  de la portada. Reutilizá las Actions, Form Requests, permisos, servicios
  de imágenes y componentes Angular existentes donde corresponda.

  1. Migrá la portada actual como primera versión publicada

  Inventariá todos los bloques de `/` y precargá sus valores actuales.
  Al aplicar la migración, la portada debe verse como hoy, con el hero
  «Vestite distinto.», las categorías, la selección, el look, el editorial
  y el mosaico completo de seis fotos. Conservá sus recortes y enlaces.

  2. Hacé editables todos los bloques propios de la portada

  - Hero. Imagen de escritorio y variante móvil opcional, punto de recorte,
    título, descripción y botones. Permití elegir el destino desde el
    catálogo, una categoría, un producto o una sección de la portada.
  - Categorías. Elegí categorías existentes, su orden, foto de portada
    y etiqueta opcional. Permití agregar y quitar tarjetas.
  - Selección de Camba. Elegí y ordená productos publicados, o usá una
    selección automática por categoría. Precio y stock vienen siempre
    del catálogo. Permití cambiar el título y el enlace de la sección.
  - Armá el look. Cambiá foto, título y texto. Asociá las prendas desde
    el catálogo y mostrá sus precios y enlaces vigentes.
  - Texturas y detalles. Editá foto principal, recortes, título, texto
    y destino de la acción.
  - Mosaico final. Editá la foto de fondo del panel de marca y su botón.
    Para cada casilla, elegí foto, posición y enlace opcional.

  Permití mostrar, ocultar y reordenar los bloques compatibles. Usá los
  layouts y estilos de Camba como base. Si ofrecés opciones de composición,
  hacelo con variantes visibles en la vista previa. Respetá el header y
  el footer compartidos como configuración general de la tienda.

  3. Diseñá una edición fácil de usar

  Mostrá las secciones en el mismo orden en que aparecen en la tienda,
  con miniatura y nombre. Cada sección tiene «Editar», visibilidad y
  controles para subir o bajar. En los selectores de categorías y
  productos, mostrá nombre y foto para que se puedan reconocer.

  Permití subir imágenes desde el dispositivo y reutilizar las ya
  cargadas. Mostrá el recorte en escritorio y móvil. Validá formato
  y tamaño con el mecanismo existente. Conservá las imágenes usadas
  por una versión publicada aunque se reemplacen en un borrador.

  Separá «Guardar borrador», «Vista previa» y «Publicar». La vista previa
  debe usar los mismos componentes visuales que la tienda, dentro de
  un acceso administrativo. Mostrá la versión publicada al abrir `/`.
  Si una publicación falla, mantené visible la versión anterior.
  Permití descartar el borrador y volver a lo publicado.

  4. Integrá y verificá el flujo completo

  Guardá la configuración en PostgreSQL. La API pública entrega solo
  la versión publicada. Usá identificadores de categorías y productos
  existentes y resolvé sus enlaces actuales. Si después se despublica
  un producto o categoría, la tienda debe seguir renderizando con
  un comportamiento definido para esa tarjeta.

  Probá en Playwright con el Docker real: entrar a Admin, cambiar la foto
  del hero, elegir otras categorías, reordenar productos y editar una
  casilla del mosaico. Verificá que el borrador no aparezca en Tienda.
  Publicá y confirmá los cambios en 4200 desde otra sesión, incluso al
  recargar y después de reiniciar los servicios.

  Revisá escritorio y móvil, permisos del editor y el caso de una imagen
  inválida. Dejá el stack corriendo y documentá en el README cómo entrar
  al editor, previsualizar y publicar. Entregá capturas del editor y del
  resultado en la tienda.

- L2 · Baseline `abd97d0` plus inherited worktree changes; no destructive resets. Docker project `camba-v2-demo-pg`, before screenshots under `web/test-results/home-editor`. Verify against a published change and restore the approved original after capturing evidence.
- L3 · Before/after capture output moved to `web/dist/artifacts/homepage-editor/` to survive Playwright's test-results reset. At 1440×900 and 390×844 the migrated homepage screenshots were byte-identical to the baseline; all six blocks and all six mosaic photos remained. Store Docker editorial SSR and Admin production builds pass (Store retains the old home.css size warning).
- L4 · Backend RED: missing routes, then isolated PostgreSQL rejected built-in filenames in a UUID comparison. Both public asset lookup and publication now send only UUID keys to PostgreSQL. GREEN: 18 tests / 243 assertions (Homepage + existing ProductImages), scoped Pint, OpenAPI syntax, git whitespace.
- L5 · Store adapter tests 5/5; independent verifier passed 10 link/visibility/media key probes and anonymous Admin API denial. Admin mocked Playwright 1/1 checks ordering, failed-save retention, rapid mosaic selection/alt editing and revision 409. Browser root cause: the image picker needed an immediate local model value rather than emitting a patch against a potentially stale bound input; preview also needed the public home's full-bleed shell rule.
- L6 · `CAMBA_RESTART_FOR_HOMEPAGE=1 node e2e/homepage-editor-docker.mjs` (with the documented demo password in the environment): real Admin/Tienda separate browser contexts; image 422 then valid upload and crop; categories changed, products reordered, mosaic updated; private draft vs public 401/403, then public SSR, reload, service restart, discard and original restore. QA publication v4 survived restart; original content published again as v5, no pending draft. Previously published QA media retained by design. Desktop/mobile evidence recorded; Admin editing at 320 px has no horizontal overflow. All Compose services healthy.
- L7 · API and Admin commits exclude inherited dirty hunks. Store integration remains in the working tree to avoid committing previously untracked approved renderer, assets, and shell work. Native assessment of the API-only commit is `high_risk`; STATUS requires a provider-bound untracked selection even for committed-only review, and no native review/approval or receipt completed. Independent verification and functional proof recorded above. No remote operation or push.
