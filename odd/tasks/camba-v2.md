# Camba v2

Build the store and admin specified in [the implementation brief](../../docs/IMPLEMENTATION_BRIEF.md). Branch: `feat/camba-v2`; baseline: `0148987`.
Delivery: `auto-chain`, stacked-to-main local work units; no remote delivery. Forecast: over 400 authored lines. Runners as introduced: PHPUnit, Angular, browser flows, Compose.

## Specs

- S1 — “Localizá y revisá Komorebi, GAM, Voltio y Camba anterior.” Record local revisions and distinguish reviewed source from production behavior.
- S2 — “Detectá y utilizá los plugins locales de diseño y optimización.” Use Impeccable comp-first and browser checks for material UI work. Honor the visual acceptance and WCAG constraints in §8 and §12 of the brief.
- S3 — “Implementá Camba v2 completa siguiendo ese encargo.” P1 foundation and identity: executable Laravel 13 and Angular 22 monorepo, isolated development services, CI checks, Sanctum and buyer-only public registration. §4–5 and §9–10.
- S4 — “Implementá Camba v2 completa siguiendo ese encargo.” P2 catalog and administration: flat categories, optional brand, individual/photo/CSV/XLSX entry, publication and archive; no excluded taxonomy or promotions. §2 and §6.
- S5 — “Implementá Camba v2 completa siguiendo ese encargo.” P3–P4 orders, authoritative Checkout Pro payment reconciliation, stock and durable notifications. Test absent webhook, duplicate events and concurrency. §7 and §12.
- S6 — “Implementá Camba v2 completa siguiendo ese encargo.” P5–P8 storefront, responsive browser/quality proof, selective pipeline, migration dry-run and operational handoff. §8–13. “Producción se despliega por CI/CD; no alteres la instalación actual desde desarrollo.”
- S7 — “Mantené PROGRESS.md actualizado con resultados reales, pendientes y el siguiente paso para retomar.” Keep separate local, simulated, provider-test and production evidence.
- S8 — “Continuá hasta completar Camba v2 entera.” Adopt upstream `ef21594`, preserve both worktrees and local notes, apply supported hook/review recovery, and keep all UC01–UC30/T01–T06 evidence in PROGRESS.md.

- S9 — “La captura del hero de Impeccable ya no es una condición para implementar el resto del frontend.” “Configurá pruebas y capturas de la aplicación con Playwright y Chromium.” “Conectá tienda y admin con las APIs existentes.” “Completá productos, galerías, carga masiva, pedidos, configuración, autenticación, carrito, checkout y todos los estados y recorridos del encargo.” “Mantené la dirección visual elegida y terminá el diseño.”
- S10 — “diagnosticá y corregí el LCP móvil y completá todos los pendientes locales de la matriz. No postergues esas tareas por falta de staging.” Preserve closed review scopes; verify the 4c1480e §9 local matrix and supported hook recovery without external services.

- S11 — “Verificá el incremento concurrente del carrito en MySQL/InnoDB.” “Implementá recuperación segura de subidas inciertas, incluso cuando la petición original siga en ejecución. Evitá depender de una comparación manual de fotos.” “Revisá los candidatos de carrito y galería mediante el flujo nativo y corregí los hallazgos que correspondan.” “Completá las verificaciones visuales y de accesibilidad que permitan las capacidades disponibles, sin falsear aprobaciones.”
- S12 — “Después continuá con las integraciones y CI/CD para las que exista configuración autorizada. Agrupá las dependencias realmente ausentes.”

## Tasks

