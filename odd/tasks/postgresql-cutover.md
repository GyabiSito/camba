# PostgreSQL for Camba v2
Branch: `feat/camba-v2` · Baseline: `71b2091`; existing unstaged deletion of the obsolete MySQL test SQL is not restored · local only, no VPS access.
Delivery: ask-on-risk if publishing is ever requested; local work-unit commits. Runner: Docker Compose production + real PostgreSQL and Redis, PHP/Playwright/HTTP, Bash release/recovery probes. Forecast ~650 authored lines; keep work units independently testable.

## Specs

S1. «Pasá todo Camba v2 a PostgreSQL. Implementá el cambio completo en `feat/camba-v2` y validalo en Docker local. Producción corre en un único VPS.» «En el commit `ee79579`, la demo ya usa PostgreSQL. `infra/compose.prod.yml` y `.github/workflows/checks.yml` siguen usando MySQL, y `api/Dockerfile` instala `pdo_pgsql` solo en desarrollo. Ya hubo un ensayo anterior en `candidate/camba-v2-local`. Si esa rama está disponible, aprovechá los cambios de PostgreSQL que funcionen y adaptalos al código actual.»

S2. «Reemplazá MySQL por PostgreSQL en `infra/compose.prod.yml`. Reutilizá la versión de PostgreSQL que ya funciona en desarrollo, con su volumen y chequeo de salud. Asegurate de que API, PHP-FPM, worker, scheduler y migrador usen la misma base PostgreSQL. Instalá `pdo_pgsql` en la imagen final de API. Corregí los `DB_*` que Compose fija a MySQL, porque esos valores tienen prioridad sobre el `.env`. PostgreSQL debe quedar en la red interna de Docker.»

S3. «Cambiá el servicio de base de datos y el driver de PHP en GitHub Actions. Ejecutá las pruebas de integración contra PostgreSQL real. Revisá los scripts de desarrollo, pruebas y arranque para que apunten al motor correcto. Adaptá las consultas y pruebas que dependan de MySQL, manteniendo su cobertura de transacciones, stock y concurrencia.»

S4. «Levantá una base PostgreSQL vacía con el Compose de producción y corré todas las migraciones. Cargá únicamente los datos de referencia necesarios, como la geografía. Si hay datos de Camba que se deban trasladar desde MySQL, prepará y ensayá la importación en local con el export disponible. Validá IDs, secuencias, relaciones, stock e importes. Si falta el export, completá todo lo demás y dejá identificado ese único pendiente.»

S5. «Construí las imágenes de API, Tienda y Admin. Levantá el stack con el Compose de producción en Docker local. Confirmá que Laravel use `pgsql`, que las migraciones estén aplicadas, que API, Tienda y Admin respondan, y que worker y scheduler arranquen. Probá catálogo, carrito, confirmación de pedido con datos de prueba y consulta desde Admin. Corré las pruebas de integración y reportá los resultados reales.»

S6. «Entregá el cambio aplicado, el SHA probado y los comandos exactos para levantar y migrar Camba v2 en el VPS. Avanzá con la configuración y las pruebas locales sin esperar mi input. La entrega termina con PostgreSQL funcionando en el stack candidato.»

## Tasks

- [x] T1 — S1–S3/S6 · runtime/recovery writer, disjoint surfaces · integrated as `5a1968e`; build and recovery verified. Risk: item 5 (production image, Compose and recovery wiring).
- [x] T2 — S3/S5 · integration/concurrency writer, disjoint surfaces · `2dc3d53` with fixture correction `7c75092` and `e6ae372`; real PostgreSQL integration, independent connections, and demo seed group passed. Risk: item 5 (CI) and item 4 (proving the existing locking invariants on the new engine).
- [x] T3 — S4 · legacy rehearsal writer, disjoint surface · integrated as `d6a1097`; isolated synthetic checks passed. Risk: item 1 (guard against accidental imported-data writes outside disposable storage). Real conversion awaits a suitable export as allowed in S4.
- [x] T4 — S4–S6 · parent integration · exact-SHA production Compose/Chromium rehearsal, independent checks and VPS runbook passed; final source tested `e6ae372`. Risk: item 5 (candidate assembly and reference-only bootstrap).

