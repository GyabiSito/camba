# Camba v2

Reconstrucción de Camba como una tienda simple de administrar, con un catálogo limitado a categorías y marcas, una experiencia visual nueva y pagos confiables.

## Estado

La tienda SSR, el admin y la [API Laravel](api/README.md) ya se pueden ejecutar juntos en un [entorno aislado](docs/DEVELOPMENT.md). Playwright cubre recorridos reales de catálogo, importación, pedidos y compra; [PROGRESS.md](docs/PROGRESS.md) separa lo probado localmente de las validaciones aún pendientes. Los flujos de CI/CD están preparados; eso no significa que se haya desplegado en producción.

## Demo local

La tienda y el admin usan la misma API Laravel y PostgreSQL en Docker Desktop. No necesitás levantar las demos de Angular por separado.

| Acceso | Correo de prueba |
| --- | --- |
| [Tienda — Mi cuenta](http://127.0.0.1:4200/cuenta) | `cliente.diseno@camba.test` |
| [Admin](http://127.0.0.1:4300/) | `admin.diseno@camba.test` |

**Contraseña de ambas cuentas:** `CambaDemo2026!`. Usá perfiles de navegador distintos si querés mantener abiertas ambas sesiones: los puertos comparten el mismo host y las cookies no se aíslan por puerto. El [buzón local](http://127.0.0.1:48025/) recibe solo correo de prueba.

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
docker compose @camba exec -T api php artisan db:seed --class=LocalDemoSeeder --force
```

El arranque de la API también aplica las migraciones pendientes. El seeder explícito puede repetirse sin duplicar el catálogo, las cuentas ni los pedidos de muestra. En la tienda hay productos agotados, carritos y pedidos de entrega y retiro; en el admin también se ven borradores, archivados y las herramientas de carga.

El historial incluye un pago confirmado simulado, uno pendiente y una reserva vencida. El stack no tiene credenciales de Mercado Pago: las pruebas de pago simulan el proveedor y la demo no realiza cobros. Los dominios `.test` y las direcciones son sintéticos.

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