- A1 — S10, Five-run baseline and measured mobile LCP fix; inline `3e1bc12`, independent Docker/HTTP proof and exact native approval acknowledged. Median 3.50 → 2.11 s; real staging/field pending. Risk: item 5 (store runtime dependency).
- A2 — S10, UC02–UC04 delivered links and session expiry; delegated parallel writer `eddbb40`, opt-in fixture; 4/4 Chromium with real Mailpit and 62 s idle. External SMTP pending.
- A3 — S10, UC06/UC08/UC18 cart tabs, catalog pagination and delivery; delegated parallel writer, `89e8224`/`b831b5b`; SQLite Chromium overlapping adds and independently repeated regression, real two-page API and delivery readback. Risk: item 4.
- A4 — S10, UC10–UC15 classification/lifecycle/gallery/uncertainty; delegated parallel writer `25338e2`, bounded UI, committed-500 RED/GREEN and independent Chromium recheck; 23/382 MySQL catalog suite. Risk: item 4; manual gallery reconciliation is not server write idempotency.
- A5 — S10, UC23/T06 inbox crash/replay and local restore; delegated parallel writer `8189773`; isolated MySQL, public/private media, fresh Redis and Mailpit drill exited 0. External payment/SMTP and production restore pending.
- A6 — S10, T02, hook log/repair and acceptance ledger; inline `daaf7c7`/`c0fe7ec`; rendered controls in Chromium and Firefox, visible keyboard focus, alerts, contrast and real inventory at 200% text/320 px. Host workspace/session rebinding and spoken announcements need a supported host/speech surface.
- W1 — S9, Admin catalog, classifications, galleries and imports; delegated parallel writer on admin `catalog/**`; `5655822`, Windows fixture `4bf2775` and XLSX proof `ae7a569`. Local Chromium CRUD, visible uploads and CSV/XLSX jobs pass.
- W2 — S9, Admin orders, fulfilment, notices and settings; delegated parallel writer on admin `operations/**`; `885d4c2` and `5655822`. Independent API gate/privacy and Chromium pass; native API approval acknowledged; real payment sandbox pending. Risk: items 2 and 3.
- W3 — S9, Store browse, search, detail/gallery, public SSR, 404 and 503; delegated parallel writer on store `catalog/**`; `75fccdf`. Screens inspected and real SSR/Chromium pass; A1 covers the later mobile LCP fix.
- W4 — S9, Store auth/account, cart/checkout/purchases/payment return; delegated parallel writer on store `shopper/**`; `75fccdf`. Local buyer/guest flows and retry/fake callback proof pass; A2 covers delivered Mailpit links, with live payment provider pending. Risk: items 2 and 4.
- W5 — S9, Shared shell/HTTP/design, Playwright, fixtures and CI; inline orchestrator-owned seams; `322f65d`, `5655822`, `75fccdf`, `4bf2775`. Integrated 17/17; builds, screenshots, actionlint, Compose render and local simulated release pass. Hosted CI/production and complete accessibility review pending. Risk: item 5.

