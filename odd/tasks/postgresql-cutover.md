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

- T1 — S1–S3/S6 · runtime/recovery writer, disjoint surfaces · in progress. Risk: item 5 (production image, Compose and recovery wiring).
- T2 — S3/S5 · integration/concurrency writer, disjoint surfaces · in progress. Risk: item 5 (CI) and item 4 (proving the existing locking invariants on the new engine).
- T3 — S4 · legacy rehearsal writer, disjoint surface · in progress. Risk: item 1 (guard against accidental imported-data writes outside disposable storage).
- T4 — S4–S6 · parent integration, exact-SHA production Compose rehearsal, independent checks and VPS runbook · in progress. Risk: item 5 (candidate assembly and reference-only bootstrap).

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
