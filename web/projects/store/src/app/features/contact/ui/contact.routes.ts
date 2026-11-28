import type { Route } from '@angular/router';
import { resolvePublicStoreInfo } from '../../../shared/data-access/public-store-info';

export const contactRoute: Route = {
  path: 'contacto',
  resolve: { info: resolvePublicStoreInfo },
  loadComponent: () => import('./pages/contact/contact').then(m => m.Contact),
};
