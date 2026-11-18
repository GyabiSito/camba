# Ejecución autónoma hasta completar Camba v2

## 1. Mandato vigente del usuario

José pidió expresamente que Codex resuelva los problemas y continúe hasta terminar todos los casos de uso, todo el diseño y el sistema completo, sin preguntar por decisiones rutinarias. Este mandato complementa AGENTS.md y IMPLEMENTATION_BRIEF.md; no amplía el catálogo comercial ni autoriza a borrar datos existentes.

Implementar, ejecutar, revisar, corregir, integrar y continuar. No finalizar con «¿sigo?», «puedo hacer la siguiente fase», «queda para otra iteración» o «si querés lo implemento» cuando el trabajo está dentro del alcance ya autorizado.

La autonomía incluye instalar las dependencias necesarias, preparar entornos locales aislados, realizar migraciones sobre datos de prueba, escribir código/UI/pruebas/docs, hacer commits coherentes y resolver problemas de integración de las herramientas de desarrollo mediante sus mecanismos soportados. No inventar credenciales, resultados, aprobaciones ni acceso a producción. Los permisos obligatorios del entorno siguen vigentes.

## 2. Cómo decidir sin interrumpir al usuario

- Resolver opciones rutinarias con el encargo, las referencias realmente leídas y criterios de simplicidad, mantenibilidad, seguridad, rendimiento y usabilidad.
- Si hay varias soluciones válidas, elegir una, registrar brevemente la razón y ejecutarla. No convertir cada elección de paquete, componente, color, puerto de prueba o nombre de clase en una pregunta.
- Buscar primero las rutas/repositorios/plugins que ya puedan descubrirse localmente. No pedir al usuario información que esté en el código, configuración autorizada o documentación.
- Si falta un valor externo, usar configuración por entorno y adaptadores/fakes exclusivamente en pruebas. Completar implementación, UI, contratos, manejo de errores y pruebas independientes. Agrupar los valores externos pendientes en PROGRESS.md sin preguntar por cada uno durante la ejecución.
- No simular un pago real aprobado para marcar como terminada la integración. Distinguir implementación terminada, proveedor simulado, proveedor de prueba y producción.
- Una dependencia bloqueada debe bloquear solamente las tareas que realmente dependen de ella. Continuar con los demás casos de uso, diseño, pruebas e infraestructura.
- Si un control obligatorio o la propia sesión impiden toda ejecución, describir el bloqueo exacto y el trabajo preservado. Una instrucción escrita no puede mantener viva una sesión que el host haya detenido.

## 3. Ciclo de trabajo obligatorio

Mantener un backlog único con los casos de uso de la sección 6 y las fases P0–P8. Para cada tarea: leer el código relevante, implementar la solución completa, probar lo que cambia, revisar, corregir hallazgos, integrar los cambios compatibles y seleccionar la siguiente tarea.

Los límites de líneas, contexto, revisiones o tamaño de candidato se resuelven dividiendo el trabajo en candidatos coherentes. No reducen el alcance total del encargo. Un candidato de 200 líneas, una revisión con horizonte terminal, un commit validado o una fase completada son hitos internos.

Antes de cerrar una tanda, ejecutar una comprobación de continuación:

1. ¿Quedan casos de uso o requisitos transversales sin implementar?
2. ¿Hay diseño provisional, pantallas incompletas, TODO funcionales, rutas sin conectar o simulaciones en el camino productivo?
3. ¿Hay correcciones en worktrees/ramas sin integrar, pruebas fallidas o hallazgos pendientes?
4. ¿Quedan tareas independientes que puedan avanzar con los recursos actuales?

Si alguna respuesta es sí, continuar con el siguiente trabajo ejecutable. Compartir avances breves sin convertirlos en un cierre del encargo.

No usar «MVP», «base», «primera entrega», «slice» o «fase terminada» como sustituto del sistema completo pedido. Mantener commits pequeños mientras se completa el alcance entero.

## 4. Recuperar el trabajo local del registro adjunto

El usuario aportó una salida de Codex local del 18/11/2026. Es evidencia reportada por esa sesión, no una ejecución realizada por el agente que preparó estas instrucciones.

El registro identifica:

