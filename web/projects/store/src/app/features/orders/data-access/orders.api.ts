import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import { Data, Page } from '../../../shared/data-access/api-contracts';
import { Order } from './order.models';

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly client = inject(ApiClient);
  private readonly base = '/api/v1/orders';

  list(page: number) { return this.client.get<Page<Order>>(this.base, { page }); }
  get(reference: string) { return this.client.get<Data<Order>>(this.base + '/' + encodeURIComponent(reference)); }
  refreshPayment(reference: string) { return this.client.post<void>(this.base + '/' + encodeURIComponent(reference) + '/payments/refresh'); }
  startPayment(reference: string, key: string) {
    return this.client.post<Data<{ status: string; checkout_url: string | null }>>(
      this.base + '/' + encodeURIComponent(reference) + '/payments', undefined, { 'Idempotency-Key': key },
    );
  }
}
