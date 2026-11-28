import { useStoreMeta } from '../../core/seo/store-meta';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, Routes } from '@angular/router';
import { resolveCatalog } from './data-access/catalog.resolver';
import { resolveMissing } from './data-access/missing.resolver';

@Component({
  selector: 'store-page-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="store-missing" aria-labelledby="missing-title">
      <h1 id="missing-title">No encontramos esta página</h1>
      <p>El enlace puede estar incompleto o haber cambiado.</p>
      <a class="button" routerLink="/tienda">Ir a la tienda</a>
    </section>
  `,
  styles: `
    :host { display: block; padding: clamp(1.25rem, 5vw, 4rem) 0; }
    .store-missing { max-inline-size: 42rem; padding-block: clamp(2rem, 6vw, 5rem); border-block-start: 1px solid var(--line); }
    h1 { font-size: clamp(2rem, 4.5vw, 3.75rem); line-height: 1.05; letter-spacing: -0.04em; }
    p { color: var(--muted); margin-block: 1rem 1.5rem; }
  `,
})
class StoreNotFound {
  constructor() {
    useStoreMeta(() => ({
      title: 'Página no encontrada',
      description: 'El enlace de esta página de Camba puede estar incompleto o haber cambiado.',
      noindex: true,
    }));
  }
}

export const storeCatalogRoutes: Routes = [
  { path: 'tienda', loadComponent: () => import('./catalog').then(m => m.StoreCatalog), resolve: { result: resolveCatalog }, runGuardsAndResolvers: 'paramsOrQueryParamsChange' },
  { path: 'catalogo', pathMatch: 'full', redirectTo: 'tienda' },
];

export const storeNotFoundRoute: Routes = [
  { path: '**', component: StoreNotFound, resolve: { result: resolveMissing } },
];