- Rama principal de implementación: feat/camba-v2.
- Worktree/rama de revisión: review/camba-v2-sliced.
- Candidato de acceso de compradores: 0b66ee6.
- Corrección posterior: a6b2af6547617f4846554c8eac1cdbf84a050d2e.
- Correcciones reportadas: migración forward para añadir role a una base existente sin perder cuentas/roles, y reenvío del correo de verificación cuando falla su encolado.
- Evidencia reportada: 9 pruebas/60 aserciones; ejecución adicional sobre MySQL aislado; reenvío HTTP 401 anónimo/204 autenticado; Pint y OpenAPI aprobados.
- En esa sesión, la corrección todavía no estaba integrada a feat/camba-v2.
- Archivos locales de progreso modificados y una carpeta .impeccable/ sin seguimiento.

Al retomar, inspeccionar git status, git worktree list, ramas y log reales. Verificar dónde existe la corrección y qué ha cambiado desde el registro. Conservar archivos modificados y .impeccable/. No resetear, borrar worktrees o copiar una carpeta antigua encima.

Leer PROGRESS.md y odd/tasks/camba-v2.md si existen localmente. Si origin/main contiene nuevas instrucciones, obtenerlas y conciliarlas sin sobrescribir los registros locales. No reemplazar un avance local más nuevo por el PROGRESS inicial del remoto.

Comprobar que el commit corregido conserva los dos arreglos y sus pruebas. Resolver la revisión nativa por el procedimiento soportado, integrar la corrección en la rama de implementación, verificar allí y continuar con workspace Angular, Docker dev y CI. No dejar el sistema dividido entre ramas como resultado final.

## 4.1. Checkpoint posterior: priorizar el estado real más reciente

El usuario aportó después otro registro local: `feat/camba-v2` en `c429f10`; revisión de cuentas `f1d1b8a` aprobada y cerrada; 98 pruebas / 1.258 aserciones reportadas, Pint y OpenAPI aprobados. Las correcciones antiguas ya aparecen integradas en el progreso adjunto. El backend avanzó en catálogo, medios, carrito, pedidos, pagos/reconciliación, importaciones, comunicaciones y entrega aislada. El principal trabajo restante es la interfaz funcional completa y su validación, además de verificaciones externas.

Estos resultados proceden del registro del usuario y deben contrastarse con el checkout actual. El remoto puede contener solamente el encargo: no asumir que origin/main tiene el avance local. Conservar `feat/camba-v2`, sus commits, cambios sin commit, worktrees, `PRODUCT.md`, `.impeccable/` y los documentos locales más nuevos.

La descripción anterior de `a6b2af6` es histórica. No ejecutar de nuevo su recuperación/integración si el log y el árbol muestran que ya se realizó. No reabrir automáticamente la revisión cerrada de `f1d1b8a`. Continuar desde la lista vigente de aceptación, sin repetir la auditoría general ni reconstruir el backend que ya funciona.

## 5. Recuperación de revisiones y hooks

El registro muestra dos fallos de herramientas diferentes:

### Revisión recuperada

gentle-ai creó una revisión sucesora y una consulta posterior siguió apuntando al predecesor, devolviendo «recovery predecessor already has successor». No repetir ese mismo comando esperando otro resultado ni crear recuperaciones duplicadas.

Usar el estado/autoridad de la revisión sucesora, el repositorio/worktree correcto y la ayuda/documentación instalada de esa versión. Inspeccionar contexto, commit/base y continuidad antes de ejecutar la siguiente transición. Si el proveedor requiere revisar un candidato corregido, vincular el commit real y obtener el resultado por su flujo soportado.

Los resultados o consentimientos de un candidato no se atribuyen a otro automáticamente. No inventar una aprobación para avanzar. El éxito de una recuperación no demuestra que la corrección haya sido revisada.

### Hook de sesión

El mensaje repetido fue: «Codex host session resolution could not be confirmed». Es un fallo de integración de sesión/contexto del hook, distinto de una prueba de aplicación fallida.

Diagnosticar instalación/versiones y configuración de la integración, directorio de trabajo, contexto del repositorio/worktree y resolución de la sesión usando comandos y mecanismos soportados. Aplicar una reparación local verificable y volver a comprobar el hook antes de declarar el problema resuelto.

No repetir indefinidamente el mismo comando rechazado, ni cambiar el código de negocio para intentar resolver un error del host. No falsificar IDs de sesión, consentimientos o estados de revisión, ni anular controles obligatorios para ocultar el fallo. No modificar los proyectos de referencia o configuraciones globales ajenas al problema.

