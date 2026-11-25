import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiClient, formatMoney } from '@camba/shared';
import { BehaviorSubject, switchMap } from 'rxjs';
import { adminApi, Data, Order, orderLabels, readState } from '../operations/operation-data';
import { OperationLoading } from '../operations/operation-ui';

type SalesMonth = { month: string; order_count: number; total_cents: number };
type Dashboard = {
  priorities: { pending_payment: number; needs_preparation: number; ready_for_pickup: number; out_of_stock: number };
  recent_orders: Order[];
  sales: { timezone: string; from: string; through: string; order_count: number; total_cents: number; months: SalesMonth[] };
};

@Component({
  selector: 'camba-dashboard',
  imports: [RouterLink, OperationLoading],
  templateUrl: './dashboard.html',
  styleUrls: ['../operations/operations.css', './dashboard.css'],
})
export class DashboardPage {
  private readonly api = inject(ApiClient);
  private readonly reload = new BehaviorSubject(0);
  protected readonly result = toSignal(this.reload.pipe(switchMap(() => readState(
    this.api.get<Data<Dashboard>>(`${adminApi}/dashboard`),
    'No pudimos cargar el inicio. Reintentá para ver los datos actualizados.',
  ))));
  protected readonly money = formatMoney;
  protected readonly orderStatus = orderLabels;
  protected readonly priorities = [
    { key: 'pending_payment', label: 'Pendientes de pago', icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2', path: '/pedidos', query: { status: 'pending_payment' } },
    { key: 'needs_preparation', label: 'Pagados por preparar', icon: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm8 4.5L12 12 4 7.5M12 12v9m4-11.25-8-4.5', path: '/pedidos', query: { status: 'paid', fulfilment_status: 'needs_preparation' } },
    { key: 'ready_for_pickup', label: 'Listos para retiro', icon: 'M6 8h12l2 12H4L6 8Zm3 0V6a3 3 0 0 1 6 0v2m-6 6 2 2 4-4', path: '/pedidos', query: { status: 'paid', fulfilment_status: 'ready_for_pickup' } },
    { key: 'out_of_stock', label: 'Publicados sin stock', icon: 'M4 7h16v13H4zM3 4h18v3H3zm9 6v3m0 3h.01', path: '/productos', query: { status: 'published', availability: 'out_of_stock' } },
  ] satisfies { key: keyof Dashboard['priorities']; label: string; icon: string; path: string; query: Record<string, string> }[];

  protected retry() { this.reload.next(this.reload.value + 1); }

  protected date(value: string, timezone: string) {
    const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
    return new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(utc));
  }

  protected day(value: string) {
    // Calendar boundaries are already dates in the store timezone; do not shift them again.
    return new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  }

  protected month(value: string, long = false) {
    return new Intl.DateTimeFormat('es-UY', { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${value}-01T12:00:00Z`));
  }

  protected maximum(months: SalesMonth[]) { return Math.max(0, ...months.map(month => month.total_cents)); }
  protected hasSales(months: SalesMonth[]) { return months.some(month => month.order_count > 0); }
  protected chartAmount(cents: number) { return new Intl.NumberFormat('es-UY', { notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100); }
}
