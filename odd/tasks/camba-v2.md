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

## Tasks

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
