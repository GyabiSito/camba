import { Routes } from '@angular/router';

export const settingsRoutes: Routes = [
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
