import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiMessage, CART_CHANGED } from '@camba/shared';
import { firstValueFrom, map } from 'rxjs';
import { AddressFields } from '../../shared/ui/address-fields';
import { ShopperAuth } from './auth';
import { accountReturn } from './account-return';
import { httpStatus } from '../../shared/data-access/api-contracts';
import { Address, addressGeography, makeAddressForm, resetAddressForm } from '../../shared/data-access/address';
import { Buyer } from '@camba/shared';
import { AccountApi, type Preferences } from './index';


@Component({
  imports: [AddressFields, ShopperAuth, ReactiveFormsModule, RouterLink],
  templateUrl: './account.html',
  styleUrls: ['../../shared/shopper.css', '../../shared/members-design.css'],
})
export class AccountPage {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly api = inject(AccountApi);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly returnTo = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map(accountReturn)), { requireSync: true });
  protected readonly verificationResult = inject(ActivatedRoute).snapshot.queryParamMap.get(
    'verificacion',
  );
  protected readonly buyer = signal<Buyer | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly profileMessage = signal('');
  protected readonly profileBusy = signal(false);
  protected readonly passwordBusy = signal(false);
  protected readonly passwordFeedback = signal<{ error: boolean; text: string } | null>(null);
  protected readonly passwordFields = [
    { name: 'current_password', label: 'Contraseña actual', autocomplete: 'current-password' },
    { name: 'password', label: 'Nueva contraseña', autocomplete: 'new-password' },
    { name: 'password_confirmation', label: 'Confirmar nueva contraseña', autocomplete: 'new-password' },
  ] as const;

  protected readonly addresses = signal<Address[] | null>(null);
  protected readonly addressesLoading = signal(false);
  protected readonly addressBusy = signal(false);
  protected readonly addressError = signal('');
  protected readonly addressMessage = signal('');
  protected readonly editingAddress = signal<number | 'new' | null>(null);
  protected readonly previousAddress = signal<Address | null>(null);
  protected readonly removingAddress = signal<number | null>(null);

  protected readonly preferencesUnavailable = signal(false);
  protected readonly preferencesLoaded = signal(false);
  protected readonly preferencesBusy = signal(false);
  protected readonly preferencesError = signal('');
  protected readonly preferencesMessage = signal('');
  protected readonly verificationMessage = signal('');
  protected readonly verificationError = signal('');
  protected readonly verificationBusy = signal(false);

  protected readonly profile = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  protected readonly password = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(12)]],
    password_confirmation: ['', Validators.required],
  });
  protected readonly address = makeAddressForm(this.fb);
  protected readonly phone = this.fb.nonNullable.control('', Validators.maxLength(30));
  protected readonly preferences = this.fb.nonNullable.group({
    payment_reminders: false,
    cart_reminders: false,
  });

  constructor() {
    void this.loadBuyer();
  }

  protected async loadBuyer(afterLogin = false) {
    this.error.set('');
    this.loading.set(true);
    try {
      const { data } = await firstValueFrom(this.api.me());
      this.profile.reset({ name: data.name });
      this.buyer.set(data);
      const destination = this.returnTo();
      if (afterLogin && destination && data.role === 'buyer') {
        if (await this.router.navigate(destination.commands)) return;
      }
      if (this.browser) void this.loadAddresses();
      if (this.browser && data.email_verified && data.role === 'buyer')
        void this.updatePreferences(false);
    } catch (error) {
      if (httpStatus(error) !== 401)
        this.error.set(apiMessage(error, 'No pudimos abrir tu cuenta.'));
      this.buyer.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected async logout() {
    if (
      this.profileBusy() ||
      this.passwordBusy() ||
      this.addressBusy() ||
      this.preferencesBusy() ||
      this.verificationBusy()
    )
      return;
    this.error.set('');
    this.profileBusy.set(true);
    try {
      await firstValueFrom(this.api.logout());
      this.buyer.set(null);
      this.profile.reset();
      this.password.reset();
      this.passwordFeedback.set(null);
      this.address.reset();
      this.phone.reset();
      this.addresses.set(null);
      this.editingAddress.set(null);
      this.removingAddress.set(null);
      this.profileMessage.set('');
      this.addressMessage.set('');
      this.addressError.set('');
      this.preferences.reset();
      this.preferencesLoaded.set(false);
      this.preferencesUnavailable.set(false);
      this.preferencesMessage.set('');
      this.preferencesError.set('');
      this.verificationMessage.set('');
      this.verificationError.set('');
      window.dispatchEvent(new Event(CART_CHANGED));
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos cerrar la sesión.'));
    } finally {
      this.profileBusy.set(false);
    }
  }

  protected async saveProfile() {
    if (this.profileBusy()) return;
    if (this.profile.invalid) {
      this.profile.markAllAsTouched();
      return;
    }
    this.error.set('');
    this.profileMessage.set('');
    this.profileBusy.set(true);
    try {
      const { data } = await firstValueFrom(
        this.api.updateProfile(this.profile.getRawValue()),
      );
      this.profile.reset({ name: data.name });
      this.buyer.set(data);
      this.profileMessage.set('Tus datos se guardaron.');
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos guardar tus datos.'));
    } finally {
      this.profileBusy.set(false);
    }
  }

  protected passwordError(name: (typeof this.passwordFields)[number]['name']): string {
    const control = this.password.controls[name];
    if (control.hasError('server')) return control.getError('server');
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Completá este campo.';
    if (control.hasError('minlength')) return 'Usá al menos 12 caracteres.';
    if (name === 'password_confirmation' && control.value !== this.password.controls.password.value) {
      return 'Las contraseñas no coinciden.';
    }
    return '';
  }

  protected async savePassword() {
    if (this.passwordBusy()) return;
    this.passwordFeedback.set(null);
    this.password.markAllAsTouched();
    const body = this.password.getRawValue();
    if (this.password.invalid || body.password !== body.password_confirmation) return;

    this.passwordBusy.set(true);
    try {
      await firstValueFrom(this.api.changePassword(body));
      this.password.reset();
      this.passwordFeedback.set({ error: false, text: 'Contraseña actualizada' });
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        let hasFieldErrors = false;
        for (const { name } of this.passwordFields) {
          const message = error.error?.errors?.[name]?.[0];
          if (typeof message !== 'string') continue;
          this.password.controls[name].setErrors({ server: message });
          hasFieldErrors = true;
        }
        if (hasFieldErrors) return;
      }
      this.passwordFeedback.set({
        error: true,
        text: httpStatus(error) === 401
          ? 'Tu sesión venció. Volvé a iniciar sesión.'
          : 'No pudimos actualizar la contraseña. Probá de nuevo en un momento.',
      });
    } finally {
      this.passwordBusy.set(false);
    }
  }

  protected async verify(resend: boolean) {
    if (this.verificationBusy()) return;
    this.verificationError.set('');
    this.verificationMessage.set('');
    this.verificationBusy.set(true);
    try {
      if (resend) {
        await firstValueFrom(this.api.requestEmailVerification());
        this.verificationMessage.set(
          'Solicitamos otro enlace. Revisá la bandeja de entrada y el correo no deseado.',
        );
      } else {
        const { data } = await firstValueFrom(this.api.me());
        this.buyer.set(data);
        this.verificationMessage.set(
          data.email_verified
            ? 'Correo verificado.'
            : 'Todavía no figura verificado. Abrí el enlace de tu correo.',
        );
      }
    } catch (error) {
      this.verificationError.set(
        apiMessage(error, 'No pudimos comprobar la verificación. Probá más tarde.'),
      );
    } finally {
      this.verificationBusy.set(false);
    }
  }

  protected async loadAddresses() {
    if (this.addressesLoading()) return;
    this.addressError.set('');
    this.addressesLoading.set(true);
    try {
      const { data } = await firstValueFrom(
        this.api.addresses(),
      );
      this.addresses.set(data);
    } catch (error) {
      this.addressError.set(apiMessage(error, 'No pudimos cargar tus direcciones.'));
    } finally {
      this.addressesLoading.set(false);
    }
  }

  protected editAddress(value: Address | null) {
    this.addressError.set('');
    this.addressMessage.set('');
    this.removingAddress.set(null);
    this.editingAddress.set(value?.id ?? 'new');
    this.previousAddress.set(value && !addressGeography(value) ? value : null);
    resetAddressForm(this.address, value ?? undefined);
    this.phone.reset(value?.phone ?? '');
  }

  protected async saveAddress() {
    const editing = this.editingAddress();
    if (editing === null || this.addressBusy()) return;
    this.addressError.set('');
    this.addressMessage.set('');
    const fields = this.address.getRawValue();
    const geography = addressGeography(fields);
    if (!geography) {
      this.address.markAllAsTouched();
      this.addressError.set('Elegí un departamento y una localidad válidos.');
      return;
    }
    if (this.address.invalid || this.phone.invalid) return;
    this.addressBusy.set(true);
    const payload = { ...fields, ...geography, phone: this.phone.value };
    try {
      const { data } = await firstValueFrom(
        this.api.saveAddress(editing === 'new' ? null : editing, payload),
      );
      this.addresses.update((items) =>
        editing === 'new'
          ? [...(items ?? []), data]
          : (items ?? []).map((item) => (item.id === data.id ? data : item)),
      );
      this.editingAddress.set(null);
      this.addressMessage.set('Dirección guardada.');
    } catch (error) {
      this.addressError.set(apiMessage(error, 'No pudimos guardar la dirección.'));
    } finally {
      this.addressBusy.set(false);
    }
  }

  protected async removeAddress(id: number) {
    if (this.addressBusy() || this.removingAddress() !== id) return;
    this.addressBusy.set(true);
    this.addressError.set('');
    this.addressMessage.set('');
    try {
      await firstValueFrom(this.api.deleteAddress(id));
      this.addresses.update((items) => (items ?? []).filter((item) => item.id !== id));
      this.removingAddress.set(null);
      if (this.editingAddress() === id) this.editingAddress.set(null);
      this.addressMessage.set('Dirección eliminada.');
    } catch (error) {
      this.addressError.set(apiMessage(error, 'No pudimos eliminar la dirección.'));
    } finally {
      this.addressBusy.set(false);
    }
  }

  protected async updatePreferences(save: boolean) {
    if (this.preferencesBusy()) return;
    this.preferencesBusy.set(true);
    this.preferencesError.set('');
    this.preferencesMessage.set('');
    try {
      const { data } = await firstValueFrom(
        save ? this.api.updatePreferences(this.preferences.getRawValue()) : this.api.preferences(),
      );
      this.preferences.reset(data);
      this.preferencesLoaded.set(true);
      if (save) this.preferencesMessage.set('Preferencias guardadas.');
    } catch (error) {
      if (httpStatus(error) === 503) {
        this.preferencesUnavailable.set(true);
        return;
      }
      this.preferencesError.set(
        apiMessage(error, 'No pudimos ' + (save ? 'guardar' : 'cargar') + ' tus preferencias.'),
      );
    } finally {
      this.preferencesBusy.set(false);
    }
  }
}
