import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../../../environments/environment';
import { useStoreMeta } from '../../../../../core/seo/store-meta';
import { scrollHelpOnNavigation } from '../../../../../shared/ui/help-article/scroll-help-on-navigation';
import { CONTACT_SENDER } from '../../../application/contact-sender';
import { contactSenderProvider } from '../../../data-access/contact-api';

@Component({
  selector: 'store-contact',
  imports: [RouterLink, ReactiveFormsModule],
  providers: [contactSenderProvider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  private readonly sender = inject(CONTACT_SENDER);
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly destroy = inject(DestroyRef);
  protected readonly title = 'Contactanos';
  protected readonly description = 'Escribinos si tenés una consulta sobre un producto, un pedido o tu cuenta.';
  protected readonly business = environment.business;
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
    useStoreMeta(() => ({ title: this.title, description: this.description, canonical: '/contacto' }));
    scrollHelpOnNavigation();
    afterNextRender(() => {
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
      const result = await this.sender.send(this.form.getRawValue());
      if (result === 'sent') {
        this.form.reset();
        this.sent.set(true);
      } else {
        this.error.set(contactErrors[result]);
      }
    } finally {
      this.sending.set(false);
    }
  }
}

const contactErrors = {
  throttled: 'Hiciste varios intentos. Esperá un minuto y volvé a probar.',
  invalid: 'Revisá los datos del formulario e intentá de nuevo.',
  unavailable: 'El formulario de contacto no está disponible por el momento. Probá más tarde.',
  failed: 'No pudimos enviar tu consulta. Probá de nuevo más tarde.',
};
