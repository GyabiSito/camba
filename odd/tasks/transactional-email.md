# Camba transactional email redesign
Branch: feat/camba-v2 · baseline c663557 · local only; ask-on-risk delivery. Forecast: ~360 authored lines plus a derived bow PNG.
Runners: Laravel PHPUnit (SQLite memory), Playwright Store with isolated Laravel/worker/SQLite and local Mailpit, Chromium visual readback.

## Specs

- S1: “Inventariá las notificaciones y mailables que realmente se envían. Incluí recuperación de contraseña, verificación de correo, pedidos y recordatorios donde ya existan. Aplicá una plantilla compartida reutilizando los mecanismos de correo del proyecto. Conservá los destinatarios, eventos de envío, colas y deduplicación actuales.”
- S2: “Usá fondo papel cálido #FCFAF6, una columna de unos 580 px que se adapte a móvil, texto tinta #24201E y separadores finos. En la cabecera, poné el lazo oficial y el nombre Camba en rojo profundo #720F12. El nombre debe seguir visible si se bloquea la imagen.” “Usá serif para el título y una sans legible para el cuerpo, con fuentes de respaldo del sistema. El CTA principal va en bordó #821F40 con texto claro. Diseñá el HTML para email con estilos en línea donde corresponda. Entregá también una versión de texto plano con el contenido y la acción principal.”
- S3: “Configurá «Camba» como nombre del remitente. Usá una dirección .test en local y la dirección autorizada por configuración en producción. Reemplazá el logo, la firma y el pie genéricos de Laravel en todos los correos. Escribí asuntos, cuerpo y textos de respaldo en español uruguayo, con voseo.” “Para recuperación, usá «Restablecé tu contraseña» como título y «Restablecer contraseña» como botón. Mostrá el vencimiento efectivo según la configuración y explicá que, si la persona no pidió el cambio, puede ignorar el correo. Traducí también la instrucción para copiar el enlace si el botón falla. Conservá el enlace original, su token y su vigencia.” “Para verificación, destacá «Verificar mi correo». En los correos de pedidos, destacá referencia, estado, total en UYU y «Ver pedido» cuando corresponda. Mostrá el contacto de ayuda solo si está configurado.”
- S4: “Generá los correos desde sus flujos reales con cuentas de prueba. Comprobá que el worker los entregue a Mailpit. Revisá remitente, asunto, HTML y texto plano. Capturá recuperación, verificación y al menos un correo de pedido a 600 y 390 px. Revisá también que el contenido se entienda con imágenes bloqueadas.” “Probá que el enlace de recuperación recibido permita completar el cambio y que el de verificación siga funcionando. Ocultá tokens y enlaces firmados en las capturas que entregues. Dejá documentado qué correos quedaron con la plantilla Camba y cómo reproducirlos.”

## Tasks

- T1 · S1–S3 · inline · complete · 2e2df4e plus compatibility fix ece91a0; 25 Laravel tests and independent MIME probes.
- T2 · S4 · inline · complete · 2e2df4e; eight variants in Mailpit, nine masked screenshots and reproduction documentation.

## Log

### L1 — Original request

Rediseñá los correos transaccionales existentes de Camba v2. Usá la
identidad de la tienda y la captura de recuperación como punto de
partida. Probá el resultado con Laravel, el worker y Mailpit local.

1. IDENTIFICÁ TODOS LOS CORREOS EXISTENTES

Inventariá las notificaciones y mailables que realmente se envían.
Incluí recuperación de contraseña, verificación de correo, pedidos
y recordatorios donde ya existan. Aplicá una plantilla compartida
reutilizando los mecanismos de correo del proyecto. Conservá los
destinatarios, eventos de envío, colas y deduplicación actuales.

2. LLEVÁ LA ESTÉTICA DE CAMBA AL CORREO

Usá fondo papel cálido #FCFAF6, una columna de unos 580 px que se
adapte a móvil, texto tinta #24201E y separadores finos. En la
cabecera, poné el lazo oficial y el nombre Camba en rojo profundo
#720F12. El nombre debe seguir visible si se bloquea la imagen.

Usá serif para el título y una sans legible para el cuerpo, con
fuentes de respaldo del sistema. El CTA principal va en bordó
#821F40 con texto claro. Diseñá el HTML para email con estilos en
línea donde corresponda. Entregá también una versión de texto plano
con el contenido y la acción principal.

3. UNIFICÁ REMITENTE, TEXTO Y CONTENIDO

