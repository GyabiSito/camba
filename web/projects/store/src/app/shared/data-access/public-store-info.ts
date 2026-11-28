import { inject } from '@angular/core';
import { type ResolveFn } from '@angular/router';
import { ApiClient } from '@camba/shared';
import { catchError, map, of } from 'rxjs';

export interface PublicStoreInfo {
  business_name: string;
  fiscalName?: string | null;
  support_email: string | null;
  support_phone: string | null;
  pickup_address: string | null;
  delivery_cents: number | null;
  free_delivery_minimum_cents?: number | null;
  checkout_pro_available?: boolean;
}

export function readPublicStoreInfo() {
  return inject(ApiClient).publicGet<{ data: PublicStoreInfo }>('/api/v1/store-info')
    .pipe(map(({ data }) => data), catchError(() => of(null)));
}

export const resolvePublicStoreInfo: ResolveFn<PublicStoreInfo | null> = readPublicStoreInfo;
