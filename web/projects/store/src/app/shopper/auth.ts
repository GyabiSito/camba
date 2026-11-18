import { DOCUMENT } from '@angular/common';
import { Component, inject, output, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient, apiMessage, CART_CHANGED } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { api } from './shopper';

type AuthMode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'camba-shopper-auth',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './shopper.css',
  template: `
    <section class="shop-workspace narrow" aria-labelledby="access-title">
      <header class="page-header">
        <h1 id="access-title">{{ titles[mode()] }}</h1>
        <p class="muted">{{ introductions[mode()] }}</p>
      </header>
      <div class="shop-panel">
        @if (message()) {
          <p class="notice" role="status">{{ message() }}</p>
        }
        @if (error()) {
          <p class="notice problem" role="alert">{{ error() }}</p>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" ngNativeValidate>
          <fieldset class="stack" [disabled]="busy()">
            @if (mode() === 'register') {
              <label class="field"
                >Nombre completo
                <input formControlName="name" autocomplete="name" required maxlength="120"
              /></label>
            }
            <label class="field"
              >Correo electrónico
              <input
                formControlName="email"
                type="email"
                autocomplete="username"
                maxlength="254"
                required
              />
            </label>
            @if (mode() !== 'forgot') {
              <label class="field"
                >Contraseña
                <input
                  formControlName="password"
                  type="password"
                  [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
                  [attr.minlength]="mode() === 'register' ? 12 : null"
                  [attr.aria-describedby]="mode() === 'register' ? 'minimum-password' : null"
                  required
                  maxlength="1024"
                />
              </label>
            }
            @if (mode() === 'register') {
              <p id="minimum-password" class="muted small">Usá al menos 12 caracteres.</p>
              <label class="field"
                >Confirmá la contraseña
                <input
                  formControlName="password_confirmation"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="12"
                  maxlength="1024"
                />
              </label>
            }
            <div class="actions">
              <button class="button" type="submit">
                {{ busy() ? 'Un momento…' : labels[mode()] }}
              </button>
              @if (mode() === 'login') {
                <button class="button button--quiet" type="button" (click)="switchTo('forgot')">
                  Olvidé mi contraseña
                </button>
              } @else {
                <button class="button button--quiet" type="button" (click)="switchTo('login')">
                  Volver al ingreso
                </button>
              }
            </div>
          </fieldset>
        </form>
      </div>
      @if (mode() === 'login') {
        <div class="listed">
          <p>
            ¿Todavía no tenés cuenta?
            <button
              class="button button--quiet"
              type="button"
              [disabled]="busy()"
              (click)="switchTo('register')"
            >
              Crear cuenta
            </button>
          </p>
        </div>
        <div class="listed">
          <p class="muted small">
            Los pedidos hechos como invitado se consultan en la sesión en que se crearon. No se
            transfieren al ingresar.
          </p>
          <a routerLink="/pedidos">Ver compras como invitado</a>
        </div>
      }
    </section>
  `,
})
export class ShopperAuth {
  private readonly client = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  readonly signedIn = output<void>();
  protected readonly mode = signal<AuthMode>('login');
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly titles = {
    login: 'Ingresá a tu cuenta',
    register: 'Creá tu cuenta',
    forgot: 'Recuperá tu contraseña',
  };
  protected readonly introductions = {
    login: 'Consultá tus compras y guardá tus direcciones.',
    register: 'Podés comprar con una cuenta o seguir como invitado.',
    forgot: 'Indicá el correo que usaste para registrarte.',
  };
  protected readonly labels = {
    login: 'Ingresar',
    register: 'Registrarme',
    forgot: 'Solicitar enlace',
  };
  protected readonly form = this.fb.nonNullable.group({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });

  protected switchTo(mode: AuthMode) {
    this.mode.set(mode);
    this.form.controls.password.reset();
    this.form.controls.password_confirmation.reset();
    this.error.set('');
    this.message.set('');
  }

