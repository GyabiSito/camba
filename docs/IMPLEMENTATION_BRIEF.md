# Encargo completo — Camba v2 con Codex local

**Autor del encargo:** José Gabriel Hernández. **Fecha:** 18/11/2026. **Repositorio:** GyabiSito/camba.

Este documento convierte la auditoría y las decisiones posteriores del usuario en un trabajo ejecutable. Las decisiones posteriores mandan: catálogo simple con categorías y marca; sin promociones, cupones, tags ni jerarquía de departamentos. La implementación se realizará en Codex local para aprovechar sus plugins de diseño.

## 0. Ejecución continua

El mandato posterior del usuario es completar absolutamente todos los casos de uso y el diseño sin preguntas rutinarias. Aplicar `docs/AUTONOMOUS_EXECUTION.md`, incluida la recuperación de worktrees/revisiones/hooks y la matriz UC01–UC30/T01–T06. El cierre de cada fase indica continuar con la siguiente; no es una solicitud de autorización nueva.

## 1. Resultado que se debe entregar

Una tienda funcional, visualmente nueva, rápida y simple de administrar. Debe permitir cargar productos individualmente y en masa, vender con Mercado Pago, gestionar pedidos y enviar notificaciones/recordatorios confiables. Monorepo Laravel 13 + Angular 22, Docker de desarrollo separado de producción y entrega productiva exclusivamente por CI/CD.

Codex debe implementar, ejecutar, probar, corregir y documentar. No detenerse en un scaffolding, pantallas estáticas, una propuesta de arquitectura ni una lista de TODO. Una integración simulada permite probar, pero no sustituye su validación con el proveedor de prueba. Avanzar el resto del producto si una credencial externa falta y registrar exactamente qué falta para terminar.

## 2. Alcance comercial definitivo

### Incluido

- Catálogo por SKU con fotos, nombre, precio final en UYU, stock, categoría y marca opcional.
- **Una categoría plana por producto**; categorías y marcas con alta/edición/desactivación sencilla desde Productos.
- Borrador, publicado y archivado, con acciones explícitas y conservación de referencias de pedidos.
- Búsqueda, filtros por categoría/marca, orden y paginación.
- Carrito y checkout; cuentas con login, registro, verificación de correo y recuperación de contraseña; perfil/direcciones/pedidos propios.
- Compra como invitado y cuenta opcional como simplificación propuesta por la auditoría; carrito persistente y asociación segura al iniciar sesión.
- Mercado Pago siguiendo el patrón real de Komorebi, webhook y consulta/reconciliación desde backend cuando falta la notificación.
- Pedidos, seguimiento de pago, preparación, envío/retiro y observaciones operativas mínimas.
- Importación CSV/XLSX y carga rápida a partir de fotografías.
- Correos transaccionales, recordatorios definidos en la sección 7 y avisos operativos del administrador.
- Configuración mínima de datos comerciales, contacto, entrega/retiro, correo y comportamiento de recordatorios.
- SEO técnico, accesibilidad, rendimiento, pruebas, migración de datos y despliegue automatizado.

### Excluido

Descuentos, precios tachados, ofertas, cupones, promociones, campañas flash, cronómetros, tags, departamentos del catálogo, subcategorías, categorías anidadas, favoritos, comparador, reseñas, generador de atributos/propiedades/variaciones, dashboards KPI extensos, múltiples comercios, suscripciones, programas de puntos, WhatsApp y módulos EV/avícolas.

Estas funciones no deben quedar como tablas/API/pantallas escondidas, ramas muertas o grandes bloques comentados. El catálogo no tendrá `parent_id` para categorías, campos de descuentos ni dependencias de promociones. Los departamentos geográficos usados para direcciones de Uruguay no son departamentos comerciales del catálogo.

La unidad vendible inicial es el producto con SKU propio. Si el inventario anterior tiene talles/colores con stock independiente, preservarlos mediante un mapeo explícito a unidades vendibles/SKU simples; no colapsar existencias ni borrar combinaciones. No construir un configurador genérico de variantes para resolver esa migración.

## 3. Relevamiento inicial obligatorio, sin paralizar la implementación

