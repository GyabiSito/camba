import type { Route } from '@angular/router';

export const termsRoute: Route = {
  path: 'terminos-y-condiciones',
  loadComponent: () => import('./pages/terms-conditions/terms-conditions').then(m => m.TermsConditions),
};