- T1 / S1, S7 — delegated read-only reference map (four distinct local checkouts); verified in `0308b42`; native assessment `passive`.
- T2a / S3, S7, S8 — native successor approved and acknowledged `a6b2af6` in its original worktree; integrated as `e675301`. UC04 backend in `a121d43` / `8ac57fb`; local proof observed. Risk: item 2 (identity and credential reset).
- T2b / S3, S7 — inline isolated Compose dependencies, Angular workspace and baseline CI in `40218ec`; local configuration/required gate/runner proofs, remote CI and app builds pending. Risk: item 5 (dependency and CI setup).
- T2c / S2, S3, S7 — design direction in progress under Impeccable; store/admin applications and browser checks pending.
- T2d / S3, S7 — UC05 profile/address API, delegated in parallel with T3a; integrated `f1d1b8a`; browser pending. Risk: item 2 (owner isolation).
- T2e / S3, S7 — UC07 administrator provisioning and server guard; inline, integrated `f1d1b8a`; browser pending. Risk: item 2 (permissions).
- T3a / S4, S7 — delegated catalog and flat taxonomy API/lifecycle alongside T2d; integrated `d2216a1`; UI and actual write contention pending. Risk: items 2 and 4.
- T3b / S4, S7 — inline UC14 gallery upload, derivatives and cover order; `706cade`; live storage/visual/contended MySQL pending. Risk: items 2 and 4.
- T3d / S4, S7 — inline UC13 auditable price and stock updates; RED 404 on history, implementation in progress. Risk: item 4 (audit and price/stock in same transaction).
- T3e / S4, S7, S8 — delegated UC16/UC17 CSV/XLSX preview and resumable execution; parallel with order/infra work on disjoint import routes, job and ledger. Risk: items 2 and 4 (untrusted files and durable application).
- T3c / S2, S4, S7 — pending audited edits, batch photo/CSV/XLSX imports and administration UI.
- T4 / S5, S7 — pending P3 orders and payments; assign route when scoped.
- T4a / S5, S7, S8 — delegated UC06 persistent guest/account cart and safe login association, parallel with T7a on disjoint backend/infra surfaces. Risk: items 2 and 4 (owner separation and merge/write ordering).
- T4b / S5, S7, S8 — delegated UC18/UC19/UC24 checkout quote, immutable orders and reservations, parallel with T7a on disjoint order/runtime surfaces. Risk: items 2 and 4 (privacy and inventory ordering).
- T4c / S5, S7, S8 — inline Checkout Pro Preferences client and signed payment input validation; independent of the order schema. Risk: items 2 and 3 (payment trust boundary and external contract).
- T4d / S5, S7, S8 — delegated checkout attempts, durable webhook, synchronization and expiration; parallel with import on disjoint payment surfaces. Risk: items 2 and 4 (payment authority and exactly-once stock).
- T4e / S5, S7, S8 — inline UC25 admin fulfilment, shipment/pickup status and private operator notes; no implicit changes to payment state. Risk: items 2 and 4.
- T5 / S5, S7 — pending P4 notifications and reminders; assign route when scoped.
- T5a / S5, S7, S8 — inline UC29 operational settings, public contact and auditable admin edits; no secret editing. Risk: item 2 (configuration access).
- T5b / S5, S7, S8 — delegated UC26–UC28 durable notifications and reminder preferences; parallel with payments and migration planner, disjoint outbox/commands. Risk: items 2 and 4 (recipients and deduplication).
- T6 / S2, S6, S7 — pending P5–P6 storefront and quality; assign route when scoped.
- T7 / S6, S7 — pending P7 deployment artifacts; assign route when scoped.
- T7a / S6, S7, S8 — delegated isolated backend container and readiness; parallel with T4a. No deployment or legacy changes. Risk: item 5 (runtime environment).
- T7b / S6, S7, S8 — inline release manifest, serialized selective update and rollback; fake-engine rehearsals, no production execution. Risk: item 5 (deployment).
- T7c / S6, S7, S8 — inline Angular build targets and local/production Compose composition. Risk: item 5 (environment and release).
- T8 / S6, S7 — pending P8 migration and operational handoff; assign route when scoped.
- T8a / S6, S7, S8 — delegated legacy catalog dry-run and stock/photo reconciliation from an isolated export; parallel with payment and import on disjoint legacy-planner surfaces. Risk: item 1 if subsequently applying; this unit is read-only.
- T8b / S6, S7, S8 — delegated legacy catalog staging and repeatability rehearsal against disposable data. Risk: items 1 and 2 (migration and file/path integrity).

- A7 — S11, MySQL cart overlap; inline proof `a85e626` using independent guarded processes; MySQL 8.4.13 observed two waiters before each release, 200/200 → 3 and 200/422 → 4, 1/26 in the durable regression. Risk: item 4 (concurrent cart writes under proof, not a runtime change).
- A8 — S11, Durable upload identity and contention; delegated parallel writer (API migration, write and tests independent of UI files); `cada0a7`, RED/GREEN in isolated InnoDB 5/104 and SQLite 16/186; independent conflicting-body, lost postcommit acknowledgement, ordering and FK probes passed. Risk: items 1, 3 and 4 (migration, upload contract and concurrent writes).
- A9 — S11, Retry of the same upload in both admin screens; delegated parallel writer (independent UI and browser evidence); `c80aacf`, final Chromium 6/6 with `06e41c0` and inspected captures. Risk: item 4 (retry and stale responses).
- A10 — S11, Bounded native cart and gallery review and a11y; inline orchestration, independent second-engine verification, and portability fix in `06e41c0`. Firefox admin shell and both pre-forward recovery paths passed; no spoken reader available. Both native assessments are high; separate candidate consents and verdicts pending.
- A11 — S12, Camba-local configuration inventory and CI checks; inline inventory, delegated long image builds. Local API/admin builds, Compose static validation, and actual change selection passed; production services and remote delivery lack authorized configuration.
- A12 — S11/S12, Fail closed during API/admin version skew; inline `06e41c0`; independent runtime/contract/build confirmation, SQLite RED 404 → GREEN 9/110, final InnoDB 2/28 and Chromium 6/6; no legacy fallback. Risk: items 3 and 5 (consumer contract and rolling release compatibility).

