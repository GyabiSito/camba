import { Routes } from '@angular/router';

export const ordersRoutes: Routes = [
  { path: 'pedidos/:reference', title: 'Tu pedido · Camba', loadComponent: () => import('./index').then(m => m.loadOrderPage()) },
  { path: 'pedidos', title: 'Tus compras · Camba', loadComponent: () => import('./index').then(m => m.loadOrderHistoryPage()) },
];
