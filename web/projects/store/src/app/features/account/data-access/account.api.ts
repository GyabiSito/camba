import { Injectable, inject } from '@angular/core';
import { ApiClient, Buyer } from '@camba/shared';
import { Address, AddressInput } from '../../../shared/data-access/address';
import { Data } from '../../../shared/data-access/api-contracts';

export type Preferences = { payment_reminders: boolean; cart_reminders: boolean };

@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly client = inject(ApiClient);
  private readonly base = '/api/v1';

  me() { return this.client.get<Data<Buyer>>(this.base + '/auth/me'); }
  login(email: string, password: string) { return this.client.post<void>(this.base + '/auth/login', { email, password }); }
  register(body: { name: string; email: string; password: string; password_confirmation: string }) {
    return this.client.post<{ meta: { verification_queued: boolean } }>(this.base + '/auth/register', body);
  }
  forgotPassword(email: string) { return this.client.post<void>(this.base + '/auth/forgot-password', { email }); }
  resetPassword(body: { password: string; password_confirmation: string; token: string }) {
    return this.client.post<void>(this.base + '/auth/reset-password', body);
  }
  logout() { return this.client.post<void>(this.base + '/auth/logout'); }
  updateProfile(body: { name: string }) { return this.client.patch<Data<Buyer>>(this.base + '/account/profile', body); }
  requestEmailVerification() { return this.client.post<void>(this.base + '/auth/email/verification-notification'); }
  addresses() { return this.client.get<Data<Address[]>>(this.base + '/account/addresses'); }
  saveAddress(id: number | null, body: AddressInput & { phone?: string | null }) {
    return id === null
      ? this.client.post<Data<Address>>(this.base + '/account/addresses', body)
      : this.client.patch<Data<Address>>(this.base + '/account/addresses/' + id, body);
  }
  deleteAddress(id: number) { return this.client.delete<void>(this.base + '/account/addresses/' + id); }
  preferences() { return this.client.get<Data<Preferences>>(this.base + '/account/reminder-preferences'); }
  updatePreferences(body: Preferences) { return this.client.patch<Data<Preferences>>(this.base + '/account/reminder-preferences', body); }
}