1. Inspeccionar el nuevo repositorio y conservar cambios existentes. Revisar AGENTS.md, este encargo, las referencias y el progreso.
2. Localizar checkouts de Komorebi, GAM, Voltio y Camba anterior mediante las carpetas conocidas/cercanas, configuración de repositorios o conectores disponibles. Revisarlos como referencia de lectura. Registrar ruta, origen Git, commit y cambios locales relevantes sin publicar datos sensibles.
3. Leer composer.json/lock, ejemplos reales de Controller/Action/Form Request/Policy, autenticación, pagos, jobs, scheduler, notificaciones, pruebas y Docker/CI de las referencias necesarias.
4. Enumerar los plugins/skills/MCP que están realmente disponibles en esta sesión local y aplicar los que ayuden al diseño, accesibilidad, optimización, Laravel y pruebas. No asumir que una conexión remota existe localmente o viceversa.
5. Verificar versiones estables y compatibilidad en documentación oficial, fijar runtime/lockfiles y dejar una breve matriz de dependencias con motivo de uso.
6. Revisar la marca y el catálogo de Camba. Crear una dirección visual y componentes reales desde el comienzo, incluyendo estados de formulario y móvil. El diseño no debe quedar como una capa pendiente al final.

Si Komorebi no se encuentra, continuar con base, diseño, catálogo y pruebas independientes. Pedir su ubicación únicamente cuando sea necesaria para cerrar la adaptación real de pagos/autenticación. No declarar que se copió su implementación sin leerla.

## 4. Arquitectura y paquetes

### Monorepo

| Ubicación | Responsabilidad |
| --- | --- |
| api/ | Laravel 13: aplicación, migraciones, pruebas y contrato OpenAPI |
| web/ | Workspace Angular 22 con aplicaciones store/admin y librerías compartidas pequeñas |
| infra/ | Dockerfiles, configuración Nginx, scripts de CI y despliegue |
| docs/ | Arquitectura, decisiones, instalación, operación, migración y progreso |
| .github/workflows/ | Validación y entrega selectiva de componentes |

No usar submódulos. Elegir una única convención de nombres para carpetas Angular y usarla en Docker, scripts, imports y filtros de CI. Mantener MySQL como base de Camba para evitar una migración adicional de motor. Redis para colas/rate limiting y caché justificada. No copiar PostGIS ni asumir que los códigos de error de PostgreSQL de Voltio sirven en MySQL.

Usar PHP compatible con Laravel 13 y los paquetes seleccionados, preferentemente 8.4/8.5 estable; Node/TypeScript compatibles con Angular 22. Resolver e instalar versiones estables; no trasladar rangos de otro composer.json como una certificación. Documentar las versiones efectivamente ejecutadas.

### Estructura Laravel

Adoptar las convenciones observadas en GAM: `app/Actions/<Area>`, `app/Http/Controllers/<Area>`, `app/Http/Requests/<Area>`, `app/Http/Resources/<Area>`, `app/Models`, `app/Policies`, `app/Enums`, `app/Services` y contratos/DTO/Queries donde resuelvan un problema real. Áreas iniciales: Identity, Catalog, Imports, Orders, Payments, Notifications y Settings.

- Controller adapta HTTP y delega; no calcula precios, envía correos o hace transacciones de negocio.
- Form Request específico por operación: normalización segura, autorización HTTP, reglas, mensajes y nombres de atributos comprensibles en español.
- Action por caso de uso con `execute()`, tipado, invariantes, transacciones y autorización correspondiente. Las reglas no deben desaparecer al ejecutar un import o job sin Form Request.
- Policies/Gates para permisos y propietario; no confiar en IDs/roles del frontend. Consultas siempre limitadas al usuario/alcance permitido.
- Resources para contratos de salida; paginación y errores coherentes, OpenAPI actualizado y cliente Angular tipado.
- Enums para estados y transiciones explícitas de pedido/pago/importación. Dinero exacto, fechas UTC y presentación local Uruguay.
- Contratos para Mercado Pago, envío de correo, reloj u otras fronteras que necesiten sustitución en pruebas. No crear repositorios genéricos, interfaces vacías ni un DTO por campo por cumplir un patrón.
- Eloquent directo en Actions es válido; Queries separadas para lecturas que realmente lo ameriten. Reutilizar servicios de dominio para alta individual, lote y migración.
- Auditoría de cambios administrativos con actor, entidad, evento y campos permitidos; sin contraseñas, tokens, secretos o dumps del request.