Conservar todos los cambios antes de una reparación o reinicio que el procedimiento requiera. Si la integración afecta a una parte del flujo, continuar con tareas independientes que sigan permitidas. Si el host impide cualquier herramienta o exige una acción humana, registrar el bloqueo real; no prometer que AGENTS.md por sí solo lo puede eliminar.

## 6. Matriz de cobertura obligatoria

Crear un registro de aceptación por cada ID, vinculando implementación, pruebas y evidencia; no marcar aprobado por existir un archivo o una ruta.

| ID | Caso de uso | Resultado exigido |
| --- | --- | --- |
| UC01 | Registro de comprador | Cuenta válida, sin escalada de rol, normalización y unicidad |
| UC02 | Verificación de correo y reenvío | Caducidad, límites y recuperación tras fallo de cola |
| UC03 | Login/logout/sesión | CSRF, recarga, vencimiento y separación de cuentas |
| UC04 | Recuperación de contraseña | Token seguro, vencido/usado y revocación correspondiente |
| UC05 | Perfil y direcciones | Edición validada y propietario verificado |
| UC06 | Carrito invitado y autenticado | Persistencia, cantidades, stock y asociación segura |
| UC07 | Acceso administrativo | Permisos en backend y ausencia de acceso comprador/anónimo |
| UC08 | Navegación del catálogo | Búsqueda, categoría, marca, orden y paginación |
| UC09 | Ficha pública | Fotos, precio, disponibilidad, descripción y 404 correcto |
| UC10 | Categorías | Alta, edición y desactivación; planas, sin jerarquía |
| UC11 | Marcas | Gestión simple y asignación opcional |
| UC12 | Productos | Alta, edición, borrador, publicación y archivo |
| UC13 | Precio y stock en admin | Cambios simples, validados y auditados |
| UC14 | Galería de fotos | Múltiples archivos, portada, orden, optimización y errores |
| UC15 | Carga por fotos | Grilla de borradores, agrupación y publicación explícita |
| UC16 | Vista previa CSV/XLSX | Validación, altas/cambios identificados y errores por fila |
| UC17 | Ejecución de importación | Progreso, resultado, reanudación y no duplicación |
| UC18 | Checkout | Datos mínimos y entrega/retiro/costos claros |
| UC19 | Pedido y reserva | Líneas/total inmutables y stock transaccional |
| UC20 | Inicio/reintento de pago | Checkout Mercado Pago asociado al pedido correcto |
| UC21 | Webhook | Firma, recepción durable y sincronización segura |
| UC22 | Conciliación sin webhook | Pago confirmado desde servidor con navegador cerrado |
| UC23 | Contingencias de pago | Duplicados/concurrencia/eventos viejos/pago tardío |
| UC24 | Consulta de pedidos propios | Historial/resultado seguros para comprador e invitado |
| UC25 | Gestión de pedidos | Preparación, envío/retiro y estados coherentes |
| UC26 | Correos transaccionales | Envío después del commit con reintentos sin duplicados |
| UC27 | Recordatorios de comprador | Pago pendiente/carrito habilitado, vigencia y preferencias |
| UC28 | Avisos administrativos | Nuevo pago, incidencias, stock bajo y pedidos pendientes |
| UC29 | Configuración y auditoría | Datos comerciales/operativos y cambios permitidos trazables |
| UC30 | Migración de datos/fotos | Dry-run, mapeos, conciliación y repetición segura |

| ID | Requisito transversal | Resultado exigido |
| --- | --- | --- |
| T01 | Diseño completo | Store/admin/auth/checkout y todos sus estados terminados |
| T02 | Responsive y accesibilidad | 320 px/escritorio, teclado, foco, contraste y errores claros |
| T03 | Rendimiento y SEO | SSR/hidratación, imágenes/bundles medidos, índices y sin N+1 relevante |
| T04 | Docker dev/prod | Arranque reproducible aislado y producción sin dev server/seed destructivo |
| T05 | CI/CD selectivo | PRs concluyentes e imágenes/despliegues independientes por componente |
| T06 | Operación y calidad | Salud, respaldo/restauración, pruebas y recuperación documentadas |

La lista organiza requisitos existentes. No reintroducir descuentos, cupones, tags, departamentos del catálogo, subcategorías, variantes genéricas ni otras funciones descartadas para «completar» el sistema.

## 7. Definición de terminado

El sistema está terminado cuando UC01–UC30 y T01–T06 están implementados y verificados en el entorno correspondiente, el diseño ya no es provisional, los arreglos están integrados, las suites pertinentes pasan, no quedan hallazgos de la revisión sin resolver y existen instrucciones reproducibles de ejecución/entrega/operación.

