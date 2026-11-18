# Progreso de Camba v2

## Estado inicial

18/11/2026: se prepararon las instrucciones para Codex local después de revisar referencias remotas de GAM y Voltio. Se confirmó que el repositorio nuevo estaba vacío. Komorebi todavía requiere lectura de su checkout local.

No hay aplicación implementada, dependencias instaladas, contenedores de Camba v2 ejecutados, pruebas de aplicación aprobadas ni despliegue de producción realizado por este arranque.

## Etapas

| Etapa | Estado | Evidencia |
| --- | --- | --- |
| Encargo e instrucciones | Preparado | AGENTS.md, IMPLEMENTATION_BRIEF.md, REFERENCES.md |
| P0 — referencias locales, plugins y decisiones | Referencias revisadas; comp de admin elegida y placas aprobadas por Impeccable | PRODUCT.md; [evidencia local](REFERENCES.md#local-source-review--2026-11-18); falta captura del hero |
| P1 — monorepo, Docker dev, CI base y acceso | Backend probado; interfaces de identidad pendientes | [API](../api/README.md) y [arranque aislado](DEVELOPMENT.md) |
| P2 — catálogo/admin/carga masiva | En curso | Catálogo/galería API; faltan interfaz, importación y pruebas de navegador |
| P3 — pedidos/pagos/webhook/conciliación | Backend y simulación verificados | Contención MySQL comprobada; falta entorno real de prueba de Mercado Pago, más UI |
| P4 — notificaciones/recordatorios | Backend con cola y preferencias | Transporte sintético/array, falta SMTP real y controles UI |
| P5 — tienda y diseño completo | Bloqueado en prueba visual de comp | App SSR inicial y reproducción de placas de admin compiladas; no son interfaces terminadas |
| P6 — rendimiento/seguridad/integración | Parcial | Derivados WebP, una consulta de portadas por página y bundles medidos; falta QA en navegador |
| P7 — imágenes y despliegue selectivo CI/CD | Infra local y flujo preparados | Arranque de producción aislado; sin publicación, SSH ni despliegue reales |
| P8 — ensayo de migración y entrega | Staging sintético probado | Faltan copia real aislada, validación histórica, redirecciones y corte |

## Próximo paso

Retomar `feat/camba-v2` con [el log de tareas](../odd/tasks/camba-v2.md). La dependencia local principal es una nueva sesión de Codex desde `C:\Users\Josec\camba` con navegador verificable: la sesión anterior perdió control del navegador al no poder confirmar su URL. En esa sesión, confirmar el SessionStart real de Engram y el dispatch de hooks; no simularlos ni reemplazar identificadores.

Para admin, retomar Impeccable en `hero`. Servir la réplica de placas con `cd web; npm exec -- ng serve admin --host 127.0.0.1 --port 43804`, capturar a 1586×992 y ejecutar `build-phase record hero --build .impeccable/review/hero-repro.png`. Luego reproducir la capa semántica y validar el hero; no pasar a fases posteriores sin esa evidencia. Completar tienda, admin, formularios de acceso, compra y carga agrupada por fotos. Están disponibles [API](../api/openapi.yaml), [configuración de entornos](DEVELOPMENT.md) y [matriz de aceptación](#acceptance-matrix). No se habilitó el release ni se modifica Camba anterior.

## Acceptance matrix

**Partial** means only the stated slice and evidence exist; it is not acceptance. The expected outcomes are in [AUTONOMOUS_EXECUTION.md](AUTONOMOUS_EXECUTION.md#6-matriz-de-cobertura-obligatoria).

| ID | Status and evidence | Remaining acceptance |
| --- | --- | --- |
| UC01 | Partial: API validation, normalized email, no role escalation, persistence; PHPUnit | Store form and browser journey |
| UC02 | Partial: signed expiry, queued notification, recovery after enqueue failure; PHPUnit and HTTP 401/204 | Rate-limit/notification delivery proof and UI |
| UC03 | Partial: cookie login/session/logout and real CSRF rejection; PHPUnit and HTTP | Browser reload, expiry and account isolation journeys |
| UC04 | Partial: secure broker and session revocation in `a121d43` / `8ac57fb`; PHPUnit and real loopback HTTP → worker → Mailpit → reset | Reset screen, browser and external delivery |
| UC05 | Partial: profile/name, owner-scoped CRUD in `f1d1b8a`; PHPUnit and independent adversarial probes | Store UI and browser |
| UC06 | Partial: `4fd6c80`/ `88e3060`; independent HTTP 67 checks and MySQL contention 44 checks | Cart/browser/auth-switch UI and shopping relay |
| UC07 | Partial: verified admin gate and explicit CLI provisioning in `f1d1b8a`; unauthorized roles denied in independent probes | Admin UI and browser |
| UC08 | Partial: published search/filters/sort/pagination API in `d2216a1`; automated | Live storefront and browser |
| UC09 | Partial: product detail strips non-public products; images and availability serve through API | Store SSR metadata, storefront gallery and HTTP 404 |
| UC10 | Partial: flat category management, deactivation guard; automated | Admin UI and true concurrent DB verification |
| UC11 | Partial: brand optional, safe deactivation; automated | Admin UI and true concurrent DB verification |
| UC12 | Partial: draft/publish/archive and persistent stable SKU; automated | Admin UI, actual concurrent lifecycle proof |
| UC13 | Partial: price/stock and actor audit in `8fee1c4`; automated transactional checks | Admin list editor and browser |
| UC14 | Partial: authenticated multi-upload, EXIF, WebP and stable cover order in `706cade`; focused tests and independent rollback probes | Admin UI/error flows, live media delivery and concurrent gallery requests |
| UC15 | Pending: existing draft/gallery APIs cover individual operations only | Interactive grouped photo grid, selection, explicit publication and recovery |
| UC16 | Partial: admin template/CSV/XLSX preview and row errors in `539d8f8`; automated | Browser preview and real workflow exercise |
| UC17 | Partial: durable row ledger, resumable confirm and idempotency in `539d8f8`; independent MySQL contention 26 checks | Admin progress and correction UI |
| UC18 | Partial: quote/pickup/delivery server totals in `9118f67`; automated | Guest/buyer checkout UI and actual business terms |
| UC19 | Partial: immutable snapshots and reservation in `9118f67`; independent real MySQL last-unit and retry races | Full browser journey |
| UC20 | Partial: preferences and owner restart/resume in `79045bb` / `0a35491`; fake provider | Actual Checkout Pro test account redirect and retry |
| UC21 | Partial: signed durable inbox 200 before async processing; independent fake provider tests | Public TLS webhook and actual provider delivery/retry |
| UC22 | Partial: minute scheduler and absent-webhook reconciliation observed against fakes | Real test-account consistency and closed-browser hosted exercise |
| UC23 | Partial: duplicate/stale/late-payment logic; independent MySQL contention 27 checks with fake evidence | Live test-account fixture cases and inbox crash recovery test |
| UC24 | Partial: encrypted owned snapshots and guest TTL; independent isolation | Browser history and provider return |
| UC25 | Partial: paid preparation/shipment/pickup and private notes in `c0c7211`; automated | Admin UI, browser and operational walkthrough |
| UC26 | Partial: durable transactional notices and real local SMTP worker receipt in Mailpit; contention with synthetic transport | Production SMTP proof and customer flow |
| UC27 | Partial: verified buyer opt-ins, send-time state and dedup; fake/array tests | Preference UI, live mail and end-to-end scheduler |
| UC28 | Partial: verified-admin inbox and deduped stock, paid, import, payment and mail incidents | Views and real operating checks |
| UC29 | Partial: public business settings and authenticated operational audit `3069dd0`; automated | Admin UI and live business configuration |
| UC30 | Partial: dry-run `9d7e52e` and isolated apply `0ef28f0`; SQLite and independent MySQL interrupted-gallery replay | Actual isolated export/photos, accounts/history, redirections and cutover |
| T01 | Partial: approved comp plates, compiled Angular shells | Real storefront, full admin, identities, checkout and all states |
| T02 | Blocked in this session: Windows browser URL could not be confirmed | Actual browser at 320 px/desktop, keyboard, focus and WCAG review |
| T03 | Partial: CSR/SSR compiled, API list loads one cover per product; WebP derivatives measured | Data hydration, SEO/product HTTP 404, mobile Lighthouse and measured UX budgets |
| T04 | Partial: full dev and production-style stacks healthy in isolation; dev roots/proxies 200, no prod-style published ports | Real edge/TLS and protected hosting configuration |
| T05 | Partial: selective filters, required jobs, image builders and digest release script; fake rollout passed | Actual GitHub run, registry pull/push and protected production delivery |
| T06 | Partial: readiness/outages locally; synthetic MySQL restore sampled | Full real-data/media/queue restoration drill and production operating checks |

## Registro de ejecución

Por cada entrega agregar: commit, funcionalidad, comandos ejecutados, resultado, entorno, evidencia de UI cuando corresponda, límites conocidos y siguiente paso. Marcar por separado pruebas con proveedor simulado y con cuenta de prueba real.

### 2026-11-18 — Impeccable initialization (local)

- Created `PRODUCT.md` from the existing brief and the owner's confirmed assortment: primarily clothing, with accessories, jewelry, necklaces, perfumes and "tarjetas cuantticas" (terminology unconfirmed).
- Recorded the user's comp-first choice as `buildPath: "comp"` in `.impeccable/config.json`; existing hook settings are preserved. `hooks on` and `hooks status` reported enabled configuration and accepted local consent, but no provider skill folders were found to repair. Automatic hook dispatch remains unverified.
- Ran `impeccable.cmd context` once. No `DESIGN.md`, live-mode setup or application was created; there is no runnable interface yet.
- Verification is structural only. Application compilation, HTTP, browser automation, visual review and provider/production checks are not applicable to this documentation-only setup; no such results are claimed.
- Engram memory operations were blocked because the Codex host session could not be confirmed. Local files preserve the checkpoint. No commit or remote operation was performed.

### 2026-11-18 — Local implementation preflight

- Baseline: `0148987` on `main`. The existing Impeccable setup and product brief are preserved. No application code, feature branch or implementation commit yet.
- Candidate directories found (contents and revisions not yet reviewed): Komorebi at `~/OneDrive/Escritorio/{komorebi,komorebi-prod}`; GAM at `~/GAM`; Voltio at `~/voltio` and `~/voltio-api`; previous Camba at `~/OneDrive/Escritorio/{Cambalache,cambalacheProd}`.
- The read-only reference mapping required by repository routing could not start: spawning `odd-explorer` with `gpt-6.1-luna` returned `Unknown model`. No project skill registry was found. Impeccable 4.3.1 is installed; its new-work workflow and the existing comp-first setting were reviewed. No interface exists yet for detector or browser checks.
- Host commands confirmed PHP 8.4.3, Composer 2.8.4, Node 24.20.0 and npm 11.10.0. PHP has `pdo_mysql`, `gd`, `intl` and `zip`. The local PHP and Node series satisfy the published [Laravel 13](https://laravel.com/framework/docs/13.x/releases) and [Angular 22](https://angular.dev/reference/versions) runtime ranges; no project dependencies have been resolved or installed.
- `docker compose version` reported v2.34.0-desktop.1; `docker version` could not connect to the local Docker Desktop Linux engine. No daemon, container, production service, migration or deployment was started. Compilation, HTTP, browser automation, visual review and application suites have not run.

### 2026-11-18 — Local reference handoff

- The user authorized `gpt-6.2-sol`; the read-only explorer mapped the four references. The parent cross-checked Komorebi API's HEAD, dependency and routes. Findings and exact local revisions are recorded in `docs/REFERENCES.md`; no claim is made about what is deployed.
- The implementation is tracked in `odd/tasks/camba-v2.md`. No production action was performed.

### 2026-11-18 — First buyer-access delivery (P1/T2a)

- Local commits: `0308b42` records product and reference evidence; `9b52a15` contains the buyer API. PHP 8.4.3, Laravel 13.43.0 and Sanctum 4.5.0. Implemented buyer-only registration, normalized email, auth throttling, signed expiring verification and cookie login/session/logout. No default admin or seeded login. Mail delivery itself has not been confirmed; notification is queued and tests use a fake or local array transport.
- PHP checks: `composer validate --strict --no-check-publish` and Pint passed. `php vendor/bin/phpunit` on an isolated MySQL 8.0.30 instance: 7 passed, 44 assertions. No Redis or Docker check; the Docker engine was unavailable. No frontend build.
- HTTP: loopback `/up` returned 200 with a passing Postman assertion; cookie smoke observed 419 without CSRF, then 201 registration, 204 login, 200 session, 204 logout, 401 after logout. `postman spec lint openapi.yaml --issueType syntax --no-report-events` found no issues.
- Independent verification: isolated source copy, PHPUnit/Pint/Composer passed; missing CSRF returned 419 and left the nine persisted table hashes unchanged. Added an automated CSRF regression to the final suite. Native review assessed `high_risk`; managed Codex assets required a sync, after which the committed candidate was eligible to start. No review result yet.
- No browser automation, visual review, real mail, payment provider or production proof. Password recovery, admin provisioning, Angular workspace, Compose and CI remain pending. No remote repository or production mutation was made.

### 2026-11-18 — Native review budget and local slicing

- The user granted review of `9b52a15`; START returned `lens_context_budget_exceeded` before creating authority. The generated lockfile accounts for 8,387 lines. There was no review result.
- Sliced locally without rewriting `feat/camba-v2`: `bec1305` pins dependencies; `25432f3` adds the framework foundation; `0b66ee6` adds identity and its tests/docs. Cache-only Composer install and the foundation PHPUnit liveness test passed (one test). `git diff --exit-code 9b52a15 HEAD` found no tree differences at the end of the sliced branch.
- Native assessment of the 18-file, 588-line identity range returned `high_risk`; fresh consent applies only to that range, not the foundation/lock slices. All implementation and review work remains local.

### 2026-11-18 — Buyer API review corrections

- Granted native review of `0b66ee6`; all four lenses completed. Two distinct blockers: existing schemas could miss `users.role`, and an enqueue error could leave a buyer with no verification recovery. Commit `a6b2af6` adds a forward migration, actual enqueue status, and authenticated throttled resend. No existing installation was accessed.
- Automated: observed RED on both regressions; GREEN 9 tests / 60 assertions. A separate MySQL 8.0.30 forward-migration run confirmed the original ID, email and password hash were preserved and the role defaulted to `buyer`. Pint and OpenAPI syntax passed. HTTP: anonymous resend 401; registration 201 with queued status; login 204; authenticated resend 204. No browser, real mail, production or other integration proof.
- Native recovery created `review-6975ad52d814d47e`, but returned no exact successor continuation. The provider's read-only authority inspection confirmed a valid recovery edge, not a validation result. Neither branch nor authority was changed after that; the correction is not integrated or published.

### 2026-11-18 — Autonomous recovery and continued implementation

- Fetched public `origin/main` without credentials or remote mutation; adopted the three requested instruction files exactly from `ef21594` as `e0c729d`, preserving existing progress, `.impeccable/` and both worktrees. The documented exact successor selection matched the corrected target; the four captures approved it and `acknowledge-approved` returned `authority: burned`. That closure covers the isolated identity candidate, not Laravel's generated dependencies or later changes. Integrated the correction as `e675301`; `git diff --exit-code a6b2af6 HEAD -- api` showed the same API tree immediately after integration.
- Engram installation was present and the daemon healthy; do not restart the unmanaged listener. Installed `jq` 1.8.2 from the official WinGet package (installer hash verified); `jq --version` now works from a refreshed PowerShell PATH and Git Bash. Hook project resolver returns `camba` with the correct cwd. Existing Codex process/session was not impersonated or restarted, so native session registration and actual Impeccable dispatch still need proof in a fresh project-root session. Impeccable settings remain enabled, consent stays unchanged, and no duplicate manifest was installed.
- Started only `camba-v2-dev`: MySQL 8.4, Redis 7.2.16 and Mailpit 1.31.5 healthy on loopback. Redis `PING` returned `PONG`; Mailpit `/readyz` returned 200. No services from the previous Camba installation were touched. Angular workspace installed Angular 22.2.6 / CLI 22.2.7 on Node 24.20.0 and uses `projects/`; no app build or visual check yet.
- UC04 backend: observed 404 RED on three recovery rules, then PHPUnit 12 tests / 82 assertions (SQLite and Compose MySQL, with the isolated migration-differential test pinned to memory). Added generic request response, native single-use and expiring tokens, encrypted queued notifications, and account-scoped session revocation. No frontend reset screen, browser proof or external mail delivery claimed.

### 2026-11-18 — Cuentas, catálogo, medios y trabajo paralelo

- **Implementación:** Cuenta de comprador y acceso administrativo `f1d1b8a`; catálogo y taxonomía `d2216a1`; galería `706cade`. Los cambios de cuenta y catálogo están en entregas locales separadas, sin tocar los worktrees existentes. Se actualizaron los contratos y ejemplos. Riesgo 2 (permisos/propiedad), 4 (orden de escrituras concurrentes).
- **Compilación/configuración:** Angular Admin arranca con su primer viewport exclusivamente de fotos (etapa de reproducción, no interfaz terminada). Asignación y medida de Impeccable: tres comps, 108 regiones y ocho placas. La comparación de una placa falló porque un checkbox autoajustado tapaba 61% de la región de la prenda; medir su caja real recuperó la foto de referencia y el gate de placas aprobó 8/8 sin override. Ocho derivados WebP para demo pesan 24.604 bytes en conjunto; los originales sintéticos no son inventario ni se cargan en el bundle.
- **HTTP:** se observó 202 al pedir recuperación, recorrido por la cola local y Mailpit, 204 al usar el token y 422 al repetirlo. El servidor de preview local no es prueba de interacción. No se usó correo externo.
- **Automatización:** suite en MySQL aislado antes del carrito/auditoría: 33 pruebas / 417 aserciones. Cuenta y catálogo: verificador independiente 7/154; login/me/logout coincidió con el baseline en estado y cuerpo. Medios: verificador independiente 7/82 y compatibilidad anterior 1/4; las pruebas de regresión añadidas pasaron 5/63 en SQLite. La validación de sintaxis OpenAPI pasó tras corregir el tipo de contenido multipart. No hubo pruebas MySQL de contención reales de clasificación/galería.
- **Visual:** la comp y placas se revisaron visualmente. Computer Use no pudo confirmar la URL de Brave en Windows y detuvo el control del navegador; no se ejecutó captura del hero, navegación, teclado ni pruebas visuales del producto. Mantener el gate en `hero`.
- **Revisiones y hooks:** el cierre de la corrección anterior sigue confirmado. En nuevas entregas, la evaluación nativa no admitió el inventario no rastreado cambiante durante las escrituras paralelas; no se repitió el mismo intento ni se inventó aprobación. Separar el próximo candidato inmutable del inventario de trabajo y confirmar su alcance antes de pedir consentimiento. Engram requiere un SessionStart real desde el workspace (el host siguió sin registrar esta sesión).
- **En curso:** carrito, pedido/reserva, precio/stock auditado y backend Docker aislado. Todavía no hay Checkout Pro, tienda SSR, importaciones ni entrega de producción. No se accedió a Camba anterior en ejecución.

### 2026-11-18 — Compra, operación y ensayo de entrega

- **Implementación integrada:** Checkout/reserva `9118f67`, Checkout Pro y reconciliación `0a35491`, preparación de pedidos `c0c7211`, importaciones `539d8f8`, comunicaciones `f78f4a2` / `dfa1e38`, configuración `3069dd0`, planificador legacy `9d7e52e`. El guard API devolvía 500 al faltar `Accept` por intentar una ruta `login` inexistente; `cb74743` lo corrigió en la configuración compartida y añadió regresión.
- **Compilación:** Node 24.20.0; pin de Angular 22.2.6 para el grupo framework y 22.2.7 para SSR/CLI resolvió un conflicto de pares tras generar la tienda SSR. Compilaron en host y Docker: admin CSR **202,42 kB** iniciales / **55,76 kB** estimados de transferencia, store SSR **229,41 kB** de cliente / **63,98 kB** estimados. Son shells/placas, no presupuestos de la tienda terminada. PHP compiló y levantó imagen con GD, EXIF, ZIP, Redis y PDO MySQL.
- **Automatización:** suite integrada en MySQL aislado **89 pruebas / 1.169 aserciones** antes de incorporar el staging legacy. Carrito: verificador real HTTP (67 checks) y paralelismo MySQL (44 checks). Pedido: procesos separados, última unidad 201/422 y mismo idempotency key 201/200, una reserva en ambos. Pagos: verificador SQLite 7/115 y 27 checks concurrentes MySQL sin contacto externo. Avisos: verificador SQLite 7/66 y 20 checks de claims paralelos MySQL, sin doble envío incluso con estado incierto; SMTP real no probado. Catálogo: lista de portadas en una consulta, detalle conserva galería.
- **Docker:** entorno producción aislado con 14 migraciones únicamente vía tarea de release, servicios saludables y reinicio sin semillas. Restauración MySQL de prueba: 31 tablas en origen y destino y el mismo marcador SHA-256. No se restauraron medios o Redis. El ensayo de dev detectó un 500 por directorios de storage ausentes en volumen nuevo; tras crearlos en el comando de arranque, el mismo volumen recuperó salud. En SSR dev un 400 posterior detectó una allowlist ausente; se agregó `NG_ALLOWED_HOSTS` limitado a loopback y checks HTTP explícitos, con el resultado final de esa prueba registrado aparte.
- **CI/CD:** `actionlint` 1.7.11, selectividad de tienda/admin/API, docs-only, cambio compartido y 60 estados del gate. Ensayo del ejecutor con Docker simulado comprobó publicación no ejecutada, selección de servicios, bloqueo, orden monotónico y rollback de imágenes sin DDL inverso. `CAMBA_RELEASE_ENABLED` es opt-in; no se cambió el valor remoto ni se ejecutó GitHub Actions.
- **Visual y revisión:** Impeccable está en `hero`; ni capturas del navegador del producto ni flujo funcional UI. La revisión posterior de cuenta tiene candidato limpio preparado, independiente del sucesor de identidad ya aprobado: `camba-v2-review-account-a7f9064d`, `40218ec..f1d1b8a`, intención `fresh_target_ready`. No se transfirió consentimiento anterior. El host no volvió a confirmar la sesión para Engram; este registro local es el respaldo.

### 2026-11-18 — Reensayos independientes y cierre de checkpoint

- **Compose final:** `92101f7`. El entorno aislado de dev pasó `up --wait` con salud HTTP explícita y recibió 200 en ambas raíces y sus proxies relativos a `/api/v1/products`. El entorno tipo producción sirvió 200 para las aplicaciones y activos JS sin publicar puertos. Los reinicios conservaron datos sintéticos y no sembraron usuarios, pedidos ni catálogo. Excluir `public/storage` resolvió un error de tar también en la misma carpeta Windows previamente usada por el dev server. La comprobación de imagen API final incluye ZIP/GD/EXIF/Redis/MySQL, sintaxis Nginx y los archivos de idioma.
- **Migración:** staging con guard de base dedicada, checksum del mapeo, revisión y preservación de SKU/slug. El verificador MySQL terminó abruptamente antes de la segunda galería, y otro proceso retomó: dos recibos, tres filas de galería y seis derivados; un nuevo reintento conservó hashes. Los 301 están en el manifiesto de propuesta, no se activaron. Una interrupción entre escritura físicamente confirmada y commit de la fila puede dejar derivados huérfanos; reconciliar el medio de staging con la base. No se usaron datos legacy reales.
- **Importaciones:** verificador independiente 7/112 (SQLite) y 26 checks de contención real en MySQL. Doble ejecución aplicó una vez, un stock incluido modificado no fue pisado, stock omitido se conservó y un SKU nuevo concurrente ganó una sola vez. No hubo reproducción de interacción de navegador.
- **Correo:** pedido y reserva sintéticos confirmados en MySQL; el comando proyectó el aviso y un worker real lo marcó enviado. Mailpit mostró el mensaje exacto al consultar después (el sondeo inmediato había devuelto cero); no confundirlo con una prueba de SMTP externo ni con un reenvío real de ese pedido. Deduplicación: suite y carreras de transportes sintéticos por separado.
- **Release y textos:** ensayo concurrente del lock con dos releases dejó ambas versiones registradas sin perder la primera. Se localizaron mensajes/atributos y correos al español y se verificaron con pruebas de checkout, acceso y transporte array. Los entornos de verificación eran descartables; las instancias de cart/pagos usadas por los verificadores se retiraron y se mantuvo el Compose de desarrollo. La política no permitió borrar los directorios temporales; no se repitió esa operación ni se borró ningún worktree.
- **Suite final:** 98 pruebas / 1.257 aserciones con MySQL aislado y dos suites que intencionalmente usan SQLite en memoria. El primer combinado detectó que la prueba de staging heredaba `camba_v2_test` y el guard la rechazaba; se corrigió la configuración de esa prueba, no el guard del comando. Pint, sintaxis OpenAPI, Compose y actionlint pasaron. Queda pendiente prueba UI/visual y validaciones externas, no declaradas aprobadas.

### Cierre de la revisión de cuenta y permisos

- El usuario eligió revisar el candidato `40218ec..f1d1b8a`. Los cuatro revisores se admitieron y Gentle AI devolvió `approved`; la operación de acuse exacta consumió la autoridad del linaje `review-db3a94b09493df63`. No hubo corrección obligatoria. La aprobación no cubre otros commits ni autoriza despliegue.
- Como trabajo separado, OpenAPI ahora rechaza los campos protegidos de perfil y las direcciones en blanco como lo hace Laravel, y documenta las respuestas de direcciones. Una regresión comprueba que un administrador ya asignado, pero con correo sin verificar, recibe 403. La creación de direcciones sigue sin ser idempotente; tras un timeout, refrescar la lista antes de reenviar.
- Verificación: 13 pruebas / 154 aserciones de cuenta y acceso en SQLite; suite completa 98 / 1.258 en MySQL aislado con los casos SQLite ya documentados. Pasaron Pint de la prueba modificada y sintaxis OpenAPI. No hubo un nuevo recorrido visual ni despliegue.

## Dependencias externas que deben resolverse para una entrega productiva

- **Mercado Pago:** aplicación Checkout Pro Uruguay, `CAMBA_MP_ACCESS_TOKEN`, `CAMBA_MP_COLLECTOR_ID`, `CAMBA_MP_WEBHOOK_SECRET`, modo de prueba, comprador de prueba y endpoint público TLS. Verificar URL/preferencia/reintento, firma recibida y recuperación sin webhook antes de habilitar cobros.
- **Correo:** `MAIL_HOST`, puerto, TLS, autenticación y remitente autorizado según el proveedor. Subir la clave solo por canal de secretos y verificar entrega real, reintento/estado incierto y dominio del remitente.
- **Producción por CI/CD:** DNS y dominios v2 reales, red existente del edge y política de proxy confiable; bootstrap de la cuenta de release y pull GHCR. Entorno protegido `camba-production` con `CAMBA_DEPLOY_TARGET`, `CAMBA_DEPLOY_KEY`, `CAMBA_DEPLOY_KNOWN_HOSTS`, configuración estable de APP_KEY/MySQL y habilitación deliberada `CAMBA_RELEASE_ENABLED` solo tras aceptación. Ver [RELEASE.md](RELEASE.md).
- **Migración/negocio:** export aislado del catálogo y fotos con mapeo y conciliación aprobados, export histórico autorizado de cuentas/pedidos/pagos si corresponde, y datos reales de segundo entorno para retiro/entrega. No leer ni alterar el legado activo.

Estas dependencias no bloquean construir y probar las partes independientes en un entorno aislado. No dar por realizado el despliegue ni el cobro de prueba mientras falte evidencia.
