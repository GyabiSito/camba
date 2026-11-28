import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage, formatDate, formatMoney } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { Order, orderStatus } from './data-access/order.models';
import { OrdersApi } from './data-access/orders.api';

@Component({
  imports: [RouterLink],
  templateUrl: './orders-history.html',
  styleUrls: ['../../shared/shopper.css', '../../shared/members-design.css', './orders-list.css'],
})
export class OrderHistoryPage {
  private readonly client = inject(OrdersApi);
  protected readonly orders = signal<Order[]>([]);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly money = formatMoney;
  protected readonly date = formatDate;
  protected readonly states = orderStatus;

  constructor() {
    void this.load(1);
  }

  protected async load(page: number) {
    this.loading.set(true);
    this.error.set('');
    try {
      const { data, meta } = await firstValueFrom(
        this.client.list(page),
      );
      this.orders.set(data);
      this.page.set(meta.current_page);
      this.lastPage.set(meta.last_page);
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos cargar los pedidos. Probá de nuevo.'));
    } finally {
      this.loading.set(false);
    }
  }
}
