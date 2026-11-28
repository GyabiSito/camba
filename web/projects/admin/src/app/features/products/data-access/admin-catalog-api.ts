import { DestroyRef, Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import { closePhotoUpload, productInput, uploadPhotos, type CropUpload, type LocalPhoto, type PhotoUploadState } from './catalog-api';
import type { Collection, Data, Page, Product, Classification } from './catalog-api';

export type ProductDetail = Data<Product> & { store_url?: string };
export type ProductHistory = {
  data: { id: number; actor_id: number | null; actor_admin_id?: number | null; old_price_cents: number | null; price_cents: number | null; old_stock: number; stock: number; created_at: string }[];
  current_page: number; last_page: number;
};
export type RowStatus = 'ready' | 'invalid' | 'applied' | 'failed';
export type ImportValue = string | number | string[] | null;
export type ImportRow = {
  line: number; sku: string | null; product_id: number | null; status: RowStatus; action: 'create' | 'update' | null;
  values: Record<string, ImportValue>; errors: Record<string, string[]>; changes: Record<string, { before: ImportValue; after: ImportValue }>;
};
export type CatalogImport = {
  id: number; status: 'completed' | 'queued' | 'preview'; counts: Record<RowStatus, number>; rows: ImportRow[];
};

@Injectable({ providedIn: 'root' })
export class AdminCatalogApi {
  private readonly api = inject(ApiClient);
  private readonly admin = '/api/v1/admin';
  private readonly products = `${this.admin}/products`;
  private readonly imports = `${this.admin}/catalog-imports`;

  categories() { return this.api.get<Data<Classification[]>>(`${this.admin}/categories`); }
  brands() { return this.api.get<Data<Classification[]>>(`${this.admin}/brands`); }
  listProducts(query: Record<string, string | number | null>) { return this.api.get<Page<Product>>(this.products, query); }
  product(id: number | string) { return this.api.get<ProductDetail>(`${this.products}/${id}`); }
  createProduct(input: ReturnType<typeof productInput>) { return this.api.post<Data<Product>>(this.products, input); }
  updateProduct(id: number, input: Partial<ReturnType<typeof productInput>>) { return this.api.patch<Data<Product>>(`${this.products}/${id}`, input); }
  transitionProduct(id: number, action: 'archive' | 'publish') { return this.api.post<Data<Product>>(`${this.products}/${id}/${action}`); }
  productHistory(id: number | string, page: number) { return this.api.get<ProductHistory>(`${this.products}/${id}/history`, { page }); }
  reorderPhotos(id: number, ids: number[]) { return this.api.put<Data<Product>>(`${this.products}/${id}/images/order`, { ids }); }
  classifications(collection: Collection, query: Record<string, string | number>) {
    return this.api.get<Page<Classification>>(`${this.admin}/${collection}/page`, query);
  }
  saveClassification(collection: Collection, id: number | undefined, body: { name?: string; active?: boolean }) {
    const endpoint = `${this.admin}/${collection}`;
    return id ? this.api.patch<Data<Classification>>(`${endpoint}/${id}`, body) : this.api.post<Data<Classification>>(endpoint, body);
  }
  previewImport(body: FormData) { return this.api.post<Data<CatalogImport>>(this.imports, body); }
  importStatus(id: number | string) { return this.api.get<Data<CatalogImport>>(`${this.imports}/${id}`); }
  confirmImport(id: number) { return this.api.post<Data<CatalogImport>>(`${this.imports}/${id}/confirm`); }
  downloadImportTemplate() { return this.api.download(`${this.imports}/template`); }
  createPhotoDraft(input: ReturnType<typeof productInput>) { return this.createProduct(input); }
  uploadPhotos(destroy: DestroyRef, product: Product, photos: LocalPhoto[], state: PhotoUploadState, fromBatch = false, crop?: CropUpload) {
    return uploadPhotos(this.api, destroy, product, photos, state, fromBatch, crop);
  }
  closePhotoUpload(destroy: DestroyRef, id: number, state: PhotoUploadState) {
    return closePhotoUpload(this.api, destroy, id, state);
  }
}
