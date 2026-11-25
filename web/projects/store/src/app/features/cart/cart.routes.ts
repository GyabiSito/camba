import { Routes } from '@angular/router';

export const cartRoutes: Routes = [
  { path: 'carrito', title: 'Tu carrito · Camba', loadComponent: () => import('./index').then(m => m.loadCartPage()) },
];
