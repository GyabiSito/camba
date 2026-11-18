# Progreso de Camba v2

## Estado inicial

18/11/2026: se prepararon las instrucciones para Codex local después de revisar referencias remotas de GAM y Voltio. Se confirmó que el repositorio nuevo estaba vacío. Komorebi todavía requiere lectura de su checkout local.

No hay aplicación implementada, dependencias instaladas, contenedores de Camba v2 ejecutados, pruebas de aplicación aprobadas ni despliegue de producción realizado por este arranque.

## Etapas

| Etapa | Estado | Evidencia |
| --- | --- | --- |
| Encargo e instrucciones | Preparado | AGENTS.md, IMPLEMENTATION_BRIEF.md, REFERENCES.md |
| P0 — referencias locales, plugins y decisiones | Referencias revisadas; comp de admin elegida y placas aprobadas por Impeccable | PRODUCT.md; [evidencia local](REFERENCES.md#local-source-review--2026-11-18); falta captura del hero |
| P1 — monorepo, Docker dev, CI base y acceso | API y pantallas integradas | Sesiones de comprador y administrador en Chromium; [arranque aislado](DEVELOPMENT.md) |
| P2 — catálogo/admin/carga masiva | Interfaz y recorridos locales | Galerías, SKU, auditoría, lote por fotos e importaciones CSV/XLSX ejecutadas por el worker desde Chromium |
| P3 — pedidos/pagos/webhook/conciliación | UI, backend y simulación verificados | Checkout idempotente en Chromium y contención MySQL; falta Checkout Pro con credenciales de prueba |
| P4 — notificaciones/recordatorios | Preferencias y avisos conectados | Mailpit local y transporte sintético; SMTP real pendiente |
| P5 — tienda y diseño | Aplicaciones conectadas y capturas revisadas | SSR público, compra/cuenta y admin a 1586 y 320 px; validación formal de Impeccable y accesibilidad integral pendientes |
| P6 — rendimiento/seguridad/integración | Parcial | Derivados WebP, portadas sin N+1, builds y Lighthouse medidos; objetivo LCP móvil no alcanzado en laboratorio |
| P7 — imágenes y despliegue selectivo CI/CD | Imágenes locales y flujo preparado | Chromium configurado en CI; no se ejecutaron Actions, publicación, SSH ni despliegue reales |
| P8 — ensayo de migración y entrega | Staging sintético probado | Faltan copia real aislada, validación histórica, redirecciones y corte |

## Próximo paso

Retomar `feat/camba-v2` con [el log de tareas](../odd/tasks/camba-v2.md). Ejecutar `npm run test:e2e` desde `web/` con los [requisitos de la fixture aislada](DEVELOPMENT.md#browser-checks-and-captures). La [sección 8 actualizada](AUTONOMOUS_EXECUTION.md#8-continuar-el-frontend-cuando-falla-el-acceso-al-navegador) ya no condiciona la implementación al hero; el estado de Impeccable en `hero` no certifica ni bloquea los recorridos que pasan en Chromium.

Retomar la verificación con las capturas de `web/test-results/`: evaluar con lector de pantalla, comparar TTFB/compresión y medir de nuevo LCP con el edge y catálogo de staging. Ejecutar los ejercicios de Mercado Pago, SMTP y migración cuando estén disponibles las dependencias de abajo. No se habilitó el release ni se modifica Camba anterior.

## Acceptance matrix

**Partial** means only the stated slice and evidence exist; it is not acceptance. The expected outcomes are in [AUTONOMOUS_EXECUTION.md](AUTONOMOUS_EXECUTION.md#6-matriz-de-cobertura-obligatoria).

| ID | Status and evidence | Remaining acceptance |
| --- | --- | --- |
| UC01 | Local: registration form and persistence in Chromium; PHPUnit proves normalization and no role escalation | External mail verification belongs to UC02 |
| UC02 | Partial: signed link and expiry in API; Chromium unverified, resend and recheck states | Successful browser transition from a delivered link; external delivery |
| UC03 | Local: login, session on browser reload, logout and CSRF guard; independent ownership probes | Browser exercise of natural session expiry |
| UC04 | Partial: loopback HTTP → worker → Mailpit → successful reset; Chromium request, reset form, URL-fragment cleanup and invalid token | Successful browser reset from delivered link; external delivery |
| UC05 | Local: owner-scoped profile and address CRUD; Chromium saves, reloads, edits and deletes | — |
| UC06 | Partial: Chromium add/update/checkout and independent HTTP/MySQL contention; guest ownership notice | Browser test of cart merge on login and simultaneous tabs |
| UC07 | Local: CLI provisioning and buyer/unverified-admin denial in API; verified admin login and buyer denial in Chromium | — |
| UC08 | Partial: live SSR catalog, category/brand filters, search, sorting, empty and out-of-range recovery in Chromium | Forward/back over multiple seeded pages |
| UC09 | Local: SSR title, absolute canonical, HTTP 404, HTTP 503 on isolated API outage, real gallery with keyboard in Chromium | Commercial photo assets |
| UC10 | Partial: flat categories and in-use deactivation conflict in Chromium | MySQL contention proof for classification |
| UC11 | Partial: optional brands and deactivation guard in API; wired admin views | Separate positive browser journey and contention proof |
| UC12 | Partial: Chromium draft, publish and archive, persistent SKU in API | Concurrent lifecycle proof |
| UC13 | Local: sales price to exact cents, stock and persisted audit shown in Chromium | — |
| UC14 | Partial: browser multi-upload, cover change, publish guard and media decoding; API rollback/EXIF checks | Concurrent browser gallery writes |
| UC15 | Local: grouped photo input creates draft; simulated upload response failure then retry uses same draft; publication explicit | Reconcile uncertain operations from the saved catalog before retry |
| UC16 | Local: CSV template and invalid-row preview, XLSX upload/preview/confirmation and worker completion in Chromium | — |
| UC17 | Local: confirm, durable worker completion, reload and same-file dedupe in Chromium; independent MySQL races | — |
| UC18 | Partial: guest quote and pickup checkout in Chromium; delivery quote verified by API | In-person verification of real pickup address/rates; full browser delivery |
| UC19 | Local: browser drops committed response and safely retries identical key/reference; real MySQL last-unit and retry races | — |
| UC20 | Partial: preferences and owner restart/resume in `79045bb` / `0a35491`; fake provider | Actual Checkout Pro test account redirect and retry |
| UC21 | Partial: signed durable inbox 200 before async processing; independent fake provider tests | Public TLS webhook and actual provider delivery/retry |
| UC22 | Partial: minute scheduler and absent-webhook reconciliation observed against fakes | Real test-account consistency and closed-browser hosted exercise |
| UC23 | Partial: duplicate/stale/late-payment logic; independent MySQL contention 27 checks with fake evidence | Live test-account fixture cases and inbox crash recovery test |
| UC24 | Partial: encrypted owned snapshots and guest TTL; browser history and spoofed return do not change authoritative payment | Actual sandbox provider return |
| UC25 | Local: authorization and operations API; Chromium real preparation and note persistence, shipping/pickup/control states exercised with mocked failure paths | Operational walkthrough with staged shipment/pickup |
| UC26 | Partial: durable transactional notices and real local SMTP worker receipt in Mailpit; contention with synthetic transport | Production SMTP proof and customer flow |
| UC27 | Partial: Chromium persists verified buyer opt-ins; backend state/dedup tests | Live mail and external scheduling |
| UC28 | Local: deduped admin inbox, protected linked order and Chromium state/filter handling | Real incident walkthrough |
| UC29 | Partial: Chromium PATCH settings, public read and audit history | Live business configuration |
| UC30 | Partial: dry-run `9d7e52e` and isolated apply `0ef28f0`; SQLite and independent MySQL interrupted-gallery replay | Actual isolated export/photos, accounts/history, redirections and cutover |
| T01 | Partial: comp-first tokens in both apps; real desktop/mobile captures and browser journeys | Record formal Impeccable phase separately; no approval inferred |
| T02 | Partial: Chromium at 320 px and 1586 px, overflow checks, focus/skip and gallery by keyboard, Lighthouse home | Screen reader, full contrast/reduced-motion review and cross-browser check |
| T03 | Partial: SSR, hydrated interactions, HTTP 404, WebP/list queries and reproducible Lighthouse lab | Mobile LCP budget, real-user INP and production media validation |
| T04 | Partial: full dev and production-style stacks healthy in isolation; dev roots/proxies 200, no prod-style published ports | Real edge/TLS and protected hosting configuration |
| T05 | Partial: CI scope and 60 gate cases, image builds and simulated release; Chromium added without publishing on E2E-only changes | Actual GitHub run, registry pull/push and protected production delivery |
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

### 2026-11-18 — Frontend integrado y revisión con Chromium

- **Implementación:** instrucciones `a9e414d` incorporadas en `8de98df`, sin reemplazar este archivo. API administrativa `885d4c2`; cliente y diseño compartidos `322f65d`; tienda SSR/compra `75fccdf`; administración `5655822`; Chromium aislado y CI `4bf2775`. Se conservaron las comps y los worktrees previos.
- **Compilación y Docker:** store SSR **320,21 kB** iniciales / **88,94 kB** estimados de transferencia; admin CSR **342,14 kB** / **88,61 kB** en el build final de Docker. Compilaron las tres imágenes; se verificó `/healthz` de ambos frontends y extensiones PHP/sintaxis Nginx de la API. Ambos Compose renderizaron sin aplicarse.
- **HTTP:** SSR compilado devolvió 200 con canonical absoluto y WebP; producto inexistente 404; API aislada detenida devolvió 503 con estado visible. Una miniatura recién subida dio 404 en Windows: se guardaba en el storage por defecto porque la SAPI HTTP no rellenaba las superglobales que Laravel usa para localizar el storage. La fixture ahora inyecta el mismo directorio temporal para lectura y escritura; Chromium comprueba 200, `image/webp` y decodificación. No fue una falla de producción.
- **Automatización:** `CAMBA_E2E_CAPTURE=1 npm run test:e2e` (variable equivalente en PowerShell) pasó **17/17** con Chromium y Laravel/SQLite/worker aislados. Incluye importación CSV real hasta su aplicación, galería, dos roles de ingreso, registro, recuperación rechazada, carrito/checkout, caída de respuesta con mismo pedido, preparación y auditoría. Algunos estados de error usan interceptación; Mercado Pago quedó deshabilitado. Independiente: **99 pruebas / 1.284 aserciones** PHPUnit SQLite, **1/16** de accesos administrativos en copia aislada, Pint y sintaxis OpenAPI. `actionlint` 1.7.11, alcance CI y 60 combinaciones del gate pasaron. El ensayo de release Linux/Docker simuló publicación/rollback; Git Bash local no tiene `flock`. No se ejecutaron Actions ni despliegue real.
- **Revisión visual:** `web/test-results/` conserva PNG del catálogo/admin y home a 1586×992, detalle/320 px y otras vistas de compra/configuración. Se inspeccionaron capturas reales, se corrigieron desborde de precio y superposición entre enlace y selector, y se comprobó foco/teclado. Impeccable ejecutó detector manual: seis avisos de `src` en plantillas Angular con binding; el detector no certifica el estado de ejecución. `hooks on` dejó la configuración habilitada, pero no encontró una instalación de skill del proveedor para reparar el manifiesto de Codex; no se acreditó dispatch automático. El estado del hero sigue sin aprobación formal.
- **Rendimiento:** [prueba reproducible](DEVELOPMENT.md#reproduce-the-mobile-storefront-audit), Lighthouse 13.6.0 en SSR compilado: **92 rendimiento / 100 accesibilidad / 100 SEO**, **LCP 3,4 s** (objetivo 2,5 s no alcanzado), **CLS 0**, **TBT 60 ms**. Hero sintético **2.980 bytes**. La primera medición sobre Vite no representa producción; inyectaba cliente dev y mapas. Sin INP de campo ni catálogo/edge de producción.
- **Revisión nativa:** no se reabrió la revisión de cuenta. `885d4c2` fue evaluado `high_risk` y se obtuvo `fresh_target_ready` en el worktree separado `camba-v2-review-operations-885d4c2`; falta consentimiento propio y no hay aprobación. El host no confirmó una sesión Engram del proyecto; este registro local conserva los resultados.

### 2026-11-18 — Acuse de operaciones y prueba XLSX

- El usuario eligió revisar `885d4c2`. Las tres perspectivas se admitieron y `review-c76ecd4198a246da` devolvió `approved`; el acuse exacto devolvió `authority: burned`. Quedaron dos avisos no bloqueantes, sin transición de corrección. No se reabrió la revisión de cuentas ni se extendió la aprobación a otros commits.
- Seguimiento independiente `aeb13aa`, sin modificar el comportamiento de la API: OpenAPI distingue la hora de actualización del proveedor de la hora de conciliación local. PHPUnit comprueba que `payment.attempt` existe con valor `null` y `payment.observations` es `[]` antes del primer pago. Pasaron **100 pruebas / 1.297 aserciones** en SQLite, Pint de lo modificado y OpenAPI 3.1 sin incidencias de sintaxis.
- Chromium `ae7a569`: el escenario de importación carga una planilla XLSX sintética, presenta el SKU en la vista previa, exige confirmación explícita y muestra el resultado aplicado por el worker. También reejecuta la importación CSV y su deduplicación. Regresión integrada **17/17**, con el mismo Laravel/SQLite/worker aislado. No se usaron archivos comerciales ni servicios externos.

## Dependencias externas que deben resolverse para una entrega productiva

- **Mercado Pago:** aplicación Checkout Pro Uruguay, `CAMBA_MP_ACCESS_TOKEN`, `CAMBA_MP_COLLECTOR_ID`, `CAMBA_MP_WEBHOOK_SECRET`, modo de prueba, comprador de prueba y endpoint público TLS. Verificar URL/preferencia/reintento, firma recibida y recuperación sin webhook antes de habilitar cobros.
- **Correo:** `MAIL_HOST`, puerto, TLS, autenticación y remitente autorizado según el proveedor. Subir la clave solo por canal de secretos y verificar entrega real, reintento/estado incierto y dominio del remitente.
- **Producción por CI/CD:** DNS y dominios v2 reales, red existente del edge y política de proxy confiable; bootstrap de la cuenta de release y pull GHCR. Entorno protegido `camba-production` con `CAMBA_DEPLOY_TARGET`, `CAMBA_DEPLOY_KEY`, `CAMBA_DEPLOY_KNOWN_HOSTS`, configuración estable de APP_KEY/MySQL y habilitación deliberada `CAMBA_RELEASE_ENABLED` solo tras aceptación. Ver [RELEASE.md](RELEASE.md).
- **Migración/negocio:** export aislado del catálogo y fotos con mapeo y conciliación aprobados, export histórico autorizado de cuentas/pedidos/pagos si corresponde, y datos reales de segundo entorno para retiro/entrega. No leer ni alterar el legado activo.

Estas dependencias no bloquean construir y probar las partes independientes en un entorno aislado. No dar por realizado el despliegue ni el cobro de prueba mientras falte evidencia.
