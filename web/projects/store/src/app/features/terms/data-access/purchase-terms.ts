import { inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import { catchError, map, of } from 'rxjs';

export interface PurchaseTerms {
  version: string;
  withdrawal: string;
  sections: { title: string; text: string }[];
}

export function resolvePurchaseTerms(version?: string | null) {
  const api = inject(ApiClient);
  if (version && !/^\d{4}-\d{2}-\d{2}(?:-v[1-9][0-9]*)?$/.test(version)) return of(null);
  return api.publicGet<{ data: PurchaseTerms }>('/api/v1/purchase-terms' + (version ? '/' + version : '')).pipe(
    map(({ data }) => data),
    catchError(() => of(null)),
  );
}
