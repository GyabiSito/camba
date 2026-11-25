# Storefront visual refresh
Branch: `feat/camba-v2` · baseline `69a3330` plus the inherited dirty home worktree · local delivery, no push/PR.
Runner: Angular SSR production/demo and Playwright · ask-on-risk if publication is requested; forecast ~550 authored lines across units.

## Specs

### S1
> ALCANCE
>
> Inventariá las rutas del storefront y cubrí las que existan: tienda,
> resultados de búsqueda y categorías, ficha, carrito, checkout, resultado
> del pedido o pago, acceso, registro, verificación, recuperación de
> contraseña, cuenta, direcciones, pedidos y ayuda. Incluí los estados
> vacíos y las páginas de error que formen parte de esos recorridos.
>
> Conservá el diseño aprobado del home y reutilizá su cabecera y el footer
> claro como base compartida. El mosaico de seis fotos pertenece al home.
> Mantené «Tienda» como enlace directo al catálogo. Revisá que «Ayuda» y
> los enlaces que apuntan a secciones del home tengan un destino válido
> cuando se abren desde otra página.
>
> `api/` y los contratos quedan en solo lectura. El alcance es el frontend
> del storefront. Conservá el SSR, los mocks, los usuarios de prueba y la
> integración existente con el modo real.

### S2
> DIRECCIÓN VISUAL
>
> Reutilizá la serif del home en títulos, la sans en controles y precios,
> el bordó en acciones y el papel cálido en fondos. Aprovechá componentes
> y tokens existentes. Usá separadores finos, espaciado consistente y foco
> visible. Dale a cada pantalla una acción principal clara. Conservá el
> significado visual y textual de disponibilidad, error y confirmación.

### S3
> 1. TIENDA Y RESULTADOS
>
> Rehacé el encabezado de «Tienda» y la zona de filtros de la captura.
> Título serif, recuento de productos y una barra compacta de búsqueda,
> categoría, marca y orden. En móvil, dejá la búsqueda a mano y agrupá
> los demás filtros en un control «Filtros» con un estado activo visible.
>
> Llevá las tarjetas al estilo de «Selección de Camba»: fotos coherentes,
> cuatro columnas en escritorio y dos en móvil cuando se lean bien,
> nombres y precios alineados y «Sin stock» donde corresponda. Conservá
> búsqueda, filtros, orden y paginación en la URL según los contratos
> actuales. Probá abrir una ficha, volver y recuperar el listado filtrado.

### S4
> 2. FICHA DE PRODUCTO
>
> Dale protagonismo a la galería y poné al lado nombre, precio en UYU,
> disponibilidad, cantidad y acción de compra. En móvil, foto primero y
> compra inmediatamente después. Usá las fotos y datos reales del artículo,
> con buen recorte y espacio reservado. Probá galería con teclado, una sola
> foto, producto agotado y confirmación al agregar al carrito.

### S5
> 3. CARRITO, CHECKOUT Y RESULTADO
>
> Rediseñá el carrito con filas claras de producto, cantidad, subtotal y
> eliminación, más un resumen fácil de encontrar. En checkout, agrupá
> contacto, entrega o retiro, y revisión del pedido. Mostrá el total y el
> siguiente paso de forma visible en escritorio y móvil.
>
> Preservá los flujos existentes de compra invitada, entrega, retiro,
> validaciones, reintentos y pago. El resultado tiene que mostrar el
> estado que informa el sistema: pendiente, confirmado o el que
> corresponda. Probá con el entorno de prueba existente.

### S6
> 4. ACCESO, CUENTA Y PEDIDOS
>
> Aplicá un mismo patrón a ingreso, registro, verificación y recuperación:
> título claro, etiquetas visibles, errores junto a los campos y un
> siguiente paso entendible. Mantené los destinos de retorno vigentes.
>
> En cuenta, ordená perfil, direcciones y pedidos con navegación legible.
> Mostrá en pedidos su referencia, fecha, total y estado, con acceso al
> detalle. Diseñá también los estados sin direcciones, sin pedidos y con
> sesión vencida. Usá solo rutas, datos y acciones disponibles.

