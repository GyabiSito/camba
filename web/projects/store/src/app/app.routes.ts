import { Routes } from '@angular/router';
import { storeCatalogRoutes } from './catalog/routes';
import { shopperRoutes } from './shopper/routes';
import { supportRoutes } from './support/routes';

export const routes: Routes = [...shopperRoutes, ...supportRoutes, ...storeCatalogRoutes];