  protected async submit() {
    if (this.busy()) return;
    const { name, email, password, password_confirmation } = this.form.getRawValue();
    const mode = this.mode();
    this.error.set('');
    this.message.set('');
    if (mode === 'register' && password !== password_confirmation) {
      this.error.set('Las contraseñas no coinciden. Revisá la confirmación.');
      return;
    }
    this.busy.set(true);
    try {
      if (mode === 'login') {
        await firstValueFrom(this.client.post<void>(api + '/auth/login', { email, password }));
        this.form.reset();
        window.dispatchEvent(new Event(CART_CHANGED));
        this.signedIn.emit();
      } else if (mode === 'register') {
        const result = await firstValueFrom(
          this.client.post<{ meta: { verification_queued: boolean } }>(api + '/auth/register', {
            name,
            email,
            password,
            password_confirmation,
          }),
        );
        this.switchTo('login');
        this.message.set(
          result.meta.verification_queued
            ? 'Cuenta creada. Revisá tu correo para verificarla e ingresá con tu nueva contraseña.'
            : 'Cuenta creada, pero el correo no se pudo solicitar. Ingresá para pedir un enlace nuevo.',
        );
      } else {
        await firstValueFrom(this.client.post<void>(api + '/auth/forgot-password', { email }));
        this.message.set(
          'Si existe una cuenta con ese correo, vas a recibir un enlace para restablecer la contraseña.',
        );
      }
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos completar la solicitud. Probá de nuevo.'));
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './shopper.css',
  template: `
    <section class="shop-workspace narrow">
      <header class="page-header"><h1>Restablecé tu contraseña</h1></header>
      <div class="shop-panel">
        @if (saved()) {
          <p class="notice" role="status">Contraseña actualizada. Ya podés ingresar.</p>
          <div class="actions"><a class="button" routerLink="/cuenta">Ir al ingreso</a></div>
        } @else if (!token) {
          <p class="notice problem" role="alert">
            Este enlace no está completo. Solicitá otro desde tu cuenta.
          </p>
          <div class="actions"><a class="button" routerLink="/cuenta">Volver a mi cuenta</a></div>
        } @else {
          @if (error()) {
            <p class="notice problem" role="alert">{{ error() }}</p>
          }
          <form [formGroup]="form" (ngSubmit)="submit()" ngNativeValidate>
            <fieldset class="stack" [disabled]="busy()">
              <label class="field"
                >Correo electrónico
                <input
                  type="email"
                  autocomplete="username"
                  formControlName="email"
                  maxlength="254"
                  required
              /></label>
              <label class="field"
                >Nueva contraseña
                <input
                  type="password"
                  autocomplete="new-password"
                  formControlName="password"
                  minlength="12"
                  maxlength="1024"
                  aria-describedby="reset-password-length"
                  required
                />
              </label>
              <p id="reset-password-length" class="muted small">Usá al menos 12 caracteres.</p>
              <label class="field"
                >Confirmá la contraseña
                <input
                  type="password"
                  autocomplete="new-password"
                  formControlName="password_confirmation"
                  minlength="12"
                  maxlength="1024"
                  required
                />
              </label>
              <div class="actions">
                <button class="button" type="submit">
                  {{ busy() ? 'Guardando…' : 'Guardar contraseña' }}
                </button>
                <a routerLink="/cuenta" class="button button--quiet">Volver al ingreso</a>
              </div>
            </fieldset>
          </form>
        }
      </div>
    </section>
  `,
})
export class ResetPage {
  private readonly client = inject(ApiClient);
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly platform = inject(PLATFORM_ID);
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
    password_confirmation: ['', [Validators.required, Validators.minLength(12)]],
  });
  protected token = this.readToken();

  private readToken() {
    if (!isPlatformBrowser(this.platform) || !this.browser) return null;
    const { hash, pathname, search } = this.browser.location;
    const token = new URLSearchParams(hash.slice(1)).get('token');
    if (hash) this.browser.history.replaceState(this.browser.history.state, '', pathname + search);
    return token && token.length <= 255 ? token : null;
  }

  protected async submit() {
    if (this.busy() || this.form.invalid || !this.token) return;
    this.error.set('');
    const form = this.form.getRawValue();
    if (form.password !== form.password_confirmation) {
      this.error.set('Las contraseñas no coinciden. Revisá la confirmación.');
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.client.post<void>(api + '/auth/reset-password', { ...form, token: this.token }),
      );
      this.form.reset();
      this.token = null;
      this.saved.set(true);
    } catch (error) {
      this.error.set(
        apiMessage(
          error,
          'No pudimos cambiar la contraseña. Revisá los datos o solicitá otro enlace.',
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