La arquitectura limpia debe verse en separación de responsabilidades y facilidad de prueba. No significa recrear un framework propio por encima de Laravel. GAM y Voltio tienen estructuras diferentes: aprender de ambos y mantener **una** estructura coherente en Camba.

### Paquetes a evaluar e integrar según función

| Necesidad | Base preferida |
| --- | --- |
| Sesión web | Laravel Sanctum con cookies/CSRF; adaptar la referencia local verificada |
| Colas y trabajos | Laravel queues/scheduler y Horizon para Redis |
| Permisos | spatie/laravel-permission + Policies; roles comprador/admin, sin constructor de roles complejo |
| Fotos, galerías y conversiones | spatie/laravel-medialibrary; optimización de imágenes y miniaturas |
| Auditoría | spatie/laravel-activitylog con datos permitidos |
| Filtros API | spatie/laravel-query-builder con filtros/orden permitidos y límites |
| CSV/XLSX | spatie/simple-excel, observado en GAM; confirmar compatibilidad y límites |
| Respaldo | spatie/laravel-backup o el mecanismo probado de la infraestructura; cubrir datos y medios, verificar restauración |
| Salud operativa | spatie/laravel-health + readiness; endpoints sensibles internos/protegidos |
| SEO | spatie/laravel-sitemap o generador sencillo si evita una dependencia innecesaria |
| Dinero | brick/money o valor monetario exacto; persistencia consistente en centésimos |
| Calidad | Pint, análisis estático Larastan/PHPStan y pruebas PHPUnit/Pest según una convención única |

No agregar de oficio event-sourcing, multitenancy, tags, comentarios, dashboards, traducción multiidioma, websocket o paquetes de reporting ajenos al alcance. DTOs nativos tipados son suficientes salvo una ventaja concreta de laravel-data. Documentar el paquete seleccionado, su uso real y sus dependencias de sistema, incluidas las herramientas de procesamiento de imágenes/respaldo en Docker.

## 5. Autenticación, cuenta y administración

Reutilizar los patrones de login/registro de Komorebi/GAM/Voltio adaptados al comercio: alta pública exclusivamente de comprador; invitado puede comprar sin convertirse en administrador; admin se aprovisiona de forma controlada, sin credenciales fijas versionadas. No trasladar PIN, dispositivos compartidos ni registro interno de GAM a Camba.

Implementar verificación de email, recuperar/restablecer contraseña con token aleatorio, caducidad, uso único e invalidación de sesiones según corresponda; login/logout/me; normalización coherente del email y unicidad respaldada por base; rate limiting y mensajes razonables. No duplicar hashing ni trasladar pepper antiguo sin estrategia de migración comprobada.

Usar Sanctum stateful para la web propia y CSRF; sesiones/cookies seguras en producción y configuración de origen por entorno. No guardar tokens largos en localStorage si se usa sesión web. Resolver explícitamente dominios de store/admin/API o un gateway bajo el mismo origen. Probar login, recarga, vencimiento, retorno del checkout y cambio de cuenta sin fugas de carrito/direcciones.

Admin con tres destinos: Productos, Pedidos y Configuración. Acceso a auditoría/estado de importaciones/avisos como vistas contextuales, no un menú creciente. Precio, stock y publicación editables desde la lista con validación. Filtros y selección para acciones masivas. Archivar antes que borrar elementos con historia. Ver la tienda y previsualizar el producto debe ser directo.

Formulario básico: fotos, nombre, precio final, stock y categoría; descripción breve opcional; marca opcional. Código automático estable e independiente de nombres de categoría/marca. Crear categoría/marca en contexto si se necesita. Evitar editor enriquecido complejo, tags, resumen duplicado, campos fiscales o de SEO obligatorios, recorte obligatorio de fotos y pestañas avanzadas vacías.