## Log

L1 — Original request (verbatim):

Pasá todo Camba v2 a PostgreSQL. Implementá el cambio completo en `feat/camba-v2` y validalo en Docker local. Producción corre en un único VPS.

En el commit `ee79579`, la demo ya usa PostgreSQL. `infra/compose.prod.yml` y `.github/workflows/checks.yml` siguen usando MySQL, y `api/Dockerfile` instala `pdo_pgsql` solo en desarrollo. Ya hubo un ensayo anterior en `candidate/camba-v2-local`. Si esa rama está disponible, aprovechá los cambios de PostgreSQL que funcionen y adaptalos al código actual.

1. CONVERTÍ PRODUCCIÓN
   Reemplazá MySQL por PostgreSQL en `infra/compose.prod.yml`. Reutilizá la versión de PostgreSQL que ya funciona en desarrollo, con su volumen y chequeo de salud. Asegurate de que API, PHP-FPM, worker, scheduler y migrador usen la misma base PostgreSQL. Instalá `pdo_pgsql` en la imagen final de API. Corregí los `DB_*` que Compose fija a MySQL, porque esos valores tienen prioridad sobre el `.env`. PostgreSQL debe quedar en la red interna de Docker.

2. CONVERTÍ CI Y LOS SCRIPTS
   Cambiá el servicio de base de datos y el driver de PHP en GitHub Actions. Ejecutá las pruebas de integración contra PostgreSQL real. Revisá los scripts de desarrollo, pruebas y arranque para que apunten al motor correcto. Adaptá las consultas y pruebas que dependan de MySQL, manteniendo su cobertura de transacciones, stock y concurrencia.

3. COMPROBÁ EL ESQUEMA Y LOS DATOS
   Levantá una base PostgreSQL vacía con el Compose de producción y corré todas las migraciones. Cargá únicamente los datos de referencia necesarios, como la geografía. Si hay datos de Camba que se deban trasladar desde MySQL, prepará y ensayá la importación en local con el export disponible. Validá IDs, secuencias, relaciones, stock e importes. Si falta el export, completá todo lo demás y dejá identificado ese único pendiente.

4. VERIFICÁ EL CAMBIO DE PUNTA A PUNTA
   Construí las imágenes de API, Tienda y Admin. Levantá el stack con el Compose de producción en Docker local. Confirmá que Laravel use `pgsql`, que las migraciones estén aplicadas, que API, Tienda y Admin respondan, y que worker y scheduler arranquen. Probá catálogo, carrito, confirmación de pedido con datos de prueba y consulta desde Admin. Corré las pruebas de integración y reportá los resultados reales.

Entregá el cambio aplicado, el SHA probado y los comandos exactos para levantar y migrar Camba v2 en el VPS. Avanzá con la configuración y las pruebas locales sin esperar mi input. La entrega termina con PostgreSQL funcionando en el stack candidato.

L2 — Baseline main feature branch clean except a pre-existing deletion of the former MySQL test database initializer; preserve it until it is clearly obsolete in the PostgreSQL test unit. The active demo is PostgreSQL 18.7. Read the local candidate branch (676c458, notably 4bdc1d9 and 3d5914b) without modifying its worktree. Reuse known pinned PostgreSQL, mounted parent data directory, separate administrator and application owner roles, explicit reference-only initialization and isolated rehearsal, not unrelated old application code. No VPS access or production write.

L3 — Searched the project, prior candidate, and relevant local legacy directories for an export. The only SQL data artifact found is a historical 2024 v1 archive with a different schema (sales, variations and old addresses), not a verified current MySQL cutover export with reconciled mappings/media. Inspected only schema/statement names and file metadata, not records. Do not load it into the v2 candidate or treat it as a current export. The v2 catalog rehearsal uses only synthetic reviewed fixtures in its dedicated PostgreSQL database.

L4 — T1 carried the pinned PostgreSQL image and parent data directory into production, common pdo_pgsql/libpq into the final API image, distinct administrator vs application roles, and a PostgreSQL recovery script. Synthetic Compose render (with the release profile) and CI shell probes passed. The production-image and real recovery rehearsal are part of the final integration.

