# Operar Camba: guía rápida

**Para practicar:** [tienda local](http://127.0.0.1:44812/) · [administración](http://127.0.0.1:44813/ingresar) · [correo local](http://127.0.0.1:49025/). Esta instancia usa datos de práctica; no es producción. Ingresá con `admin@camba.test`; la contraseña de esta instancia está en la tercera línea del archivo privado que abre este comando de PowerShell:

```powershell
notepad (Join-Path $env:LOCALAPPDATA 'Camba\local-preview\admin-access.txt')
```

## Cargar un producto

1. En **Productos → Otras tareas → Categorías y marcas**, creá o elegí una categoría activa. La marca es opcional. En **Nuevo producto**, completá nombre, precio en UYU, stock y categoría; elegí **Crear borrador**. Guardá el SKU para futuras búsquedas e importaciones.
2. En **Galería**, usá **Agregar fotos → Subir fotos**. Podés usar JPG, PNG o WebP: hasta 12 fotos por producto, de 10 MB y 4096 × 4096 px como máximo por archivo. Elegí la portada y guardá el orden.
3. Revisá los datos y elegí **Publicar**. Comprobá la ficha en la tienda. Si necesitás retirarla de la venta, usá **Archivar**.

## Crear varios borradores por fotos

1. En **Productos → Otras tareas → Carga por fotos**, armá un grupo por producto. Podés aplicar precio, stock o categoría comunes a los grupos seleccionados y corregir cada uno después.
2. Elegí **Revisar borradores → Confirmar y crear borradores**. El lote no publica productos. Abrí **Revisar y publicar** para comprobar los datos y la portada de cada ficha antes de publicarla.
3. Si una carga queda incierta, abrí el mismo borrador. Usá **Reintentar carga** con los mismos archivos en el mismo orden, o **Cerrar carga pendiente** si ya no los tenés. Si el servidor confirmó el cierre pero queda limpieza local, usá **Reintentar recuperación**: no vuelve a subir las fotos. No borres datos del sitio ni crees otro borrador para resolverlo.

## Importar CSV/XLSX

1. En **Productos → Otras tareas → Importar planilla**, elegí **Descargar plantilla CSV**. Conservá las cabeceras. Usá el SKU (`codigo`) para identificar el producto, los identificadores de categorías y marcas activas y un precio como `950.50`. Para actualizar un producto, una celda vacía deja el valor anterior; `0` en stock sí lo modifica.
2. Subí un CSV UTF-8 o un XLSX de una sola hoja, sin fórmulas, de hasta 500 filas de datos y 2 MiB. Elegí **Ver vista previa**: separa altas, cambios y filas inválidas. Para nuevas fichas subí las fotos después a su galería; el importador no descarga imágenes de URLs.
3. Elegí **Confirmar importación** y esperá el resultado del worker. Solo se aplican filas válidas; si una fila falla no se deshacen las ya aplicadas. El mismo archivo sin cambios recupera el resultado anterior. Las fichas nuevas quedan en borrador. [Reglas de la plantilla](../api/docs/imports.md#template-rules).

## Gestionar pedidos

Para practicar sin cobrar a nadie, buscá el pedido local `3CDDDE76`, creado desde la tienda con `Remera demo local`. Su pago quedó pendiente.

1. Abrí **Pedidos**, filtrá por **Estado del pago** o **Preparación y entrega**, y entrá al pedido por su referencia. Verificá productos, datos de contacto y retiro o envío.
2. Cuando aparezca **Empezar preparación**, podés dejar una **Nota interna**. Para retiro: **Marcar listo para retirar → Confirmar retiro**. Para envío: **Marcar como enviado** (con seguimiento si corresponde) → **Marcar como entregado**.
3. Si el pago no coincide, usá **Solicitar verificación del pago** y revisá después el pedido y **Avisos operativos**. La acción aparece si Mercado Pago está habilitado y el pedido tiene un intento de pago o un pago registrado en ese proveedor. El resultado no es inmediato; la acción no marca manualmente el pago como aprobado.