## 6. Catálogo, fotos e importación

Definir precio/stock/estado válidos en API y base. Precio exacto y positivo, stock entero no negativo, SKU y slug únicos, manejo claro de colisiones, publicación solo con datos mínimos y al menos una imagen válida. Las desactivaciones de categorías/marcas no pueden destruir pedidos ni dejar cambios silenciosos del catálogo.

Fotos: selección múltiple, arrastrar/reordenar, portada, progreso/reintento y errores por archivo. Validar contenido real, peso y dimensiones; normalizar orientación, producir miniaturas/formatos optimizados y no servir originales gigantes en tarjetas. Pruebas con fotos reales de celular, JPEG con metadatos, PNG y WEBP. No reutilizar el validador casero de Camba que depende de un único encabezado JPEG. HEIC solo si el entorno permite conversión y está probado; si no, informar el formato requerido con claridad.

### Carga rápida por fotos

Subir varias imágenes y preparar una grilla de borradores. Agrupar explícitamente las imágenes que pertenecen al mismo producto; nunca publicar por inferencias silenciosas. Completar nombre, precio, stock, categoría y marca opcional, con valores comunes aplicables a una selección. Mantener cambios ante error; mostrar vista previa y resumen antes de publicar. Usable desde celular.

### CSV/XLSX

Plantilla mínima: codigo, nombre, precio_uyu, stock, categoria, marca opcional, descripcion opcional y referencias a fotos ya subidas. Sin columnas de ofertas/cupones/tags/jerarquías. Ofrecer descarga de ejemplo y errores por fila.

Proceso en backend: subir → analizar → validar → vista previa de altas/cambios → confirmar → trabajo con progreso → resultado. Distinguir crear/actualizar por SKU; no actualizar por título. Un blanco no borra un dato existente salvo opción explícita. Categorías/marcas desconocidas requieren una política visible de creación; no crear taxonomías por errores tipográficos sin advertencia.

Definir límites de filas/tamaño, codificación, separadores y decimales. Proteger memoria y descompresión de XLSX, validar archivos, no descargar URLs arbitrarias de imágenes ni ejecutar fórmulas. Atomizar cada producto y sus fotos, evitar duplicados por archivo/fila/reintento y soportar reanudación tras fallo del worker. Guardar quién confirmó y qué cambió. Los registros de importación y la unicidad en base deben respaldar la idempotencia, no solo desactivar un botón.

## 7. Pedidos, pagos y recordatorios

### Pedido antes del pago

El cliente envía SKU/producto y cantidad. El backend valida publicación/stock, calcula precios y envío exactos, registra un pedido con líneas inmutables y dirección, reserva existencias y asigna una referencia opaca única. El importe no depende del navegador. Crear la preferencia/checkout a partir de ese pedido, conforme al producto/API utilizado por Komorebi y su documentación vigente.

Separar pedido, intentos de pago, eventos recibidos y notificaciones. Un nuevo intento no duplica el pedido ni la reserva. Registrar identificadores del proveedor y el estado, sin conservar datos de tarjetas ni secretos. Permitir retiro/entrega conforme a la operación real de Camba; no implementar un motor de tarifas avanzado. Cotizar costos antes de confirmar y conservarlos en el pedido.

### Webhook y sincronización

1. Validar forma, tamaño y firma con el contrato oficial de esa API y los headers correspondientes; rechazo explícito ante firma inválida. No copiar un algoritmo de otra variante de Mercado Pago por parecido.
2. Registrar de forma durable la recepción válida y procesarla con un job o síncronamente si se justifica. No responder éxito antes de haber guardado el trabajo que se afirma aceptado.
3. Consultar el recurso de pago a Mercado Pago con credenciales del backend; comprobar referencia, importe, moneda, receptor/cuenta y coherencia con el pedido.
4. Delegar en una única Action de sincronización con transacciones, locks y restricciones únicas. Debe ser segura ante evento duplicado, simultáneo, fuera de orden y distintos intentos para el mismo pedido.
5. Confirmar/liberar/ajustar stock una vez, mantener historial y generar notificaciones después del commit. Un pago aprobado no puede desaparecer de la base porque haya fallado un correo.

