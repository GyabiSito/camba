import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient, apiMessage, CART_CHANGED } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { AddressFields } from './address-fields';
import { ShopperAuth } from './auth';
import { Address, api, Buyer, Data, httpStatus, makeAddressForm } from './shopper';

type Preferences = { payment_reminders: boolean; cart_reminders: boolean };

@Component({
  imports: [AddressFields, ShopperAuth, ReactiveFormsModule, RouterLink],
  templateUrl: './account.html',
  styleUrls: ['./shopper.css', './members-design.css'],
})
export class AccountPage {
  private readonly client = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly returnToCheckout =
    inject(ActivatedRoute).snapshot.queryParamMap.get('volver') === 'checkout';
  protected readonly verificationResult = inject(ActivatedRoute).snapshot.queryParamMap.get(
    'verificacion',
  );
  protected readonly buyer = signal<Buyer | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly profileMessage = signal('');
  protected readonly profileBusy = signal(false);

  protected readonly addresses = signal<Address[] | null>(null);
  protected readonly addressesLoading = signal(false);
  protected readonly addressBusy = signal(false);
  protected readonly addressError = signal('');
  protected readonly addressMessage = signal('');
  protected readonly editingAddress = signal<number | 'new' | null>(null);
  protected readonly removingAddress = signal<number | null>(null);

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
      const { data } = await firstValueFrom(this.client.get<Data<Buyer>>(api + '/auth/me'));
      this.profile.reset({ name: data.name });
      this.buyer.set(data);
      if (afterLogin && this.returnToCheckout) await this.router.navigateByUrl('/checkout');
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
      this.addressBusy() ||
      this.preferencesBusy() ||
      this.verificationBusy()
    )
      return;
    this.error.set('');
    this.profileBusy.set(true);
    try {
      await firstValueFrom(this.client.post<void>(api + '/auth/logout'));
      this.buyer.set(null);
      this.profile.reset();
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
        this.client.patch<Data<Buyer>>(api + '/account/profile', this.profile.getRawValue()),
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

  protected async verify(resend: boolean) {
    if (this.verificationBusy()) return;
    this.verificationError.set('');
    this.verificationMessage.set('');
    this.verificationBusy.set(true);
    try {
      if (resend) {
        await firstValueFrom(this.client.post<void>(api + '/auth/email/verification-notification'));
        this.verificationMessage.set(
          'Solicitamos otro enlace. Revisá la bandeja de entrada y el correo no deseado.',
        );
      } else {
        const { data } = await firstValueFrom(this.client.get<Data<Buyer>>(api + '/auth/me'));
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
        this.client.get<Data<Address[]>>(api + '/account/addresses'),
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
    this.address.reset(
      value
        ? { ...value, details: value.details ?? '', postal_code: value.postal_code ?? '' }
        : undefined,
    );
    this.phone.reset(value?.phone ?? '');
  }

  protected async saveAddress() {
    const editing = this.editingAddress();
    if (editing === null || this.address.invalid || this.phone.invalid || this.addressBusy())
      return;
    this.addressBusy.set(true);
    this.addressError.set('');
    this.addressMessage.set('');
    const payload = { ...this.address.getRawValue(), phone: this.phone.value };
    const url = api + '/account/addresses';
    try {
      const { data } = await firstValueFrom(
        editing === 'new'
          ? this.client.post<Data<Address>>(url, payload)
          : this.client.patch<Data<Address>>(url + '/' + editing, payload),
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
      await firstValueFrom(this.client.delete<void>(api + '/account/addresses/' + id));
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
    const url = api + '/account/reminder-preferences';
    try {
      const { data } = await firstValueFrom(
        save
          ? this.client.patch<Data<Preferences>>(url, this.preferences.getRawValue())
          : this.client.get<Data<Preferences>>(url),
      );
      this.preferences.reset(data);
      this.preferencesLoaded.set(true);
      if (save) this.preferencesMessage.set('Preferencias guardadas.');
    } catch (error) {
      this.preferencesError.set(
        apiMessage(error, 'No pudimos ' + (save ? 'guardar' : 'cargar') + ' tus preferencias.'),
      );
    } finally {
      this.preferencesBusy.set(false);
    }
  }
}
