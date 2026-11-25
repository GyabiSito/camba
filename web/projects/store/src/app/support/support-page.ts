import { ViewportScroller } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient, formatMoney } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { useStoreMeta } from '../catalog/catalog-data';
import { editorialEnabled } from '../catalog/editorial-config';
import { supportPages, type StoreInfo } from './routes';

@Component({
  selector: 'store-support-page',
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-page.html',
  styleUrl: './support-page.css',
})
export class SupportPage {
  private readonly route = inject(ActivatedRoute).snapshot;
  private readonly api = inject(ApiClient);
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly destroy = inject(DestroyRef);
  protected readonly page = this.route.data['page'] as keyof typeof supportPages;
  protected readonly editorial = editorialEnabled;
  protected readonly copy = supportPages[this.page];
  protected readonly info = this.route.data['info'] as StoreInfo | null;
  protected readonly draft = this.page === 'politica-de-privacidad' || this.page === 'terminos-y-condiciones';
  protected readonly money = formatMoney;
  protected readonly interactive = signal(false);
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', Validators.maxLength(40)],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  constructor() {
    useStoreMeta(() => ({ title: this.copy[0], description: this.copy[1], canonical: '/' + this.page, noindex: this.draft }));
    const navigation = inject(Router).currentNavigation();
    if (navigation?.trigger === 'imperative' && navigation.id > 1 && !this.route.fragment) {
      const viewport = inject(ViewportScroller);
      // Angular skips scroll events before hydration stabilizes; never override Back or a fragment.
      afterNextRender(() => {
        if (viewport.getScrollPosition()[1] > 0) viewport.scrollToPosition([0, 0], { behavior: 'instant' });
      });
    }
    if (this.page === 'contacto') afterNextRender(() => {
      this.interactive.set(true);
      void this.enterContact();
    });
  }

  private async enterContact(): Promise<void> {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;
    const motion = await import('animejs/animation').catch(() => null);
    if (!motion || reduced.matches || this.destroy.destroyed) return;

    const entry = motion.animate(this.host.querySelectorAll('.contact-grid > section'), {
      translateY: [12, 0], duration: 420, delay: (_: unknown, index = 0) => index * 75, ease: 'out(3)',
    });
    const stop = () => entry.revert();
    reduced.addEventListener('change', stop, { once: true });
    this.destroy.onDestroy(() => {
      reduced.removeEventListener('change', stop);
      stop();
    });
  }

  protected phoneLink(phone: string): string {
    return 'tel:' + phone.replace(/[ .()-]/g, '');
  }

  protected emailLink(email: string): string {
    const domain = email.lastIndexOf('@');
    return 'mailto:' + encodeURIComponent(email.slice(0, domain)) + email.slice(domain);
  }

  protected async send(): Promise<void> {
    if (!this.interactive() || this.sending()) return;
    this.sent.set(false);
    this.error.set('');
    if (this.form.invalid) {
      this.error.set('Revisá el nombre, el correo y el mensaje antes de enviar.');
      return;
    }

    this.sending.set(true);
    try {
      await firstValueFrom(this.api.post('/api/v1/contact', this.form.getRawValue()));
      this.form.reset();
      this.sent.set(true);
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.error.set(status === 429 ? 'Hiciste varios intentos. Esperá un minuto y volvé a probar.'
        : status === 422 ? 'Revisá los datos del formulario e intentá de nuevo.'
        : status === 503 ? 'El formulario de contacto no está disponible por el momento. Probá más tarde.'
        : 'No pudimos enviar tu consulta. Probá de nuevo más tarde.');
    } finally {
      this.sending.set(false);
    }
  }
}