El retorno success/failure/pending del navegador es presentación, no evidencia de cobro. Un payment_id recibido por frontend es una pista para verificación, nunca autorización por sí solo. Restringir consulta de pedidos a su dueño o una sesión/credencial de invitado con alcance y caducidad; no exponer datos por ID enumerable.

### Respaldo cuando no llega el webhook

Implementar un proceso **del servidor**, no dependiente de que el comprador mantenga la pestaña abierta. Scheduler/job examina pedidos pendientes elegibles, con lotes limitados, locks, timeout, backoff y frecuencia máxima por pedido. Si conoce payment_id, consulta ese pago; si no, busca por external_reference usando el endpoint compatible. Verificar todas las coincidencias y la cuenta/importe/moneda; no elegir ciegamente el primer resultado. Persistir siguiente intento, resultado y error operable.

Webhook, reconciliación periódica, retorno del checkout y acción administrativa de reconsulta pasan por la misma sincronización idempotente. Limitar/refrescar la consulta del navegador sin multiplicar peticiones al proveedor. Probar explícitamente **webhook ausente + navegador cerrado + pago aprobado** y demostrar que el pedido termina correctamente.

Definir estados pendientes, aprobados, rechazados, cancelados, reembolsados y contracargos según los estados reales del producto elegido. No reabrir un pedido pagado por un evento viejo. Si llegan dos pagos aprobados para el mismo pedido, registrar ambos y marcar la excepción para conciliación, sin descontar dos veces. No implementar una interfaz de reembolsos automáticos fuera del alcance.

### Stock y contingencias

Reservar en transacción con vencimiento. Validar concurrencia por última unidad. Liberar por expiración/cancelación una vez, según el estado del proveedor. Si un pago aprueba después del vencimiento y el stock ya no está disponible, conservar el pago/pedido y marcarlo para resolución administrativa; no perder el cobro, inventar stock ni emitir un reembolso real automáticamente. Probar esta contingencia y documentar la operación.

### Notificaciones y recordatorios

Adaptar de Voltio las claves de deduplicación, unicidad en base, entrega por cola, reintentos y vigencia al ejecutar. Mantener un único canal de correo de producción configurable por Laravel y Mailpit/local equivalente en desarrollo. Notificaciones administrativas dentro del panel cuando aporten; sin infraestructura websocket obligatoria.

Implementar:

- Verificación de cuenta y recuperación de contraseña.
- Pedido creado, pago confirmado y cambios de entrega/retiro relevantes.
- Aviso al administrador de nuevo pedido pagado, incidencia de pago/stock y trabajo de importación terminado/fallido.
- Recordatorio configurable de pago pendiente antes de vencer; no enviar después de aprobar/cancelar/vencer.
- Recordatorio configurable de carrito abandonado para un comprador/contacto identificado que habilitó ese aviso; sin descuentos ni captura invasiva de email del invitado.
- Aviso de stock bajo y pedido pagado pendiente de preparación/retiro al administrador, con deduplicación para evitar ruido.

Proponer tiempos iniciales documentados y editables, límites de frecuencia e interruptor por tipo; no enviar mensajes reales desde suites/seeders. Al enviar, volver a verificar destinatario, preferencias y estado actual. Un cron repetido o dos workers no deben duplicar el mismo recordatorio. El fallo de correo no revierte el pago ni el stock. Mostrar estado/error suficiente para reintentar sin doble envío comercial. No incorporar recordatorios de reservas EV por copiar Voltio.

## 8. Diseño y rendimiento como requisitos de desarrollo

Rediseñar tienda y admin completos. Conservar identidad reconocible de Camba con una dirección visual propia, inspirada en claridad, jerarquía, espacio y consistencia de Apple. Usar los plugins locales disponibles durante diseño, implementación y revisión. No copiar logos/activos de Apple, ni aceptar una plantilla de e-commerce recargada como resultado.

