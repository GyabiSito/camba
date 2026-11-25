import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiClient, apiMessage, CART_CHANGED } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { api } from './shopper';

type AuthMode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'camba-shopper-auth',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrls: ['./shopper.css', './members-design.css'],
  template: `
    <section class="shop-workspace narrow members" aria-labelledby="access-title">
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
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <fieldset class="stack" [disabled]="busy()">
            @if (mode() === 'register') {
              <label class="field"
                >Nombre completo
                <input id="auth-name" formControlName="name" autocomplete="name" required maxlength="120"
                  [attr.aria-invalid]="fieldError('name') ? 'true' : null"
                  [attr.aria-describedby]="fieldError('name') ? 'auth-name-error' : null"
              /></label>
              @if (fieldError('name'); as validation) { <p id="auth-name-error" class="field-error">{{ validation }}</p> }
            }
            <label class="field"
              >Correo electrónico
              <input
                id="auth-email"
                formControlName="email"
                type="email"
                autocomplete="username"
                maxlength="254"
                required
                [attr.aria-invalid]="fieldError('email') ? 'true' : null"
                [attr.aria-describedby]="fieldError('email') ? 'auth-email-error' : null"
              />
            </label>
            @if (fieldError('email'); as validation) { <p id="auth-email-error" class="field-error">{{ validation }}</p> }
            @if (mode() !== 'forgot') {
              <label class="field"
                >Contraseña
                <input
                  id="auth-password"
                  formControlName="password"
                  type="password"
                  [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
                  [attr.minlength]="mode() === 'register' ? 12 : null"
                  [attr.aria-describedby]="fieldError('password') ? 'auth-password-error' : (mode() === 'register' ? 'minimum-password' : null)"
                  required
                  maxlength="1024"
                  [attr.aria-invalid]="fieldError('password') ? 'true' : null"
                />
              </label>
              @if (fieldError('password'); as validation) { <p id="auth-password-error" class="field-error">{{ validation }}</p> }
            }
            @if (mode() === 'register') {
              <p id="minimum-password" class="muted small">Usá al menos 12 caracteres.</p>
              <label class="field"
                >Confirmá la contraseña
                <input
                  id="auth-password-confirmation"
                  formControlName="password_confirmation"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="12"
                  maxlength="1024"
                  [attr.aria-invalid]="fieldError('password_confirmation') ? 'true' : null"
                  [attr.aria-describedby]="fieldError('password_confirmation') ? 'auth-password-confirmation-error' : null"
                />
              </label>
              @if (fieldError('password_confirmation'); as validation) { <p id="auth-password-confirmation-error" class="field-error">{{ validation }}</p> }
            }
            <div class="actions">
              <button class="button" type="submit">
                {{ busy() ? 'Un momento…' : labels[mode()] }}
              </button>
              @if (mode() === 'login') {
                <button class="button button--quiet" type="button" (click)="switchTo('forgot')">
                  Olvidé mi contraseña
                </button>
              } @else if (recoveryPage) {
                <a class="button button--quiet" routerLink="/cuenta">Volver al ingreso</a>
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
  protected readonly recoveryPage = inject(ActivatedRoute).snapshot.data['requestPasswordReset'] === true;
  protected readonly mode = signal<AuthMode>(this.recoveryPage ? 'forgot' : 'login');
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly titles = {
    login: 'Ingresá a tu cuenta',
    register: 'Creá tu cuenta',
    forgot: 'Recuperá tu contraseña',
  };
  protected readonly introductions = {
    login: 'Ingresá para gestionar tus datos, direcciones y compras. Si tu sesión venció, podés volver a iniciar sesión.',
    register: 'Podés comprar con una cuenta o seguir como invitado.',
    forgot: 'Indicá el correo que usaste para registrarte.',
  };
  protected readonly labels = {
    login: 'Ingresar',
    register: 'Registrarme',
    forgot: 'Solicitar enlace',
  };
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.maxLength(1024)]],
    password_confirmation: ['', [Validators.maxLength(1024)]],
  });

  protected fieldError(field: 'name' | 'email' | 'password' | 'password_confirmation') {
    if (!this.submitted()) return '';
    if (field === 'name' && this.mode() === 'register' && !this.form.controls.name.value.trim()) return 'Ingresá tu nombre.';
    if (field === 'email' && !this.form.controls.email.value.trim()) return 'Ingresá tu correo electrónico.';
    if (field === 'password' && this.mode() !== 'forgot' && !this.form.controls.password.value) return 'Ingresá tu contraseña.';
    if (field === 'password' && this.mode() === 'register' && this.form.controls.password.value.length < 12) return 'Usá al menos 12 caracteres.';
    if (field === 'password_confirmation' && this.mode() === 'register') {
      if (!this.form.controls.password_confirmation.value) return 'Confirmá tu contraseña.';
      if (this.form.controls.password.value !== this.form.controls.password_confirmation.value)
        return 'Las contraseñas no coinciden.';
    }
    const control = this.form.controls[field];
    if (control.hasError('required')) return 'Completá este campo.';
    if (control.hasError('email')) return 'Ingresá un correo electrónico válido.';
    if (control.hasError('maxlength')) return 'El texto supera el largo permitido.';
    return '';
  }

  protected switchTo(mode: AuthMode) {
    this.mode.set(mode);
    this.submitted.set(false);
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
    this.submitted.set(true);
    const invalid = this.form.controls.email.invalid ||
      (mode === 'register' && (!name.trim() || this.form.controls.name.invalid || password.length < 12 || password_confirmation.length < 12 || this.form.controls.password_confirmation.invalid || password !== password_confirmation)) ||
      (mode === 'login' && (!password || this.form.controls.password.invalid));
    if (invalid) {
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
  styleUrls: ['./shopper.css', './members-design.css'],
  template: `
    <section class="shop-workspace narrow members">
      <header class="page-header"><h1>Restablecé tu contraseña</h1></header>
      <div class="shop-panel">
        @if (saved()) {
          <p class="notice" role="status">Contraseña actualizada. Ya podés ingresar.</p>
          <div class="actions"><a class="button" routerLink="/cuenta">Ir al ingreso</a></div>
        } @else if (!token()) {
          <p class="notice problem" role="alert">
            Este enlace no es válido, ya venció o ya se usó.
          </p>
          <div class="actions"><a class="button" routerLink="/cuenta/recuperar">Solicitar un nuevo enlace</a></div>
        } @else {
          @if (error()) {
            <p class="notice problem" role="alert">{{ error() }}</p>
          }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <fieldset class="stack" [disabled]="busy()">
              <label class="field"
                >Nueva contraseña
                <input
                  id="reset-password"
                  type="password"
                  autocomplete="new-password"
                  formControlName="password"
                  minlength="12"
                  maxlength="1024"
                  [attr.aria-describedby]="fieldError('password') ? 'reset-password-error' : 'reset-password-length'"
                  required
                  [attr.aria-invalid]="fieldError('password') ? 'true' : null"
                />
              </label>
              @if (fieldError('password'); as validation) { <p id="reset-password-error" class="field-error">{{ validation }}</p> }
              <p id="reset-password-length" class="muted small">Usá al menos 12 caracteres.</p>
              <label class="field"
                >Confirmá la contraseña
                <input
                  id="reset-password-confirmation"
                  type="password"
                  autocomplete="new-password"
                  formControlName="password_confirmation"
                  minlength="12"
                  maxlength="1024"
                  required
                  [attr.aria-invalid]="fieldError('password_confirmation') ? 'true' : null"
                  [attr.aria-describedby]="fieldError('password_confirmation') ? 'reset-confirmation-error' : null"
                />
              </label>
              @if (fieldError('password_confirmation'); as validation) { <p id="reset-confirmation-error" class="field-error">{{ validation }}</p> }
              <div class="actions">
                <button class="button" type="submit">
                  {{ busy() ? 'Guardando…' : 'Guardar contraseña' }}
                </button>
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
  protected readonly submitted = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(1024)]],
    password_confirmation: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(1024)]],
  });
  protected readonly token = signal(this.readToken());

  protected fieldError(field: 'password' | 'password_confirmation') {
    if (!this.submitted()) return '';
    const control = this.form.controls[field];
    if (field === 'password_confirmation' && control.value !== this.form.controls.password.value)
      return control.hasError('required') ? 'Confirmá tu contraseña.' : 'Las contraseñas no coinciden.';
    if (control.hasError('required')) return 'Ingresá tu contraseña.';
    if (control.hasError('minlength')) return 'Usá al menos 12 caracteres.';
    if (control.hasError('maxlength')) return 'El texto supera el largo permitido.';
    return '';
  }

  private readToken() {
    if (!isPlatformBrowser(this.platform) || !this.browser) return null;
    const { hash, pathname, search } = this.browser.location;
    const token = new URLSearchParams(hash.slice(1)).get('reset');
    if (hash) this.browser.history.replaceState(this.browser.history.state, '', pathname + search);
    return token && token.length <= 1024 ? token : null;
  }

  protected async submit() {
    const token = this.token();
    if (this.busy() || !token) return;
    this.error.set('');
    const form = this.form.getRawValue();
    this.submitted.set(true);
    if (this.form.invalid || form.password !== form.password_confirmation) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.client.post<void>(api + '/auth/reset-password', { ...form, token }),
      );
      this.form.reset();
      this.token.set(null);
      this.saved.set(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422 && error.error?.errors?.token) {
        this.form.reset();
        this.token.set(null);
      } else {
        this.error.set(apiMessage(error, 'No pudimos cambiar la contraseña. Volvé a intentar.'));
      }
    } finally {
      this.busy.set(false);
    }
  }
}
