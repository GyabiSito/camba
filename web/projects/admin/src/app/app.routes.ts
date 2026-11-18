import { Routes } from '@angular/router';
import { AdminLogin, AdminShell, requireAdmin } from './shell';
import { adminCatalogRoutes } from './catalog/routes';
import { adminOperationsRoutes } from './operations/routes';

export const routes: Routes = [
  { path: 'ingresar', component: AdminLogin, title: 'Ingresar a administración | Camba' },
  { path: '', component: AdminShell, canActivate: [requireAdmin], children: [
    { path: '', redirectTo: 'productos', pathMatch: 'full' },
    ...adminCatalogRoutes, ...adminOperationsRoutes,
    { path: '**', redirectTo: 'productos' },
  ] },
];
