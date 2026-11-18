# Referencias de implementación

Fecha del relevamiento remoto: 18 de noviembre de 2026. Estos ejemplos orientan decisiones; sus instrucciones de dominio no se convierten automáticamente en requisitos de Camba.

## 1. Komorebi: referencia principal de tienda

URL pública: https://komorebi.com.uy/ . Se inspeccionaron su portada, catálogo y una ficha durante la auditoría de Camba. Se observó navegación concentrada en Tienda, filtros de categorías/marcas y compra con cuenta.

**Limitación:** sus repositorios no aparecen entre los accesibles en esta sesión remota. No se auditó su código aquí. La implementación local debe localizar su checkout y revisar fuentes reales antes de declarar adoptado su patrón de pago, autenticación o administración.

Contexto previo útil como pistas, no como verificación actual de archivos:

- Carpeta de API identificada anteriormente como `KomorebiApi`; frontend `KomorebiStore`; administrador separado. Las rutas locales pueden haber cambiado.
- Se mencionaron `App\Actions\Komorebi\...`, Form Requests específicos, servicios de pagos y controladores de Mercado Pago separados.
- Se mencionaron `MercadoPagoCheckoutController`, `MercadoPagoWebhookController` y un `MercadoPagoWebhookRequest`.
- Pistas de rutas: `POST /api/v1/komorebi/checkout/mercadopago/preference` y `POST /api/v1/komorebi/payments/mercadopago/webhook`.

Leer localmente composer.json/lock, Actions de checkout/sincronización, webhook y su validador, jobs/comandos de conciliación, notificaciones y pruebas. Verificar qué pasa sin webhook, con múltiples intentos y con eventos repetidos. No sustituir esta lectura por lo descrito en el chat.

## 2. GAM: arquitectura Laravel convencional

Repositorio comprobado: https://github.com/ProyectoGAM/GAM-Backend

Commit revisado: `1883fedbabbb7f14015011ab64bd8d12b404b2cd`.

Fuentes leídas:

