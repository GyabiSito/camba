import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient, apiMessage } from '@camba/shared';
import { firstValueFrom } from 'rxjs';

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

export type LocalPhoto = { key: number; file: File; url: string; error: string };
let nextPhotoKey = 0;

type PhotoUploadAttempt = { key: string; fingerprint: string; draftSku?: string; replayed?: boolean };
export type PhotoUploadState = { attempt?: PhotoUploadAttempt };
class PhotoUploadInputError extends Error {}

const photoUploadPrefix = 'camba:photo-upload:v1:';
const uploadRecoveryUnavailable = 'No se puede iniciar una carga segura. Usá un navegador actualizado, con almacenamiento habilitado y conexión segura.';
const photoUploadKey = (id: number) => photoUploadPrefix + id;

function readPhotoUpload(slot: string): PhotoUploadAttempt | null {
  const value = localStorage.getItem(slot);
  if (value === null) return null;
  const attempt: PhotoUploadAttempt = JSON.parse(value);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(attempt?.key) || !/^(?:[A-Za-z0-9+/]{43}=){1,12}$/.test(attempt?.fingerprint)) {
    throw new Error('Invalid photo upload recovery record');
  }
  return attempt;
}

export function hasPendingPhotoUpload(id: number) {
  try {
    return localStorage.getItem(photoUploadKey(id)) !== null;
  } catch {
    return false;
  }
}

export function photoUploadState(id: number): PhotoUploadState {
  try {
    return { attempt: readPhotoUpload(photoUploadKey(id)) ?? undefined };
  } catch {
    return {};
  }
}

export function pendingPhotoDrafts() {
  try {
    return Object.keys(localStorage).flatMap((slot) => {
      if (!slot.startsWith(photoUploadPrefix)) return [];
      const id = Number(slot.slice(photoUploadPrefix.length));
      try {
        const sku = readPhotoUpload(slot)?.draftSku;
        return Number.isSafeInteger(id) && id > 0 && typeof sku === 'string' ? [{ id, sku }] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export async function uploadPhotos(api: ApiClient, destroy: DestroyRef, product: Product, photos: LocalPhoto[], state: PhotoUploadState, fromBatch = false) {
  if (!globalThis.crypto?.subtle || !crypto.randomUUID || !navigator.locks) {
    throw new PhotoUploadInputError(uploadRecoveryUnavailable);
  }
  // The earlier response may clear storage while this retry is hashing. Keep the attempt we saw.
  const startedWith = state.attempt ?? photoUploadState(product.id).attempt;
  let fingerprint = '';
  const body = new FormData();
  try {
    // Digest files one at a time, keeping their selection order without storing photo contents.
    for (const { file } of photos) {
      const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      fingerprint += btoa(String.fromCharCode(...new Uint8Array(hash)));
      body.append('photos[]', file, file.name);
    }
  } catch {
    throw new PhotoUploadInputError('No pudimos leer las fotos. Volvé a elegir los archivos y reintentá.');
  }
  if (destroy.destroyed) throw new Error('Photo upload canceled');

  const slot = photoUploadKey(product.id);
  let fresh = false;
  try {
    // Lock only the local reservation; the server arbitrates overlapping requests with the same key.
    await navigator.locks.request(slot, () => {
      if (destroy.destroyed) return;
      const stored = readPhotoUpload(slot);
      if (startedWith && stored && startedWith.key !== stored.key) {
        throw new PhotoUploadInputError('Hay otra carga sin confirmar. Volvé a abrir la galería para retomarla antes de agregar más fotos.');
      }
      const existing = startedWith ?? stored;
      if (existing && existing.fingerprint !== fingerprint) {
        throw new PhotoUploadInputError('Hay una carga sin confirmar. Volvé a elegir las mismas fotos en el mismo orden y reintentá.');
      }
      const attempt = existing ?? { key: crypto.randomUUID(), fingerprint, ...(fromBatch && { draftSku: product.sku }) };
      if (!stored || !stored.replayed) {
        localStorage.setItem(slot, JSON.stringify(existing ? { ...attempt, replayed: true } : attempt));
      }
      fresh = !existing;
      state.attempt = attempt;
    });
  } catch (error) {
    if (error instanceof PhotoUploadInputError) throw error;
    throw new PhotoUploadInputError(uploadRecoveryUnavailable);
  }
  const attempt = state.attempt;
  if (destroy.destroyed || !attempt) throw new Error('Photo upload canceled');

  const finish = async (confirmed: boolean) => {
    // Keep the result authoritative even if browser storage becomes unavailable after the request.
    const released = await navigator.locks.request(slot, () => {
      const stored = readPhotoUpload(slot);
      if (stored?.key !== attempt.key) return true;
      if (!confirmed && stored.replayed) return false;
      localStorage.removeItem(slot);
      return true;
    }).catch(() => false);
    if (confirmed || released) state.attempt = undefined;
  };
  try {
    const result = await firstValueFrom(api.post<Data<Product>>(`${products}/${product.id}/images/uploads`, body, {
      'Idempotency-Key': attempt.key,
    }).pipe(takeUntilDestroyed(destroy)));
    if (result?.data?.id !== product.id || !Array.isArray(result.data.images)) {
      throw new Error('Photo upload response was not confirmed');
    }
    await finish(true);
    return result.data;
  } catch (error) {
    // A definitive first rejection is editable; rejection of a replay cannot settle the earlier request.
    if (fresh && error instanceof HttpErrorResponse && [400, 401, 403, 404, 413, 415, 419, 422, 429].includes(error.status)) {
      await finish(false);
    }
    throw error;
  }
}

export function photoUploadFailure(error: unknown, recovering: boolean) {
  if (error instanceof PhotoUploadInputError) return error.message;
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return 'La carga segura no está disponible para este producto. Actualizá la página y volvé a intentarlo.';
  }
  if (!recovering) return '';
  return error instanceof HttpErrorResponse && error.status === 409
    ? 'Esta selección no coincide con la carga anterior. Volvé a elegir las fotos originales en el mismo orden.'
    : 'No pudimos confirmar la carga. Podés reintentar con las mismas fotos sin duplicarlas.';
}

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
  // A proxy or response failure can follow a committed write, even with an HTTP status.
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}
