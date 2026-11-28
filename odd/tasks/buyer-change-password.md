# Authenticated shopper password change
feat/camba-v2 · preserve pre-existing uncommitted changes · local only / ask-on-risk.
Runner: Docker Laravel on isolated PostgreSQL and rebuilt Store Chromium on localhost:4200. Forecast 250–400 authored lines.

## Specs

S1. Agregá una tarjeta Cambiar contraseña debajo de Datos personales en /cuenta. Usá el diseño de los formularios actuales y tres campos: Contraseña actual, Nueva contraseña y Confirmar nueva contraseña. Mostrá los errores junto al campo correspondiente y, al guardar, limpiá los campos y mostrá «Contraseña actualizada».

S2. Agregá PATCH /api/v1/account/password en Laravel y conectalo desde AccountApi. Exigí sesión de comprador y CSRF. Tomá la cuenta de la sesión, verificá la contraseña actual y aplicá la misma validación que ya usa Camba para registrar y restablecer contraseñas. Reutilizá el guardado con hash del modelo User, conservá la sesión actual y mantené las contraseñas fuera de los logs.

S3. Verificá en Docker que una contraseña actual incorrecta o una confirmación distinta no guarden cambios. Después de un cambio válido, comprobá que la contraseña anterior ya no permita ingresar, que la nueva sí funcione y que «Olvidé mi contraseña» siga disponible.

S4. Revisá si PATCH /api/v1/account/password ya envía un aviso por correo. Si falta, reutilizá el sistema de correos de Camba para enviar una sola notificación al correo registrado, después de guardar el cambio.

Asunto: Tu contraseña de Camba se actualizó
Mensaje: «Actualizaste la contraseña de tu cuenta de Camba. Si no hiciste este cambio, restablecé tu contraseña desde la tienda y contactanos».

Verificá en Mailpit que un cambio válido envíe un solo correo, sin incluir ninguna contraseña, y que los intentos fallidos no envíen nada.

## Tasks

- [x] T1 · S2 · inline after delegated map; RED 404, GREEN 3 focused tests / 70 assertions.
- [x] T2 · S1, S3 · inline form, real Docker Chromium and Laravel 33 tests / 461 assertions; independent readback no blocker. Native review not started: see L4.

- [x] T3 · S4 · inline addition; RED missing outbox row, GREEN 4 focused / 94 assertions, broader 38 / 474 and real Mailpit, independent readback.

## Log

L1.
Agregá una tarjeta Cambiar contraseña debajo de Datos personales en /cuenta. Usá el diseño de los formularios actuales y tres campos: Contraseña actual, Nueva contraseña y Confirmar nueva contraseña. Mostrá los errores junto al campo correspondiente y, al guardar, limpiá los campos y mostrá «Contraseña actualizada».

Agregá PATCH /api/v1/account/password en Laravel y conectalo desde AccountApi. Exigí sesión de comprador y CSRF. Tomá la cuenta de la sesión, verificá la contraseña actual y aplicá la misma validación que ya usa Camba para registrar y restablecer contraseñas. Reutilizá el guardado con hash del modelo User, conservá la sesión actual y mantené las contraseñas fuera de los logs.

Verificá en Docker que una contraseña actual incorrecta o una confirmación distinta no guarden cambios. Después de un cambio válido, comprobá que la contraseña anterior ya no permita ingresar, que la nueva sí funcione y que «Olvidé mi contraseña» siga disponible.

L2. Shared Login/registration/reset/changed password input rules preserve the bcrypt ceiling (72 UTF-8 bytes, no NUL) and 12-character minimum for new passwords. Session identity is exclusive; current password is checked under row lock, then the User cast hashes the new value. Refresh the guard-owned user before Sanctum stores the session hash. CSRF, buyer role and per-account throttle on PATCH. Existing recovery unchanged.

L3. Rebuilt only the Store. Real Docker Chromium: card immediately below personal data and no horizontal overflow at 390px, current wrong PATCH 422 inline, mismatched confirmation inline/no PATCH, valid PATCH 204 with three cleared fields and success; original session remains signed in after reload; old login 422/new login 204; recovery form opens. No synthetic plaintext in recent API/API-file logs. Isolated PostgreSQL Identity+Cart 33 tests / 461 assertions, focused 3 / 70. PHP Pint check 10 files and git diff --check passed. OpenAPI addition checked structurally; no YAML parser installed in the attempted host Node/Python environments.

L4. Risk: items 2 and 4 (credential authority and serialization with password recovery). Independent readback and focused syntax passed. Gentle AI STATUS returned invalid_request, intended_untracked_selection_required, before freeze. Do not mix historical unstaged changes into a work-unit commit; no remote reporting or publishing.

L5.
Revisá si PATCH /api/v1/account/password ya envía un aviso por correo. Si falta, reutilizá el sistema de correos de Camba para enviar una sola notificación al correo registrado, después de guardar el cambio.

Asunto: Tu contraseña de Camba se actualizó
Mensaje: «Actualizaste la contraseña de tu cuenta de Camba. Si no hiciste este cambio, restablecé tu contraseña desde la tienda y contactanos».

Verificá en Mailpit que un cambio válido envíe un solo correo, sin incluir ninguna contraseña, y que los intentos fallidos no envíen nada.

L6. No notice previously existed for PATCH /api/v1/account/password. Save one credential-free account notice with each actual password change in the same transaction, using the existing scheduler, worker, recipient fingerprint check and duplicate-delivery guard. Identical password is a 204 no-op. Security notices are excluded from the Admin operational feed. Real Mailpit at localhost:8025: wrong current and mismatched confirmation both 422 with no matching mail; valid PATCH 204 delivered one message to the registered address with exact subject/copy and no secrets in HTML or text, still one after replay and an extra projection. Only worker restarted; no migration or frontend build. Pint and diff check passed. Risk item 4 (atomic persisted event and async delivery); independent verifier found no static blocker. Native preflight stopped with invalid_request/intended_untracked_selection_required before freeze; no commit mixing prior dirty work, and no remote reporting.
