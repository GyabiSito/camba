import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StoreHome, HOME_RENDER_OPTIONS } from '../../../../../../store/src/app/home-preview';
import type { PreviewResult } from './preview-result';

@Component({
  imports: [StoreHome],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-store' },
  providers: [{ provide: HOME_RENDER_OPTIONS, useFactory: () =>
    (inject(ActivatedRoute).snapshot.data['result'] as PreviewResult).options ?? { editorial: false, preview: true } }],
  styleUrls: ['../../../../../../store/src/app/app.css'],
  styles: `
    :host { font-family: var(--font); }
    :host :focus-visible { outline-color: var(--home-action); }
    .preview-error { max-inline-size: 42rem; padding: 2rem; }
    .preview-notice { position: fixed; inset: auto 1rem 1rem; margin: 0; padding: .65rem 1rem; background: var(--surface); color: var(--ink); border: 1px solid var(--line); z-index: 20; }
  `,
  template: `
    @if (ready) { <main class="store-body"><store-home /></main> }
    @else {
      <main class="preview-error"><h1>No pudimos abrir la vista previa</h1>
        <p>Verificá tu sesión administradora y volvé a abrir la vista previa desde Portada.</p>
        <button class="button" type="button" (click)="reload()">Volver a intentar</button></main>
    }
    @if (notice()) { <p class="preview-notice" role="status">Los enlaces a otras páginas están desactivados en la vista previa.</p> }
  `,
})
export class HomepagePreviewCanvas {
  protected readonly ready = inject(ActivatedRoute).snapshot.data['result'].kind === 'ready';
  protected readonly notice = signal(false);
  protected reload() { window.location.reload(); }

  constructor() {
    const root = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      // Capture before RouterLink so the isolated canvas never routes inside Admin.
      const contain = (event: Event) => {
        const anchor = (event.target as Element | null)?.closest('a');
        if (!anchor) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const href = anchor.getAttribute('href') ?? '';
        if (href.startsWith('#') && event.type === 'click') {
          root.ownerDocument.getElementById(href.slice(1))?.scrollIntoView();
        } else if (!href.startsWith('#')) this.notice.set(true);
      };
      for (const type of ['click', 'auxclick', 'contextmenu']) root.addEventListener(type, contain, true);
      destroy.onDestroy(() => {
        for (const type of ['click', 'auxclick', 'contextmenu']) root.removeEventListener(type, contain, true);
      });
    });
  }
}
