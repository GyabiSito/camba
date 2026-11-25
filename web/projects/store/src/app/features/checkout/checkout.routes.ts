import { Routes } from '@angular/router';

export const checkoutRoutes: Routes = [
  { path: 'checkout', title: 'Confirmar compra · Camba', loadComponent: () => import('./checkout').then(m => m.CheckoutPage) },
];
