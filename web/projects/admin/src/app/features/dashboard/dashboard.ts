import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { formatDate, formatMoney } from '@camba/shared';
import { BehaviorSubject, switchMap } from 'rxjs';
import { readState } from '../../shared/operations-data';
import { orderLabels } from '../orders';
import { OperationLoading } from '../../shared/operation-ui';
import { DashboardApi } from './data-access/dashboard-api';
import type { Dashboard, SalesMonth } from './data-access/dashboard-api';

@Component({
  selector: 'camba-dashboard',
  imports: [RouterLink, OperationLoading],
  templateUrl: './dashboard.html',
  styleUrls: ['../../shared/operations.css', './dashboard.css'],
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly reload = new BehaviorSubject(0);
  protected readonly result = toSignal(this.reload.pipe(switchMap(() => readState(
    this.api.load(),
    'No pudimos cargar el inicio. Reintentá para ver los datos actualizados.',
  ))));
  protected readonly money = formatMoney;
  protected readonly date = formatDate;
  protected readonly orderStatus = orderLabels;
  protected readonly pendingOrders = {
    key: 'pending_payment', label: 'Pendientes de pago',
    icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
    path: '/pedidos', query: { status: 'pending_payment' },
  } as const;
  protected readonly priorities = [
    this.pendingOrders,
    { key: 'needs_preparation', label: 'Pagados por preparar', icon: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm8 4.5L12 12 4 7.5M12 12v9m4-11.25-8-4.5', path: '/pedidos', query: { status: 'paid', fulfilment_status: 'needs_preparation' } },
    { key: 'ready_for_pickup', label: 'Listos para retiro', icon: 'M6 8h12l2 12H4L6 8Zm3 0V6a3 3 0 0 1 6 0v2m-6 6 2 2 4-4', path: '/pedidos', query: { status: 'paid', fulfilment_status: 'ready_for_pickup' } },
    { key: 'out_of_stock', label: 'Publicados sin stock', icon: 'M4 7h16v13H4zM3 4h18v3H3zm9 6v3m0 3h.01', path: '/productos', query: { status: 'published', availability: 'out_of_stock' } },
    { key: 'received_withdrawals', label: 'Arrepentimientos por revisar', icon: 'M8 6 4 10l4 4m-4-4h10a5 5 0 0 1 0 10h-3', path: '/pedidos/arrepentimientos', query: { status: 'received' } },
    { key: 'registered_buyers', label: 'Usuarios', icon: 'M13 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 19v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M16 5a3 3 0 0 1 0 6m2 2a4 4 0 0 1 2 4v2', path: '/usuarios', query: {} },
  ] satisfies { key: keyof Dashboard['priorities']; label: string; icon: string; path: string; query: Record<string, string> }[];

  protected retry() { this.reload.next(this.reload.value + 1); }

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