- [Arquitectura](https://github.com/ProyectoGAM/GAM-Backend/blob/1883fedbabbb7f14015011ab64bd8d12b404b2cd/docs/architecture.md).
- [composer.json](https://github.com/ProyectoGAM/GAM-Backend/blob/1883fedbabbb7f14015011ab64bd8d12b404b2cd/composer.json).
- [CreateProductAction](https://github.com/ProyectoGAM/GAM-Backend/blob/1883fedbabbb7f14015011ab64bd8d12b404b2cd/app/Actions/SuppliersAndCatalogs/CreateProductAction.php).
- [StoreProductRequest](https://github.com/ProyectoGAM/GAM-Backend/blob/1883fedbabbb7f14015011ab64bd8d12b404b2cd/app/Http/Requests/SuppliersAndCatalogs/StoreProductRequest.php).
- [RegisterRequest](https://github.com/ProyectoGAM/GAM-Backend/blob/1883fedbabbb7f14015011ab64bd8d12b404b2cd/app/Http/Requests/IdentityAndAccess/RegisterRequest.php).
- [RegisterUserAction](https://github.com/ProyectoGAM/GAM-Backend/blob/1883fedbabbb7f14015011ab64bd8d12b404b2cd/app/Actions/IdentityAndAccess/RegisterUserAction.php).

Aprender: controladores delgados; casos de uso en Actions; Form Requests personalizados; Policies/Gates; transacciones; auditoría con campos permitidos; DTOs/Services/Interfaces solo donde tienen función concreta. Su guía elige explícitamente convenciones de Laravel y evita app/Modules y capas DDD artificiales.

Paquetes presentes en el manifiesto leído: Laravel 13, Sanctum, Horizon, brick/money, Spatie activitylog, backup, health, medialibrary, permission, query-builder y simple-excel, además de otros paquetes de reporting/observabilidad. La presencia en ese manifiesto no certifica las versiones a instalar hoy en Camba ni obliga a copiar todos.

No copiar su registro administrativo de usuarios, PIN/dispositivos compartidos, aislamiento por unidades productivas o reglas avícolas: Camba requiere registro público de compradores y un dominio comercial sencillo.

## 3. Voltio: notificaciones y entrega operativa

Repositorios comprobados:

- Raíz: https://github.com/GyabiSito/voltio , commit `7a6ede3c0d8719bf552d7dc04dfc0d3ebd7b2823`.
- API: https://github.com/GyabiSito/voltio-api , commit `e916d3f7c1f28f3df61ca260e63a454da2297329`.

La raíz fija la API exactamente en ese commit. Fuentes leídas:

- [composer.json de API](https://github.com/GyabiSito/voltio-api/blob/e916d3f7c1f28f3df61ca260e63a454da2297329/composer.json).
- [RegisterRequest](https://github.com/GyabiSito/voltio-api/blob/e916d3f7c1f28f3df61ca260e63a454da2297329/app/Modules/Identity/Requests/RegisterRequest.php).
- [RegisterUserAction](https://github.com/GyabiSito/voltio-api/blob/e916d3f7c1f28f3df61ca260e63a454da2297329/app/Modules/Identity/Actions/RegisterUserAction.php).
- [AuthController](https://github.com/GyabiSito/voltio-api/blob/e916d3f7c1f28f3df61ca260e63a454da2297329/app/Modules/Identity/Controllers/AuthController.php).
- [CreateUserNotificationAction](https://github.com/GyabiSito/voltio-api/blob/e916d3f7c1f28f3df61ca260e63a454da2297329/app/Modules/Notification/Actions/CreateUserNotificationAction.php).
- [SendBookingRemindersAction](https://github.com/GyabiSito/voltio-api/blob/e916d3f7c1f28f3df61ca260e63a454da2297329/app/Modules/Notification/Actions/SendBookingRemindersAction.php).
- [Workflow raíz](https://github.com/GyabiSito/voltio/blob/7a6ede3c0d8719bf552d7dc04dfc0d3ebd7b2823/.github/workflows/ci-cd.yml).
- [Guía de producción](https://github.com/GyabiSito/voltio/blob/7a6ede3c0d8719bf552d7dc04dfc0d3ebd7b2823/docker/production/README.md).

Aprender: normalización/validación explícita, Actions, deduplicación respaldada por unicidad en base, estado de entregas de notificaciones, jobs después del commit, recordatorios por lotes con vigencia comprobada y pruebas de concurrencia. El workflow comprueba aplicación/migraciones/Compose, publica imágenes GHCR por SHA y serializa despliegues.

Adaptar: su workflow raíz construye múltiples imágenes y está condicionado por submódulos; Camba debe detectar componentes afectados y no usar submódulos. No copiar flags de transición que reinicializan una base ni PostGIS, Reverb, reservas EV o canales WhatsApp. Los errores de unicidad de PostgreSQL observados en sus Actions requieren adaptación a MySQL, no copiar códigos SQLSTATE específicos.

## 4. Camba anterior: datos y defectos que no repetir

Revisiones inventariadas:

| Repositorio | main auditado | Fijado por CambaProd |
| --- | --- | --- |
| GyabiSito/CambaProd | f5cc1968eeb09ba4e5a464f6cc9d4de64c2d6f48 | — |
| GyabiSito/cambalacheApi | 8e89912698105fa0b7354e97f86e88a84c6959f6 | 37a694d08afc3149acbcf3905e62839c26bdfaa5 |
| GyabiSito/cambalacheFront | 247785af97bb77233ecf5351a1c7b1c44c6a1dba | eb3b407870c8ac7dcc55e59fedfa18895da9da25 |
| GyabiSito/cambalacheAdmin | d3cd5b4a6e95df53f1843aac010812630e3df982 | El mismo |

Contrastar con los checkouts locales: pueden contener cambios sin publicar. No afirmar que estos commits son los que ejecuta producción.

La auditoría estática previa encontró: precios/subtotales recibidos del cliente; carritos/direcciones sin suficiente comprobación de propietario; reportes fuera del grupo administrativo; firma de webhook que no detiene expresamente un desacuerdo; venta reconstruida desde carrito mutable después de pagar; reintentos sin idempotencia robusta; reserva/stock mejorables; tipos monetarios inconsistentes; formularios excesivos; ausencia de importación; JavaScript global de plantilla; caches y arranque complejos; archivos sensibles/generados versionados.

Recuperar catálogo, fotos, SKU, slugs, condiciones de envío y datos históricos necesarios. No copiar secretos, fixtures de producción o los defectos del flujo. Descuentos y cupones históricos, si existen en pedidos, pueden conservarse como evidencia del pasado; no se incorpora un motor comercial nuevo de promociones.

## 5. Documentación oficial

Consultar la documentación de las versiones resueltas al implementar:

- Laravel: https://laravel.com/framework/docs/13.x
- Angular: https://angular.dev/reference/versions
- Spatie: https://spatie.be/docs y https://spatie.be/open-source/packages
- Media Library: https://spatie.be/docs/laravel-medialibrary/v11/introduction
- Mercado Pago: https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-orders/overview
- Buscar pagos por referencia: https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/search-payments/get
- Notificaciones: https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-orders/notifications
- GitHub Actions: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

Identificar primero qué producto/API usa realmente Komorebi (Preferences/Payments u Orders) y consultar sus páginas específicas. No mezclar contratos de distintas APIs por nombres parecidos. La consulta de respaldo es siempre desde el backend; una URL de retorno o un payment_id del navegador nunca son confirmación suficiente.