El despliegue real depende de disponer de configuración, accesos y secretos válidos. Cuando falte algo externo, completar todo lo que sí puede terminarse, mantener preparado el pipeline y enumerar exactamente la única verificación/acción pendiente por dependencia. No llamar «sistema completo validado en producción» a lo que solo se probó con fakes.

Los reportes de avance no son cierres. Una pausa técnica de sesión debe dejar un checkpoint preciso para continuar desde ahí; no reiniciar desde cero ni reducir el objetivo al último commit.

## 8. Continuar el frontend cuando falla el acceso al navegador

### Cambio del orden de trabajo

El registro local establecía «no pasar a fases posteriores» hasta capturar el hero de Impeccable. La condición de revisar la primera pantalla antes de extenderla también figuraba en el encargo remoto. **Esa dependencia global queda sustituida:** una validación visual pendiente no impide implementar otras pantallas, integrar API, formularios y estados, escribir pruebas o terminar el diseño en código.

Conservar Impeccable, las comps y placas elegidas como referencia visual. No borrar su configuración ni registrar fases como aprobadas sin sus evidencias. Si su proceso de comp exige una captura aún no disponible, mantener esa comprobación pendiente y continuar el trabajo funcional fuera de esa dependencia de orden. No desactivar hooks de seguridad ni inventar una excepción técnica para afirmar que el gate pasó.

### Alternativa ejecutable en el proyecto

1. Comprobar una vez el estado actual de las herramientas y de los servidores de store/admin. Conservar los puertos del proyecto o elegir otros libres. No volver a comprobar lo mismo sin cambio de entorno ni dedicar la tanda completa a diagnosticar Brave.
2. Inspeccionar los tests/dependencias del workspace. Si falta, incorporar `@playwright/test` como dependencia de desarrollo compatible y con lockfile, mediante el gestor y los permisos admitidos en la sesión. Instalar su Chromium por la vía oficial. Es un runner de pruebas de la aplicación propia, no una forma de controlar un navegador ajeno cuya URL no se haya confirmado.
3. Configurar baseURL/webServer y datos de prueba aislados. Lanzar Chromium headless desde Playwright sin depender de una pestaña abierta de Brave ni de Computer Use. Si corresponde usar Docker/CI para el runner, mantener la versión de imagen alineada con el paquete y documentar la conectividad a los servicios de prueba.
4. Navegar a la aplicación real, ejecutar acciones/expectativas y obtener screenshots. Capturar el hero a 1586×992 para comparar con la comp existente y vistas móviles a 320 px; añadir tamaños intermedios necesarios. Abrir las imágenes y corregir discrepancias reales. No generar una imagen de diseño y presentarla como captura del producto.
5. Registrar en el flujo de diseño únicamente evidencias que ese flujo admita y que realmente se hayan producido. Si exige otra vía no disponible, mantener pendiente esa validación específica; la captura de Playwright conserva su valor como prueba independiente, sin atribuirle una aprobación inexistente de Impeccable.
6. Si no puede ejecutarse ningún navegador autorizado, registrar la causa y seguir implementando UI, componentes, rutas, formularios y estados completos con comprobaciones estáticas/unitarias/builds. Estos controles permiten avanzar, pero no se etiquetan como pruebas visuales, de accesibilidad o E2E aprobadas. Reintentar el navegador cuando cambien las condiciones o al verificar la siguiente entrega.

Documentación oficial: https://playwright.dev/docs/intro , https://playwright.dev/docs/browsers y https://playwright.dev/docs/running-tests . Ajustar comandos/versiones al workspace real. Esta alternativa se propuso antes de recibir evidencia de ejecución; el checkpoint de la sección 9 informa el avance posterior. Priorizar siempre el estado local actual.

### Trabajo concreto a continuar

El backend reportado y los shells Angular permiten avanzar sin volver a planificar todo. Inspeccionar el estado actual y completar, en entregas pequeñas:

