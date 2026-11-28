# Referencias de implementación

Fecha del relevamiento remoto: 18 de noviembre de 2026. Estos ejemplos orientan decisiones; sus instrucciones de dominio no se convierten automáticamente en requisitos de Camba.

## Local source review — 2026-11-18

`~` denotes the local home directory; `Desktop` below means `~/OneDrive/Escritorio`. Dirty counts are Git porcelain entries, not evidence of deployed state. No services, data, secrets or production endpoints were opened.

| Local checkout | HEAD (dirty entries) | Source inspected |
| --- | --- | --- |
| `Desktop/komorebi` | `50987b3801d3` (4) | Gitlinks; API `8f2cb699e92c` (1), Store `fa774fa2bcdb` (1), Admin `84e72e6433a0` (0). `Desktop/komorebi-prod` was empty. |
| `~/GAM` | `c9f4ad8c0321` (1) | Backend actual checkout `394b5c2902f8` (0), differs from root pin `8b85bdd10266`; Frontend `d0b825f9b508` (0). |
| `~/voltio` | `d3185cd1ed62` (1) | `apps/api` `e916d3f7c1f2` (0), matches root pin. Standalone `~/voltio-api` `68b040707a51` (0) does not contain the notification implementation reviewed. |
| `Desktop/Cambalache` | Parent is not a Git repository | API `1c6e8001382d` (3), Front `e231d3066e31` (9), Admin `3bd512bc384b` (0). |
| `Desktop/cambalacheProd` | `f5cc1968eeb0` (4) | API `8e8991269810` (1), Front `247785af97bb` (40), Admin `d3cd5b4a6e95` (4). Root API/Front pins differ from the local checkout. |

- **Komorebi access:** API `routes/api.php:54–74`, `UserRegisterAction.php:21–51`, `UserLoginAction.php:20–88`. Adapt normalization, throttling, verification and generic credential errors; retain Camba's Sanctum cookie contract. Do not transplant JWT/refresh sessions or PostgreSQL duplicate detection.
- **Komorebi payments:** `KomorebiApi/composer.json:16` declares `mercadopago/dx-php` 3.8.0. `CreateMercadoPagoPreferenceAction.php:25–67,138–185` and `MercadoPagoWebhookController.php:49–110` confirm Checkout Pro Preferences + Payments, not Orders. `MercadoPagoWebhookSignatureValidator.php:7–51` verifies the signed query ID before provider fetch. `SyncCheckoutSessionStatusAction.php:48–123,161–185` looks up the stored reference on demand; `routes/console.php:13–25` does not schedule reconciliation. Camba must persist the order first, verify the fetched payment against its snapshot and reconcile in the background, using exact money.
- **GAM patterns:** `GAM-Backend/architecture.md:133–158` plus `ProductController.php:27–34`, `StoreProductRequest.php:15–35`, `ProductPolicy.php:20–45`, and `CreateProductAction.php:24–55,95–103` show validated payloads, server-side authorization and transactional actions with allowlisted auditing.
- **Voltio:** `apps/api/routes/console.php:12–22`, `SendBookingRemindersAction.php:74–95,134–145` and `CreateUserNotificationAction.php:71–129` demonstrate rechecking eligibility, deduplicating durably and dispatching after commit. Root `.github/workflows/ci-cd.yml:79–143,177–203,325–330` provides verification and deployment patterns; do not adapt the gitlink gate.
- **Earlier Camba:** API migrations 11–14 separate cover/gallery paths and stock levels. `CartController.php:173–184` uses the most-specific stock; `ProductVariationsNestedController.php:74–85` caps child totals against the parent. Reconcile residual stock explicitly, do not add stock across tiers, synthesize stable child SKUs from source IDs where needed and preserve cover/gallery distinction. No dataset was inspected.

## 1. Komorebi: referencia principal de tienda

### Geographic address patterns — local source review

| Checkout inspected | Pattern adapted for Camba v2 |
| --- | --- |
| KomorebiStore `fa774fa`, `features/account/ui/pages/addresses/addresses.ts:110–147,217–229,257–274` | Numeric form values, clear the child on department change, restore both choices on edit. V2 loads only the requested department's localities and adds searchable controls. |
| KomorebiApi `8f2cb69`, `AccountAddressRequest.php:27–59`, `UpdateOrCreateAccountAddressAction.php:23–37` | Check that the two IDs form a real pair. V2 derives the department via the locality FK rather than persisting a second FK on the address. |
| Earlier Camba front `e231d30`, `billing.component.ts:41–71,75–84,137–144` | The child lookup is scoped to the selected department. Input sent numeric values; the source was a nested JSON file. |
| Earlier Camba API `1c6e800`, `UyDepartmentSeeder.php:13–33`, migrations `40-create_uy_departments_table.php` and `41-create_uy_towns_table.php:16–28` | Upstream town IDs are unique only within their department. V2 preserves the composite source key and adds a database-generated locality ID. |

V2 uses the original dataset from the storefront checkout as its one seed source. Its additive backfill accepts only unique case-, accent- and whitespace-normalized matches; it neither discards unmatched text nor rewrites issued orders.

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
