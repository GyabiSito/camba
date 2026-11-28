import { Routes } from '@angular/router';
import { requireBuyer } from '../account/account-return';

export const checkoutRoutes: Routes = [
  {
    path: 'checkout',
    title: 'Confirmar compra · Camba',
    canActivate: [requireBuyer('checkout')],
    loadComponent: () => import('./checkout').then(m => m.CheckoutPage),
  },
];
