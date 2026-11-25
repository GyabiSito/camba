import { Routes } from '@angular/router';

export const noticeRoutes: Routes = [
  { path: 'pedidos/avisos', title: 'Avisos · Camba',
    loadComponent: () => import('./notices').then((m) => m.NoticesPage) },
];
