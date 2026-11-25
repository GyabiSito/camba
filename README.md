# Camba v2

Reconstrucción de Camba como una tienda simple de administrar, con un catálogo limitado a categorías y marcas, una experiencia visual nueva y pagos confiables.

## Estado

La tienda SSR, el admin y la [API Laravel](api/README.md) ya se pueden ejecutar juntos en un [entorno aislado](docs/DEVELOPMENT.md). Playwright cubre recorridos reales de catálogo, importación, pedidos y compra; [PROGRESS.md](docs/PROGRESS.md) separa lo probado localmente de las validaciones aún pendientes. Los flujos de CI/CD están preparados; eso no significa que se haya desplegado en producción.

## Demo local

La tienda y el Admin usan la misma API Laravel y PostgreSQL en Docker Desktop. Las dos cuentas se probaron desde sus formularios y conservaron la sesión al recargar.

| Acceso | Correo verificado | Contraseña de prueba | Rol |
| --- | --- | --- | --- |
| [Tienda](http://127.0.0.1:4200/) · [Mi cuenta](http://127.0.0.1:4200/cuenta) | `cliente.diseno@camba.test` | `CambaDemo2026!` | Cliente (`buyer`) |
| [Admin → Inicio](http://127.0.0.1:4300/dashboard) | `admin.diseno@camba.test` | `CambaDemo2026!` | Administrador (`admin`) |

El [buzón Mailpit](http://127.0.0.1:48025/) recibe solo correo de prueba. Para el chequeo HTTP usá [`/readyz`](http://127.0.0.1:48025/readyz). Laravel y el worker usan `mailpit:1025` por SMTP sin autenticación ni TLS, solo dentro de Docker. El puerto SMTP `41025` ya no se publica en el host. `user.diseno@camba.test` no es una cuenta de esta demo.

**Para tener las dos sesiones abiertas**, usá dos perfiles de navegador o una ventana normal y otra privada. Las cookies se comparten entre puertos cuando el nombre del host es el mismo. También se verificó el acceso por `localhost:4200` y `localhost:4300`; elegí un nombre de host y mantenelo durante cada sesión.

### Levantar, migrar y seedear

Con Docker Desktop en modo Linux, desde la raíz del repositorio en PowerShell:

```powershell
$envFile = 'infra/dev/demo.env.local'
if (-not (Test-Path -LiteralPath $envFile)) {
    $key = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($key) } finally { $rng.Dispose() }
    ('CAMBA_DEV_APP_KEY=base64:' + [Convert]::ToBase64String($key)) |
        Set-Content -LiteralPath $envFile -Encoding ASCII
}
$camba = @('--env-file', $envFile, '-f', 'infra/compose.dev.yml', '-f', 'infra/compose.dev.apps.yml')
docker compose @camba up -d --build --wait
docker compose @camba exec -T api php artisan migrate --force
docker compose @camba exec -T api php artisan db:seed --class=GeographySeeder --force
docker compose @camba exec -T api php artisan db:seed --class=LocalDemoSeeder --force
```

El arranque de la API también aplica las migraciones pendientes. El seed agrega:

- Catálogo con categorías, marcas y fotos locales: productos publicados (incluidos agotados), borradores y archivados.
- Las dos cuentas, dos direcciones guardadas y un carrito de dos productos para el cliente.
- Tres pedidos de entrega y retiro: pago confirmado, pendiente de pago y reserva vencida.

Podés repetir el seed sin duplicar cuentas ni pedidos. Actualiza los datos del catálogo de muestra sin resetear el stock existente, conserva las contraseñas, cantidades del carrito y estados de pedidos existentes, y repone los artículos del carrito de muestra que falten. No lo uses para restablecer una contraseña.

Si ya tenés la demo en uso, agregá la camisa de «Armá el look» sin volver a seedear las compras. Para incorporar cambios de la tienda, reconstruí solo ese servicio:

```powershell
docker compose @camba exec -T api php artisan db:seed --class=LocalEditorialCatalogSeeder --force
docker compose @camba up -d --build --no-deps --wait store
```

En Docker podés consultar el estado del pedido, pero no iniciar pagos: el stack no tiene credenciales de Mercado Pago. Los correos `.test` y las direcciones son sintéticos.

### Actualizar el directorio de direcciones

La migración carga los 19 departamentos y 1.884 localidades desde [el JSON original](api/database/data/countries.json). Si ya ejecutaste la migración, podés repetir **solo** el seed geográfico sin tocar pedidos, carritos ni direcciones ya vinculadas:

```powershell
docker compose --env-file infra/dev/demo.env.local -f infra/compose.dev.yml -f infra/compose.dev.apps.yml exec -T api php artisan db:seed --class=GeographySeeder --force
```

La API lee las opciones de PostgreSQL; el comando funciona aunque la tienda esté apagada. Las direcciones con una coincidencia única se vinculan automáticamente. Si una dirección antigua conserva texto sin coincidencia, editá Departamento y Localidad antes de usarla para un envío nuevo. Los pedidos anteriores conservan la dirección con la que se emitieron.

### Editar y publicar la portada

1. Entrá al [Admin → Portada](http://127.0.0.1:4300/portada) con la cuenta administradora. **Editar** abre la página de una sección. Desde el resumen también podés cambiar su posición u ocultarla.
2. Elegí **Guardar borrador** y **Volver a Portada**. Abrí la [Vista previa](http://127.0.0.1:4300/portada/vista-previa) dentro del Admin y alterná entre **Escritorio** y **Móvil**. La [Tienda](http://127.0.0.1:4200/) solo muestra lo publicado.
3. Elegí **Publicar** cuando esté pronta. La Tienda muestra el cambio al recargar, sin editar archivos ni reconstruir Docker. **Descartar borrador** vuelve a lo publicado sin cambiar la Tienda.

Podés subir fotos JPEG, PNG o WebP de hasta 10 MiB y 4096 px por lado, o volver a usar una de la biblioteca. Los nombres, enlaces, precios y stock de las prendas se actualizan desde el catálogo. Un producto o categoría que ya no se muestra en el catálogo deja de aparecer en la portada; en el mosaico se conserva la foto, pero se quita el enlace.

### Detener y conservar los datos

```powershell
docker compose --env-file infra/dev/demo.env.local -f infra/compose.dev.yml -f infra/compose.dev.apps.yml stop
```

El proyecto `camba-v2-demo-pg` conserva su propio volumen y no usa ni borra MySQL. No uses `down -v` para detenerlo. Para ejecutar las pruebas sin cambiar los datos de la demo, ver [Pruebas en PostgreSQL](docs/DEVELOPMENT.md#postgresql-checks).

## Empezar con Codex local

Abrir este repositorio en el equipo que tiene los plugins de diseño y dar esta instrucción:

> Leé AGENTS.md, docs/IMPLEMENTATION_BRIEF.md, docs/REFERENCES.md y docs/PROGRESS.md. Localizá y revisá las copias locales de Komorebi, GAM, Voltio y Camba anterior. Implementá Camba v2 completa siguiendo el encargo, usando los plugins y skills disponibles en esta sesión local. Avanzá por entregas verificables sin quedarte solamente en un plan ni pedirme confirmación por decisiones rutinarias. Empezá por el relevamiento de referencias y del entorno, y continuá con la implementación. Mantené actualizado PROGRESS.md con evidencia real, pendientes y el siguiente paso para poder retomar. Los despliegues de producción deben realizarse por CI/CD; no alteres la instalación actual desde el entorno de desarrollo.

## Documentos

- [Instrucciones permanentes para agentes](AGENTS.md).
- [Encargo de implementación y criterios de aceptación](docs/IMPLEMENTATION_BRIEF.md).
- [Referencias verificadas y qué aprender de cada proyecto](docs/REFERENCES.md).
- [Avance, evidencia y pendientes](docs/PROGRESS.md).
- [Rendimiento móvil en laboratorio](docs/LOCAL_PERFORMANCE.md) y [ensayo local de recuperación](docs/LOCAL_RECOVERY.md).

El alcance definitivo es el del encargo. Sustituye las propuestas más amplias de la auditoría inicial: no habrá descuentos, cupones, tags, departamentos del catálogo ni subcategorías.
