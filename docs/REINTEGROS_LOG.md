# Conservar el historial de reintegros

El canal Laravel `refunds` escribe una línea JSON por pago reintegrado en `/var/www/html/storage/logs/refunds/DDMMAAAA.log`. La fecha corresponde a `verified_at` en la zona configurada de la tienda (`America/Montevideo`), no al día de importación. El canal `pagos` no cambia. No hay cambios de datos ni llamadas a Mercado Pago durante la importación.

## Ruta rápida local

El Compose de desarrollo ya comparte `api-storage` entre API, worker y scheduler. Los archivos anteriores siguen en `storage/logs/refounds` dentro de ese volumen. No borres ni reemplaces el volumen y no montes una carpeta vacía encima para buscarlos.

```sh
docker exec camba-v2-demo-pg-api-1 php artisan camba:import-refund-logs
```

Sin argumentos, el comando busca solamente el directorio anterior dentro de Laravel storage. Si no existe, informa que no hay historial. El origen queda intacto y repetir el comando no duplica líneas. Los archivos nuevos no aparecen en la carpeta del host: solo `pagos` tiene un bind mount local.

## Producción: preservar antes de recrear

**Procedimiento para una ventana de mantenimiento autorizada; no ejecutado como parte del desarrollo.** La configuración anterior no montaba `refounds` en un volumen persistente. Cada contenedor PHP puede tener historia diferente en su propia capa. Copiá los tres antes de recrear cualquiera; una copia de FPM no sustituye la del worker ni la del scheduler.

1. Prepará una carpeta de staging privada y respaldada fuera de los contenedores. Conservá el manifiesto de IDs, imagen anterior y SHA-256 de cada archivo. No copies `.env`, credenciales ni bases de datos.
2. Pausá los escritores PHP durante el corte. El ejemplo siguiente usa `dc` como el wrapper Compose de producción ya configurado por operaciones; no inventa rutas ni credenciales:

   ```sh
   dc stop api-fpm worker scheduler || exit 1
   mkdir -p "$STAGE/api-fpm" "$STAGE/worker" "$STAGE/scheduler"
   for role in api-fpm worker scheduler; do
     id=$(dc ps -aq "$role")
     test -n "$id" || exit 1
     printf '%s %s\n' "$role" "$id"
     docker cp "$id:/var/www/html/storage/logs/refounds/." "$STAGE/$role/" || exit 1
   done
   ```

   Una ruta ausente no prueba pérdida ni ausencia global: registrá la ausencia de ese rol y revisá los otros dos. Cualquier otro error de copia bloquea la recreación. No uses `down`, `rm`, `down -v` ni una limpieza de imágenes/contenedores en este paso.
3. Con los originales asegurados, prepará la imagen nueva y el Compose actualizado. `refund-logs` se monta únicamente en las funciones PHP (incluido el comando de release), no en Nginx, Tienda ni Admin. La imagen precrea el directorio como UID/GID 33; un volumen nuevo toma ese contenido inicial. Un volumen preexistente debe tener acceso de escritura para ese usuario; no lo resuelvas con permisos globales ni con un `chown` de todo storage.
4. Ejecutá el importador con la **imagen nueva**, el volumen nuevo y staging de solo lectura, sin red ni credenciales. Sustituí las variables por los identificadores explícitos del corte. `$REFUND_VOLUME` es el nombre real del volumen creado para el proyecto, no necesariamente el nombre corto de Compose:

   ```sh
   docker run --rm --pull never --network none --user 33:33 \
     --mount "type=volume,source=$REFUND_VOLUME,target=/var/www/html/storage/logs/refunds" \
     --mount "type=bind,source=$STAGE,target=/legacy,readonly" \
     -e APP_ENV=testing -e CACHE_STORE=array -e SESSION_DRIVER=array \
     "$NEW_API_IMAGE" php artisan camba:import-refund-logs \
     /legacy/api-fpm /legacy/worker /legacy/scheduler
   ```

   Verificá previamente que staging sea legible por UID 33. Repetí exactamente la importación: cantidad de líneas y hashes del destino deben quedar iguales. Los originales tampoco deben cambiar. No reabras escritores mientras se copia/importa historia: el comando valida el conjunto antes de agregar, pero no implementa una transacción distribuida entre varios archivos.
5. Solo después de verificar la copia y con la imagen inmutable nueva disponible localmente, recreá `api-fpm`, `worker` y `scheduler` sin recrear dependencias:

   ```sh
   dc up -d --no-deps --pull never --force-recreate api-fpm worker scheduler
   ```

   Verificá desde cada rol que el mismo archivo es legible y escribible por UID 33. Reconciliá cantidades y pagos únicos, no solo tamaño del archivo. Conservá staging y respaldos; los archivos históricos nunca se eliminan automáticamente.

## Validación, reintentos y conflictos

El comando acepta archivos `DDMMAAAA.log` o directorios de ese nivel, múltiples argumentos y JSONL completo. Valida campos permitidos, tipos, importe positivo en centésimos, moneda UYU, referencias y fecha con zona. El nombre del archivo debe coincidir con la fecha local del registro. Compara todos los orígenes con el destino existente antes de agregar líneas. El mismo pago con contenido distinto, un campo desconocido, fecha inválida o línea incompleta falla sin sobrescribir historia. Investigá la discrepancia usando copias; no edites los originales para hacer pasar el comando.

El append usa el handler diario existente y su bloqueo de archivo. En modo importación también rechaza conflictos que aparezcan después de validar. Un fallo de escritura puede dejar un subconjunto válido importado; no anuncia éxito y es seguro reintentar. No cambia estados `sent` ni fuerza reenvíos de correo. El escaneo conserva el límite práctico de memoria/tamaño del historial diario: si deja de caber, corresponde un staging indexado, no omitir la validación.

## Prueba aislada y recreación

Antes del corte, usá un proyecto Docker descartable con volumen nuevo y datos sintéticos: tres procesos UID 33 comparten el volumen; dos escriben el mismo pago y otro uno distinto. Confirmá dos líneas válidas y la separación de fechas a medianoche de Uruguay. Importá orígenes superpuestos dos veces y compará hashes. Recreá los tres contenedores **sin eliminar el volumen** y comprobá los mismos archivos desde cada rol. No uses cuentas demo ni proveedores reales para esta prueba.

## Vuelta atrás

Si la preservación/importación falla antes de recrear, conservá los contenedores anteriores y reanudalos con `dc start api-fpm worker scheduler`; no apliques todavía la imagen nueva. Si ya recreaste, mantené el volumen `refund-logs` y staging, pausá escritores y respaldá las líneas nuevas. No cambies solo a la imagen vieja: vuelve a escribir `refounds` y dividiría otra vez el historial. La reversión operativa requiere una imagen compatible que conserve el canal/directorio `refunds`, o un plan explícito y verificado para copiar aditivamente todas las líneas nuevas a la ruta antigua antes de reanudar. No borres el volumen nuevo ni cambies los marcadores de entrega en la base.
