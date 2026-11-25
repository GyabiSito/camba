import { Routes } from '@angular/router';
import { storeCatalogRoutes } from './catalog/routes';
import { shopperRoutes } from './shopper/routes';
import { contactRoute } from './features/contact/ui/contact.routes';
import { shippingRoute } from './features/shipping/ui/shipping.routes';
import { faqRoute } from './features/faq/ui/faq.routes';
import { termsRoute } from './features/terms/ui/terms-conditions.routes';
import { privacyRoute } from './features/privacy/ui/privacy-policy.routes';

export const routes: Routes = [...shopperRoutes, contactRoute, shippingRoute, faqRoute, termsRoute, privacyRoute, ...storeCatalogRoutes];
