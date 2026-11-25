import { inject, Injectable } from '@angular/core';
import { ApiClient } from '@camba/shared';

export type Admin = { name: string; email: string };

@Injectable({ providedIn: 'root' })
export class AdminSessionApi {
  private readonly api = inject(ApiClient);

  load() {
    return this.api.get<{ data: Admin }>('/api/v1/admin/session');
  }

  signIn(email: string, password: string) {
    return this.api.post('/api/v1/auth/login', { email, password });
  }

  signOut() {
    return this.api.post('/api/v1/auth/logout');
  }
}
