import { Routes } from '@angular/router';

export const adminOperationsRoutes: Routes = [
  {
    path: 'pedidos',
    pathMatch: 'full',
    title: 'Pedidos · Camba',
    loadComponent: () => import('./order-list').then((m) => m.OrderListPage),
  },
  {
    path: 'pedidos/avisos',
    title: 'Avisos · Camba',
    loadComponent: () => import('./notices').then((m) => m.NoticesPage),
  },
  {
    path: 'pedidos/:reference',
    title: 'Detalle del pedido · Camba',
    loadComponent: () => import('./order-detail').then((m) => m.OrderDetailPage),
  },
  {
    path: 'configuracion',
    pathMatch: 'full',
    title: 'Configuración · Camba',
    loadComponent: () => import('./settings').then((m) => m.SettingsPage),
  },
  {
    path: 'configuracion/historial',
    title: 'Historial de configuración · Camba',
    loadComponent: () => import('./settings-history').then((m) => m.SettingsHistoryPage),
  },
];
