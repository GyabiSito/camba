# Admin product editor and photo crop
feat/camba-v2 · base 428a3ec · local work-unit commits only · ask-on-risk.
Runners: isolated Laravel SQLite/PostgreSQL, Playwright and Admin production build. Forecast 480–720 authored lines across API and UI units.

## Specs

### S1
Trabajá en el repo local de Camba. Rediseñá las pantallas «Nuevo producto» y «Editar producto» de Admin, y agregá un cropper para las fotos. El límite es de 5 fotos en total por producto, incluida la portada.

Partí del editor y la galería existentes. Revisá product-editor, product-gallery y el flujo de subida de Laravel antes de implementar. Conservá la estética de Camba y los comportamientos de borrador, guardado, publicación y archivo.

### S2
- Usá una cabecera compacta con «Nuevo producto» o «Editar producto», el estado y el SKU cuando exista. El nombre completo se edita en el formulario, así evitamos que un título largo empuje todo hacia abajo.
- En escritorio, poné los datos, el precio y el stock en una columna, y las fotos al lado. En móvil, usá una sola columna y mantené las acciones de guardado y publicación fáciles de encontrar.
- Mostrá «Portada» como la foto principal y «Fotos adicionales» como una grilla con hasta cuatro lugares. Incluí un contador como «2 de 5 fotos» y una forma clara de cambiar la portada y ordenar las adicionales.
- Si la API necesita un ID antes de subir fotos, guiá al usuario para guardar el borrador y continuar en la misma pantalla de edición.

### S3
- Al seleccionar una imagen, abrí el cropper con vista previa, zoom, desplazamiento, «Cancelar» y «Usar recorte». Si selecciona varias, dejá revisar el encuadre de cada una antes de subirlas.
- Revisá la proporción que usa la Tienda para mostrar productos y usala como encuadre inicial. La vista previa debe coincidir con el archivo recortado que se sube. Si se cancela un reemplazo, conservá la foto guardada.
- Reutilizá una dependencia compatible si ya existe. Si hace falta incorporar una, verificá que sea mantenida y compatible con la versión de Angular del repo. El cropper debe funcionar con teclado y en pantallas táctiles.

### S4
- Aplicá el máximo de 5 también en la API, contando las fotos guardadas y las de la operación actual. Protegé el límite ante subidas simultáneas y conservá la idempotencia y la recuperación de cargas fallidas. Si un producto previo ya supera el límite, mantené sus fotos y bloqueá las nuevas altas hasta que haya lugar.
- Usá la validación y optimización de imágenes existentes. Mantené la carga masiva por CSV operativa con su formato actual.

### S5
Probá en escritorio y a 320 px. Cubrí crear un borrador, recortar la portada, agregar cuatro fotos, rechazar una sexta, cambiar la portada y cancelar un reemplazo. Incluí un caso de API donde dos subidas simultáneas compiten por el último lugar. Volvé a ejecutar las pruebas existentes de recuperación de fotos y el build de Admin.

Implementalo en la rama local y entregá un resumen de los cambios, pruebas ejecutadas y capturas del editor en escritorio y móvil.

## Tasks

- [x] T1 · S1, S3–S5 · inline after delegated read-only map · quota and atomic replacement, `266ca87`; PostgreSQL 18.7 GREEN (14/216) and SQLite GREEN (12/155). Risk: items 1 and 4 (stored galleries/serialized writes).
- [x] T2 · S1–S5 · inline, depends on T1 contract · editor layout, photo review/crop and recovery, browser scenarios and captures; frontend work-unit commit carries this log. Risk: item 4 (async upload and retry).
- [x] T3 · S5 · independent verification plus local QA · release build, both browser widths, CSV/recovery regressions, rollback probe and screenshot inspection.

## Log

### L1 · Original request

Trabajá en el repo local de Camba. Rediseñá las pantallas «Nuevo producto» y «Editar producto» de Admin, y agregá un cropper para las fotos. El límite es de 5 fotos en total por producto, incluida la portada.

Partí del editor y la galería existentes. Revisá product-editor, product-gallery y el flujo de subida de Laravel antes de implementar. Conservá la estética de Camba y los comportamientos de borrador, guardado, publicación y archivo.

## Diseño del editor