- Una cabecera compacta con búsqueda, Tienda, contacto, cuenta y carrito. Un catálogo principal; categorías/marcas como filtros.
- Inicio breve con propuesta comercial y selección honesta de productos; sin rankings inventados, rellenos aleatorios o múltiples carruseles que repiten lo mismo.
- Ficha con fotos, precio final, disponibilidad, descripción breve y una acción principal. Carrito/checkout cortos, errores claros, progreso y recuperación tras fallo.
- Admin enfocado en trabajo: tabla legible, edición sencilla, carga múltiple y pedidos accionables. Estados vacíos, carga, error, guardado, falta de stock, pago pendiente e importación parcial diseñados expresamente.
- Sistema pequeño de tokens/componentes compartidos: tipografía, color, espaciado, controles, diálogos, tablas y mensajes. Responsive desde 320 px; probar móvil realista y escritorio, teclado, lector/semántica, foco, contraste y reducción de movimiento.
- Sin jQuery ni plugins globales de plantilla; lógica Angular moderna, componentes pequeños, formularios tipados, carga diferida y cancelación/debounce donde aporte.
- Store con SSR/hidratación y metadatos correctos en catálogo/fichas; admin CSR. Sin acceso inseguro a window/localStorage durante SSR. Producto inexistente devuelve una experiencia y estado HTTP 404 correctos, no redirección silenciosa al inicio.
- SDK de pago solo cuando se necesita; no cargarlo en todo el sitio. Imágenes responsivas con dimensiones, miniaturas y lazy loading apropiado; priorizar la imagen principal sin descargar toda la galería de entrada.
- Paginación e índices de base; evitar N+1, invalidar caché al publicar/importar. No cachear respuestas personalizadas o stock reservado de forma insegura ni copiar cinco bases Redis por sección.
- Definir presupuestos medibles de bundles/imagen y una medición reproducible de rendimiento móvil. Registrar LCP/CLS/INP cuando se pueda obtener evidencia adecuada y Lighthouse como medición de laboratorio, sin confundirlo con datos reales de usuarios. No inventar puntuaciones ni relajar presupuestos para conseguir un verde.

La primera entrega visual de admin/catalogo debe revisarse en navegador antes de extenderla. No completar todo el frontend con estilos provisionales para prometer un rediseño posterior.

## 9. Docker de desarrollo y producción

**Desarrollo:** Compose propio con MySQL y Redis aislados, API, worker/scheduler, correo de prueba y frontend(s) con recarga. Documentar un comando reproducible para levantarlo; puertos/configuraciones locales sin colisionar con otros proyectos. Datos sintéticos y seeders explícitos, repetibles y seguros.

**Producción:** Compose separado con imágenes por componente construidas en CI. Dockerfiles/stages de producción con dependencias necesarias, assets compilados, sin dev server ni bind mounts de código. Una misma imagen PHP para API, worker, scheduler y tarea de migración. Procesos/usuarios adecuados, healthchecks, logs controlados, volúmenes de medios y secretos fuera de Git. Sin publicar MySQL/Redis a Internet.

La tarea de migración se ejecuta una vez por release, separada del arranque normal; readiness no se basa en un `.ready` versionado. Ningún arranque de producción ejecuta seed comercial, migrate:fresh, limpieza indiscriminada de Redis o recreación de volúmenes. Config/cache/APP_KEY compartidos coherentemente por los procesos de backend.

Preparar integración con el edge Nginx existente por red/rutas específicas de Camba. No tomar los puertos 80/443 ni reconfigurar Komorebi, GAM o Voltio por defecto. Documentar TLS/dominios confiables y requerimientos del webhook. Probar Compose en un entorno aislado y ensayar respaldo/restauración antes del corte.

## 10. CI/CD selectivo y exclusivamente automatizado en producción

Cada componente tiene imagen y referencia desplegada independiente. API incluye sus procesos worker/scheduler con la misma versión. Evitar una variable global que obligue a usar el SHA del último commit para todas las imágenes, aunque algunas no se hayan construido.

| Cambio | Validación/build/deploy afectado |
| --- | --- |
| api/ o Docker/config de backend | Backend y comprobaciones de contrato relevantes; desplegar API/worker/scheduler |
| Aplicación store | Tienda |
| Aplicación admin | Admin |
| Librerías Angular compartidas, lockfile o configuración común | Ambas aplicaciones Angular |
| Infraestructura/workflow compartido | Todos los componentes realmente afectados y validación de Compose |
| Solo documentación | Checks de documentos que correspondan; sin despliegue de aplicaciones |