- Admin funcional de productos, categorías/marcas, precio/stock, publicación/archivo y galería; conectar los endpoints existentes.
- Carga agrupada por fotos, vista previa de planilla, confirmación, progreso, corrección de errores y reanudación.
- Pedidos administrativos, preparación/envío/retiro, avisos y configuración operativa.
- Store: inicio, catálogo, filtros/búsqueda/paginación, ficha, galería y 404; SSR e hidratación reales con datos de API.
- Cuenta: registro/login/verificación/reenvío/reset, perfil, direcciones y pedidos propios.
- Carrito invitado/comprador, checkout, entrega/retiro y retorno de pago con todos sus estados.
- Preferencias, recordatorios y notificaciones visibles que correspondan.
- Responsive, semántica, foco, errores, estados vacíos/carga y rendimiento en cada recorrido; terminar el diseño ya en la implementación.

Primero reutilizar y corregir los contratos existentes; cambiar backend solo donde falte una capacidad o un fallo real impida esos recorridos. No gastar la siguiente tanda en volver a revisar las mismas cuentas ya aprobadas mientras toda la UI sigue pendiente.

### Estado y criterio de cierre

Actualizar localmente PROGRESS.md y el log de tareas para distinguir «implementación pendiente» de «implementado, pendiente de verificar en navegador». Sustituir la frase que bloquea fases posteriores por esta regla. No sobrescribir esos archivos con sus versiones iniciales de origin/main.

Compartir avances y continuar automáticamente al siguiente caso de uso. Si el navegador aún falta, eso no justifica una respuesta final mientras haya código/diseño/integración/pruebas independientes por completar. Una vez agotado todo el trabajo ejecutable, describir solo las verificaciones que realmente continúan bloqueadas. No declarar completo/visualmente aprobado/productivo lo que todavía no se verificó.

## 9. Completar la aceptación local antes de esperar a staging

### Checkpoint posterior reportado

El registro aportado por el usuario sitúa `feat/camba-v2` en `051939b`: revisión de operaciones de `885d4c2` aprobada y acusada, seguimiento documental/prueba `aeb13aa` e importación real CSV/XLSX por Chromium y worker en `ae7a569`. Reporta 17/17 recorridos Chromium, 100 pruebas PHP / 1.297 aserciones en SQLite, Pint y sintaxis OpenAPI. Son resultados de la sesión local, no verificaciones repetidas desde GitHub.

Conservar la revisión de cuentas cerrada de `f1d1b8a` y la de operaciones de `885d4c2`, con sus alcances exactos. No extender esas aprobaciones a commits posteriores ni reabrirlas por defecto. Inspeccionar primero el HEAD y los registros reales; `051939b` es una referencia histórica de continuidad, nunca un destino para resetear una rama más avanzada.

La matriz adjunta conserva pendientes que pueden probarse localmente. La dependencia de Mercado Pago, SMTP externo o datos comerciales no bloquea esos recorridos. Sustituir localmente el próximo paso que deja toda mejora de LCP para staging por el siguiente trabajo concreto.

### Primero: diagnosticar y corregir el LCP móvil

El informe existente usa SSR compilado, Lighthouse 13.6.0 y una imagen sintética de 2.980 bytes; reporta LCP 3,4 s frente a la meta de 2,5 s. Identificar el elemento LCP real antes de atribuirlo al hero.

- Reproducir el comando de DEVELOPMENT.md. Guardar URL, commit, versión, perfil móvil/CPU/red y condiciones de caché/servidor; comparar cinco ejecuciones antes/después con la misma configuración y todas sus mediciones, además de la mediana. No escoger solo la mejor ni reducir las restricciones para aprobar.
- Conservar informe JSON y traza/red. Desglosar TTFB, demora de inicio del recurso, descarga y demora de render. Si el elemento es texto, los tiempos de recurso pueden ser cero.
- Corregir la causa dominante observada: esperas de API/SSR, descubrimiento tardío, CSS/fuentes, hidratación o contenido oculto por JavaScript. Comprobar el HTML inicial y la cascada antes de decidir. No aplicar indiscriminadamente precargas ni comprimir aún más una imagen minúscula sin evidencia.
- Mantener contenido, accesibilidad y dirección visual. Verificar los recorridos afectados; registrar la diferencia y cualquier límite del entorno. La medición con catálogo/edge real sigue pendiente hasta disponer de ellos, aunque el laboratorio mejore.

Guía primaria del diagnóstico: https://web.dev/articles/optimize-lcp . Preparar la medición de campo de INP para cuando exista tráfico real; su ausencia antes del lanzamiento no significa que falte una implementación que pueda probarse ahora.

### Después: agotar los pendientes locales de la matriz

Inspeccionar si ya se completaron desde el registro. Corregir fallos reales y añadir solo la evidencia necesaria, reutilizando la fixture y los servicios aislados existentes.

