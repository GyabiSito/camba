import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import type { Data, PageInfo } from '../../../shared/operations-data';

export type Settings = {
  business_name: string;
  support_email: string | null;
  support_phone: string | null;
  pickup_address: string | null;
  delivery_cents: number | null;
  remind_payment: boolean;
  payment_lead_minutes: number;
  remind_cart: boolean;
  cart_delay_hours: number;
  low_stock_threshold: number;
  pending_fulfilment_hours: number;
};
export type AuditEntry = { id: number; actor_id: number; before: Settings; after: Settings; created_at: string };

@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly api = inject(ApiClient);
  private readonly endpoint = '/api/v1/admin/settings';
  get() { return this.api.get<Data<Settings>>(this.endpoint); }
  save(patch: Partial<Settings>) { return this.api.patch<Data<Settings>>(this.endpoint, patch); }
  history(page: number) {
    return this.api.get<PageInfo & { data: AuditEntry[] }>(`${this.endpoint}/history`, { page });
  }
}