### S7
> VERIFICACIÓN Y ENTREGA
>
> - Capturá las pantallas que cambies antes y después, con los mismos
>   mocks. Revisá a 1440 y 390 px y comprobá el reflow a 320 px.
> - Probá en Playwright Inicio → Tienda → filtro → ficha → carrito →
>   checkout, y acceso → cuenta → pedidos. Incluí volver al listado,
>   errores de formulario, foco con teclado y estados vacíos.
> - Corré el build SSR. Verificá el header y footer compartidos desde el
>   home, el catálogo y una ruta de cuenta. Revisá que el home coincida
>   visualmente con la versión aprobada y que el diff de `api/` esté limpio.
> - Entregá una lista de rutas rediseñadas con capturas y pruebas. Si hay
>   una ruta del storefront que siga con estilos viejos, completala antes
>   de cerrar.

## Tasks

- [x] T1 · S1–S2, S7 · inline · shared home-compatible shell, tokens, directory, help, 404 · RED on original catalog shell, GREEN at 1440/390/320 · kept in worktree.
- [x] T2 · S2–S4, S7 · delegated direct with inline seam refinements · catalog/detail, responsive disclosure, add/set quantity, route and gallery checks · RED on original catalog filters and on expanded-by-default mobile controls · kept in worktree.
- [x] T3 · S2, S5, S7 · delegated direct · cart/checkout · focused RED → GREEN with isolated purchase fixtures · `f93470b`.
- [x] T4 · S2, S5–S7 · delegated direct · auth/account/order and payment results · focused keyboard/validation/320 demo check, functional shopper-fixture comparison · `8fe4527`.
- [x] T5 · S1, S7 · inline · storefront seam, matched browser captures and journeys · production/demo SSR, HTTP statuses, 14 focused checks, purchase probe, 56 matched capture pairs, and identical home hashes · kept in worktree.

## Log

### L1 — User request
Rediseñá todas las páginas desactualizadas del storefront de Camba.
Tomá el home aprobado como referencia visual y partí de la captura de
/tienda. Trabajá sobre las rutas y componentes del checkout local.
Entregá las páginas implementadas, recorridas y probadas.

ALCANCE

Inventariá las rutas del storefront y cubrí las que existan: tienda,
resultados de búsqueda y categorías, ficha, carrito, checkout, resultado
del pedido o pago, acceso, registro, verificación, recuperación de
contraseña, cuenta, direcciones, pedidos y ayuda. Incluí los estados
vacíos y las páginas de error que formen parte de esos recorridos.

Conservá el diseño aprobado del home y reutilizá su cabecera y el footer
claro como base compartida. El mosaico de seis fotos pertenece al home.
Mantené «Tienda» como enlace directo al catálogo. Revisá que «Ayuda» y
los enlaces que apuntan a secciones del home tengan un destino válido
cuando se abren desde otra página.

`api/` y los contratos quedan en solo lectura. El alcance es el frontend
del storefront. Conservá el SSR, los mocks, los usuarios de prueba y la
integración existente con el modo real.

DIRECCIÓN VISUAL

Reutilizá la serif del home en títulos, la sans en controles y precios,
el bordó en acciones y el papel cálido en fondos. Aprovechá componentes
y tokens existentes. Usá separadores finos, espaciado consistente y foco
visible. Dale a cada pantalla una acción principal clara. Conservá el
significado visual y textual de disponibilidad, error y confirmación.

1. TIENDA Y RESULTADOS

Rehacé el encabezado de «Tienda» y la zona de filtros de la captura.
Título serif, recuento de productos y una barra compacta de búsqueda,
categoría, marca y orden. En móvil, dejá la búsqueda a mano y agrupá
los demás filtros en un control «Filtros» con un estado activo visible.

Llevá las tarjetas al estilo de «Selección de Camba»: fotos coherentes,
cuatro columnas en escritorio y dos en móvil cuando se lean bien,
nombres y precios alineados y «Sin stock» donde corresponda. Conservá
búsqueda, filtros, orden y paginación en la URL según los contratos
actuales. Probá abrir una ficha, volver y recuperar el listado filtrado.

2. FICHA DE PRODUCTO

Dale protagonismo a la galería y poné al lado nombre, precio en UYU,
disponibilidad, cantidad y acción de compra. En móvil, foto primero y
compra inmediatamente después. Usá las fotos y datos reales del artículo,
con buen recorte y espacio reservado. Probá galería con teclado, una sola
foto, producto agotado y confirmación al agregar al carrito.