## Log

### L1 — Original request

Leé AGENTS.md, docs/IMPLEMENTATION_BRIEF.md,
docs/REFERENCES.md y docs/PROGRESS.md.

Implementá Camba v2 completa siguiendo ese encargo.
Localizá y revisá Komorebi, GAM, Voltio y Camba anterior.
Detectá y utilizá los plugins locales de diseño y optimización.

Empezá por revisar referencias y entorno, y continuá implementando,
probando y corrigiendo por entregas. No te quedes solamente en un plan
ni pidas confirmación por decisiones rutinarias ya autorizadas.

Mantené PROGRESS.md actualizado con resultados reales, pendientes
y el siguiente paso para retomar. Producción se despliega por CI/CD;
no alteres la instalación actual desde desarrollo.

### L2 — 2026-11-18

Podes usar gpt-6.2-sol

The authorized explorer completed the read-only mapping; local evidence is in [REFERENCES.md](../../docs/REFERENCES.md). Engram mirror pending: host-session verification blocked prior memory writes. Review mode is globally enabled; code candidates still require separate consent when due.

T2a observed RED on the initial four identity tests (missing public routes) and on non-first-party registration (201 instead of 400). The real loopback HTTP flow rejected missing CSRF and verified buyer registration, login, session lookup, logout and unauthorized lookup after logout. Postman asserted `/up` returns 200 and linted the OpenAPI syntax successfully. The independent isolated verifier observed CSRF 419 with unchanged persisted table hashes, PHPUnit 6 tests/40 assertions, Pint and Composer validation. The verifier's CSRF invariant was added to PHPUnit: 7 tests/44 assertions passed on isolated MySQL. No real mail, customer data or production systems were used. Password recovery, Redis/Compose/CI and Angular remain pending.

Native preflight initially returned `managed_assets_outdated`; the exact `gentle-ai sync --agent codex` continuation ran and the same immutable committed candidate returned `fresh_target_ready`. The separately configured Impeccable settings remain outside the candidate. The isolated PHP/MySQL processes were stopped and temporary directories removed.

### L3 — Review continuation

1

The user selected the granted invocation for `9b52a15`. It returned `lens_context_budget_exceeded` with `mutation_outcome: not_started`; no reviewer or authority was created. `api/composer.lock` contributes 8,387 generated lines. One non-destructive slicing pass created `review/camba-v2-sliced`: `bec1305` dependency manifest/lock, `25432f3` bootable Laravel foundation, `0b66ee6` buyer-identity changes and tests. `git diff --exit-code 9b52a15 HEAD` passed in that worktree and both final tree IDs are identical (`8ae3fd1d05afc6c567fa5760533b23cd8a39063f`). Cache-only Composer install and the foundation liveness test passed. The 18-file buyer slice is assessed `high_risk` and requires fresh candidate consent. Its review would not approve the generated lock or foundation. `feat/camba-v2` history was not rewritten and nothing was pushed.

### L4 — Narrowed candidate review

1

Four native lenses ran on `0b66ee6`; closure requested one correction for the missing forward role migration and lost verification notification after queue failure. `a6b2af6` adds a non-destructive forward migration and authenticated, throttled resend with honest enqueue status. Both regressions failed before the fix; the final suite passed 9 tests/60 assertions on isolated MySQL (the upgrade test uses in-memory SQLite), plus a separate MySQL forward-upgrade probe preserving the seeded row and a real HTTP resend smoke. Pint, Postman OpenAPI syntax and whitespace passed. Correction was 135 lines under the accepted 185-line plan and 200-line cap.

