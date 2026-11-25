import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import type { Order, Quote } from '../../orders';
import { Data } from '../../../shared/data-access/api-contracts';
import { OrderInput } from './checkout.models';

@Injectable({ providedIn: 'root' })
export class CheckoutApi {
  private readonly client = inject(ApiClient);
  private readonly base = '/api/v1';

  quote(items: { product_id: number; quantity: number }[], address?: { department_id: number; locality_id: number }) {
    return this.client.post<Data<Quote>>(this.base + '/checkout/quote', { items, ...(address && { address }) });
  }
  placeOrder(body: OrderInput, idempotencyKey: string) {
    return this.client.post<Data<Order>>(this.base + '/orders', body, { 'Idempotency-Key': idempotencyKey });
  }
}
