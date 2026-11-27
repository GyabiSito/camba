import { Routes } from '@angular/router';
import { requireBuyer } from '../account/account-return';

export const cartRoutes: Routes = [
  {
    path: 'carrito',
    title: 'Tu carrito · Camba',
    canActivate: [requireBuyer('carrito')],
    loadComponent: () => import('./index').then(m => m.loadCartPage()),
  },
];
