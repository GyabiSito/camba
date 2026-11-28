# Verificar la entrega de Camba v2

Las pruebas de esta máquina no autorizan operar el Camba anterior ni prueban los servicios externos. Para trabajar fuera de loopback, confirmá el destino, la operación permitida y la identidad autorizada. Cargá secretos en la configuración protegida del entorno: no en comandos, Git, capturas ni logs.

## Instancia local entregada

> Registro histórico de la entrega en MySQL. Para el entorno local vigente en PostgreSQL, usá el [arranque de la demo](../README.md#demo-local). No apliques el Compose actual al proyecto histórico.

| Servicio | URL o puerto en esta máquina |
| --- | --- |
| Tienda | [http://127.0.0.1:44812/](http://127.0.0.1:44812/) |
| Admin | [http://127.0.0.1:44813/ingresar](http://127.0.0.1:44813/ingresar) — [acceso y guía rápida](GUIA_ADMIN.md) |
| API | [http://127.0.0.1:44811/api/v1/products](http://127.0.0.1:44811/api/v1/products); salud [`/up`](http://127.0.0.1:44811/up), disponibilidad [`/ready`](http://127.0.0.1:44811/ready) |
| Mailpit | [http://127.0.0.1:49025/](http://127.0.0.1:49025/); SMTP local `127.0.0.1:42025` |
| MySQL / Redis | `127.0.0.1:44306` / `127.0.0.1:47379` |

El proyecto Compose histórico `camba-v2-local` usaba red y volúmenes propios. Los siguientes comandos registran aquella entrega y requieren los archivos Compose de esa versión, no los actuales:

```powershell
$local = Join-Path $env:LOCALAPPDATA 'Camba\local-preview'
$compose = @('compose', '-p', 'camba-v2-local', '--env-file',
  (Join-Path $local 'runtime.env'), '-f', 'infra/compose.dev.yml',
  '-f', 'infra/compose.dev.apps.yml', '-f', (Join-Path $local 'compose.local-images.yml'))
docker @compose ps
# Para retomar la misma instancia después de detenerla, sin borrar datos:
docker @compose up -d --no-build --pull never --wait --wait-timeout 300
```

Para un arranque con base **nueva**, levantá `api` y sus dependencias primero (`docker @compose up -d --no-build --pull never --wait api`), ejecutá `docker @compose exec -T api php artisan migrate --force --no-interaction` y recién luego levantá el resto. La tienda SSR necesita el esquema para responder, por lo que no conviene esperar que esté sana antes de migrar.

Si la cuenta de Admin aún no existe, ejecutá `docker @compose exec api php artisan camba:admin admin@camba.test` y completá las preguntas de contraseña. Para adoptar una cuenta anterior verificada, indicá su correo exacto y agregá `--from-legacy`. Solo puede existir una cuenta administrativa; no se crea desde la Tienda. El servidor de desarrollo no debe exponerse en Internet.

## Validaciones que requieren otras capacidades

### Lector de pantalla (T02)

En un escritorio con audio o salida de voz observable, abrí la instancia con NVDA (menú **Herramientas → Visualizador de voz**) o con Narrador (`Win+Ctrl+Enter`). Con `Tab` y `Shift+Tab`, verificá navegación, foco y etiquetas. Comprobá qué se anuncia al dar de alta un producto, recuperar una carga, cometer un error de checkout y confirmar un pedido: foco correcto, aviso útil una sola vez y sin perder el estado al avanzar. Registrá navegador, lector, versión y resultado leído. Las aserciones de roles y foco de Chromium/Firefox no prueban anuncios hablados.

### Mercado Pago (UC20–24)

Se necesita una aplicación Checkout Pro Uruguay y comprador de prueba autorizados, `CAMBA_MP_ACCESS_TOKEN`, `CAMBA_MP_COLLECTOR_ID`, `CAMBA_MP_WEBHOOK_SECRET`, `CAMBA_MP_LIVE=false` y un staging público con HTTPS para el retorno y `POST /api/v1/webhooks/mercadopago`. Usá la tienda de staging: creá un pedido de prueba, abrí Checkout Pro y verificá retorno y reintento con la misma referencia. Registrá el HTTP del webhook, el procesamiento en cola y que la lectura autorizada del proveedor coincide con moneda, importe, referencia y estado. Para probar recuperación sin webhook, cerrá el navegador en la segunda compra de prueba, controlá la no entrega solo en staging y ejecutá `php artisan camba:reconcile-payments` allí. El pedido no debe cambiar a aprobado por parámetros de retorno. [Protocolo y rutas](../api/docs/payment-lifecycle.md).

### Correo y avisos (UC26–27)

Se necesita un destinatario de prueba bajo control, remitente autorizado y runtime protegido con `MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_PORT`, TLS (`MAIL_SCHEME` según el proveedor), `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` y `MAIL_FROM_NAME`. Desde la tienda de staging, pedí verificar un correo y seguí el enlace HTTPS recibido en el **buzón real**. Para avisos de compra, generá un pedido sintético y procesá la proyección con `php artisan camba:notices`. Si no hay worker persistente en ese entorno aislado, ejecutá `php artisan queue:work --once` para procesar el trabajo de prueba. Registrá recepción real y ausencia de duplicados; un aviso `sent` no prueba entrega al buzón y uno `uncertain` no se reenvía a ciegas. [Operación de avisos](../api/docs/notices.md).

### Migración (UC30)

Se necesita un export congelado y autorizado del catálogo, las fotos, el mapeo revisado (categorías, stock y redirecciones), conciliación histórica y destino desechable. No conectar a la instalación activa. Generá y revisá el plan antes de escribir:

```sh
php artisan camba:plan-legacy-catalog /isolated/export.json /isolated/mapping.json \
  --photos=/isolated/photos --no-ansi > /isolated/plan.json
# Solo en la base y el directorio de medios de staging permitidos:
php artisan camba:stage-legacy-catalog /isolated/export.json /isolated/mapping.json \
  /isolated/plan.json --photos=/isolated/photos \
  --mapping-sha256="$REVIEWED_MAPPING_SHA256" --apply --no-ansi
```

Guardá el plan en UTF-8 sin BOM y asigná a `REVIEWED_MAPPING_SHA256` el SHA-256 del mapeo aprobado. Repetí el mismo plan en staging, compará conteos, SKU, stock, portada/orden, medios y redirecciones; conciliá cuentas, pedidos y pagos por separado. El plan exitoso no autoriza el corte. [Guardas y requisitos exactos](../api/docs/legacy-migration.md).

### CI/CD, edge y negocio (T03–T06, UC18/25/28/29)

Con el repositorio y la identidad de GitHub autorizados, cargá `RELEASE_REPO`, `EXPECTED_SHA` y `RELEASE_HOST` con el repositorio, SHA y host autorizados. Obtené `RUN_ID` de la primera consulta antes de ejecutar la segunda:

```sh
gh run list --repo "$RELEASE_REPO" --workflow checks.yml --commit "$EXPECTED_SHA"
gh run watch "$RUN_ID" --repo "$RELEASE_REPO" --exit-status
curl --fail --silent --show-error "https://$RELEASE_HOST/ready"
```

Una corrida manual no publica. Antes de habilitar deliberadamente `CAMBA_RELEASE_ENABLED`, se requieren `camba-production` protegido, `CAMBA_DEPLOY_TARGET`, `CAMBA_DEPLOY_KEY`, `CAMBA_DEPLOY_KNOWN_HOSTS`, pull restringido de GHCR, red/DNS/TLS del edge y acceso de release restringido. Para el primer despliegue aprobado, verificá tres digests inmutables, migraciones terminadas, respaldos y restauración, y recorridos HTTPS de tienda/admin además de `/ready`. Cotejá tarifas, retiro, envíos y avisos con una operación de negocio de prueba. Medí rendimiento con catálogo real y edge; el LCP de laboratorio y un ensayo con Docker simulado no demuestran INP de campo ni un despliegue real. [Flujo de release](RELEASE.md).
