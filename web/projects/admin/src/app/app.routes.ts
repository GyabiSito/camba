import { Routes } from '@angular/router';
import { AdminLogin, AdminShell, requireAdmin } from './shell';
import { adminCatalogRoutes } from './catalog/routes';
import { adminOperationsRoutes } from './operations/routes';

export const routes: Routes = [
  { path: 'ingresar', component: AdminLogin, title: 'Ingresar a administración | Camba' },
  { path: 'portada/vista-previa/lienzo', canActivate: [requireAdmin], loadChildren: () =>
    import('./homepage/preview/routes').then(module => module.adminHomePreviewCanvasRoutes) },
  { path: '', component: AdminShell, canActivate: [requireAdmin], children: [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', title: 'Inicio | Camba Admin', loadComponent: () =>
      import('./dashboard/dashboard').then(module => module.DashboardPage) },
    ...adminCatalogRoutes, ...adminOperationsRoutes,
    { path: 'portada', loadChildren: () => import('./homepage/routes').then(module => module.homepageRoutes) },
    { path: '**', redirectTo: 'productos' },
  ] },
];