Native `recover` returned successor `review-6975ad52d814d47e` in `reviewing` with no exact next transition. Replaying the captured predecessor STATUS returned `invalid_request` (already has successor); the exact provider-directed `inspect-authority` confirmed the recovery edge is valid but supplied no sanctioned exit or successor invocation. No validator, approval, receipt or integration is claimed. Scratch HTTP and MySQL were stopped; the bound worktree and correction commit remain unchanged.

### L5 — Autonomous continuation and next units

Continuá hasta completar Camba v2 entera.

Leé las instrucciones actualizadas de origin/main, commit ef21594:
AGENTS.md, docs/AUTONOMOUS_EXECUTION.md y
docs/IMPLEMENTATION_BRIEF.md. Conservá mis cambios locales,
el progreso y los worktrees existentes.

Recuperá e integrá las correcciones pendientes. Diagnosticá y
repará la integración de revisiones y hooks por sus mecanismos
soportados, sin repetir comandos fallidos indefinidamente.

Después continuá automáticamente con todos los casos de uso,
el diseño completo de tienda y admin, optimización, pruebas,
Docker y CI/CD. Usá los plugins locales disponibles.

No me preguntes por decisiones rutinarias: elegí una solución
coherente con el encargo, implementala y verificala. No cierres
el trabajo al terminar una fase o una revisión.

Si falta una credencial externa, completá todo lo independiente
y registrá la dependencia exacta. No inventes resultados ni
declares validaciones que no ejecutaste.

Mantené PROGRESS.md actualizado y seguí trabajando hasta cumplir
toda la matriz de aceptación.

Upstream `ef21594` publishes the full acceptance matrix now tracked in PROGRESS.md. Documented successor STATUS recovered the frozen target; four reviewers approved and acknowledgement consumed its authority. No approval has been transferred to later commits. See PROGRESS.md for isolated Compose/CI/password recovery proof and the current Engram/Impeccable verification limits. Parallel UC05/T3a routes have disjoint allowed edit surfaces and reuse the parent-owned Sanctum and admin gate wiring.

T2d/T2e `f1d1b8a`, T3a `d2216a1`, and T3b `706cade`: account/catalog/gallery are integrated. Primary MySQL tests and independent owner/permission/file-rollback probes are listed in PROGRESS. For the next native account candidate the active workspace continued to change its allowed untracked inventory; a **new detached clean worktree**, not either original worktree, returned native `fresh_target_ready` on `40218ec..f1d1b8a`. Worktree `camba-v2-review-account-a7f9064d`, target `sha256:9e760f03dedc06898fa298b73a41b3b02a5bf254204a5c575e8ddf09d61d1477`. No fresh consent or approval recorded.

T3d `8fee1c4` records admin price/stock audit. T3e `539d8f8` includes CSV/XLSX ledger, explicit confirmation and durable reapplication; ZIP capability packaged. T4a `4fd6c80` / `88e3060`, T4b `9118f67`, T4c `79045bb`, T4d `0a35491`, and T4e `c0c7211` are integrated, with separate real MySQL contention proofs for carts, reservation and payment evidence (provider strictly faked). T5a `3069dd0` and T5b `f78f4a2` / `dfa1e38` implement store settings, protected preferences and durable notices. Independent parallel claims passed but real SMTP remains untested.

T2c was stopped in the browser by host policy (current Windows URL could not be verified). Comp-first plates passed 8/8 after correcting a measurement box mislabeled as a checkbox; semantic interface was not started past the hero gate. Angular SSR/CSR runtimes were separately built in `8ec6a83` and are not a substitute for completed UI. T7a `c626369` backend, T7b `7f4d1a1` / `93883dd` release engine and T7c `92101f7` full environment were locally checked. Production-style and dev HTTP evidence is in PROGRESS, not an actual release.

T8a `9d7e52e` dry-run and T8b `0ef28f0` staging were independently exercised, including a real MySQL interrupted-gallery retry with synthetic data. The two legacy production-data and redirect decisions still depend on the owner-approved isolated export and browser cutover. Final integrated PHPUnit: 98 tests / 1,257 assertions. The acceptance matrix remains partial; checkpoint is for work not yet possible with this browser/session and external environments, not a declaration of completion.

