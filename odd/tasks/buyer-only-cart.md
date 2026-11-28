# Cart requires a buyer session
feat/camba-v2 · preserve previously dirty tree · ask-on-risk, local only.
Runners: isolated Docker PostgreSQL Laravel tests and habitual Docker Store Chromium at localhost:4200. Estimate 280–400 authored lines.

## Specs

S1. Ajustá Camba para que solo un comprador con sesión iniciada pueda usar el carrito. Si alguien sin sesión pulsa «Agregar al carrito» o abre /carrito, mostrá Iniciar sesión y Crear cuenta. Después del ingreso o registro, llevalo de vuelta al producto o al carrito, según desde dónde llegó.

S2. En Laravel, protegé el GET y todas las operaciones de api/routes/cart.php. Verificá que una llamada directa sin sesión devuelva 401, incluso con CSRF válido, y que no cree carritos ni agregue artículos. Conservá la recuperación al iniciar sesión de los carritos de invitado que ya existían.

S3. Probá en Docker el acceso sin sesión desde la ficha de producto y desde /carrito, y comprobá que un comprador autenticado pueda agregar, cambiar cantidades y quitar productos de su carrito.

## Tasks

- [x] T1 · S1–S2 · inline after delegated map; RED guest GET 200, GREEN buyer cookie guard and one-time legacy restore, navigation returns from the shared account form.
- [x] T2 · S3 · SSR Store build and habitual Docker Chromium, 121 Laravel tests in isolated PostgreSQL, focused Playwright on Windows, independent readback. Native review preflight blocked; see L4.

## Log

L1.
Ajustá Camba para que solo un comprador con sesión iniciada pueda usar el carrito. Si alguien sin sesión pulsa «Agregar al carrito» o abre /carrito, mostrá Iniciar sesión y Crear cuenta. Después del ingreso o registro, llevalo de vuelta al producto o al carrito, según desde dónde llegó.

En Laravel, protegé el GET y todas las operaciones de api/routes/cart.php. Verificá que una llamada directa sin sesión devuelva 401, incluso con CSRF válido, y que no cree carritos ni agregue artículos. Conservá la recuperación al iniciar sesión de los carritos de invitado que ya existían.

Probá en Docker el acceso sin sesión desde la ficha de producto y desde /carrito, y comprobá que un comprador autenticado pueda agregar, cambiar cantidades y quitar productos de su carrito.

L2. Cart routes use auth:web and the existing buyer gate as a group. Legacy import locks only an existing guest cart, so login after the change does not create empty guest records. PostgreSQL coverage proves valid CSRF does not bypass auth for GET/POST/PUT/DELETE/resume, buyer mutations retain rules, admins get 403, and a seeded legacy cart merges exactly once, capped by stock. Browser return destinations are allowlisted; reactively update query params when Angular reuses /cuenta. RED also observed stale prompt when switching from /cuenta via the cart link, fixed and replayed.

L3. Habitual Docker Store rebuilt and recreated without touching other services or volumes. Chromium checked guest product at 390 px (keyboard Add, offers both actions, registration returns to exact product), desktop direct cart (offers both actions, login returns to cart), and re-entry to the same account component from the cart link. Buyer add 1, update 2 persisted across sessions, remove returns empty. All five no-session requests with real CSRF returned 401. Laravel isolated PostgreSQL: 121 tests/1750 assertions. Focused Playwright on Windows: 1 passed. Independent readback found no blockers. No provider calls or charges used.

L4. Risk: items 2 and 3 (buyer-cookie authorization and intentional HTTP contract change). Native review assessment reported untracked files need explicit selection; STATUS returned invalid_request before freeze, intended_untracked_selection_required. No receipt, commit, GitHub or publishing; preserve unrelated local edits.