Implementar detección de cambios contra los commits correctos del evento, contemplando PR, push con múltiples commits, primer push y cambios compartidos; no inferir siempre con HEAD~1. Si se usa filtrado de rutas, el check obligatorio agregado debe ejecutarse y terminar correctamente aunque un componente no cambie. No dejar el merge bloqueado por un workflow omitido ni considerar aprobado un job fallido por una condición mal escrita.

PR: formato/análisis/tests del componente, pruebas de contrato y UI pertinentes, builds reproducibles y Compose. main: publicar solo imágenes afectadas con SHA/digest inmutable y desplegarlas tras pasar checks. Reutilizar el artefacto probado, sin recompilarlo en el servidor. Acciones/dependencias fijadas y permisos mínimos; secretos para registro, VPS y proveedor fuera de logs.

Despliegue automatizado con bloqueo/serialización y manifiesto persistido de versiones por componente. Evitar carreras entre pipelines y que un release antiguo sobrescriba uno posterior. Actualizar referencias de forma controlada, ejecutar migración compatible si corresponde, hacer pull y recrear solo servicios afectados, comprobar salud y conservar referencia anterior para rollback. No ejecutar down global, reiniciar base/Redis ni recompilar tienda por un cambio exclusivo de API.

Los cambios de API deben conservar compatibilidad con el frontend desplegado o coordinar ambos componentes en el mismo release. Las migraciones deben admitir esa transición; rollback de imagen no revierte automáticamente el esquema ni pedidos nuevos. Documentar recuperación. Para el primer corte, entorno/configuración y secretos deben estar preparados; no inventarlos para afirmar un despliegue exitoso.

## 11. Migración desde Camba anterior

Construir herramienta con modo dry-run, mapeos y reporte de errores. Leer una copia aislada de datos/fotos; no experimentar en la base publicada. Preservar SKU/slugs cuando sea posible, fotos y referencias históricas. Mapear departamento/categoría/subcategoría anteriores a una categoría plana mediante un archivo revisable; conservar marcas opcionales. Conciliar stock por unidades vendibles y dinero exacto; no sumar indiscriminadamente los tres niveles de stock anteriores.

Separar datos reales y de prueba por evidencia, no por suposición de que la tienda no se usa. Mantener pedidos/pagos/usuarios que correspondan y probar la compatibilidad de contraseñas antes de decidir una migración de cuentas. Si requiere restablecimiento, documentar ese recorrido. Conservar promociones históricas solo como snapshot de pedidos, sin reactivar módulos.

Verificar conteos, SKU duplicados, imágenes faltantes, precios/stock, slugs y redirecciones. Importación repetida no duplica datos. Ensayar corte/retorno; si v2 recibe operaciones, no restaurar una base vieja perdiéndolas. El retiro/archivo de repositorios previos es posterior a aceptación y no autoriza borrar bases, volúmenes o fotos.

## 12. Pruebas y criterios de aceptación

Crear pruebas de negocio significativas, no solo tests que duplican el código. Unitarias para invariantes/calculadores y feature/integración con MySQL y Redis para flujos persistentes. Usar fakes/adaptadores de Mercado Pago y correo en las suites; fixtures sintéticos y reloj controlable. Separar pruebas reales contra cuenta de prueba del proveedor, documentando sus resultados sin secretos.