### L6 — Account review consent

1

The user granted the bound `f1d1b8a` review. Four native captures were admitted; provider approved without a correction transition and the exact acknowledgement burned authority in `review-db3a94b09493df63`. Scope is unchanged. Follow-up clarified the OpenAPI account request and response contract, added the already-admin/unverified-email regression, and documented that repeated address POSTs can duplicate a record. Scoped suite 13/154 (SQLite); integrated suite 98/1,258 (MySQL with explicitly isolated SQLite cases); Pint and OpenAPI syntax passed. No shipping or publish action.

### L7 — Frontend continuity and isolated Chromium

Retomá feat/camba-v2 desde su estado actual, último commit
reportado c429f10. Conservá todo el trabajo y progreso local.

Leé las instrucciones actualizadas de origin/main, commit a9e414d,
especialmente AGENTS.md y la sección 8 de
docs/AUTONOMOUS_EXECUTION.md. No sobrescribas PROGRESS.md local.

La captura del hero de Impeccable ya no es una condición para
implementar el resto del frontend.

Configurá pruebas y capturas de la aplicación con Playwright y
Chromium. Si tampoco pueden ejecutarse, dejá esa verificación
pendiente y continuá implementando las interfaces completas.

Conectá tienda y admin con las APIs existentes. Completá productos,
galerías, carga masiva, pedidos, configuración, autenticación,
carrito, checkout y todos los estados y recorridos del encargo.
Mantené la dirección visual elegida y terminá el diseño.

No reabras por defecto la revisión de cuentas ya cerrada ni
repitas trabajo integrado. Corregí problemas reales y seguí con
el siguiente caso de uso sin preguntarme.

No cierres la tanda por falta de navegador mientras queden tareas
de implementación, diseño, integración o pruebas ejecutables.
No declares aprobada una validación que no se haya realizado.

Applied the instruction-only update from `a9e414d` as `8de98df`; local progress history and prior worktrees were preserved. W1–W4 worked in disjoint places; W5 owns shared seams, browser fixture and checks. Native account approval was not reopened. The operations API addition `885d4c2` is a separate 145-line, high-risk scope with independent verification and a clean native preflight; no review verdict for it. Engram's host did not register a valid workspace session, so this task file is the durable record, with the mirror pending.

Final isolated browser run passed 17/17 after fixing PHP's HTTP storage path and a 320 px layout overlap. Raw fixture thumbnail changed from HTTP 404 to a decoded WebP at 200. Dedicated login test users avoid colliding with the real five-per-minute account limiter. Separate compiled SSR wrapper verified 200/canonical and 503 on fixture shutdown. Lighthouse 13.6.0: 92/100/100, LCP 3.4 s (not at 2.5 s target), CLS 0, TBT 60 ms. See PROGRESS for builds, exact check types, real external dependencies and full acceptance limits. No push/deploy. Store and admin route seams and their browser scenarios form coherent app-level commits above the 400-line planning heuristic; publishing slices were not requested.

### L8 — Operations API review consent

1

Provider admitted all three perspectives for `885d4c2` and returned final `approved`; exact acknowledgement consumed authority in `review-c76ecd4198a246da`. Two informational observations were addressed separately in `aeb13aa` (provider vs local reconciliation timestamps, and explicit empty payment evidence). No source runtime changes, account review reopening, or deployment. PHPUnit SQLite 100/1,297; scoped Pint and OpenAPI syntax passed. Browser regression 17/17 after `ae7a569`, including the real fixture queue applying CSV and XLSX in the same scenario.

### L9 — Section 9 local acceptance

Continuá feat/camba-v2 desde su HEAD actual, posterior a 051939b.

Incorporá las instrucciones de origin/main, commit 4c1480e,
conservando el código, PROGRESS.md y los registros locales.

Aplicá la sección 9 de docs/AUTONOMOUS_EXECUTION.md:
diagnosticá y corregí el LCP móvil y completá todos los pendientes
locales de la matriz. No postergues esas tareas por falta de staging.

