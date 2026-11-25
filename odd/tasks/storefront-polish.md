# Storefront polish
Branch: feat/camba-v2 · baseline 8fe4527 with inherited demo and storefront worktree · local only.
Runner: Angular production/demo SSR and Playwright Chromium · ask-on-risk if publication is requested · forecast 450–650 authored lines.

## Specs

### S1
> Pulí el storefront actual de Camba siguiendo las capturas adjuntas.
> Trabajá con la demo seedeada existente. `api/` y los contratos quedan
> en solo lectura.

### S2
> 1. TU CARRITO
>
> Agregá una miniatura de la prenda a la izquierda de cada fila, junto
> al nombre enlazado. Usá unos 80 × 100 px en escritorio y 56 × 70 px en
> móvil, con fondo neutro y espacio reservado. Mantené cantidad, actualizar,
> quitar y subtotal donde se puedan encontrar fácilmente.
>
> Usá la portada del producto correspondiente. Si el carrito no la trae,
> resolvela desde los datos de catálogo disponibles en el frontend, sin
> inventar campos ni disparar una consulta por fila en cada render. Si la
> imagen falta o falla, mostrá un respaldo discreto. Cantidades y precios
> siguen saliendo del carrito.

### S3
> 2. CONFIRMÁ TU COMPRA
>
> Conservá exactamente la composición actual, los formularios, la entrega
> o retiro, los totales y el botón. El único cambio opcional es agregar una
> miniatura de 36–44 px junto a cada producto de «Resumen de la compra».
> Incluila solo si se puede reutilizar la del carrito y el nombre, la
> cantidad y el precio siguen leyéndose cómodamente a 320 px.

### S4
> 3. MI CUENTA
>
> Reemplazá los desplegables de direcciones y recordatorios por secciones
> visibles. En escritorio, usá dos zonas: «Datos personales» a la izquierda
> y «Direcciones guardadas» a la derecha. En móvil, apilalas. Presentá las
> direcciones como fichas compactas, con localidad y acciones de editar,
> eliminar y agregar. Dejá los recordatorios en una sección breve debajo.
>
> Ubicá «Mis pedidos» como acceso visible cerca del encabezado y «Cerrar
> sesión» como acción secundaria. Si recordatorios todavía no está
> disponible en la demo, mostrá un estado informativo sin botón inútil
> y conservá el comportamiento del modo real.

### S5
> 4. MIS PEDIDOS
>
> Mantené el listado y sus datos. Ordená visualmente cada fila: fecha y
> referencia a la izquierda, total en UYU a la derecha, y debajo el tipo
> de entrega, el estado y «Ver pedido →». Diferenciá «Pago confirmado»,
> «Pendiente de pago» y «Reserva vencida» con etiquetas de color suave
> y texto explícito. En móvil, dejá que los datos se reacomoden sin
> comprimir el importe ni esconder el enlace.

### S6
> 5. CONFIRMACIÓN AL AGREGAR AL CARRITO
>
> Usá la modal de Komorebi como referencia de interacción, con el estilo
> de Camba. Al confirmar el agregado, abrí una modal centrada con un
> indicador de éxito, «Agregado al carrito», miniatura, nombre, cantidad
> y precio. Poné «Seguir comprando» como acción secundaria y «Ver carrito»
> como acción principal bordó. Si ya estaba en el carrito y cambió su
> cantidad, titulá «Carrito actualizado» y mostrá la cantidad resultante.
>
> Abrila únicamente después de confirmar la operación. Tomá el contador
> del estado vigente del carrito. «Seguir comprando», la X y Escape
> cierran y devuelven el foco al botón de origen. «Ver carrito» navega
> al listado. Mantené el foco dentro de la modal mientras esté abierta.
> Si hay error o falta stock, mostralo en la ficha. Si usás Anime.js para
> la entrada, respetá la preferencia de movimiento reducido.

### S7
> VALIDACIÓN
>
> Probá con Playwright a 1440, 390 y 320 px. Comprobá ficha → agregar →
> modal → carrito, «Seguir comprando», Escape y el foco al cerrar.
> Verificá las miniaturas del carrito, el cambio de cantidad y los totales.
> Entrá a Mi cuenta con las dos direcciones de prueba y abrí un pedido de
> cada estado disponible. Dejá capturas de las pantallas y de la modal
> abierta, y compará el checkout con la versión aprobada.

## Tasks

- [x] T1 · S1–S3, S6–S7 · inline · cart cover cache, row media and native add confirmation. RED on missing covers and native tab-boundary wrap; GREEN on all three widths. Checkout unchanged.
- [x] T2 · S1, S4–S5, S7 · delegated direct with inline final visual fixes · account and orders history, browser-only reads, focused layout checks and seeded order details passed.
- [x] T3 · S7 · inline · demo/normal SSR builds, seeded Chromium journeys and 15 regressions passed, matched checkout captures and visual evidence.

## Log

### L1 — Original request
Pulí el storefront actual de Camba siguiendo las capturas adjuntas.
Trabajá con la demo seedeada existente. `api/` y los contratos quedan
en solo lectura.

1. TU CARRITO

Agregá una miniatura de la prenda a la izquierda de cada fila, junto
al nombre enlazado. Usá unos 80 × 100 px en escritorio y 56 × 70 px en
móvil, con fondo neutro y espacio reservado. Mantené cantidad, actualizar,
quitar y subtotal donde se puedan encontrar fácilmente.

