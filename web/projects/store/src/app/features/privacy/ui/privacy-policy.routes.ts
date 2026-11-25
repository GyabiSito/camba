import type { Route } from '@angular/router';
import { resolvePublicStoreInfo } from '../../../shared/data-access/public-store-info';

export const privacyRoute: Route = {
  path: 'politica-de-privacidad',
  resolve: { info: resolvePublicStoreInfo },
  loadComponent: () => import('./pages/privacy-policy/privacy-policy').then(m => m.PrivacyPolicy),
};
