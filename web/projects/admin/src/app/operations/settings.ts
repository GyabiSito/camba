import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient } from '@camba/shared';
import { BehaviorSubject, switchMap, tap } from 'rxjs';
import { adminApi, Data, operationError, readState } from './operation-data';
import { OperationLoading } from './operation-ui';
import { parseDelivery, settingFields, settingGroups, Settings } from './settings-data';

@Component({
  selector: 'camba-settings',
  imports: [RouterLink, ReactiveFormsModule, OperationLoading],
  templateUrl: './settings.html',
  styleUrls: ['./operations.css', './settings.css'],
})
export class SettingsPage {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new BehaviorSubject(0);
  private baseline?: Settings;
  readonly groups = settingGroups;
  readonly saving = signal(false);
  readonly attempted = signal(false);
  readonly feedback = signal<{ error: boolean; text: string } | null>(null);
  readonly rejectedFields = signal<Set<string>>(new Set());

  readonly form = this.fb.group({
    business_name: [
      '',
      [
        (control: { value: string }) => (control.value.trim() ? null : { required: true }),
        Validators.maxLength(120),
      ],
    ],
    support_email: ['', [Validators.email, Validators.maxLength(254)]],
    support_phone: ['', Validators.maxLength(40)],
    pickup_address: ['', Validators.maxLength(255)],
    delivery_cents: [
      '',
      (control: { value: string }) =>
        !control.value.trim() || parseDelivery(control.value) !== null ? null : { amount: true },
    ],
    remind_payment: [false],
    payment_lead_minutes: [
      10,
      [Validators.required, Validators.min(1), Validators.max(25), Validators.pattern(/^\d+$/)],
    ],
    remind_cart: [false],
    cart_delay_hours: [
      24,
      [Validators.required, Validators.min(1), Validators.max(168), Validators.pattern(/^\d+$/)],
    ],
    low_stock_threshold: [
      3,
      [Validators.required, Validators.min(0), Validators.max(1000), Validators.pattern(/^\d+$/)],
    ],
    pending_fulfilment_hours: [
      24,
      [Validators.required, Validators.min(1), Validators.max(168), Validators.pattern(/^\d+$/)],
    ],
  });

  readonly settings = toSignal(
    this.reload.pipe(
      switchMap(() =>
        readState(
          this.api
            .get<Data<Settings>>(`${adminApi}/settings`)
            .pipe(tap((response) => this.restore(response.data))),
          'No pudimos cargar la configuración.',
        ),
      ),
    ),
  );

  retry() {
    this.reload.next(0);
  }

  clearError(name: keyof Settings) {
    if (this.rejectedFields().has(name)) {
      this.rejectedFields.update(
        (previous) => new Set([...previous].filter((key) => key !== name)),
      );
    }
  }

  fieldError(name: keyof Settings): string | null {
    const control = this.form.controls[name];
    if (this.rejectedFields().has(name)) return 'Revisá el valor. No se pudo guardar este campo.';
    if (!control.invalid || (!control.touched && !this.attempted())) return null;
    if (name === 'business_name' && control.hasError('required'))
      return 'Ingresá el nombre comercial.';
    if (name === 'support_email' && control.hasError('email')) return 'Ingresá un correo válido.';
    if (name === 'delivery_cents')
      return 'Usá un importe entre 0 y 21.474.836,47, con hasta dos decimales.';
    if (control.hasError('maxlength')) return 'El texto es demasiado largo.';
    return 'Ingresá un número entero dentro del rango indicado.';
  }

  save(event: Event) {
    event.preventDefault();
    if (this.saving() || !this.baseline) return;
    this.attempted.set(true);
    this.feedback.set(null);
    if (this.form.invalid) {
      this.feedback.set({ error: true, text: 'Revisá los campos indicados antes de guardar.' });
      (event.currentTarget as HTMLFormElement)
        .querySelector<HTMLElement>('input.ng-invalid')
        ?.focus();
      return;
    }

    const input = this.form.getRawValue();
    const values: Settings = {
      ...input,
      business_name: input.business_name.trim(),
      support_email: input.support_email.trim() || null,
      support_phone: input.support_phone.trim() || null,
      pickup_address: input.pickup_address.trim() || null,
      delivery_cents: parseDelivery(input.delivery_cents),
    };
    const baseline = this.baseline;
    const changed = settingFields.filter(({ name }) => values[name] !== baseline[name]);
    if (!changed.length) {
      this.feedback.set({ error: false, text: 'No hay cambios nuevos para guardar.' });
      return;
    }
    const patch = Object.fromEntries(changed.map(({ name }) => [name, values[name]]));
    this.saving.set(true);
    this.rejectedFields.set(new Set());
    this.api
      .patch<Data<Settings>>(`${adminApi}/settings`, patch)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (response) => {
          this.restore(response.data);
          this.saving.set(false);
          this.feedback.set({ error: false, text: 'Guardamos la configuración.' });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          if (error instanceof HttpErrorResponse && error.status === 422 && error.error?.errors) {
            this.rejectedFields.set(new Set(Object.keys(error.error.errors)));
          }
          this.feedback.set({
            error: true,
            text: operationError(
              error,
              'No pudimos guardar los cambios. Tus datos siguen disponibles.',
            ),
          });
        },
      });
  }

  private restore(values: Settings) {
    this.baseline = values;
    this.attempted.set(false);
    this.form.reset({
      ...values,
      support_email: values.support_email ?? '',
      support_phone: values.support_phone ?? '',
      pickup_address: values.pickup_address ?? '',
      delivery_cents:
        values.delivery_cents === null
          ? ''
          : (values.delivery_cents / 100).toFixed(2).replace('.', ','),
    });
  }
}
