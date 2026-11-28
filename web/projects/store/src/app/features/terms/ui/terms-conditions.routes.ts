import type { ActivatedRouteSnapshot, Route } from '@angular/router';
import { resolvePublicStoreInfo } from '../../../shared/data-access/public-store-info';
import { resolvePurchaseTerms } from '../data-access/purchase-terms';

export const termsRoute: Route = {
  path: 'terminos-y-condiciones',
  resolve: { info: resolvePublicStoreInfo, terms: (route: ActivatedRouteSnapshot) => resolvePurchaseTerms(route.queryParamMap.get('version')) },
  runGuardsAndResolvers: 'paramsOrQueryParamsChange',
  loadComponent: () => import('./pages/terms-conditions/terms-conditions').then(m => m.TermsConditions),
};

export const withdrawalRoute: Route = {
  path: 'arrepentimiento',
  title: 'Botón de arrepentimiento · Camba',
  resolve: { terms: () => resolvePurchaseTerms() },
  loadComponent: () => import('./withdrawal').then(m => m.WithdrawalPage),
};
