import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiClient, apiMessage, formatDate } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { HelpArticle } from '../../../shared/ui/help-article/help-article';
import type { PurchaseTerms } from '../data-access/purchase-terms';

type Receipt = { reference: string; received_at: string };

@Component({
  imports: [HelpArticle, ReactiveFormsModule, RouterLink],
  templateUrl: './withdrawal.html',
  styleUrls: ['../../../shared/ui/help-article/help-content.css', '../../../shared/shopper.css', './withdrawal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WithdrawalPage {
  private readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly receiptTitle = viewChild<ElementRef<HTMLHeadingElement>>('receiptTitle');
  protected readonly terms = inject(ActivatedRoute).snapshot.data['terms'] as PurchaseTerms | null;
  protected readonly busy = signal(false);
  protected readonly receipt = signal<Receipt | null>(null);
  protected readonly date = formatDate;
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    order_reference: ['', [Validators.required, Validators.pattern(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected print(): void {
    this.document.defaultView?.print();
  }

  protected async submit(referenceField: HTMLInputElement, emailField: HTMLInputElement): Promise<void> {
    if (this.busy() || this.receipt()) return;
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      (this.form.controls.order_reference.invalid ? referenceField : emailField).focus();
      return;
    }
    this.busy.set(true);
    try {
      const { data } = await firstValueFrom(this.api.post<{ data: Receipt }>('/api/v1/withdrawals', this.form.getRawValue()));
      this.receipt.set(data);
      afterNextRender(() => this.receiptTitle()?.nativeElement.focus(), { injector: this.injector });
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos registrar la solicitud. Volvé a intentar o escribinos desde Contactanos.'));
    } finally {
      this.busy.set(false);
    }
  }
}