| Área | Evidencia mínima |
| --- | --- |
| Acceso | Registro comprador, verificación, login/logout, reset vencido/usado, CSRF, límites y no escalada a admin |
| Aislamiento | Usuario A no lee/cambia carrito, dirección, pedido o reportes de B; invitado solo accede a su pedido |
| Catálogo | Alta simple sin marca/tags, publicar/archivar, categorías planas, SKU/slug y fotos válidas |
| Importación | Lote válido, errores parciales, SKU repetido, mismo archivo confirmado dos veces, reanudación y actualización sin borrados implícitos |
| Dinero | Precios del cliente ignorados, centésimos/redondeo/envío y moneda coherentes |
| Pago | Firma inválida, pendiente/rechazado/aprobado, retorno sin webhook y consulta del servidor |
| Reconciliación | Webhook ausente y navegador cerrado; referencia con múltiples intentos; API del proveedor lenta/429/fallo y recuperación |
| Idempotencia | Webhook/job duplicado o concurrente, doble intento aprobado y correos/stock una sola vez |
| Stock | Última unidad disputada, expiración de reserva y pago tardío sin perder evidencia |
| Recordatorios | Dos workers/cron repetido sin duplicado, preferencia deshabilitada, cancelación/pago entre programar y enviar, reintento de correo |
| UI | Alta individual y por lotes, compra, login/reset, errores reales de API y móvil/escritorio/teclado |
| Rendimiento | Build/bundles e imágenes medidos, carga diferida, consultas sin N+1 y estados SSR correctos |
| Docker/CI | Instalación limpia, MySQL real, reinicio sin seed destructivo, Compose dev/prod y despliegue selectivo ensayado |
| Datos | Dry-run y migración ensayada con diferencias verificadas; recuperación de respaldo en entorno aislado |

Aceptación de usabilidad: la dueña debe poder crear y publicar productos, corregir precio/stock y preparar un lote desde fotos/planilla sin recorrer marca obligatoria, tags, jerarquías o pantallas técnicas. Proponer una sesión con tres altas y un lote de veinte, registrar lo observado y corregir obstáculos; no atribuirle una validación que no haya realizado.

## 13. Orden de trabajo y entregables

**P0 — Referencias y dirección visual:** entorno/plugins locales, fuentes y commits, decisiones breves de arquitectura/paquetes, flujo operativo y primera dirección visual real. Actualizar REFERENCES/PROGRESS y continuar.

**P1 — Base ejecutable:** monorepo, versiones y lockfiles, Docker dev, CI siempre concluyente, autenticación adaptada, diseño base de formularios y layout, pruebas iniciales.

**P2 — Operación del catálogo:** admin completo, categorías/marcas simples, fotos, edición, publicación, archivo, carga por fotos y CSV/XLSX con progreso; pruebas y revisión de UI.

**P3 — Compra y pagos:** carrito, envío/retiro, pedidos/snapshots/reservas, integración de Komorebi adaptada, webhook y reconciliación por API, acceso seguro a pedidos y pruebas de concurrencia/contingencia.

**P4 — Notificaciones:** correos, recordatorios y avisos operativos con estado/deduplicación/reintentos. Probar scheduler y workers.

**P5 — Tienda completa y diseño final:** terminar todos los recorridos públicos/cuenta/checkout, SEO/SSR, responsive, accesibilidad, estados vacíos/error y consistencia visual. La base visual ya debe haberse usado desde P1/P2.

**P6 — Calidad integral:** escenarios de la matriz, rendimiento medido, seguridad/aislamiento y dependencias, correcciones. No sustituir esta etapa por una revisión de screenshots.

**P7 — Producción por CI/CD:** Docker de producción, imágenes y publicación selectiva, migraciones controladas, secretos/entornos documentados, healthcheck, rollback y ensayo de actualización de un solo componente.

**P8 — Migración y entrega:** dry-run, ensayo de datos/fotos, guías cortas de operación/desarrollo/despliegue/recuperación, README ejecutable, credenciales de prueba por vía segura y lista precisa de verificaciones externas pendientes. Preparar el corte real por pipeline una vez disponible la configuración correspondiente.

Realizar commits coherentes y revisables en la rama de trabajo local, sin mezclar secretos o cambios ajenos. Actualizar documentación y OpenAPI cuando cambia el contrato. Mantener el trabajo avanzando por fases; un checkpoint de sesión debe dejar qué funciona, qué se ejecutó, qué falló y el siguiente comando/tarea concreto.

La entrega final debe incluir código funcional y pruebas, no un documento que asegure que todo está hecho. Para cada área distinguir implementación, ejecución local, proveedor de prueba y validación productiva. Si falta un recurso externo, dejar su integración preparada y el bloqueo exacto, completar lo independiente y no fabricar resultados.