L5 — T3 ported the disposable legacy catalog guard to PostgreSQL without introducing a full-database data transfer tool. Observed RED on the old PostgreSQL guard. SQLite Legacy feature suite: 16 tests, 140 assertions, one opt-in test skipped. A fresh isolated real PG18 staging run passed (1 test, 21 assertions): exact stock/cents, receipt/replay, relations, next ID and wrong-target refusal. The historical SQL file was not used.

L6 — Built API runtime from immutable `d6a1097`; `powershell.exe -File infra/recovery/rehearse.ps1 -ApiImage <that local image>` exited 0. Custom-format dump/restore matched table counts, migrations, decrypted order, stock, jobs and public/private media; probes /up and /ready passed, private media returned 404 and one synthetic notice reached isolated Mailpit without replay. Both recovery projects were stopped without deleting their volumes. The active demo stayed up.

L7 — Immutable runtime `c11344c` passed the full rehearsal on secondary ports in scratch: PostgreSQL 18.7, 18 migrations, reference-only geography (19 departments and 1,884 localities), all services up, HTTP 200 for readiness/Tienda/Admin, browser checkout 201 and Admin order 200, 24,690 cents and stock 5→3, matching IDs/FKs and sequences. Stopped only that scratch project, keeping its volumes intact, before the final candidate run.

L8 — The old MySQL contention class skipped all six on real PostgreSQL (RED). In PostgreSQL a waiting worker can directly block another worker queued for the same row; the test observes the transitive blocker chain and clears the statistics snapshot each poll. The PG18 contention suite passed all six (135 assertions). Exact integrated full API and separate demo-seed suite running.

L9 — Integrated `2dc3d53` rebuilt and passed the Compose/Chromium rehearsal at ports 44970/44971. An independent read-only verifier confirmed source labels, private network, non-superuser ownership, migrations, geography, persisted money/stock/relationships, worker and scheduler, and a guest 401 on the Admin order. No code or permissions blocker found.

L10 — PostgreSQL integration RED after 171 tests (2,477 assertions): one payment eligibility fixture tried to insert a 27-character `toISOString()` value in `CHAR(24)`. The production provider parser already emits a 24-character UTC millisecond timestamp. Use its existing wire format in the fixture; no schema, runtime payment behavior, or assertion changes. Re-run the affected test and full integration groups.

L11 — The timestamp fixture fix is `7c75092`. The exact-source Compose/browser rehearsal exited 0 again against new isolated project `camba-pg-candidate-b495d97733`; it remains running on 44970/44971. The runtime files are byte-identical to the independently checked `2dc3d53`. All 18 migrations and geography checks passed; browser and persisted assertions repeated successfully. Earlier temporary candidate projects were stopped without deleting volumes.

L12 — PostgreSQL 18.7 full suite GREEN: 171 cases, 2,488 assertions, zero failures and one opt-in legacy staging case skipped; that opt-in case passed separately against its own PostgreSQL database (21 assertions). Six contention cases passed (135 assertions). Dedicated PostgreSQL seed group passed (3 cases, 51 assertions) after the local runner mounted the existing demo photos read-only; the hosted runner already has the checkout layout. Fixture-focused GREEN: 1 case, 20 assertions. CI scope/required-gate shell probes and release executor mock regression passed. No GitHub-hosted run or VPS deploy was attempted.

L13 — Corrected the final legacy test style finding and the local demo asset-mount instructions in `e6ae372`. Rebuilt exact `e6ae372c333a0d406db21cfb720f73eec3a8ab01` OCI artifacts and repeated startup, migrations, browser checkout and persisted checks with exit 0. Left `camba-pg-candidate-eff888410d` up at ports 44970/44971 with the synthetic order `b5ad5030-f3e1-4845-b695-8f9cc26e390b`. No runtime paths changed after the separately independently checked candidate.

L14 — Post-normalization full Pint passed (207 files) and the touched staging test class passed in isolated SQLite (11 cases, 93 assertions, one opt-in PostgreSQL case, already run against real PostgreSQL). The sole remaining data operation is conversion/reconciliation with a suitable authorized MySQL export and matching media.
