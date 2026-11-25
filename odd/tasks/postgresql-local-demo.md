# Local PostgreSQL demo
Branch: feat/camba-v2 · baseline 8fe4527 plus inherited frontend worktree · no production changes or publication.
Runner: isolated Docker Desktop Compose + PostgreSQL feature/contention checks + Playwright on the actual dev stack · ask-on-risk · forecast ~550 authored lines subject to compatibility findings.

## Specs

### S1
> Dejá Camba v2 corriendo como una sola demo local en Docker Desktop, con
> PostgreSQL como base de datos y todos los escenarios de prueba cargados.
>
> - Tienda: http://127.0.0.1:4200/
> - Admin: http://127.0.0.1:4300/

### S2
> 1. BAJÁ LAS DEMOS ANTERIORES
>
> Desde el checkout local de Camba v2, identificá por PID, puerto y línea
> de comandos los procesos de demo iniciados por CMD o PowerShell.
> Detenelos, incluidos los de 44822 y 44858 si siguen activos. Conservá
> los procesos de otros proyectos, las instalaciones anteriores de Camba
> y sus volúmenes. Si 4200 o 4300 están ocupados, identificá al dueño
> antes de detener nada.

### S3
> 2. PASÁ EL STACK DE DESARROLLO A POSTGRESQL
>
> Adaptá el Compose de desarrollo para usar PostgreSQL con versión fijada,
> volumen propio y healthcheck. Publicá tienda y admin solo en loopback.
> Dejá la base en la red interna de Docker.
>
> Configurá Laravel con `DB_CONNECTION=pgsql` y el host del servicio de
> PostgreSQL. Incorporá `pdo_pgsql` a la imagen que usan API, worker y
> scheduler. Verificá que los tres apunten a la misma base de desarrollo.
> Mantené Redis y el correo local del stack.
>
> Permití cambios en `api/` acotados a la configuración, las migraciones
> y las consultas que requieran compatibilidad con PostgreSQL. Conservá
> los contratos públicos y el comportamiento de compra, stock, pedidos
> y pagos. Revisá el SQL específico de MySQL, índices, restricciones,
> decimales y bloqueos donde corresponda. Aplicá todas las migraciones
> desde cero sobre una base PostgreSQL nueva de esta demo. Conservá las
> bases y volúmenes MySQL existentes. El alcance es desarrollo local.

### S4
> 3. CARGÁ TODA LA DEMO EN LA BASE
>
> Reutilizá los seeders y comandos existentes. Si faltan escenarios,
> completá el seed de desarrollo para que se pueda repetir sin
> duplicados. Tienda y admin tienen que leer los datos de PostgreSQL
> a través de la API del stack.
>
> - Catálogo: categorías, marcas, productos publicados, borradores y
>   archivados, precios en UYU y stock variado, incluidos agotados.
>   Cargá portadas y galerías que funcionen desde el navegador.
> - Cliente: cuenta demo verificada, dos direcciones, carrito con
>   productos y pedidos de entrega y retiro. Incluí pago confirmado
>   simulado, pendiente y reserva vencida.
> - Admin: cuenta demo verificada con permisos para recorrer catálogo,
>   stock, carga masiva y pedidos. Dejá datos suficientes para probarlos.
> - Pagos y correo: usá simulación y correo local.

### S5
> 4. VERIFICÁ Y DEJALO CORRIENDO
>
> Levantá Docker en segundo plano. Confirmá desde Laravel que está
> conectado a PostgreSQL y verificá que API, worker y scheduler estén
> saludables. Ejecutá las pruebas de catálogo, carrito, checkout y pedidos
> contra PostgreSQL, incluidos los casos de stock y reintentos.
>
> Entrá por navegador a 4200 y 4300 con las cuentas de prueba. Verificá las
> fotos del catálogo y carrito, el checkout, las direcciones y el historial.
> En admin, abrí un producto y un pedido seedeados. Dejá el carrito demo
> precargado después de verificar.
>
> Actualizá el README con las URLs, las credenciales demo de cliente y
> admin y los comandos exactos para levantar, migrar, seedear y detener.
> Dejá el stack corriendo y entregame los accesos y el resultado de las
> pruebas sobre PostgreSQL.

