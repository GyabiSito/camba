import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import type { HomeAsset, HomeDocument, HomeEditorState, HomePublication } from '@camba/shared';
import { forkJoin } from 'rxjs';
import type { Data } from '../../../shared/operations-data';
import type { Product as StoreProduct } from '../../../../../../store/src/app/home-preview';
import { AdminCatalogApi } from '../../products';

export type HomepageMutation = { revision: number; document?: HomeDocument | null };
export type UploadedHomeMedia = { key: string; asset: HomeAsset };

@Injectable({ providedIn: 'root' })
export class HomepageApi {
  private readonly api = inject(ApiClient);
  private readonly catalog = inject(AdminCatalogApi);
  private readonly endpoint = '/api/v1/admin/homepage';

  load() { return this.api.get<Data<HomeEditorState>>(this.endpoint); }
  preview() {
    return forkJoin({
      publication: this.api.get<Data<HomePublication<StoreProduct>>>(`${this.endpoint}/preview`),
      state: this.load(),
    });
  }
  categories() { return this.catalog.categories(); }
  listPublishedProducts(query: { q?: string; category?: number; page?: number; per_page: number }) {
    return this.catalog.listProducts({ ...query, status: 'published' });
  }
  product(id: number) { return this.catalog.product(id); }
  save(body: HomepageMutation) { return this.api.put<Data<HomeEditorState>>(this.endpoint, body); }
  transition(operation: 'publish' | 'discard', body: HomepageMutation) {
    return this.api.post<Data<HomeEditorState>>(`${this.endpoint}/${operation}`, body);
  }
  uploadMedia(body: FormData) {
    return this.api.post<{ data: UploadedHomeMedia }>(`${this.endpoint}/media`, body);
  }
}
