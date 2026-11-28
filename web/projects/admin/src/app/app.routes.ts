import { Routes } from '@angular/router';
import { AdminLogin, AdminShell } from './layout/shell';
import { requireAdmin } from './core/admin-session';
import { adminCatalogRoutes } from './features/products/routes';
import { noticeRoutes } from './features/notices/notices.routes';
import { orderRoutes } from './features/orders/orders.routes';
import { settingsRoutes } from './features/settings/settings.routes';

export const routes: Routes = [
  { path: 'ingresar', component: AdminLogin, title: 'Ingresar a administración | Camba' },
  { path: 'portada/vista-previa/lienzo', canActivate: [requireAdmin], loadChildren: () =>
      import('./features/homepage/preview/routes').then(module => module.adminHomePreviewCanvasRoutes) },
  { path: '', component: AdminShell, canActivate: [requireAdmin], children: [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', title: 'Inicio | Camba Admin', loadComponent: () =>
      import('./features/dashboard/dashboard').then(module => module.DashboardPage) },
    { path: 'usuarios', pathMatch: 'full', title: 'Usuarios | Camba Admin', loadComponent: () =>
      import('./features/customers/customers').then(module => module.CustomerListPage) },
    { path: 'usuarios/:customer', title: 'Ficha de usuario | Camba Admin', loadComponent: () =>
      import('./features/customers/customers').then(module => module.CustomerDetailPage) },
    ...adminCatalogRoutes, ...noticeRoutes, ...orderRoutes, ...settingsRoutes,
    { path: 'portada', loadChildren: () => import('./features/homepage/routes').then(module => module.homepageRoutes) },
    { path: '**', redirectTo: 'productos' },
  ] },
];
