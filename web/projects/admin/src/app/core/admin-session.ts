import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, map, switchMap, tap } from 'rxjs';
import { AdminSessionApi, type Admin } from './data-access/admin-session-api';

@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly api = inject(AdminSessionApi);
  readonly user = signal<Admin | null>(null);

  load() {
    return this.api.load().pipe(
      map(({ data }) => data),
      tap((data) => this.user.set(data)),
    );
  }

  signIn(email: string, password: string) {
    return this.api.signIn(email, password).pipe(switchMap(() => this.load()));
  }

  signOut() {
    return this.api.signOut().pipe(tap(() => this.user.set(null)));
  }
}

export const requireAdmin: CanActivateFn = async (_, state) => {
  const session = inject(AdminSession);
  const router = inject(Router);
  try {
    await firstValueFrom(session.load());
    return true;
  } catch (error) {
    session.user.set(null);
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    const reason = status === 403 ? 'ineligible' : status === 401 ? undefined : 'offline';
    return router.createUrlTree(['/ingresar'], { queryParams: { next: state.url, reason } });
  }
};
