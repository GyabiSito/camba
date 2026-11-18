# Progreso de Camba v2

## Estado inicial

18/11/2026: se prepararon las instrucciones para Codex local después de revisar referencias remotas de GAM y Voltio. Se confirmó que el repositorio nuevo estaba vacío. Komorebi todavía requiere lectura de su checkout local.

No hay aplicación implementada, dependencias instaladas, contenedores de Camba v2 ejecutados, pruebas de aplicación aprobadas ni despliegue de producción realizado por este arranque.

## Etapas

| Etapa | Estado | Evidencia |
| --- | --- | --- |
| Encargo e instrucciones | Preparado | AGENTS.md, IMPLEMENTATION_BRIEF.md, REFERENCES.md |
| P0 — referencias locales, plugins y decisiones | Referencias revisadas; dirección visual pendiente | PRODUCT.md; Impeccable comp-first; [evidencia local](REFERENCES.md#local-source-review--2026-11-18) |
| P1 — monorepo, Docker dev, CI base y acceso | En curso | [API](../api/README.md): Laravel y acceso de comprador verificados localmente |
| P2 — catálogo/admin/carga masiva | Pendiente | — |
| P3 — pedidos/pagos/webhook/conciliación | Pendiente | — |
| P4 — notificaciones/recordatorios | Pendiente | — |
| P5 — tienda y diseño completo | Pendiente | — |
| P6 — rendimiento/seguridad/integración | Pendiente | — |
| P7 — imágenes y despliegue selectivo CI/CD | Pendiente | — |
| P8 — ensayo de migración y entrega | Pendiente | — |

## Próximo paso

Continue P1 on `feat/camba-v2` from [the task log](../odd/tasks/camba-v2.md): finish the native review decision for the API candidate and proceed with T2b (Angular workspace, isolated dev services, CI). Use Impeccable comp-first for the first UI. Do not start or change the previous installation.

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

- Local commits: `0308b42` records product/root references; the following work-unit commit contains `api/` and this checkpoint. PHP 8.4.3, Laravel 13.43.0 and Sanctum 4.5.0. Implemented buyer-only registration, normalized email, auth throttling, signed expiring verification and cookie login/session/logout. No default admin or seeded login. Mail delivery itself has not been confirmed; notification is queued and tests use a fake or local array transport.
- PHP checks: `composer validate --strict --no-check-publish` and Pint passed. `php vendor/bin/phpunit` on an isolated MySQL 8.0.30 instance: 7 passed, 44 assertions. No Redis or Docker check; the Docker engine was unavailable. No frontend build.
- HTTP: loopback `/up` returned 200 with a passing Postman assertion; cookie smoke observed 419 without CSRF, then 201 registration, 204 login, 200 session, 204 logout, 401 after logout. `postman spec lint openapi.yaml --issueType syntax --no-report-events` found no issues.
- Independent verification: isolated source copy, PHPUnit/Pint/Composer passed; missing CSRF returned 419 and left the nine persisted table hashes unchanged. Added an automated CSRF regression to the final suite. Native review decision not yet recorded.
- No browser automation, visual review, real mail, payment provider or production proof. Password recovery, admin provisioning, Angular workspace, Compose and CI remain pending. No remote repository or production mutation was made.

## Dependencias externas que deben resolverse para una entrega productiva

- Acceso local a la referencia Komorebi.
- Credenciales de prueba/producción de Mercado Pago y correo, sin incluir valores aquí.
- VPS, dominios y reglas concretas del proxy de Camba.
- Registro de imágenes y secretos/entorno de GitHub Actions.
- Copia de catálogo y fotografías para ensayar migración.

Estas dependencias no bloquean construir y probar las partes independientes en un entorno aislado. No dar por realizado el despliegue ni el cobro de prueba mientras falte evidencia.
