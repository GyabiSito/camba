import type { Route } from '@angular/router';

export const faqRoute: Route = {
  path: 'preguntas-frecuentes',
  loadComponent: () => import('./pages/faq/faq').then(m => m.Faq),
};
