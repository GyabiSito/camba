import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import type { Page } from '../../../shared/operations-data';
import type { Order, OrderResponse, FulfilmentStage } from './order.models';

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly api = inject(ApiClient);
  private readonly endpoint = '/api/v1/admin/orders';

  list(query: Record<string, string | number | null>) {
    return this.api.get<Page<Order>>(this.endpoint, query);
  }

  detail(reference: string) {
    return this.api.get<OrderResponse>(this.path(reference));
  }

  updateFulfilment(reference: string, status: FulfilmentStage, note: string | null, tracking?: string | null) {
    return this.api.patch<unknown>(this.path(reference) + '/fulfilment', {
      status, note, ...(status === 'shipped' ? { tracking: tracking ?? null } : {}),
    });
  }

  refreshPayment(reference: string) {
    return this.api.post<unknown>(this.path(reference) + '/payments/refresh');
  }

  private path(reference: string) {
    return `${this.endpoint}/${encodeURIComponent(reference)}`;
  }
}
