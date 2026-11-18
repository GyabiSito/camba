import { HttpErrorResponse } from '@angular/common/http';
import { apiMessage } from '@camba/shared';

export const admin = '/api/v1/admin';
export const products = `${admin}/products`;
export const imports = `${admin}/catalog-imports`;
export const labels = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' };
export const maxInt = 2_147_483_647;
export const acceptedPhotos = 'image/jpeg,image/png,image/webp';

export type Status = keyof typeof labels;
export type Collection = 'categories' | 'brands';
export type Data<T> = { data: T };
export type Page<T> = Data<T[]> & { meta: { current_page: number; last_page: number; total: number } };
export type Classification = { id: number; slug: string; name: string; active: boolean };
export type Photo = { id: number; url: string; thumbnail_url: string; alt: string };
export type Product = {
  id: number;
  sku: string;
  slug: string;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  stock: number;
  category: Classification | null;
  brand: Classification | null;
  images: Photo[];
  status: Status;
};

export function photoOf(product: Product) {
  return product.images[0];
}

export type ProductFields = {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: number | null;
  brand: number | null;
};

export function fieldsFrom(product?: Product): ProductFields {
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price_cents == null ? '' : (product.price_cents / 100).toFixed(2).replace('.', ','),
    stock: String(product?.stock ?? 0),
    category: product?.category?.id ?? null,
    brand: product?.brand?.id ?? null,
  };
}

export function productInput(fields: ProductFields) {
  const price = fields.price.trim();
  const parts = /^(\d{1,8})(?:[.,](\d{1,2}))?$/.exec(price);
  const cents = parts ? Number(parts[1]) * 100 + Number((parts[2] ?? '').padEnd(2, '0')) : 0;
  if (price && (cents < 1 || cents > maxInt)) {
    throw new Error('Ingresá un precio positivo en UYU, con hasta dos decimales y sin separador de miles.');
  }
  const stock = fields.stock.trim();
  if (!/^\d{1,10}$/.test(stock) || Number(stock) > maxInt) {
    throw new Error('Ingresá un stock entero de 0 a 2.147.483.647.');
  }
  return {
    name: fields.name.trim() || null,
    description: fields.description.trim() || null,
    price_cents: price ? cents : null,
    stock: Number(stock),
    category_id: fields.category,
    brand_id: fields.brand,
  };
}

export function uploadBody(files: readonly File[]) {
  const body = new FormData();
  for (const file of files) body.append('photos[]', file, file.name);
  return body;
}

export type LocalPhoto = { key: number; file: File; url: string; error: string };
let nextPhotoKey = 0;

export function localPhotos(files: readonly File[]) {
  return files.map((file): LocalPhoto => {
    const error = !acceptedPhotos.split(',').includes(file.type)
      ? 'Usá JPG, PNG o WebP.'
      : file.size > 10 * 1024 * 1024 ? 'Supera los 10 MB.' : '';
    return { file, key: ++nextPhotoKey, url: error ? '' : URL.createObjectURL(file), error };
  });
}

export function releasePhotos(photos: readonly LocalPhoto[]) {
  for (const photo of photos) if (photo.url) URL.revokeObjectURL(photo.url);
}

export function fieldErrors(error: unknown): Record<string, string[]> {
  return error instanceof HttpErrorResponse && error.error?.errors && typeof error.error.errors === 'object'
    ? error.error.errors
    : {};
}

