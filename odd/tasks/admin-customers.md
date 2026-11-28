# Admin customer directory (read only)
Branch: feat/camba-v2 · baseline 428a3ec · one coherent local delivery, no push or deployment.
Checks: isolated Laravel feature tests; existing local Docker Admin/API; Chromium desktop and 320 px; Admin build. Forecast: roughly 500–750 authored lines.

## Specs
- S1. “Agregá «Usuarios» en el menú lateral, dentro de Operación.” “En Inicio, agregá una tarjeta «Usuarios» con el estilo de las tarjetas actuales.” “Reservá el cero para cuando la API confirme que no hay clientes.”
- S2. “Mostrá nombre, correo, estado de verificación del correo, fecha de registro, cantidad de pedidos y fecha del último pedido.” “Agregá búsqueda por nombre o correo y paginación desde la API. Ordená por registro más reciente por defecto.” “Al volver al listado, restaurá la búsqueda y la página.”
- S3. “Mostrá sus datos de cuenta, sus direcciones guardadas y un historial paginado de pedidos.” “Usá las mismas etiquetas de estado y el formateador de fechas de Montevideo de Pedidos.” “Consultá los pedidos por el identificador de cuenta registrado en la compra. Una coincidencia de correo por sí sola no vincula un pedido a un cliente.” “El detalle de cada pedido debe seguir mostrando la dirección que quedó guardada en esa compra.”
- S4. “Protegé listado, ficha e historial con autorización de administrador en Laravel.” “La consulta debe limitarse a compradores y devolver solo los campos que usa la pantalla. Mantené las direcciones fuera de la respuesta del listado.” “Calculá los recuentos y la fecha del último pedido en la consulta del servidor, sin cargar el historial completo de cada cliente.”
- S5. “Cubrí el rechazo a visitantes y compradores en la API. Verificá Inicio, listado y ficha en escritorio y a 320 px, y ejecutá el build de Admin.” “entregá un resumen con las pruebas ejecutadas y capturas de Inicio, listado y ficha.”

## Tasks
- [ ] T1 · S1–S5 · inline, one admin read-only feature with API and UI dependent on the same contract · risk item 2: new customer PII reads, explicitly protected by admin gate · implementation in verification.

## Log
### L1 — 2026-11-28
Trabajá en el repo local de Camba. Agregá una tarjeta «Usuarios» en Inicio de Admin, un listado de clientes registrados y una ficha por cliente para consultar sus pedidos y direcciones guardadas. La primera versión es de solo lectura.

## Inicio y navegación

- Agregá «Usuarios» en el menú lateral, dentro de Operación.
- En Inicio, agregá una tarjeta «Usuarios» con el estilo de las tarjetas actuales. Mostrá el total de cuentas compradoras registradas y hacé que toda la tarjeta abra el listado.
- Obtené el total desde la API y actualizalo al volver a Inicio. Mostrá un estado de carga y un mensaje discreto si la consulta falla. Reservá el cero para cuando la API confirme que no hay clientes.

## Listado de usuarios

- Mostrá nombre, correo, estado de verificación del correo, fecha de registro, cantidad de pedidos y fecha del último pedido.
- Agregá búsqueda por nombre o correo y paginación desde la API. Ordená por registro más reciente por defecto.
- Cada fila debe permitir abrir la ficha. Al volver al listado, restaurá la búsqueda y la página. En móvil, priorizá nombre, correo y acceso a la ficha para evitar scroll horizontal.

## Ficha del usuario

- Mostrá sus datos de cuenta, sus direcciones guardadas y un historial paginado de pedidos.
- En cada pedido, mostrá referencia, fecha, total en UYU, estado del pago, modalidad y enlace «Ver pedido» al detalle que ya existe en Admin. Usá las mismas etiquetas de estado y el formateador de fechas de Montevideo de Pedidos.
- Consultá los pedidos por el identificador de cuenta registrado en la compra. Una coincidencia de correo por sí sola no vincula un pedido a un cliente.
- Mostrá las direcciones actuales de la cuenta en su propia sección. El detalle de cada pedido debe seguir mostrando la dirección que quedó guardada en esa compra.
- Mostrá estados vacíos claros para clientes que todavía no tienen pedidos o direcciones.

## API y verificación

- Reutilizá los modelos y las convenciones de Admin. Protegé listado, ficha e historial con autorización de administrador en Laravel. La consulta debe limitarse a compradores y devolver solo los campos que usa la pantalla. Mantené las direcciones fuera de la respuesta del listado.
- Calculá los recuentos y la fecha del último pedido en la consulta del servidor, sin cargar el historial completo de cada cliente.
- Probá que un administrador pueda buscar y paginar, abrir un cliente desde Inicio, distinguir sus direcciones guardadas de las del pedido y navegar al detalle de la compra. Incluí un pedido con correo coincidente que pertenezca a otra cuenta para comprobar que queda fuera del historial.
- Cubrí el rechazo a visitantes y compradores en la API. Verificá Inicio, listado y ficha en escritorio y a 320 px, y ejecutá el build de Admin.

Implementalo en la rama local y entregá un resumen con las pruebas ejecutadas y capturas de Inicio, listado y ficha.

### L2 — scope and baseline
- Preserve staged `api/storage/logs/.gitignore` and untracked `api/.env.prod`. Do not inspect the latter or include either in snapshots, receipts or commits.
- Use the existing verified-admin middleware. The directory and its order aggregates/history share the stored account ID; saved-address projection does not touch order snapshots. Keep the local demo database read-only; use disposable fixtures for transitions and screenshots.

### L3 — own checks
- RED: the three API tests saw absent routes/metric; Chromium saw no Usuarios tile.
- GREEN: isolated SQLite tests verified the API, including access rejection, order ownership, exact projections, and pagination before exposing data. Chromium exercised desktop and 320 px, including the order link and list state restore. Real camba-demo-pg HTTP matched the directory total to the dashboard and returned 401/403 for guest/buyer on all three endpoints.
- Contract: OpenAPI YAML parsed with the installed Prettier parser. Final visuals use synthetic fixture data, not demo customer data.

### L4 — final evidence
- The shared-worktree rebuild coincided with unfinished, unrelated product gallery edits. A scoped copy of baseline plus this feature's frontend compiled and passed all 12 Chromium checks. Final captures checked at 1440 and 320 px.
- Independent verifier confirmed all three routes carry the admin guard and found no code blockers. Its own authenticated runtime setup stopped at a Sanctum fixture error; it did not claim a runtime pass. Parent spot-checked the same route-list command and added the verifier's literal wildcard regression. Final isolated Laravel: 15 tests, 215 assertions, all passing. Real demo HTTP completed role denials and verified-admin reads without changing business records.
