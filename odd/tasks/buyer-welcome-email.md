# Buyer welcome email
Branch feat/camba-v2 · revision baseline 676f760 with prior welcome design · local only, ask-on-risk.
Runners: Laravel PHPUnit on isolated SQLite, independent scratch verifier, Store 4200 and real Redis worker/Mailpit 48025.

## Specs

- S1: “Rediseñá el correo de bienvenida de Camba y mové el disparador al registro exitoso de un comprador. Encolalo después de guardar la cuenta, aunque el correo todavía no esté verificado.” “Conservá el correo «Verificá tu correo» y su enlace.”
- S2: “Reutilizá la cola y la deduplicación actuales. La bienvenida se envía una sola vez por cuenta y verificar el correo no vuelve a dispararla.”
- S3: “Usá la captura de Komorebi como referencia de composición. Hacé una cabecera rosa pálido con el lazo bordó y el título serif centrado «Te damos la bienvenida a Camba». Debajo, en un cuerpo claro, usá este texto:” «Hola, {nombre}. Gracias por sumarte a Camba. Ya podés recorrer la tienda y descubrir prendas para combinar a tu manera. Te enviamos por separado un enlace para verificar tu correo.» “Poné un solo botón centrado, «Explorá la tienda», que abra /tienda en el entorno configurado. Mostrá el contacto de ayuda en el pie si está publicado. Adaptá también la versión en texto plano.”
- S4: “Probalo en el Docker habitual con Mailpit y el worker real. Registrá una cuenta nueva y comprobá que lleguen la bienvenida y la verificación antes de abrir el enlace. Después verificá la cuenta y volvé a abrir el enlace. Debe seguir habiendo una sola bienvenida. Mostrá el correo nuevo a 600 y 390 px.”

## Tasks

- T1 · S1–S3 · inline · verified locally; PHPUnit RED→GREEN 38 tests/438 assertions, Pint, and 5 independent probes/58 assertions run with the installed dependencies · Risk: items 2 and 4 (pre-verification recipient, atomic registration/outbox).
- T2 · S4 · inline · verified on the usual Docker; one welcome and one verification before opening the signed link, no duplicate after opening it twice, actual Mailpit HTML at 600/390 px.

## Log

### L1 — Original request

Agregá un correo de bienvenida a Camba v2. Enviá el mensaje cuando un comprador confirme su correo por primera vez mediante el enlace de verificación. Conservá el flujo actual de «Verificá tu correo» y hacé este cambio sobre la rama que ya tiene el rediseño de correos transaccionales.

## Diseño y contenido

Reutilizá las plantillas HTML y texto plano de Camba, con el mismo lazo, el remitente configurado y el pie de ayuda.

- Asunto sugerido — Te damos la bienvenida a Camba
- Texto sugerido — ¡Hola, {nombre}! Tu correo ya está verificado. Desde Mi cuenta podés guardar tus direcciones y consultar tus pedidos.
- Botón — Ver tienda, con la URL de /tienda construida a partir de la configuración del entorno.

Usá voseo y un saludo natural si falta el nombre. Mantené el mensaje breve.

## Cuándo se envía

Generá el aviso a partir de la primera verificación exitosa de una cuenta de comprador y encolalo después de confirmar el cambio en la base. El registro, el reenvío de un enlace, volver a abrir un enlace ya usado y verificar cuentas mediante seeds o migraciones no deben generar la bienvenida. Tampoco hagas envíos retroactivos a cuentas ya verificadas.

Reutilizá la cola y la deduplicación existentes para que repetir la verificación no genere dos avisos. Si falla el envío, la cuenta tiene que seguir verificada y el aviso debe seguir el mecanismo de reintento existente.

## Verificación

Con Mailpit y el worker real, registrá un comprador de prueba y comprobá que primero llegue «Verificá tu correo». Abrí el enlace y verificá que la cuenta quede confirmada y llegue una sola bienvenida, con el diseño nuevo y el botón apuntando a la tienda. Volvé a abrir el mismo enlace y comprobá que no llegue otra. Cubrí la deduplicación con una prueba automatizada.

Actualizá docs/CORREOS_TRANSACCIONALES.md con el noveno correo y los pasos para probarlo. Entregá los cambios y una captura del mensaje en Mailpit. Limitá el trabajo al correo de bienvenida y dejalo validado en local.

### L2 — Route
- Risk item 2: signed buyer verification and binding to the verified address. Risk item 4: atomic first verification and durable deduplication; scheduler already enqueues due pending notices after commit.
- Keep the welcome record out of the commerce-only admin feed to preserve its response contract and avoid user identifiers.

