import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { Data, Page } from '../../../shared/data-access/api-contracts';
import { Order } from './order.models';

const rejectionKey = (reference: string) => 'camba:checkout-rejection:' + reference;

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly client = inject(ApiClient);
  private readonly base = '/api/v1/orders';

  list(page: number) { return this.client.get<Page<Order>>(this.base, { page }); }
  get(reference: string) { return this.client.get<Data<Order>>(this.base + '/' + encodeURIComponent(reference)); }
  refreshPayment(reference: string) { return this.client.post<void>(this.base + '/' + encodeURIComponent(reference) + '/payments/refresh'); }
  cancelPayment(reference: string) {
    return this.client.post<Data<{ status: string }>>(this.base + '/' + encodeURIComponent(reference) + '/payments/cancel');
  }
  rejectionAtDeparture(reference: string, browser: Window | null) {
    try {
      return browser?.sessionStorage.getItem(rejectionKey(reference)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  async redirectToPayment(reference: string, key: string, browser: Window, previousRejection = '') {
    const { data } = await firstValueFrom(
      this.client.post<Data<{ status: string; checkout_url: string | null }>>(
        this.base + '/' + encodeURIComponent(reference) + '/payments',
        undefined,
        { 'Idempotency-Key': key },
      ),
    );
    // Laravel already restricts the checkout host to the configured Mercado Pago environment.
    if (data.status !== 'ready' || !data.checkout_url || new URL(data.checkout_url).protocol !== 'https:')
      return false;
    try {
      browser.sessionStorage.setItem(rejectionKey(reference), previousRejection);
    } catch {
      // Without storage, the first rejection read on return is treated as prior evidence.
    }
    browser.location.assign(data.checkout_url);
    return true;
  }
}
