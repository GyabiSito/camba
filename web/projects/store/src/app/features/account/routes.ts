import { Routes } from '@angular/router';

export const accountRoutes: Routes = [
  {
    path: 'cuenta/restablecer',
    title: 'Restablecer contraseña · Camba',
    loadComponent: () => import('./auth').then((m) => m.ResetPage),
  },
  {
    path: 'cuenta/recuperar',
    title: 'Recuperar contraseña · Camba',
    data: { requestPasswordReset: true },
    loadComponent: () => import('./auth').then((m) => m.ShopperAuth),
  },
  {
    path: 'cuenta',
    title: 'Tu cuenta · Camba',
    loadComponent: () => import('./account').then((m) => m.AccountPage),
  },
];