## Tasks

- [x] T1 · S1–S3 · inline · 24 host demos stopped; PostgreSQL isolated on its internal network; health checks and independent isolation recheck passed · `163e26a`. Risk: item 5 (isolated Docker runtime and storage).
- [x] T2 · S3, S5 · delegated direct · PostgreSQL DDL and unique-error savepoints; migration RED → GREEN; 52 pass, 6 MySQL-only skips; separate PostgreSQL row-lock probe passed · `8369e59`.
- [x] T3 · S4–S5 · delegated direct with inline fixture review · repeatable local seed, real media and three order states; PostgreSQL repeat test 32 assertions · `dec4baf`.
- [x] T4 · S4–S5 · inline · actual store/admin browser verification, simulated payment suites, Mailpit delivery and complete README; stack left running · `89a6229`.

## Log

### L1 — Original request
Dejá Camba v2 corriendo como una sola demo local en Docker Desktop, con
PostgreSQL como base de datos y todos los escenarios de prueba cargados.

- Tienda: http://127.0.0.1:4200/
- Admin: http://127.0.0.1:4300/

1. BAJÁ LAS DEMOS ANTERIORES

Desde el checkout local de Camba v2, identificá por PID, puerto y línea
de comandos los procesos de demo iniciados por CMD o PowerShell.
Detenelos, incluidos los de 44822 y 44858 si siguen activos. Conservá
los procesos de otros proyectos, las instalaciones anteriores de Camba
y sus volúmenes. Si 4200 o 4300 están ocupados, identificá al dueño
antes de detener nada.

2. PASÁ EL STACK DE DESARROLLO A POSTGRESQL

Adaptá el Compose de desarrollo para usar PostgreSQL con versión fijada,
volumen propio y healthcheck. Publicá tienda y admin solo en loopback.
Dejá la base en la red interna de Docker.

Configurá Laravel con `DB_CONNECTION=pgsql` y el host del servicio de
PostgreSQL. Incorporá `pdo_pgsql` a la imagen que usan API, worker y
scheduler. Verificá que los tres apunten a la misma base de desarrollo.
Mantené Redis y el correo local del stack.

Permití cambios en `api/` acotados a la configuración, las migraciones
y las consultas que requieran compatibilidad con PostgreSQL. Conservá
los contratos públicos y el comportamiento de compra, stock, pedidos
y pagos. Revisá el SQL específico de MySQL, índices, restricciones,
decimales y bloqueos donde corresponda. Aplicá todas las migraciones
desde cero sobre una base PostgreSQL nueva de esta demo. Conservá las
bases y volúmenes MySQL existentes. El alcance es desarrollo local.

3. CARGÁ TODA LA DEMO EN LA BASE

Reutilizá los seeders y comandos existentes. Si faltan escenarios,
completá el seed de desarrollo para que se pueda repetir sin
duplicados. Tienda y admin tienen que leer los datos de PostgreSQL
a través de la API del stack.

- Catálogo: categorías, marcas, productos publicados, borradores y
  archivados, precios en UYU y stock variado, incluidos agotados.
  Cargá portadas y galerías que funcionen desde el navegador.
- Cliente: cuenta demo verificada, dos direcciones, carrito con
  productos y pedidos de entrega y retiro. Incluí pago confirmado
  simulado, pendiente y reserva vencida.
- Admin: cuenta demo verificada con permisos para recorrer catálogo,
  stock, carga masiva y pedidos. Dejá datos suficientes para probarlos.
- Pagos y correo: usá simulación y correo local.

4. VERIFICÁ Y DEJALO CORRIENDO

