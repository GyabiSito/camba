# Camba storefront support directory
Branch feat/camba-v2 · baseline 676f760 · ask-on-risk, local only · forecast 550 authored lines.
Runners: Laravel PHPUnit isolated SQLite; Angular build; live Store SSR Docker and Chromium; isolated SMTP proof.

## Specs

S1: “Implementá las páginas de Envíos, Términos y condiciones, Política de privacidad, Preguntas frecuentes y Contactanos en Camba v2. Revisá el footer y las páginas equivalentes de komorebi.com.uy o de su checkout local para entender cómo están organizadas. Adaptá esa estructura a Camba y usá sus propios datos y textos.”

“Implementá las cinco páginas públicas y actualizá el pie de Camba v2 tomando como referencia la organización del sitio activo komorebi.com.uy.”

S2: “/envios — Explicá las modalidades de envío y retiro que estén habilitadas, la cobertura confirmada y cómo se calcula el costo antes de confirmar el pedido. Usá la configuración real de la tienda.”

“/envios — Resumen de modalidades, cobertura y costos. Debajo, explicá preparación, retiro, entrega y seguimiento según la configuración real de Camba.”

S3: “/terminos-y-condiciones — Incorporá las condiciones aprobadas de compra, entrega, cambios, devoluciones y atención. Si falta texto aprobado, dejá el borrador listo para revisión e indicá qué puntos necesitan confirmación.”

“/politica-de-privacidad y /terminos-y-condiciones — Páginas de lectura con subtítulos claros, fecha de actualización y enlace a Contactanos. Usá los datos, prácticas y textos aprobados de Camba. Dejá identificados los puntos pendientes de aprobación antes de publicar.”

S4: “/politica-de-privacidad — Documentá los datos que Camba realmente recoge y su uso para cuentas, pedidos, entregas y avisos. Usá los datos y canales de contacto del negocio. Dejá cualquier texto pendiente de aprobación identificado antes de publicarlo.”

“/politica-de-privacidad y /terminos-y-condiciones — Páginas de lectura con subtítulos claros, fecha de actualización y enlace a Contactanos. Usá los datos, prácticas y textos aprobados de Camba. Dejá identificados los puntos pendientes de aprobación antes de publicar.”

S5: “/preguntas-frecuentes — Respondé cómo comprar, qué opciones de entrega hay, dónde consultar pedidos y cómo recuperar una cuenta. Enlazá a Envíos, Mi cuenta o Contactanos cuando corresponda. Las respuestas tienen que coincidir con lo que funciona hoy.”

“/preguntas-frecuentes — Acordeones accesibles agrupados por compras, envíos, cambios y cuenta. Respondé según el flujo actual de Camba, incluida la compra como invitado si está habilitada. Cerrá con un enlace a Contactanos.”

S6: “/contacto — Mostrá el correo, teléfono y otros canales que estén publicados en la configuración de Camba. Si hay un formulario funcional en la referencia, adaptalo al canal de soporte configurado y probá que el mensaje llegue a Mailpit.”

“/contacto — Formulario con nombre, correo, teléfono opcional y mensaje. En escritorio, poné al lado los canales publicados en Admin. Conectá el formulario al backend y verificá la recepción en Mailpit con el destinatario de soporte configurado.”

S7: “Actualizá el componente compartido para que aparezca en toda la Tienda. Conservá el degradado claro, el lazo, la paleta bordó y «Volver arriba».

- Explorá — Ver tienda y las categorías publicadas.
- Ayuda — Envíos, Preguntas frecuentes y Contactanos.
- Legal — Términos y condiciones y Política de privacidad.

Usá enlaces a páginas reales. Actualizá los enlaces al antiguo #contacto y conservá el ancla si todavía tiene referencias. Si faltan datos comerciales o textos aprobados, reportá cuáles hacen falta para publicar cada página.”

“Usá el componente compartido en toda la tienda. Conservá el degradado claro, el lazo, la paleta bordó y la tipografía de Camba.

- Primera fila, tres columnas: Camba con su descripción, Explorá con Ver tienda y las categorías publicadas, y Ayuda con Envíos, Preguntas frecuentes y Contactanos.
- Franja inferior separada por una línea fina: copyright a la izquierda, Política de privacidad y Términos y condiciones a la derecha. Integrá «Volver arriba» sin que compita con esos enlaces. En móvil, apilá los grupos cuando el ancho lo pida.”

