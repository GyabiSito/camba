import { Routes } from '@angular/router';
import { resolveProduct } from './data-access/product.resolver';

export const productRoutes: Routes = [
  { path: 'producto/:slug', loadComponent: () => import('./index').then(m => m.loadProductPage()), resolve: { result: resolveProduct } },
];
