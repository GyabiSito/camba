import { inject, RESPONSE_INIT } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { ApiClient, StoreProduct } from '@camba/shared';
import { catchError, map, of, tap } from 'rxjs';
import { CatalogCovers } from '../../../shared/catalog-covers';
import { PageResult } from '../../../shared/page-result';

function markStatus(response: ResponseInit | null, status: number): void {
  if (!response) return;
  response.status = status;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  response.headers = headers;
}

export const resolveProduct: ResolveFn<PageResult<StoreProduct>> = (route) => {
  const response = inject(RESPONSE_INIT, { optional: true });
  const covers = inject(CatalogCovers);
  const slug = route.paramMap.get('slug') ?? '';
  if (!/^[A-Za-z0-9-]{1,160}$/.test(slug)) {
    markStatus(response, 404);
    return { kind: 'missing' };
  }
  return inject(ApiClient).publicGet<{ data: StoreProduct }>(`/api/v1/products/${slug}`).pipe(
    tap(({ data }) => covers.remember([data])),
    map(({ data }) => ({ kind: 'ready', data }) as const),
    catchError((error: { status?: number }) => {
      if (error?.status === 404) {
        markStatus(response, 404);
        return of({ kind: 'missing' } as const);
      }
      markStatus(response, 503);
      return of({ kind: 'unavailable' } as const);
    }),
  );
};
