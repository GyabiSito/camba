import { Routes } from '@angular/router';
import { storeCatalogRoutes } from './catalog/routes';
import { shopperRoutes } from './shopper/routes';

export const routes: Routes = [...shopperRoutes, ...storeCatalogRoutes];