Levantá Docker en segundo plano. Confirmá desde Laravel que está
conectado a PostgreSQL y verificá que API, worker y scheduler estén
saludables. Ejecutá las pruebas de catálogo, carrito, checkout y pedidos
contra PostgreSQL, incluidos los casos de stock y reintentos.

Entrá por navegador a 4200 y 4300 con las cuentas de prueba. Verificá las
fotos del catálogo y carrito, el checkout, las direcciones y el historial.
En admin, abrí un producto y un pedido seedeados. Dejá el carrito demo
precargado después de verificar.

Actualizá el README con las URLs, las credenciales demo de cliente y
admin y los comandos exactos para levantar, migrar, seedear y detener.
Dejá el stack corriendo y entregame los accesos y el resultado de las
pruebas sobre PostgreSQL.

### L2 — Starting evidence
- Docker Desktop Linux Engine 28.0.4 and Compose v2.34.0 available. 4200/4300 free after process and container inventory. Existing project camba-v2-local and its mysql volume must stay untouched.
- Existing development pair infra/compose.dev.yml and infra/compose.dev.apps.yml uses MySQL, Laravel PHP/worker/scheduler shared build, Redis, Mailpit and Angular normal development mode; use a new project/volume namespace.
- Tracked demo WebPs already exist in web/projects/admin/public/demo; expose these files to the explicit local seeder via a dev-only read-only mount. Existing DatabaseSeeder is empty by design.
- Independent code units: DB driver compatibility and seed behavior consume the same established Laravel models/actions and can proceed in parallel without overlapping files. Parent owns infrastructure, local provider wiring, git, docs and final health/browser gates. No broad API redesign.

### L3 — Final local delivery
- The exact PID/port/command inventory is in `web/test-results/postgres-demo/host-demo-processes.json`. Only 24 verified host Node demos were stopped, including 44822 and 44858. The existing `camba-v2-local` MySQL installation and its volume remain running and untouched.
- The new Docker project `camba-v2-demo-pg` is healthy; PostgreSQL 18.7 uses a digest-pinned image, a separate volume, and only the Docker-internal `postgres-private` network, with no host port. Independent verification initially flagged that the default bridge was not marked internal; it passed the corrected private-network recheck. API, worker, and scheduler each reported `pgsql`, host `postgres`, PDO driver loaded and database `camba_v2_demo`. API/Redis are also not published; frontends are loopback 4200 and 4300.
- All 16 migrations ran in batch 1 on the clean main PostgreSQL database. The catalogue migration chooses database-native identity/FK syntax; PostgreSQL-only savepoints roll back caught uniqueness failures without changing public errors. Existing integer cents, constraints and row-lock semantics remain. The separate PG row-lock probe observed SQLSTATE 55P03 on the second connection and unchanged stock after release. OpenAPI unchanged.
- Six published items in Remeras/Camisas/Pantalones, one draft and one archived item, demo users verified, and imported stock-preview data, two addresses and cart items, delivery/pickup histories and paid/pending/expired examples. Re-seeding completed without duplicate fixture items or orders. Payment verification used simulated evidence and PHPUnit provider fakes; actual Mercado Pago credentials are blank. A synthetic SMTP message reached Mailpit.
- Real Playwright run used 4200/4300 and the seeded PostgreSQL/Laravel data, with no HTTP interception of API responses. It decoded catalog/gallery/cart images, signed in as both roles in separate contexts, verified cart/checkout delivery and pickup, all three history states, admin product/order/import screens and left the two cart lines intact. Seven screenshots and HTTP/runtime evidence are under `web/test-results/postgres-demo/`.
- Commands to launch, migrate, seed and stop are in README and PostgreSQL test commands in docs/DEVELOPMENT.md. Formal native assessor could not bind the inherited untracked inventory; no native approval claimed. Local commits kept unrelated frontend work and no publication was attempted.
