import type { Route } from '@angular/router';
import { resolvePublicStoreInfo } from '../../../shared/data-access/public-store-info';

export const shippingRoute: Route = {
  path: 'envios',
  resolve: { info: resolvePublicStoreInfo },
  loadComponent: () => import('./pages/shipping/shipping').then(m => m.Shipping),
};
