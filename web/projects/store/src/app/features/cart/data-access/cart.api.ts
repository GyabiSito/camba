import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import { Cart } from './cart.models';
import { Data } from '../../../shared/data-access/api-contracts';

@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly client = inject(ApiClient);
  private readonly base = '/api/v1/cart';

  getCart() { return this.client.get<Data<Cart>>(this.base); }
  addItem(id: number) { return this.client.post<Data<Cart>>(`${this.base}/items/${id}`); }
  updateItem(id: number, quantity: number) { return this.client.put<Data<Cart>>(`${this.base}/items/${id}`, { quantity }); }
  removeItem(id: number) { return this.client.delete<void>(`${this.base}/items/${id}`); }
}
