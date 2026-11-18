import { HttpErrorResponse } from '@angular/common/http';
import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, CanActivateFn, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiClient, apiMessage } from '@camba/shared';
import { firstValueFrom, map, switchMap, tap } from 'rxjs';

type Admin = { name: string; email: string };

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
  imports: [FormsModule, RouterLink],
  styleUrl: './shell.css',
  template: `
    <main class="login-frame" id="contenido">
      <a class="wordmark" routerLink="/productos" aria-label="Camba, administración">Camba</a>
      <div class="login-box">
        <h1>Ingresar a administración</h1>
        <p class="muted">Usá una cuenta con acceso administrativo y correo verificado.</p>
        @if (error()) { <p class="callout" role="alert">{{ error() }}</p> }
        <form (ngSubmit)="submit()" #form="ngForm" [attr.aria-busy]="busy()">
          <label class="field">Correo electrónico
            <input [(ngModel)]="email" name="email" type="email" required autocomplete="username" />
          </label>
          <label class="field">Contraseña
            <input [(ngModel)]="password" name="password" type="password" required autocomplete="current-password" />
          </label>
          <button class="button" type="submit" [disabled]="busy() || form.invalid">{{ busy() ? 'Ingresando…' : 'Ingresar' }}</button>
        </form>
      </div>
    </main>
  `,
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
      await this.router.navigateByUrl(/^\/(productos|pedidos|configuracion)(?:\/|\?|$)/.test(next) ? next : '/productos');
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
  template: `
    <a class="skip" href="#contenido">Saltar al contenido</a>
    <header class="masthead">
      <a class="wordmark" routerLink="/productos" aria-label="Camba, administración">Camba</a>
      <nav aria-label="Administración">
        <a routerLink="/productos" routerLinkActive="active" ariaCurrentWhenActive="page">Productos</a>
        <a routerLink="/pedidos" routerLinkActive="active" ariaCurrentWhenActive="page">Pedidos</a>
        <a routerLink="/configuracion" routerLinkActive="active" ariaCurrentWhenActive="page">Configuración</a>
      </nav>
      <details class="account">
        <summary [attr.aria-label]="'Opciones de ' + user()?.name" [title]="user()?.name">{{ initials() }}</summary>
        <div class="surface">
          <strong>{{ user()?.name }}</strong>
          <span class="muted">{{ user()?.email }}</span>
          <button type="button" class="button button--quiet" [disabled]="busy()" (click)="signOut()">Cerrar sesión</button>
        </div>
      </details>
    </header>
    <main id="contenido" tabindex="-1" class="admin-body">
      @if (error()) { <p role="alert" class="callout">{{ error() }}</p> }
      <router-outlet />
    </main>
  `,
})
export class AdminShell {
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);
  protected readonly user = this.session.user;
  protected readonly initials = computed(() => this.user()?.name.trim().split(/\s+/).slice(0, 2).map((v) => v[0]).join('').toUpperCase() || 'CA');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

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