Configurá «Camba» como nombre del remitente. Usá una dirección .test
en local y la dirección autorizada por configuración en producción.
Reemplazá el logo, la firma y el pie genéricos de Laravel en todos
los correos. Escribí asuntos, cuerpo y textos de respaldo en español
uruguayo, con voseo.

Para recuperación, usá «Restablecé tu contraseña» como título y
«Restablecer contraseña» como botón. Mostrá el vencimiento efectivo
según la configuración y explicá que, si la persona no pidió el
cambio, puede ignorar el correo. Traducí también la instrucción para
copiar el enlace si el botón falla. Conservá el enlace original, su
token y su vigencia.

Para verificación, destacá «Verificar mi correo». En los correos de
pedidos, destacá referencia, estado, total en UYU y «Ver pedido» cuando
corresponda. Mostrá el contacto de ayuda solo si está configurado.

4. PROBÁ EL ENVÍO Y EL RESULTADO

Generá los correos desde sus flujos reales con cuentas de prueba.
Comprobá que el worker los entregue a Mailpit. Revisá remitente,
asunto, HTML y texto plano. Capturá recuperación, verificación y al
menos un correo de pedido a 600 y 390 px. Revisá también que el
contenido se entienda con imágenes bloqueadas.

Probá que el enlace de recuperación recibido permita completar el
cambio y que el de verificación siga funcionando. Ocultá tokens y
enlaces firmados en las capturas que entregues. Dejá documentado
qué correos quedaron con la plantilla Camba y cómo reproducirlos.

### L2 — Baseline
- Historical Mailpit reset viewed at 600px with URLs masked: Laravel mark/signature/footer and English fallback.
- Read-only map: eight active variants (two identity, six commerce); operational notices are panel only. Candidate will retain inherited link generation and worker eligibility/dedup rules.
- Risk item 2: security-bound URLs must be copied unmodified in each MIME part and proven by following the delivered originals. Risk item 3: mail presentation/config identity is shared; no recipient, scheduling, or provider changes.

### L3 — T1 checks
- RED: recovery subject fell back to English under the test locale and the shipped message had no UYU amount.
- GREEN: two targeted MIME tests passed (33 assertions); Identity, Notices and Settings passed 25 tests / 247 assertions on isolated SQLite. Auth action URLs are generated only by the unchanged parent implementations.
- T2 fixture runs the real queue worker, SMTP and notice projector; additional commerce event inputs are synthetic.

### L4 — Delivery evidence
- Chromium end-to-end passed: new registration and signed verification (HTTP 204), password reset and sign-in with the replacement password, and real checkout (HTTP 201). All eight variants arrived in a disposable Mailpit from the isolated database queue. The remaining commerce inputs were committed synthetic states, not real payments.
- Both MIME parts and sender checked for all eight. Nine masked captures at 600 px, 390 px and 390 px with the image blocked live under `web/test-results/transactional-mail/`. Visual review found no overflow. Impeccable reported no findings.
- The original Playwright default output directory cleared earlier untracked reports; no tracked sources or demo data were affected. The opt-in mail runner now uses its own output directory, independently read back from the config. The test Mailpit was stopped; the shared instance still returned readiness HTTP 200.
- Reproduction and production sender requirements: `docs/CORREOS_TRANSACCIONALES.md`. External SMTP and non-Chromium email clients are not verified.

### L5 — Local commits and native review
- `2e2df4e feat(mail): brand Camba transactional emails` (19 scoped files, 510 changed text lines). One coherent review slice kept the shared presentation, tests and docs together. Unrelated dirty and untracked paths were excluded from the native candidate.
- The independent verifier reproduced sender behavior, signed URL integrity, MIME rendering and redaction. The parent spot-checked masked link removal. External verifier scratch cleanup was declined by execution policy.
- Candidate review granted. Four lenses were captured in parallel; native review found that removing the legacy production sender fallback could interrupt an existing partially configured SMTP setup. The sole four-line correction, `ece91a0 fix(mail): preserve the legacy production sender fallback`, keeps configured production addresses authoritative and preserves the earlier fallback only when the variable is missing. RED proved the missing legacy fallback; all three sender scenarios and 25 Laravel tests / 247 assertions passed after correction.
- The targeted validator approved the correction and the provider acknowledged and consumed the review authority for lineage `review-7905b31333ae5b0d`. No push or deployment. Two non-blocking follow-ups were left out of the correction: improve projector-failure diagnostics and assert the per-order reference, status and CTA in the synthetic Mailpit fixtures.
