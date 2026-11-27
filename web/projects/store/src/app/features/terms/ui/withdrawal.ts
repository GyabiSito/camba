import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiClient, apiMessage } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { HelpArticle } from '../../../shared/ui/help-article/help-article';
import type { PurchaseTerms } from '../data-access/purchase-terms';

type Receipt = { reference: string; received_at: string };

@Component({
  imports: [DatePipe, HelpArticle, ReactiveFormsModule, RouterLink],
  templateUrl: './withdrawal.html',
  styleUrls: ['../../../shared/ui/help-article/help-content.css', '../../../shared/shopper.css'],
  styles: `
    form { max-width: 34rem; }
    label { font-weight: 700; }
    input { width: 100%; min-height: 2.75rem; margin-block-start: 0.35rem; padding-inline: 0.65rem; }
    strong { overflow-wrap: anywhere; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WithdrawalPage {
  private readonly api = inject(ApiClient);
  protected readonly terms = inject(ActivatedRoute).snapshot.data['terms'] as PurchaseTerms | null;
  protected readonly busy = signal(false);
  protected readonly receipt = signal<Receipt | null>(null);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    order_reference: ['', [Validators.required, Validators.pattern(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected async submit(): Promise<void> {
    if (this.busy() || this.receipt()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { data } = await firstValueFrom(this.api.post<{ data: Receipt }>('/api/v1/withdrawals', this.form.getRawValue()));
      this.receipt.set(data);
      this.form.reset();
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos registrar la solicitud. Volvé a intentar o escribinos desde Contactanos.'));
    } finally {
      this.busy.set(false);
    }
  }
}
