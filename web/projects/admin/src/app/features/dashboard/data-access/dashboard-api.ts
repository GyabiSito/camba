import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import type { Order } from '../../orders';

export type SalesMonth = { month: string; order_count: number; total_cents: number };
export type Dashboard = {
  priorities: { pending_payment: number; needs_preparation: number; ready_for_pickup: number; out_of_stock: number };
  recent_orders: Order[];
  sales: { timezone: string; from: string; through: string; order_count: number; total_cents: number; months: SalesMonth[] };
};

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly api = inject(ApiClient);
  load() { return this.api.get<{ data: Dashboard }>('/api/v1/admin/dashboard'); }
}
