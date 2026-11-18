import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, Routes } from '@angular/router';
import {
  resolveCatalog,
  resolveHome,
  resolveMissing,
  resolveProduct,
  useStoreMeta,
} from './catalog-data';

@Component({
  selector: 'store-page-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="surface" aria-labelledby="missing-title">
      <h1 id="missing-title">No encontramos esta página</h1>
      <p>El enlace puede estar incompleto o haber cambiado.</p>
      <a class="button" routerLink="/tienda">Ir a la tienda</a>
    </section>
  `,
  styles: `
    :host {
      display: block;
      padding: clamp(1.25rem, 5vw, 4rem) 0;
    }
    section {
      padding: clamp(1rem, 4vw, 3rem);
    }
    h1 {
      font-size: clamp(2rem, 4.5vw, 3.75rem);
      line-height: 1.05;
      letter-spacing: -0.04em;
    }
    p {
      color: var(--muted);
    }
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
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./browse').then((module) => module.StoreHome),
    resolve: { result: resolveHome },
  },
  {
    path: 'tienda',
    loadComponent: () => import('./browse').then((module) => module.StoreCatalog),
    resolve: { result: resolveCatalog },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
  },
  { path: 'catalogo', pathMatch: 'full', redirectTo: 'tienda' },
  {
    path: 'producto/:slug',
    loadComponent: () => import('./detail').then((module) => module.StoreProduct),
    resolve: { result: resolveProduct },
  },
  { path: '**', component: StoreNotFound, resolve: { result: resolveMissing } },
];
