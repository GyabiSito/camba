import { Routes } from '@angular/router';

export const orderRoutes: Routes = [
  {
    path: 'pedidos',
    pathMatch: 'full',
    title: 'Pedidos · Camba',
    loadComponent: () => import('./order-list').then((m) => m.OrderListPage),
  },
  {
    path: 'pedidos/:reference',
    title: 'Detalle del pedido · Camba',
    loadComponent: () => import('./order-detail').then((m) => m.OrderDetailPage),
  },
];
