# Camba technical namespace cutover
feat/camba-v2 · base 025d0f4 · one local work unit, no push/deploy · ask-on-risk.
Runners: Compose dev/prod/edge, isolated PostgreSQL 18.7/Laravel, Angular production builds, local Docker cutover. Forecast: 250–400 authored changed lines.

## Specs
### S1
Renombrá los identificadores técnicos vigentes de Camba en C:\Users\Josec\camba. Usá `camba` en lugar de `camba` y `camba-v2`, conservando los sufijos que identifican cada entorno. Trabajá sobre la rama actual y preservá mis cambios locales.

### S2
1. Buscá las variantes `camba`, `camba-v2` y `camba` en archivos versionados. Revisá Docker Compose, nombres de bases y roles PostgreSQL, contenedores, volúmenes, redes, aliases del proxy, variables de entorno, scripts, CI/CD, fixtures, pruebas y documentación operativa. Actualizá juntas las definiciones y todos sus consumidores.

### S3
2. Conservá la separación entre desarrollo, pruebas y producción. Por ejemplo, `camba_demo_test` pasa a `camba_demo_test` y `camba-v2-demo-pg` a `camba-demo-pg`. Revisá también las validaciones que impiden ejecutar pruebas sobre una base real.

### S4
3. Antes de renombrar recursos locales existentes, comprobá si `camba` ya está ocupado por la instalación anterior. Cambiar el nombre del proyecto Compose puede hacer que Docker cree volúmenes vacíos. Preservá los datos, imágenes subidas y logs de pagos y reintegros. Si hay una colisión, conservá ambos entornos y documentá el cambio necesario para resolverla. Conservá el historial de migraciones ya aplicadas.

### S5
4. Validá los Compose, los builds de Tienda y Admin y las pruebas relevantes de Laravel en PostgreSQL aislado. Levantá el entorno local con los nombres nuevos y comprobá que la API, Tienda, Admin, worker, scheduler y Mailpit se conecten correctamente y sigan viendo los datos esperados.

### S6
Dejá el cambio en un commit local. El alcance de ejecución es el repo y Docker local. Prepará los pasos para el corte del VPS, donde puede existir un proyecto `camba` en uso.

### S7
Al terminar, pasame el hash, un resumen de nombres anteriores y nuevos, los resultados de las pruebas y cualquier referencia antigua que todavía sea necesaria para conservar datos o compatibilidad.

## Tasks
- [x] T1 · S1–S3 · inline; delegated map, one atomic work unit. Compose and isolated database guards verified.
- [x] T2 · S4–S5 · inline; original resources retained; new local stack and copied state verified.
- [x] T3 · S6–S7 · inline; VPS runbook checked by independent verification; deliver in this work unit.

## Log
L1. User request (verbatim)

Renombrá los identificadores técnicos vigentes de Camba en C:\Users\Josec\camba. Usá `camba` en lugar de `camba` y `camba-v2`, conservando los sufijos que identifican cada entorno. Trabajá sobre la rama actual y preservá mis cambios locales.

1. Buscá las variantes `camba`, `camba-v2` y `camba` en archivos versionados. Revisá Docker Compose, nombres de bases y roles PostgreSQL, contenedores, volúmenes, redes, aliases del proxy, variables de entorno, scripts, CI/CD, fixtures, pruebas y documentación operativa. Actualizá juntas las definiciones y todos sus consumidores.

2. Conservá la separación entre desarrollo, pruebas y producción. Por ejemplo, `camba_demo_test` pasa a `camba_demo_test` y `camba-v2-demo-pg` a `camba-demo-pg`. Revisá también las validaciones que impiden ejecutar pruebas sobre una base real.

3. Antes de renombrar recursos locales existentes, comprobá si `camba` ya está ocupado por la instalación anterior. Cambiar el nombre del proyecto Compose puede hacer que Docker cree volúmenes vacíos. Preservá los datos, imágenes subidas y logs de pagos y reintegros. Si hay una colisión, conservá ambos entornos y documentá el cambio necesario para resolverla. Conservá el historial de migraciones ya aplicadas.

4. Validá los Compose, los builds de Tienda y Admin y las pruebas relevantes de Laravel en PostgreSQL aislado. Levantá el entorno local con los nombres nuevos y comprobá que la API, Tienda, Admin, worker, scheduler y Mailpit se conecten correctamente y sigan viendo los datos esperados.

Dejá el cambio en un commit local. El alcance de ejecución es el repo y Docker local. Prepará los pasos para el corte del VPS, donde puede existir un proyecto `camba` en uso.

Al terminar, pasame el hash, un resumen de nombres anteriores y nuevos, los resultados de las pruebas y cualquier referencia antigua que todavía sea necesaria para conservar datos o compatibilidad.

L2. `Si, lo autorizo` — permission to use gpt-6-luna for read-only mapping; implementation, validation and delivery remain local.

L3. Base 025d0f4; untracked user file preserved. Docker desktop-linux: no resources found under the destination projects `camba` and `camba-demo-pg`; preserve the 8 running old containers and their data volumes. PostgreSQL source contains the three expected demo databases and the existing SCRAM role. The source Redis uses an anonymous data volume. Shared VPS edge alias names require explicit collision checks; VPS not accessed.

L4. RED: dev Compose resolved the former project/role/database and had no named Redis data mount. GREEN: `camba-demo-pg`, `camba_demo`, `camba`, explicit `redis-data`. Prod/edge Compose resolved both `camba-*` and alternate `camba-prod-*` aliases with synthetic settings; the release test passed inside the isolated Linux runner (`flock` unavailable in Windows Git Bash). The executor requires an explicit project for a release.

L5. Local copy from four read-only volume mounts: matching content/ownership/mode manifests after cold copy. The existing host payment logs bind stayed identical. Renamed all three PostgreSQL databases and the role on the copy; authenticated over TCP. Preserved 22 migrations (same IDs/names/batches digest `130756fe87f708991cf7ed3d8479a419`), 32 users, 13 products, 19 images, 50 orders, the pending inbox event, Redis 16 keys and Mailpit 1 message. The old eight containers and original volumes remain stopped/intact.

L6. Angular production builds for Store/Admin and Docker build for API/Store passed (existing CSS warnings). Isolated PostgreSQL 18.7 main suite: 259 passed, 1 opt-in skipped, 3,775 assertions; seed suite 3/51 and the skipped isolated legacy staging case run separately 1/21. The Cart suite refused even the actual demo database name inside the disposable cluster before refreshing. Live `camba-demo-pg`: all 8 healthy; HTTP 200 for API, Store, Admin and Mailpit; Chromium decoded a gallery image via `/storage`, authenticated in Admin and read all 13 products. API, worker and scheduler verified the new database/role, Redis, Mailpit and readable logs.

L7. Independent verification passed configuration, database safety, coexistence and live readback. Its one runbook finding (former PostgreSQL names repeated the new names) was corrected and the four references were rechecked against 025d0f4. No VPS access or production execution. Dispose only of the uniquely named test project; retain old and new demo state. The original migration files and unrelated working-tree edits stay out of this commit.