S8: “Abrí las cinco rutas directamente y desde el pie del Inicio, la Tienda y una ficha de producto. Verificá que funcionen al recargar, que las páginas públicas rendericen con SSR y que el pie se pueda navegar con teclado y a 320 px. Entregá una captura del footer en escritorio y en móvil, las rutas implementadas y los textos o datos que queden pendientes de aprobación. Validá todo en el Docker local.”

“Validá las cinco rutas desde el pie y por acceso directo en el Docker local. Comprobá el renderizado SSR, la navegación con teclado y el diseño a 320 px. Entregá capturas del pie en escritorio y móvil, más la prueba de recepción del formulario.”

## Tasks

- T1 · S1–S5, S7 · inline · local runtime green; approved commercial/legal data outstanding.
- T2 · S6 · inline · SSR hydration corrected; Docker browser→SMTP and independent mail-boundary check green · Risk: item 2 (public email submission); shared support channel not configured.
- T3 · S8 · inline and independent mail verifier · local functional checks green and screenshots delivered; no isolated commit or native review in mixed worktree.

## Log

### L1 — Original request

Implementá las páginas de Envíos, Términos y condiciones, Política de privacidad, Preguntas frecuentes y Contactanos en Camba v2. Revisá el footer y las páginas equivalentes de komorebi.com.uy o de su checkout local para entender cómo están organizadas. Adaptá esa estructura a Camba y usá sus propios datos y textos.

## Páginas públicas

- /envios — Explicá las modalidades de envío y retiro que estén habilitadas, la cobertura confirmada y cómo se calcula el costo antes de confirmar el pedido. Usá la configuración real de la tienda.
- /terminos-y-condiciones — Incorporá las condiciones aprobadas de compra, entrega, cambios, devoluciones y atención. Si falta texto aprobado, dejá el borrador listo para revisión e indicá qué puntos necesitan confirmación.
- /politica-de-privacidad — Documentá los datos que Camba realmente recoge y su uso para cuentas, pedidos, entregas y avisos. Usá los datos y canales de contacto del negocio. Dejá cualquier texto pendiente de aprobación identificado antes de publicarlo.
- /preguntas-frecuentes — Respondé cómo comprar, qué opciones de entrega hay, dónde consultar pedidos y cómo recuperar una cuenta. Enlazá a Envíos, Mi cuenta o Contactanos cuando corresponda. Las respuestas tienen que coincidir con lo que funciona hoy.
- /contacto — Mostrá el correo, teléfono y otros canales que estén publicados en la configuración de Camba. Si hay un formulario funcional en la referencia, adaptalo al canal de soporte configurado y probá que el mensaje llegue a Mailpit.

## Pie de página

Actualizá el componente compartido para que aparezca en toda la Tienda. Conservá el degradado claro, el lazo, la paleta bordó y «Volver arriba».

- Explorá — Ver tienda y las categorías publicadas.
- Ayuda — Envíos, Preguntas frecuentes y Contactanos.
- Legal — Términos y condiciones y Política de privacidad.

Usá enlaces a páginas reales. Actualizá los enlaces al antiguo #contacto y conservá el ancla si todavía tiene referencias. Si faltan datos comerciales o textos aprobados, reportá cuáles hacen falta para publicar cada página.

## Verificación

Abrí las cinco rutas directamente y desde el pie del Inicio, la Tienda y una ficha de producto. Verificá que funcionen al recargar, que las páginas públicas rendericen con SSR y que el pie se pueda navegar con teclado y a 320 px. Entregá una captura del footer en escritorio y en móvil, las rutas implementadas y los textos o datos que queden pendientes de aprobación. Validá todo en el Docker local.

### L2 — Reference, local baseline and delivery constraints

- Local Komorebi checkout 50987b3: three help links, two legal links, structured page sections and a real support form that reaches configured mail via its worker. Reuse organization, not contacts, carrier/geography, or policies.
- Live Docker 4200 returns 404 for /envios, public categories are published, pickup/delivery configured, support email and phone are not published.
- Use existing public store-info and checkout quote. Neither the public API nor quote defines a geographic coverage policy.
- Reviewable delivery only. Existing shared footer is untracked and already used by dirty StoreShell; do not stage or include pre-existing edits without separate authorization.

