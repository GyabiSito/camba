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

## Tasks

- T1 / S1, S7 — delegated read-only reference map (four distinct local checkouts); verified in `0308b42`; native assessment `passive`.
- T2a / S3, S7 — inline Laravel bootstrap and first-party buyer access; RED/GREEN, actual loopback HTTP and independent isolation verification observed; native candidate assessment follows the work-unit commit. Risk: items 2 and 5 (identity/CSRF and framework dependencies).
- T2b / S3, S7 — pending Angular workspace, isolated dev services and CI base; assign route after T2a.
- T2c / S2, S3, S7 — pending design direction, identity API, UI and checks; assign route after T2b.
- T3 / S2, S4, S7 — pending P2 catalog, import and admin; assign route when scoped.
- T4 / S5, S7 — pending P3 orders and payments; assign route when scoped.
- T5 / S5, S7 — pending P4 notifications and reminders; assign route when scoped.
- T6 / S2, S6, S7 — pending P5–P6 storefront and quality; assign route when scoped.
- T7 / S6, S7 — pending P7 deployment artifacts; assign route when scoped.
- T8 / S6, S7 — pending P8 migration and operational handoff; assign route when scoped.

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
