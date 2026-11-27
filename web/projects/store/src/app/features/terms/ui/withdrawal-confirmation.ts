import { Location } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiClient, formatDate } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { useStoreMeta } from '../../../core/seo/store-meta';
import { httpStatus } from '../../../shared/data-access/api-contracts';
import { HelpArticle } from '../../../shared/ui/help-article/help-article';

type Receipt = { reference: string; received_at: string };

@Component({
  imports: [RouterLink, HelpArticle],
  templateUrl: './withdrawal-confirmation.html',
  styleUrls: ['../../../shared/ui/help-article/help-content.css', '../../../shared/shopper.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WithdrawalConfirmationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiClient);
  private readonly location = inject(Location);
  private readonly reference = this.route.snapshot.paramMap.get('reference') ?? '';
  private token = '';
  protected readonly date = formatDate;
  protected readonly ready = signal(false);
  protected readonly invalid = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly receipt = signal<Receipt | null>(null);

  constructor() {
    useStoreMeta(() => ({ title: 'Confirmá tu solicitud', description: 'Confirmación de arrepentimiento de Camba.', noindex: true }));
    afterNextRender(() => {
      this.token = this.route.snapshot.fragment ?? '';
      this.invalid.set(!/^[a-f0-9]{64}$/.test(this.token));
      this.ready.set(true);
    });
  }

  protected async confirm(): Promise<void> {
    if (!this.ready() || this.invalid() || this.busy() || this.receipt()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      const { data } = await firstValueFrom(this.api.post<{ data: Receipt }>(
        '/api/v1/withdrawals/' + encodeURIComponent(this.reference) + '/confirmation', { token: this.token },
      ));
      this.receipt.set(data);
      this.clearToken();
    } catch (error) {
      if ([404, 410, 422].includes(httpStatus(error) ?? 0)) {
        this.invalid.set(true);
        this.clearToken();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private clearToken(): void {
    this.token = '';
    this.location.replaceState('/arrepentimiento/confirmar/' + encodeURIComponent(this.reference));
  }
}