const translated: Record<string, string> = {
  'Add a product name before publishing.': 'Agregá un nombre antes de publicar.',
  'Add a price before publishing.': 'Ingresá un precio antes de publicar.',
  'Choose an active category before publishing.': 'Elegí una categoría activa antes de publicar.',
  'Choose an active brand or remove the brand before publishing.': 'Elegí una marca activa o dejá el producto sin marca.',
  'Add at least one product image before publishing.': 'Agregá al menos una foto antes de publicar.',
  'Choose a distinct name for this classification.': 'Ya existe otra clasificación con ese nombre. Elegí uno diferente.',
  'Reassign or archive published products before deactivation.': 'Reasigná o archivá los productos publicados antes de desactivar.',
  'There are no valid rows to confirm.': 'No hay filas válidas para confirmar.',
  'Confirmation was saved, but the job could not start. Confirm again to resume.': 'La confirmación se guardó, pero la tarea no arrancó. Volvé a confirmar para reanudar.',
  'Use the template columns without additions or omissions.': 'Usá las columnas de la plantilla sin agregar ni quitar ninguna.',
  'Use at most 500 data rows per file.': 'Usá hasta 500 filas de datos por archivo.',
  'The row has more cells than the template.': 'La fila tiene más celdas que la plantilla.',
  'The file must contain at least one data row.': 'El archivo debe incluir al menos una fila de datos.',
  'Use a UTF-8 CSV file.': 'Guardá el CSV con codificación UTF-8.',
  'Use literal values instead of formulas.': 'Usá valores en lugar de fórmulas.',
  'XLSX processing is unavailable.': 'El procesamiento de XLSX no está disponible.',
  'The XLSX archive is not valid.': 'El archivo XLSX no es válido.',
  'XLSX requires a single worksheet.': 'Dejá una sola hoja en el archivo XLSX.',
  'The XLSX worksheet reference is not supported.': 'No se pudo reconocer la hoja del XLSX. Guardalo de nuevo o exportá a CSV.',
  'The XLSX has invalid worksheet row numbers.': 'La numeración de filas del XLSX no es válida.',
  'The row contains an invalid or duplicate cell reference.': 'Hay una referencia de celda inválida o duplicada en esta fila.',
  'Use text or plain numeric cells in the template.': 'Usá celdas de texto o números sin formato en la plantilla.',
  'The XLSX contains too many entries.': 'El XLSX tiene demasiadas entradas internas. Guardá una copia nueva o exportá a CSV.',
  'The XLSX archive has unsupported entries or exceeds the decompression limit.': 'El XLSX excede el límite de descompresión o incluye entradas no admitidas. Exportá a CSV.',
  'The XLSX has a missing, invalid, or oversized XML part.': 'El XLSX contiene una parte inválida, ausente o demasiado grande. Guardalo de nuevo o exportá a CSV.',
  'Use an SKU of up to 64 letters, digits, dots, hyphens or underscores.': 'Usá un SKU de hasta 64 letras, números, puntos, guiones o guiones bajos.',
  'Use a positive UYU price with at most two decimal places and no thousands separators.': 'Ingresá un precio positivo en UYU, con hasta dos decimales y sin separador de miles.',
  'Use a whole stock count from 0 to 2147483647.': 'Ingresá un stock entero de 0 a 2.147.483.647.',
  'Use the slug of an existing active classification.': 'Usá el identificador de una clasificación activa existente.',
  'This value is required to create a draft.': 'Completá este campo para crear el borrador.',
  'Use existing, optimized photos that belong to this SKU.': 'Usá fotos ya optimizadas y asociadas a este SKU.',
  'This classification is no longer active.': 'Esta clasificación ya no está activa.',
  'This SKU or one of its proposed fields changed after preview. Upload a corrected file.': 'El SKU o uno de los campos cambió después de la vista previa. Subí una planilla corregida.',
  'Could not assign a unique SKU or slug. Retry creating the draft.': 'No se pudo asignar un SKU único. Intentá crear el borrador de nuevo.',
};

export function localize(message: string): string {
  return translated[message]
    ?? message.replace(/^SKU (.+) occurs more than once in this file\.$/, 'El SKU $1 está repetido en esta planilla.')
      .replace(/^Use at most (\d+) characters\.$/, 'Usá hasta $1 caracteres.');
}

export function uploadError(message: string): string {
  const known = localize(message);
  return known !== message || /^No se |^El procesamiento/.test(known) ? known
    : 'Revisá que el archivo sea un JPG, PNG o WebP válido, de hasta 10 MB y 4096 × 4096 px.';
}

export function summaryError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 503) {
    const known = translated[error.error?.message];
    if (known) return known;
  }
  const message = apiMessage(error, fallback);
  if (error instanceof HttpErrorResponse && error.status === 404) return fallback;
  return localize(message);
}

export function disconnected(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status === 502 || error.status === 504);
}