### L3 — User refinement (2026-11-23)

Implementá las cinco páginas públicas y actualizá el pie de Camba v2 tomando como referencia la organización del sitio activo komorebi.com.uy.

## Pie de página

Usá el componente compartido en toda la tienda. Conservá el degradado claro, el lazo, la paleta bordó y la tipografía de Camba.

- Primera fila, tres columnas: Camba con su descripción, Explorá con Ver tienda y las categorías publicadas, y Ayuda con Envíos, Preguntas frecuentes y Contactanos.
- Franja inferior separada por una línea fina: copyright a la izquierda, Política de privacidad y Términos y condiciones a la derecha. Integrá «Volver arriba» sin que compita con esos enlaces. En móvil, apilá los grupos cuando el ancho lo pida.

## Páginas

- /envios — Resumen de modalidades, cobertura y costos. Debajo, explicá preparación, retiro, entrega y seguimiento según la configuración real de Camba.
- /preguntas-frecuentes — Acordeones accesibles agrupados por compras, envíos, cambios y cuenta. Respondé según el flujo actual de Camba, incluida la compra como invitado si está habilitada. Cerrá con un enlace a Contactanos.
- /contacto — Formulario con nombre, correo, teléfono opcional y mensaje. En escritorio, poné al lado los canales publicados en Admin. Conectá el formulario al backend y verificá la recepción en Mailpit con el destinatario de soporte configurado.
- /politica-de-privacidad y /terminos-y-condiciones — Páginas de lectura con subtítulos claros, fecha de actualización y enlace a Contactanos. Usá los datos, prácticas y textos aprobados de Camba. Dejá identificados los puntos pendientes de aprobación antes de publicar.

Validá las cinco rutas desde el pie y por acceso directo en el Docker local. Comprobá el renderizado SSR, la navegación con teclado y el diseño a 320 px. Entregá capturas del pie en escritorio y móvil, más la prueba de recepción del formulario.

Direct unauthenticated GET of the six active Komorebi pages returned 200. RED: Camba Docker /envios 404 and four isolated contact requests 404 after fixture setup was corrected.

### L4 — Local candidate

- Backend adds isolated FormRequest, named rate limit and fixed configured support TO. Only validated email is Reply-To; no user-supplied header text besides that validated address. Synchronous ack means accepted by the configured mailer, not a background promise. No queue, data migration, external service or shared DB change.
- Docker editorial/no-payment Store build passed with the pre-existing home.css budget warning. Only the Store container was recreated (other service IDs unchanged). Docker 4200 now returns 200 for /envios. Settings, Identity and Orders: 42 tests / 613 assertions on isolated SQLite; scoped Pint passed.
- Isolated QA network runs the same local Store image on 43988, local Laravel image with disposable SQLite and a configured synthetic support address, and separate Mailpit on 43987. Shared live support config remains unchanged.

### L5 — Results

- SSR `NG0500` on configured Contact page traced to `noscript` children parsed as a text node by scripting-enabled browsers. Replaced markup with ordinary Angular conditional and kept the fields disabled until interactive. Final Docker browser test detects hydration errors and verifies availability, successful 204 and truthful success feedback.
- Docker Store validation: five direct HTTP 200s with no JS and reload at 320 px; all 15 destinations from Home, store and actual product; desktop and 320px footer captures, visible focus, FAQ keyboard and return-to-top. Existing shell checks passed. Combined Node E2E 4/4. Angular build passed with the pre-existing home.css budget warning. Final Laravel 42 tests / 622 assertions and Pint passed. Independent scratch contact probe passed 51 assertions; adopted distinct recipient/sender/subject/address-protection cases in the main suite.
- Mailpit confirmed one `Consulta desde Camba` from the test Camba sender to the configured `ayuda-qa@camba.test`, with correct Reply-To and plain body, optional phone omitted. `web/test-results/storefront-support-pages/{footer-1440,footer-320,contacto-mailpit-buzon}.png`.
- Only demo Store recreated. PostgreSQL, API, scheduler, worker, Redis, Admin and shared Mailpit were not recreated. No live support settings changed. Reproduction and blocks: `docs/PAGINAS_PUBLICAS.md`.
- Native assessment could not isolate the candidate from existing tracked and untracked files; no review started or mixed worktree committed. No production publication.