Conservá el alcance de las revisiones cerradas.
Identificá el hook que falla mediante su log y reparalo por
mecanismos soportados.

Seguí automáticamente hasta agotar el trabajo ejecutable.
Dejá pendientes únicamente las validaciones que realmente
requieran servicios, datos o capacidades no disponibles.

Local HEAD resolved to `051939b`; adopted only upstream instruction changes as `d03db84`, with no overwrite of PROGRESS or the completed review worktrees. Baseline and encoding each saved five Lighthouse JSON/trace/network sets. The same eager hero was the LCP element; negotiation cut total transfer 406,637 → 161,260 B, median LCP 3,499.7 → 2,109.0 ms. HTTP and independent image smoke pass. A2 and A5 ran and passed on separate synthetic services; details are in PROGRESS and linked runbooks.

A3 fixed a real lost update: two browser intents read quantity 1 and wrote absolute 2, so one unit disappeared. The sibling POST writes a locked increment and two real writes persist 3; PUT remains absolute. A4 handles every 5xx as potentially committed after a reproduced failure; retrieval and explicit review precede another write. A6 fixed anchor resolution with the SPA base and adopted text-relative container breakpoints after an observed 450 px overflow. Full API: 105/1,406 MySQL (plus intended SQLite cases), isolated SQLite run 105 enumerated / 1,321 assertions / 4 InnoDB-only skips; Pint/OpenAPI and the local CI/release rehearsals passed. Unchanged closed reviews; `3e1bc12` is the new bounded runtime candidate for a separate native review (not yet approved).

Final Chromium run: 27 passed and three opt-in skips covered on the earlier Mailpit/idle-session run. Firefox final loaded-inventory reflow and shell accessibility both passed. `eaaec7a` corrects first-listing image priority, proved in SSR without making other listing images eager. Both optimized application builds passed. PROGRESS records the native readiness and the tool/capability limits (Engram host, spoken announcements, static Impeccable plate gate) separately from real provider/staging validation.

### L10 — Compression review consent

1

The provider admitted all three perspectives for `3e1bc12`, returned `approved`, and the exact acknowledgement burned authority for `review-81e40b94c8f301d9`. No correction was required. The sole informational finding was addressed separately with a real compiled-SSR HTTP check: gzip, Brotli and identity yielded identical decoded bytes, with exact uncompressed `206` range behavior. No production code changed in the follow-up and no review verdict was attributed to cart/gallery or publishing.

### L11 — InnoDB and uncertain gallery upload recovery

Retomá feat/camba-v2 desde su HEAD actual, posterior a af5547a.
Conservá código, registros y revisiones cerradas.

Completá los pendientes locales reales:
1. Verificá el incremento concurrente del carrito en MySQL/InnoDB.
2. Implementá recuperación segura de subidas inciertas, incluso
   cuando la petición original siga en ejecución. Evitá depender
   de una comparación manual de fotos.
3. Revisá los candidatos de carrito y galería mediante el flujo
   nativo y corregí los hallazgos que correspondan.
4. Completá las verificaciones visuales y de accesibilidad que
   permitan las capacidades disponibles, sin falsear aprobaciones.

Después continuá con las integraciones y CI/CD para las que exista
configuración autorizada. Agrupá las dependencias realmente ausentes.

No repitas controles ya suficientes ni cierres por terminar una
revisión mientras quede trabajo ejecutable. Continuá automáticamente.

Observed local HEAD was af5547a, worktrees intact, with only the previously existing untracked .impeccable/ and assets/. The existing manual comparison is superseded by S11. Engram task mirror is pending supported host registration.

Final observed scope: legacy POST behavior preserved; durable gallery retry verified even before the original completes. The dedicated route fails closed against older API versions. Local API regression reached 110/1,489 on MySQL before the final route delta; the final focused MySQL suite passed 2/28, gallery SQLite 9/110, Chromium 6/6, and final local image probes passed. Native reviews still require separate consent: exact cart implementation `89e8224` first, then the isolated gallery slice `0067bc0`. No former approval is reopened or inherited.
