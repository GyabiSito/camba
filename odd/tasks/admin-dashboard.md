# Camba Admin dashboard
Branch `feat/camba-v2` · delivery `ask-on-risk` · Angular builds, PostgreSQL fixtures, and Playwright on Docker Admin 4300.
Parallel writers: protected server summary, real list filters, and dashboard presentation. Parent owns routing/login, docs and end-to-end evidence.

## Specs

- S1 — «Agregá «Inicio» como primera entrada del menú, con ruta `/dashboard`. Usala como destino por defecto después del login y preservá el regreso a una ruta específica cuando el usuario haya entrado desde un enlace.» «En el encabezado, poné las acciones «Nuevo producto», «Carga masiva» y «Editar portada», enlazadas a sus pantallas actuales.»
- S2 — «Pedidos pendientes de pago.» «Pedidos pagados que todavía necesitan preparación.» «Pedidos listos para retiro, si ese estado existe en Camba.» «Productos publicados sin stock disponible.» «Cada tarjeta debe llevar a la lista correspondiente con el filtro aplicado, usando los filtros reales del Admin. Mantené separados el estado de pago y el de preparación o entrega.»
- S3 — «Mostrá los últimos cinco pedidos usando la tabla del Admin. Incluí referencia, fecha, total en UYU, pago, modalidad de entrega y «Ver pedido». Agregá «Ver todos los pedidos» y un estado vacío claro.» «Debajo, poné «Ventas confirmadas» con el monto y la cantidad de pedidos pagados de los últimos 30 días, y un gráfico mensual de los últimos seis meses. Calculá los importes a partir de las confirmaciones registradas, contando cada pedido una sola vez. Excluí pedidos pendientes y reservas vencidas. Indicá el período y usá la zona horaria configurada en la tienda. Si todavía no hay ventas, mostrá un estado vacío.»
- S4 — «Leé los datos de la API conectada a PostgreSQL.» «Calculá los agregados en el servidor y limitá el listado.» «En escritorio, dejá las prioridades en la primera fila, los pedidos recientes debajo y las ventas al final. En móvil, apilá el contenido y mantené «Ver pedido» fácil de tocar. Reutilizá tablas, indicadores de estado y botones del panel. Cubrí carga, error y ausencia de datos.» «Probá el dashboard en el Docker real de 4300. Verificá que un pedido pendiente aparezca en su tarjeta y en la tabla, que un pago previamente confirmado cuente una sola vez en ventas y que un producto agotado aparezca en el filtro correspondiente. Probá los accesos rápidos y la entrada después del login. Dejá capturas a 1440 y 390 px y el enlace directo al dashboard funcionando.»

## Tasks

- T1 · S2–S4 · delegated · verified · `c663557` · Admin-only read model and timezone-aware order aggregates (risk 2; operational/financial data).
- T2 · S2 · delegated · verified · API `c663557`; UI working tree · additive drilldown filters and preserved list contracts (risk 3).
- T3 · S1/S3/S4 · delegated · verified · working tree · dashboard page, responsive states and fixture coverage.
- T4 · S1–S4 · inline · verified · default/return navigation, documentation, independent check and actual Docker evidence.

## Log

