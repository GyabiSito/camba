import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="preview-heading">
      <div><a class="back" routerLink="/portada">Volver a Portada</a><h1>Vista previa</h1></div>
      <div class="viewport-controls" role="group" aria-label="Tamaño de la vista previa">
        <button class="button button--quiet" type="button" [attr.aria-pressed]="viewport() === 'desktop'"
          aria-controls="homepage-canvas" (click)="viewport.set('desktop')">Escritorio</button>
        <button class="button button--quiet" type="button" [attr.aria-pressed]="viewport() === 'mobile'"
          aria-controls="homepage-canvas" (click)="viewport.set('mobile')">Móvil</button>
      </div>
    </header>
    <p class="muted" id="preview-help">Borrador guardado · {{ viewport() === 'desktop' ? '1100 px' : 'hasta 390 px' }}.
      Los enlaces a otras páginas no navegan en esta vista.</p>
    <div class="preview-stage" tabindex="0" aria-label="Lienzo de la portada" aria-describedby="preview-help">
      <iframe id="homepage-canvas" title="Borrador guardado de la portada de Camba"
        src="/portada/vista-previa/lienzo" [class.mobile]="viewport() === 'mobile'"
        sandbox="allow-scripts allow-same-origin" referrerpolicy="same-origin"></iframe>
    </div>
  `,
  styles: `
    :host { display: block; min-inline-size: 0; }
    .preview-heading { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; }
    h1 { margin: .75rem 0 0; font-size: 2rem; }
    .back { display: inline-flex; align-items: center; min-block-size: 2.75rem; font-weight: 650; }
    .viewport-controls { display: flex; gap: .5rem; }
    button[aria-pressed='true'] { background: var(--accent); border-color: var(--forest); color: var(--forest); }
    .muted { margin-block: 1rem; }
    .preview-stage { overflow: auto; border: 1px solid var(--line); background: var(--accent); }
    iframe { display: block; inline-size: 1100px; max-inline-size: none; block-size: 76vh; min-block-size: 30rem; margin-inline: auto; border: 0; background: var(--surface); }
    iframe.mobile { inline-size: min(390px, 100%); }
  `,
})
export class HomepagePreview {
  protected readonly viewport = signal<'desktop' | 'mobile'>(
    globalThis.matchMedia?.('(max-width: 48rem)').matches ? 'mobile' : 'desktop',
  );
}
