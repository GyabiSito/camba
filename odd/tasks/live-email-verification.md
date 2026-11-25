# Live Store email verification and welcome
Branch feat/camba-v2 · baseline ff24ddf · local Docker only, ask-on-risk · forecast ~200 authored lines.
Runners: Laravel PHPUnit isolated SQLite; existing Chromium fixture; local Docker Store 4200 with Mailpit 48025 and PostgreSQL/Redis.

## Specs

- S1: “Reproducí el problema con un comprador nuevo en ese Docker. Comprobá si la API, el worker y el scheduler están ejecutando el código que incluye ff24ddf. Rastreá si se guardó email_verified_at y si se creó, procesó y entregó el aviso de bienvenida. Identificá el punto exacto del fallo antes de cambiar la lógica.”
- S2: “Cuando el comprador abra un enlace firmado válido en el navegador, redirigilo a Mi cuenta y mostrá «Tu cuenta ha sido verificada». Si abrió el correo en otro navegador sin sesión, mostrá la confirmación en el ingreso y llevalo a Mi cuenta cuando inicie sesión. Conservá la validación de firma y vencimiento, y el 204 para clientes JSON si forma parte del contrato. Mostrá un estado claro para enlaces inválidos o vencidos. Usá el origen configurado de la Tienda y no arrastres la firma a la URL final.”
- S3: “Corregí lo necesario para que la primera verificación exitosa genere una sola bienvenida. Conservá la deduplicación al volver a abrir el enlace. Actualizá solo los servicios necesarios del Compose local y preservá la base, las cuentas y los volúmenes.”
- S4: “Probalo de punta a punta en 4200. Registrá un comprador nuevo, abrí el enlace recibido en Mailpit, confirmá la redirección y el mensaje visible, y comprobá que llegue exactamente una bienvenida. Volvé a abrir el enlace y verificá que no llegue otra. Reportá la causa de cada síntoma y qué servicios quedaron actualizados.”

## Tasks

- T1 · S1/S2 · inline · complete (30 Laravel tests, 311 assertions; Store image builds) · 676f760, native review approved and acknowledged.
- T2 · S3/S4 · inline · complete on 4200/48025 · 676f760, live flow, screenshots and ledger trace; native review approved and acknowledged.

## Log

### L1 — Original request

Corregí el flujo de verificación y bienvenida de Camba en el Docker local que sirve la Tienda en el puerto 4200 y Mailpit en el 48025. El usuario se registra, recibe «Verificá tu correo», abre el enlace y queda en /email/verify/… sin confirmación visible ni correo de bienvenida. El commit ff24ddf se probó en un entorno aislado.

1. Reproducí el problema con un comprador nuevo en ese Docker. Comprobá si la API, el worker y el scheduler están ejecutando el código que incluye ff24ddf. Rastreá si se guardó email_verified_at y si se creó, procesó y entregó el aviso de bienvenida. Identificá el punto exacto del fallo antes de cambiar la lógica.

2. Cuando el comprador abra un enlace firmado válido en el navegador, redirigilo a Mi cuenta y mostrá «Tu cuenta ha sido verificada». Si abrió el correo en otro navegador sin sesión, mostrá la confirmación en el ingreso y llevalo a Mi cuenta cuando inicie sesión. Conservá la validación de firma y vencimiento, y el 204 para clientes JSON si forma parte del contrato. Mostrá un estado claro para enlaces inválidos o vencidos. Usá el origen configurado de la Tienda y no arrastres la firma a la URL final.

3. Corregí lo necesario para que la primera verificación exitosa genere una sola bienvenida. Conservá la deduplicación al volver a abrir el enlace. Actualizá solo los servicios necesarios del Compose local y preservá la base, las cuentas y los volúmenes.

4. Probalo de punta a punta en 4200. Registrá un comprador nuevo, abrí el enlace recibido en Mailpit, confirmá la redirección y el mensaje visible, y comprobá que llegue exactamente una bienvenida. Volvé a abrir el enlace y verificá que no llegue otra. Reportá la causa de cada síntoma y qué servicios quedaron actualizados.

### L2 — Baseline: 2026-11-24 00:36–00:37 UTC
- Real signup in Store 4200 returned 201, verification arrived in Mailpit 48025. Browser navigation got HTTP 204 without Location or visible success.
- PostgreSQL saved verification and pending welcome record #34. Scheduler ran `camba:notices` and the worker ran the job, but it cancelled as `no_longer_eligible` with zero attempts; Mailpit search showed only the verification message for that test buyer.
- API/worker/scheduler source bind mounts have identical current fingerprints for ff24ddf. A fresh PHP process in the old worker accepted the same cancelled record and address hash; the queue daemon was started at 22:31 UTC before ff24ddf and retains the loaded old eligibility class. API per-request code and scheduler child processes already handled the new kind. No previous notices will be resubmitted.
- Risk item 2: signed endpoint outcome and no signed URL in redirect or referrer. Risk item 5: selective local runtime update; preserve volumes and unrelated dirty changes.

### L3 — Implementation and refresh
- RED: expired browser link returned 403 in the new Page contract test. GREEN: 303 to configured Account URL for HTML success/invalid, JSON/wildcard responses unchanged, no signed URL or referrer. Full targeted suite 30/30, 311 assertions.
- Built and recreated Store only; fresh worker process in the same container. API uses live-mounted source, scheduler already enqueues successfully; API/scheduler/admin/PostgreSQL/Redis/Mailpit IDs and start times unchanged, all volume names unchanged. Store build success; pre-existing home CSS budget warning only.

### L4 — Real Docker proof
- Fresh buyer: registration HTTP 201 and verification mail first. Invalid HTML link returned 303 to the alert. Valid HTML link from a second browser returned 303 to confirmation, no signed query or referrer; login 204 left the visible confirmation and account content intact. Reopening in the signed-in browser returned the same safe Account URL. JSON replay returned 204 without Location.
- At 00:44:36 UTC PostgreSQL recorded `email_verified_at`; notice #35 was sent at 00:45:04 in one attempt. The scheduler ran again at 00:46:01 after replay; Mailpit still counted exactly one welcome at 00:46:11. The old cancelled baseline notice was not resent.
- The scoped isolated Chromium test passed too. Visually checked mobile sign-in and desktop Mi cuenta; screenshots in `web/test-results/live-email-verification/`, no signed token. Impeccable detector reported no findings.

### L5 — Local commit and verification readback
- Independent scoped source review found no blocker. Its PHP prerequisites failed due to shell quoting, so it did not independently run the runtime checks. The parent ran an isolated scratch matrix successfully: weighted Accept HTML/JSON, wildcard 204, invalid/expired/mismatched/missing-user handling, safe redirect headers, no writes on rejection and one notice after replay.
- Commit `676f760 fix(identity): confirm email verification in the storefront` stages only eight intended paths. Only our additive hunks entered the commit for the two dirty Account files; the inherited working-tree edits remain. No push or deployment. Temporary verifier scratch cleanup was blocked by execution policy.

### L6 — Native review closure
- The user granted candidate review. Four lenses ran in parallel; the last capture approved without correction. Exact acknowledgement consumed authority for lineage `review-1c920fbdcddffce9`. No additional source or Docker changes and no publish.
- Non-blocking display notes: a URL-only confirmation marker can be forged in a guest browser but grants no authority and cannot change account state; a signed-in unverified different account suppresses the banner. These do not reopen the reviewed candidate.