Usá la portada del producto correspondiente. Si el carrito no la trae,
resolvela desde los datos de catálogo disponibles en el frontend, sin
inventar campos ni disparar una consulta por fila en cada render. Si la
imagen falta o falla, mostrá un respaldo discreto. Cantidades y precios
siguen saliendo del carrito.

2. CONFIRMÁ TU COMPRA

Conservá exactamente la composición actual, los formularios, la entrega
o retiro, los totales y el botón. El único cambio opcional es agregar una
miniatura de 36–44 px junto a cada producto de «Resumen de la compra».
Incluila solo si se puede reutilizar la del carrito y el nombre, la
cantidad y el precio siguen leyéndose cómodamente a 320 px.

3. MI CUENTA

Reemplazá los desplegables de direcciones y recordatorios por secciones
visibles. En escritorio, usá dos zonas: «Datos personales» a la izquierda
y «Direcciones guardadas» a la derecha. En móvil, apilalas. Presentá las
direcciones como fichas compactas, con localidad y acciones de editar,
eliminar y agregar. Dejá los recordatorios en una sección breve debajo.

Ubicá «Mis pedidos» como acceso visible cerca del encabezado y «Cerrar
sesión» como acción secundaria. Si recordatorios todavía no está
disponible en la demo, mostrá un estado informativo sin botón inútil
y conservá el comportamiento del modo real.

4. MIS PEDIDOS

Mantené el listado y sus datos. Ordená visualmente cada fila: fecha y
referencia a la izquierda, total en UYU a la derecha, y debajo el tipo
de entrega, el estado y «Ver pedido →». Diferenciá «Pago confirmado»,
«Pendiente de pago» y «Reserva vencida» con etiquetas de color suave
y texto explícito. En móvil, dejá que los datos se reacomoden sin
comprimir el importe ni esconder el enlace.

5. CONFIRMACIÓN AL AGREGAR AL CARRITO

Usá la modal de Komorebi como referencia de interacción, con el estilo
de Camba. Al confirmar el agregado, abrí una modal centrada con un
indicador de éxito, «Agregado al carrito», miniatura, nombre, cantidad
y precio. Poné «Seguir comprando» como acción secundaria y «Ver carrito»
como acción principal bordó. Si ya estaba en el carrito y cambió su
cantidad, titulá «Carrito actualizado» y mostrá la cantidad resultante.

Abrila únicamente después de confirmar la operación. Tomá el contador
del estado vigente del carrito. «Seguir comprando», la X y Escape
cierran y devuelven el foco al botón de origen. «Ver carrito» navega
al listado. Mantené el foco dentro de la modal mientras esté abierta.
Si hay error o falta stock, mostralo en la ficha. Si usás Anime.js para
la entrada, respetá la preferencia de movimiento reducido.

VALIDACIÓN

Probá con Playwright a 1440, 390 y 320 px. Comprobá ficha → agregar →
modal → carrito, «Seguir comprando», Escape y el foco al cerrar.
Verificá las miniaturas del carrito, el cambio de cantidad y los totales.
Entrá a Mi cuenta con las dos direcciones de prueba y abrí un pedido de
cada estado disponible. Dejá capturas de las pantallas y de la modal
abierta, y compará el checkout con la versión aprobada.

### L2 — Baseline and edit surfaces
- Capture the running seeded demo at 44858 without mutating it. Build the candidate independently. Attached screenshots were not available in the current tool context; the unchanged live render is the comparison baseline. Komorebi direct reference did not load; use the user's explicit interaction spec.
- The real cart wire product contains name, slug, price and stock, not a cover. Add a frontend cover lookup/cache only; preserve server ownership of quantities, availability and price. No api/ or contract changes and no checkout code changes.
- Cart/catalog/detail files and account/history files are disjoint, substantial independent edit units. Parent owns the cart/details and full browser seam. Worker owns account/history and its focused test only.

### L3 — Delivery evidence
- The running demo on 44858 had already been used, so the matched baseline was a separate process running its immutable `dist/shopper-demo` build with the same initial seed. The final review build stays running at `http://127.0.0.1:44862/cuenta`. Existing 44858 data was not reset or mutated.
- The cart reuses catalog covers already loaded, otherwise deduplicates by slug and uses a neutral fallback. Cart quantities, prices and confirmed count remain authoritative. The native confirmation opens after an accepted mutation, with a directional dialog-focus wrap, Escape/X/secondary-action restoration, and no success modal on rejected stock. Draft display does not optimistically overwrite cart quantities.
- Existing simulated and normal SSR built; normal-mode Playwright seam ran with isolated HTTP fixtures (not a real API or provider). The final seeded browser probe exercised cart media, totals, modal states and focus, visible account addresses, and three order details at 1440/390/320. Existing suite 15/15. Signed-in demo SSR responded 200 without sending address data in its HTML. `api/` and contracts unchanged; only existing home CSS budget warnings.
- Checkout source was not touched for this task, and each approved-build vs candidate PNG is byte-identical at 1440, 390 and 320. Before/after evidence and modal screenshots: `web/test-results/storefront-polish/index.html`. Visual pass confirmed compact mobile actions, centered dialog and distinct soft status colors.
- Mixed inherited uncommitted storefront and demo changes were preserved; worktree delivery, no push or review receipt. Native assessment could not bind the mixed untracked inventory. Risk: none (UI confirmation with existing mutation contracts and local state only).
