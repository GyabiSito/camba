import { HttpErrorResponse } from '@angular/common/http';
import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, CanActivateFn, isActive, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiClient, apiMessage } from '@camba/shared';
import { firstValueFrom, map, switchMap, tap } from 'rxjs';
import { noticeQueryKeys } from './operations/operation-data';

type Admin = { name: string; email: string };
const sectionMatch = { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' } as const;

@Injectable({ providedIn: 'root' })
class AdminSession {
  private readonly api = inject(ApiClient);
  readonly user = signal<Admin | null>(null);

  load() {
    return this.api.get<{ data: Admin }>('/api/v1/admin/session').pipe(
      map(({ data }) => data),
      tap((data) => this.user.set(data)),
    );
  }

  signIn(email: string, password: string) {
    return this.api.post('/api/v1/auth/login', { email, password }).pipe(switchMap(() => this.load()));
  }

  signOut() {
    return this.api.post('/api/v1/auth/logout').pipe(tap(() => this.user.set(null)));
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

@Component({
  selector: 'camba-admin-login',
  imports: [FormsModule],
  styleUrl: './shell.css',
  templateUrl: './admin-login.html',
})
export class AdminLogin {
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly busy = signal(false);
  protected readonly error = signal(this.entryError());
  protected email = '';
  protected password = '';

  private entryError() {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    return reason === 'ineligible' ? 'La cuenta no tiene acceso administrativo o el correo no está verificado.'
      : reason === 'offline' ? 'No pudimos comprobar tu sesión. Intentá ingresar.' : '';
  }

  protected async submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.session.signIn(this.email.trim(), this.password));
      this.password = '';
      const next = this.route.snapshot.queryParamMap.get('next') ?? '';
      await this.router.navigateByUrl(/^\/(dashboard|productos|pedidos|configuracion|portada)(?:[/?#]|$)/.test(next) ? next : '/dashboard');
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'La cuenta no tiene acceso administrativo o el correo no está verificado.'
        : apiMessage(error, 'No pudimos iniciar sesión. Revisá tus datos o intentá de nuevo.'));
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'camba-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrl: './shell.css',
  templateUrl: './admin-layout.html',
})
export class AdminShell {
  private readonly session = inject(AdminSession);
  protected readonly router = inject(Router);
  protected readonly categoriesActive = isActive('/productos/categorias', this.router, sectionMatch);
  protected readonly brandsActive = isActive('/productos/marcas', this.router, sectionMatch);
  private readonly catalogActive = isActive('/productos', this.router, { ...sectionMatch, paths: 'subset' });
  protected readonly productsActive = computed(() => this.catalogActive() && !this.categoriesActive() && !this.brandsActive());
  protected readonly noticesActive = isActive('/pedidos/avisos', this.router, sectionMatch);
  private readonly orderSection = isActive('/pedidos', this.router, { ...sectionMatch, paths: 'subset' });
  protected readonly ordersActive = computed(() => this.orderSection() && !this.noticesActive());
  protected readonly noticeReturn = computed(() => {
    const url = this.router.lastSuccessfulNavigation()?.finalUrl;
    const path = this.router.url.split(/[?#]/, 1)[0];
    if (url?.queryParams['from'] !== 'avisos' ||
      !/^\/(?:pedidos\/[0-9a-f-]{36}|productos\/(?:\d+|importar\/\d+)|configuracion)$/.test(path)) return null;

    return Object.fromEntries(noticeQueryKeys.flatMap(key => {
      const value = url.queryParamMap.get('notice_' + key);
      return value === null ? [] : [[key, value]];
    }));
  });
  protected readonly user = this.session.user;
  protected readonly initials = computed(() => this.user()?.name.trim().split(/\s+/).slice(0, 2).map((v) => v[0]).join('').toUpperCase() || 'CA');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly menuOpen = signal(false);

  protected closeMenu(focusTarget: HTMLElement) {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    focusTarget.focus();
  }

  protected async signOut() {
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.session.signOut());
      await this.router.navigateByUrl('/ingresar');
    } catch (error) {
      this.error.set(apiMessage(error, 'No se pudo cerrar la sesión. Intentá nuevamente.'));
    } finally {
      this.busy.set(false);
    }
  }
}