3. CARRITO, CHECKOUT Y RESULTADO

Rediseñá el carrito con filas claras de producto, cantidad, subtotal y
eliminación, más un resumen fácil de encontrar. En checkout, agrupá
contacto, entrega o retiro, y revisión del pedido. Mostrá el total y el
siguiente paso de forma visible en escritorio y móvil.

Preservá los flujos existentes de compra invitada, entrega, retiro,
validaciones, reintentos y pago. El resultado tiene que mostrar el
estado que informa el sistema: pendiente, confirmado o el que
corresponda. Probá con el entorno de prueba existente.

4. ACCESO, CUENTA Y PEDIDOS

Aplicá un mismo patrón a ingreso, registro, verificación y recuperación:
título claro, etiquetas visibles, errores junto a los campos y un
siguiente paso entendible. Mantené los destinos de retorno vigentes.

En cuenta, ordená perfil, direcciones y pedidos con navegación legible.
Mostrá en pedidos su referencia, fecha, total y estado, con acceso al
detalle. Diseñá también los estados sin direcciones, sin pedidos y con
sesión vencida. Usá solo rutas, datos y acciones disponibles.

VERIFICACIÓN Y ENTREGA

- Capturá las pantallas que cambies antes y después, con los mismos
  mocks. Revisá a 1440 y 390 px y comprobá el reflow a 320 px.
- Probá en Playwright Inicio → Tienda → filtro → ficha → carrito →
  checkout, y acceso → cuenta → pedidos. Incluí volver al listado,
  errores de formulario, foco con teclado y estados vacíos.
- Corré el build SSR. Verificá el header y footer compartidos desde el
  home, el catálogo y una ruta de cuenta. Revisá que el home coincida
  visualmente con la versión aprobada y que el diff de `api/` esté limpio.
- Entregá una lista de rutas rediseñadas con capturas y pruebas. Si hay
  una ruta del storefront que siga con estilos viejos, completala antes
  de cerrar.

### L2 — Starting evidence
- Route inventory: `/`, `/tienda` (q, category, brand, sort, page), `/catalogo` redirect, `/producto/:slug`, `/carrito`, `/checkout`, `/cuenta` (login, register, forget, verification, profile, addresses), `/cuenta/restablecer`, `/pedidos`, `/pedidos/:reference` (including payment return), wildcard error. No separate help route; `/#contacto` / `/#canales` are real destinations.
- Frontend demo intercepts catalog and sign-in fixtures; it does not simulate cart, checkout, order, verification or reset mutations. Use the immutable demo and an isolated local browser fixture with actual response shapes for operational flows; preserve both integration modes and do not submit real orders/payments.
- Baseline artifacts from preceding production/demo builds `dist/home-direct-shop{,-real}`. No new visual world; approved home governs storefront tokens.
- Independent writer reason: each of catalog/detail, cart/checkout, and auth/account/orders is a complete, substantial unit with disjoint edit surfaces and its own checks. Parent owns shared shell, storefront-scoped tokens, captures and integration.

### L3 — Delivery evidence
- T1/T2 and final fixture/evidence changes stay in the worktree because they share the inherited, uncommitted home/demo files. The independent purchase and member slices were committed without staging that inherited work. No push, PR, or deploy.
- Catalog filters are collapsed from the first script-enabled mobile render; mobile users without JavaScript retain the native GET form. Desktop remains a single aligned filter row. The product keeps the original single-unit add action; an explicit edited quantity uses one existing absolute update, not a two-request increment/overwrite.
- Final builds: `web/dist/storefront-refresh-final-{demo,real}`. Demo preview: `http://127.0.0.1:44855/`. Visual evidence and exact coverage: `docs/STOREFRONT_REFRESH.md`, `web/test-results/storefront-refresh/index.html`. Home is byte-identical in the matching PNGs at 1440 and 390 px. 320 px reflow, keyboard, empty/error, catalog back navigation, purchase retries and order states passed against the isolated local fixtures.
- `git diff --check` passed and `api/` has no changes. The separate API-backed account suite failed to start its fixture listener on 43819; provider payment and real email were not used. The only build warnings concern existing home CSS budgets. The candidate assessor did not establish a binding for the local mixed worktree; no native approval claimed.
- Risk: none (visual scope, unchanged contracts, and the existing single server mutation per purchase action).
