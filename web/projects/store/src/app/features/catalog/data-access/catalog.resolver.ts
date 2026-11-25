import { inject, RESPONSE_INIT } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { ApiClient, Page, StoreClassification, StoreProduct } from '@camba/shared';
import { catchError, forkJoin, map, of, tap } from 'rxjs';
import { CatalogCovers } from '../../../shared/catalog-covers';
import { catalogParams, readCatalogQuery } from '../application/catalog-query';
import { PageResult } from '../../../shared/page-result';

export interface CatalogData {
  products: Page<StoreProduct>;
  categories: StoreClassification[];
  brands: StoreClassification[];
}

function markUnavailable(response: ResponseInit | null): void {
  if (!response) return;
  response.status = 503;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  response.headers = headers;
}

export const resolveCatalog: ResolveFn<PageResult<CatalogData>> = (route) => {
  const response = inject(RESPONSE_INIT, { optional: true });
  const api = inject(ApiClient);
  const covers = inject(CatalogCovers);
  return forkJoin({
    products: api.publicGet<Page<StoreProduct>>('/api/v1/products', {
      ...catalogParams(readCatalogQuery(route.queryParamMap)),
      per_page: 12,
    }),
    categories: api.publicGet<{ data: StoreClassification[] }>('/api/v1/categories'),
    brands: api.publicGet<{ data: StoreClassification[] }>('/api/v1/brands'),
  }).pipe(
    tap(({ products }) => covers.remember(products.data)),
    map(({ products, categories, brands }) => ({
      kind: 'ready',
      data: { products, categories: categories.data, brands: brands.data },
    }) as const),
    catchError(() => {
      markUnavailable(response);
      return of({ kind: 'unavailable' } as const);
    }),
  );
};