### L3 — First checks
- Baseline RED: a valid first signed verification updates the buyer but creates no welcome record. After the change, the focused signed-link replay creates one record and one send; prepare failure leaves verification intact and uses the existing retry.
- Scope suite: Identity, Notices and Settings 28/28, 282 assertions with isolated SQLite. One test checks that exceptional identity notices do not appear in the commerce API.
- Existing browser runner reuses real SMTP and worker; each run stores captures in its own directory so prior proof is preserved.

### L4 — Local verification and commit
- Chromium test passed with the real Laravel database queue, worker and isolated Mailpit. Initial verification mail arrived first, both first and repeated signed-link requests returned 204, the welcome CTA matched APP_URL plus `/tienda`, and exactly one welcome remained after another scheduler/worker cycle. Shared Mailpit stayed healthy; the disposable container was stopped.
- Opened the welcome in the Mailpit UI and inspected its Camba bow, sender, optional support, subject and clickable CTA. Captured `web/test-results/transactional-mail/bienvenida-mailpit.png` and inspected the mobile render.
- Independent scratch verifier and parent spot check passed 13 probes, including rollback before ledger commit and address change before delivery; durable regressions now cover both alongside replay, HTML escaping and retry. Final Laravel suite: 29/29, 292 assertions. Actual parallel MySQL traffic was not tested. Verifier scratch was left intact after a reparse point check.
- Scoped commit `ff24ddf feat(mail): welcome buyers after first email verification` on feat/camba-v2. Risk items 2 and 4; native review enabled, no push/deploy.

### L5 — Native review closure
- User granted review for this candidate. Four lenses ran in parallel and the last capture approved without correction. Native acknowledgement consumed authority for lineage `review-7c7592a6f31073a6`. No source changes after the review, no push or deploy.
- Non-blocking observations only: welcome delivery failures are intentionally outside the commerce admin feed; document that operational limitation if extending the recovery guide. The Mailpit count uses the first inbox page; pagination would make the check more robust in a shared/noisy mailbox. The verified run used a disposable mailbox.

### L6 — Updated request (2026-11-25)

Rediseñá el correo de bienvenida de Camba y mové el disparador al registro exitoso de un comprador. Encolalo después de guardar la cuenta, aunque el correo todavía no esté verificado. Reutilizá la cola y la deduplicación actuales. La bienvenida se envía una sola vez por cuenta y verificar el correo no vuelve a dispararla. Conservá el correo «Verificá tu correo» y su enlace.

Usá la captura de Komorebi como referencia de composición. Hacé una cabecera rosa pálido con el lazo bordó y el título serif centrado «Te damos la bienvenida a Camba». Debajo, en un cuerpo claro, usá este texto:

«Hola, {nombre}. Gracias por sumarte a Camba. Ya podés recorrer la tienda y descubrir prendas para combinar a tu manera. Te enviamos por separado un enlace para verificar tu correo.»

Poné un solo botón centrado, «Explorá la tienda», que abra /tienda en el entorno configurado. Mostrá el contacto de ayuda en el pie si está publicado. Adaptá también la versión en texto plano.

Probalo en el Docker habitual con Mailpit y el worker real. Registrá una cuenta nueva y comprobá que lleguen la bienvenida y la verificación antes de abrir el enlace. Después verificá la cuenta y volvé a abrir el enlace. Debe seguir habiendo una sola bienvenida. Mostrá el correo nuevo a 600 y 390 px.

- The latest request changes the earlier trigger and visual design; L1–L5 are historical record, not the current specification. Registration stores the ledger row atomically for one fixed registered email; the existing scheduler dispatches after commit. Verification still has the same signed-link behavior and no longer writes a welcome. Existing addresses and administrative exclusions remain intact.

### L7 — Verified local implementation

- Actual Chromium registration on Store 4200 returned 201. Redis worker and Mailpit 48025 delivered one welcome and one verification while the account was still unverified. The PostgreSQL ledger had one sent row and one attempt. After following the actual verification link, seeing the confirmation, reopening the same link, and running another projector cycle, the account was verified and the same counts held.
- The single CTA opened the configured Store `/tienda` with HTTP 200. Checked the deployed sender, CID asset, HTML and plain text; no support contact is published in the current local settings. Inspected actual Mailpit HTML captures under `web/test-results/bienvenida-registro-docker/` at 600 and 390 px; no signed links are present in them.
- Only the local worker was restarted. No migrations, resets, or volume changes. The broad opt-in Playwright suite was listed, not run; the dedicated live Chromium check passed. The independently authored probes passed after rerunning with the installed vendor tree instead of an incomplete scratch copy.
- Native assessment requires untracked-candidate selection and the current checkout contains unrelated tracked and untracked changes. No native lifecycle was started and no mixed worktree commit was made.
