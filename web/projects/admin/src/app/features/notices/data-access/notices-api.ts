import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import type { Page } from '../../../shared/operations-data';

export type Notice = {
  id: number; state: 'active' | 'resolved' | 'failed' | 'uncertain'; channel: 'panel' | 'mail'; kind: string;
  issue: string | null; error_code: string | null; subject_type: 'order' | 'product' | 'import' | 'cart';
  subject_id: number | null; order_reference: string | null; updated_at: string; attempts: number;
};
export type NoticePage = Page<Notice> & { kinds: Record<string, string> };

@Injectable({ providedIn: 'root' })
export class NoticesApi {
  private readonly api = inject(ApiClient);
  list(query: Record<string, string | number | null>) {
    return this.api.get<NoticePage>('/api/v1/admin/notices', query);
  }
}
