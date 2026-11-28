import { Routes } from '@angular/router';
import { resolveHome } from './data-access/home.resolver';

export const homeRoutes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./index').then(m => m.StoreHome), resolve: { result: resolveHome } },
];