- L1 · User request:

  Implementá el dashboard de Camba v2 tomando como referencia la captura
  del panel de Komorebi. Adaptalo a los datos, estados y acciones que ya
  existen en Camba. Usá el diseño actual del Admin, con papel cálido,
  bordó y la navegación lateral existente.

  1. ENTRADA Y ACCIONES RÁPIDAS

  Agregá «Inicio» como primera entrada del menú, con ruta `/dashboard`.
  Usala como destino por defecto después del login y preservá el regreso
  a una ruta específica cuando el usuario haya entrado desde un enlace.

  En el encabezado, poné las acciones «Nuevo producto», «Carga masiva»
  y «Editar portada», enlazadas a sus pantallas actuales.

  2. QUÉ NECESITA ATENCIÓN

  Mostrá tarjetas compactas con:
  - Pedidos pendientes de pago.
  - Pedidos pagados que todavía necesitan preparación.
  - Pedidos listos para retiro, si ese estado existe en Camba.
  - Productos publicados sin stock disponible.

  Cada tarjeta debe llevar a la lista correspondiente con el filtro
  aplicado, usando los filtros reales del Admin. Mantené separados
  el estado de pago y el de preparación o entrega. Usá los estados
  del backend y etiquetas comprensibles para la persona que opera la tienda.

  3. PEDIDOS RECIENTES Y VENTAS

  Mostrá los últimos cinco pedidos usando la tabla del Admin. Incluí
  referencia, fecha, total en UYU, pago, modalidad de entrega y «Ver pedido».
  Agregá «Ver todos los pedidos» y un estado vacío claro.

  Debajo, poné «Ventas confirmadas» con el monto y la cantidad de pedidos
  pagados de los últimos 30 días, y un gráfico mensual de los últimos seis
  meses. Calculá los importes a partir de las confirmaciones registradas,
  contando cada pedido una sola vez. Excluí pedidos pendientes y reservas
  vencidas. Indicá el período y usá la zona horaria configurada en la tienda.
  Si todavía no hay ventas, mostrá un estado vacío.

  4. API, DISEÑO Y VERIFICACIÓN

  Leé los datos de la API conectada a PostgreSQL. Reutilizá las consultas
  existentes donde sirvan. Si falta el resumen, agregá una consulta
  administrativa que devuelva los totales, la serie mensual y los cinco
  pedidos recientes. Calculá los agregados en el servidor y limitá el listado.

  En escritorio, dejá las prioridades en la primera fila, los pedidos
  recientes debajo y las ventas al final. En móvil, apilá el contenido
  y mantené «Ver pedido» fácil de tocar. Reutilizá tablas, indicadores de
  estado y botones del panel. Cubrí carga, error y ausencia de datos.

  Probá el dashboard en el Docker real de 4300. Verificá que un pedido
  pendiente aparezca en su tarjeta y en la tabla, que un pago previamente
  confirmado cuente una sola vez en ventas y que un producto agotado
  aparezca en el filtro correspondiente. Probá los accesos rápidos y la
  entrada después del login. Dejá capturas a 1440 y 390 px y el enlace
  directo al dashboard funcionando. La captura de komorebi la tenes en descargas: 77b0fd9d-57f8-46b9-9de2-d6ac9a83b898.png

- L2 · Baseline `4a0453f` plus inherited dirty Admin/Store changes; no live data changes. Opened supplied local reference. Borrow priorities, recent rows and monthly sales order; use current warm Camba tokens, light sidebar, existing states, no external reference assets. The store presents dates in America/Montevideo, while Laravel persists timestamps in UTC.
- L3 · Freeze seam: GET `/api/v1/admin/dashboard`. `data`: `priorities:{pending_payment,needs_preparation,ready_for_pickup,out_of_stock}`, `recent_orders` existing OrderResource summaries (no PII), `sales:{timezone,from,through,order_count,total_cents,months:[{month,order_count,total_cents}]}`. Needs preparation = paid + unstarted/preparing; pickup = paid + ready_for_pickup. Published out of stock = stock zero (available stock); existing list gains Admin availability filter; order list gains virtual aggregate filter. Sales from authoritative orders.paid_at + currently paid, counted once, local calendar boundaries converted to UTC. `from/through` inclusive date labels (today + previous 29 calendar days), six periods include current month.
- L4 · RED observed: no summary endpoint, unfiltered virtual drilldowns, and default login went to `/productos`. PostgreSQL isolated `tests/Feature/Dashboard` 9/103; broader Dashboard/Catalog/Orders 50 total, six MySQL-only cases skipped, 884 assertions. Duplicate approved Payment observations for one order, timezone rollover, invalid/public filters and no anonymous data covered. OpenAPI syntax, scoped Pint and production Angular build passed (inherited CSS warnings).
- L5 · Playwright: 4 dashboard state/layout cases, 3 filter/order workflow regressions, 4 isolated shell/accessibility cases (including default login, Portada deep link, filtered Pedidos return, buyer denial), all passed. Manual screenshot readback caught desktop header alignment; fixed a common action track and pinned exact column positions in Docker smoke. Heading option «Pagados por preparar» clarifies the combined drilldown while payment and fulfilment remain separate in Orders.
- L6 · Real Docker: two responsive screenshots, 320px no horizontal overflow, three quick actions, five latest rows and details, four drilldowns match real list metadata (`1/1/0/1`), confirmed sales one order / 201000 cents in America/Montevideo. Existing pending order appears in the filtered order table but not among latest five (all five in live data are expired); recent-table pending case covered by an isolated browser fixture. No real demo order/stock/payment writes. Artifacts `web/dist/artifacts/admin-dashboard/{dashboard-1440.png,dashboard-390.png,docker-verification.json}`.
- L7 · Independent check: dashboard requests fail 401 without auth on both 4300/4200 and exact API/links/authorization preserve existing semantics; no source blocker. Backend commit `c663557` excludes inherited OpenAPI classification hunks. UI, nav and tests remain local working changes to preserve inherited dependencies. Native assessment remains unassessable until untracked paths are declared; no native receipt or remote operations.
