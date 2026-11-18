import { Routes } from '@angular/router';

export const adminCatalogRoutes: Routes = [
  { path: 'productos', pathMatch: 'full', loadComponent: () => import('./products').then((m) => m.Products) },
  { path: 'productos/nuevo', loadComponent: () => import('./product-editor').then((m) => m.ProductEditor) },
  { path: 'productos/clasificaciones', loadComponent: () => import('./classifications').then((m) => m.Classifications) },
  { path: 'productos/carga-por-fotos', loadComponent: () => import('./photo-drafts').then((m) => m.PhotoDrafts) },
  { path: 'productos/importar', pathMatch: 'full', loadComponent: () => import('./spreadsheet-import').then((m) => m.SpreadsheetImport) },
  { path: 'productos/importar/:id', loadComponent: () => import('./spreadsheet-import').then((m) => m.SpreadsheetImport) },
  { path: 'productos/:id', loadComponent: () => import('./product-editor').then((m) => m.ProductEditor) },
];