| Casos | Siguiente evidencia local pendiente |
| --- | --- |
| UC02 y UC04 | Navegador → solicitud real → worker → correo recibido en Mailpit → enlace entregado → verificación o reset exitoso. Comprobar el acceso resultante; una prueba de token inválido no cubre el éxito. SMTP externo queda separado. |
| UC03 | Caducidad natural de una sesión en la fixture y recuperación del acceso. Ajustar el tiempo solo en configuración aislada, conservando las reglas productivas. |
| UC06 | Fusión de carrito invitado al iniciar sesión y acciones en pestañas simultáneas, con persistencia y límites de stock/precio del servidor. |
| UC08 | Catálogo con suficientes productos para varias páginas; filtros y navegación adelante/atrás conservan URL, resultados y estado coherentes. |
| UC10, UC11 y UC12 | Recorrido positivo de marca y contención relevante en MySQL aislado para clasificación y ciclo de publicación/archivo. Reutilizar pruebas existentes si demuestran las invariantes. |
| UC14 y UC15 | Escrituras concurrentes de galería y recuperación de un resultado de subida incierto consultando el catálogo guardado antes de repetir. Comprobar que no haya duplicados ni pérdida de portada. |
| UC18 | Entrega completa desde navegador con cotización real de la API aislada; mantener la validación comercial de dirección/tarifa como dependencia distinta. |
| UC23 | Interrumpir y reanudar el procesamiento del inbox en el entorno aislado, preservando idempotencia. Los fakes prueban recuperación local, no certifican Mercado Pago. |
| T02 | Contraste de estados, zoom, movimiento reducido, foco, errores y una comprobación con otro motor disponible. Revisar tienda y admin; Lighthouse 100 no equivale a revisión integral. |
| T06 | Ensayo reproducible de restauración de base y archivos multimedia sintéticos en volúmenes nuevos, y recuperación segura de trabajos/notificaciones pendientes. No restaurar sobre el legado ni publicar efectos externos. |

**Lector de pantalla:** utilizar NVDA en Windows u otro lector realmente disponible mediante las capacidades autorizadas de la sesión. Recorrer encabezados, formularios, validaciones, estados dinámicos, diálogos e importación/checkout con teclado. NVDA ofrece Speech Viewer para inspeccionar el texto anunciado: https://www.nvaccess.org/get-help/accessibility-testing-with-nvda-free-sample/ . Registrar lector, navegador, recorrido y observaciones reales. Si no hay capacidad de operar/observar el lector, dejar solo esa validación pendiente y seguir con los demás controles; el árbol accesible y las pruebas automáticas no la reemplazan.

Actualizar la matriz local después de cada resultado. Separar «pendiente ejecutable localmente» de «requiere servicio/dato externo» dentro de cada fila. No añadir módulos nuevos, duplicar pruebas ya suficientes ni inventar tareas para prolongar la ejecución.

### Herramientas, documentación y cierre concreto

El mensaje genérico `Hook failed / code 1` no identifica por sí solo el hook ni demuestra que fallaron los commits o las pruebas. Localizar nombre, fase y log, informar la causa observada y reparar solo por mecanismos soportados. No atribuirlo a Engram sin comprobarlo, desactivar un control obligatorio o alterar un acuse para aparentar éxito.

Actualizar README, PRODUCT, PROGRESS y el log local cuando tengan afirmaciones de estado obsoletas, por ejemplo «no hay aplicación implementada», conservando los registros históricos y sus fechas. No reemplazarlos por las versiones iniciales remotas. Incorporar estas instrucciones mediante conciliación de los cambios documentales; no descartar código local.

Cuando no quede trabajo local ejecutable, entregar un estado verificable con: cobertura y comandos reales, mediciones LCP antes/después, defectos todavía abiertos, validaciones externas pendientes y pasos exactos para retomarlas. Mercado Pago necesita cuenta de prueba/TLS; SMTP necesita configuración autorizada; la migración necesita export/fotos aislados. Descubrir configuración autorizada ya disponible sin imprimir secretos ni tomar credenciales de otros proyectos. No declarar integración externa aprobada a partir de fakes.

Las revisiones citadas certifican únicamente sus candidatos; conservar las reglas vigentes de publicación y despliegue y completar la preparación de CI/CD. No extender una aprobación de API al release. Mientras haya una corrección, recorrido o comprobación local ejecutable dentro del alcance, continuar automáticamente.