- Usá una cabecera compacta con «Nuevo producto» o «Editar producto», el estado y el SKU cuando exista. El nombre completo se edita en el formulario, así evitamos que un título largo empuje todo hacia abajo.
- En escritorio, poné los datos, el precio y el stock en una columna, y las fotos al lado. En móvil, usá una sola columna y mantené las acciones de guardado y publicación fáciles de encontrar.
- Mostrá «Portada» como la foto principal y «Fotos adicionales» como una grilla con hasta cuatro lugares. Incluí un contador como «2 de 5 fotos» y una forma clara de cambiar la portada y ordenar las adicionales.
- Si la API necesita un ID antes de subir fotos, guiá al usuario para guardar el borrador y continuar en la misma pantalla de edición.

## Recorte y subida

- Al seleccionar una imagen, abrí el cropper con vista previa, zoom, desplazamiento, «Cancelar» y «Usar recorte». Si selecciona varias, dejá revisar el encuadre de cada una antes de subirlas.
- Revisá la proporción que usa la Tienda para mostrar productos y usala como encuadre inicial. La vista previa debe coincidir con el archivo recortado que se sube. Si se cancela un reemplazo, conservá la foto guardada.
- Reutilizá una dependencia compatible si ya existe. Si hace falta incorporar una, verificá que sea mantenida y compatible con la versión de Angular del repo. El cropper debe funcionar con teclado y en pantallas táctiles.
- Aplicá el máximo de 5 también en la API, contando las fotos guardadas y las de la operación actual. Protegé el límite ante subidas simultáneas y conservá la idempotencia y la recuperación de cargas fallidas. Si un producto previo ya supera el límite, mantené sus fotos y bloqueá las nuevas altas hasta que haya lugar.
- Usá la validación y optimización de imágenes existentes. Mantené la carga masiva por CSV operativa con su formato actual.

## Verificación

Probá en escritorio y a 320 px. Cubrí crear un borrador, recortar la portada, agregar cuatro fotos, rechazar una sexta, cambiar la portada y cancelar un reemplazo. Incluí un caso de API donde dos subidas simultáneas compiten por el último lugar. Volvé a ejecutar las pruebas existentes de recuperación de fotos y el build de Admin.

Implementalo en la rama local y entregá un resumen de los cambios, pruebas ejecutadas y capturas del editor en escritorio y móvil.

### L2 · Authorization and starting evidence

> Si

Authorized gpt-6-luna only for the read-only map because the mandated model was unavailable. Mapping found no existing saved-photo replace endpoint; the explicit current request includes API changes. Catalog imagery is 4:5. Pre-change Laravel image suite 9/121 and browser recovery 3/3 passed. Existing staged api/storage/logs/.gitignore and untracked api/.env.prod are outside scope. Use no remote service or existing demo database.

### L3 · Quota, replacement and browser proof

Observed RED: before the limit, two real PostgreSQL requests competing for the fifth slot both returned 201; the old API also accepted a sixth image and ignored the replacement target. The browser test initially found no draft-to-photos affordance.

The existing locked action checks capacity after receipt replay. A separate keyed replacement route fails safely against older servers, preserves ID and position, and hashes the target with the ordered bytes. The legacy staging action preserves historical media; normal Admin API calls and grouped drafts still enforce five. The OpenAPI changes are already present in the concurrent customer-directory commit 6848361 and were not rewritten.

The browser crop review draws the same 4:5 rectangle for preview and encoded image; pending crops are recoverable as exact bytes in browser storage and use the existing keyed retry/close path. The first full scoped Playwright run verified 11 cases (editor desktop and 320 px, stale gallery/retries, publishing/archiving and CSV/XLSX). The final visual correction localizes the picker; final checks are running.

### L4 · Verified result

The latest Admin production build passed. Final editor Playwright run passed both widths (1440 and 320 px), including tap to accept, touch drag in the replacement preview and Escape to cancel, with no horizontal overflow. All three upload recovery tests passed on the localized picker; the earlier 11-case scoped run covers publication, archive and CSV/XLSX as well. The final untracked screenshots are under `web/test-results/capturas-editor-producto/`.

The independent verifier reproduced replacement rollback, close and replay with byte-level checks (1 test, 15 assertions). Its rollback/close probe was incorporated into `ProductImagesTest`; the 12-test final SQLite suite and Pint passed. No demo data, production systems, or existing user staging were changed.
