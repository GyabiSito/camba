import { Routes } from '@angular/router';
import { storeCatalogRoutes, storeNotFoundRoute } from './features/catalog/catalog.routes';
import { accountRoutes } from './features/account/routes';
import { homeRoutes } from './features/home/home.routes';
import { cartRoutes } from './features/cart/cart.routes';
import { checkoutRoutes } from './features/checkout/checkout.routes';
import { productRoutes } from './features/product/product.routes';
import { ordersRoutes } from './features/orders/orders.routes';
import { contactRoute } from './features/contact/ui/contact.routes';
import { shippingRoute } from './features/shipping/ui/shipping.routes';
import { faqRoute } from './features/faq/ui/faq.routes';
import { termsRoute, withdrawalRoute } from './features/terms/ui/terms-conditions.routes';
import { privacyRoute } from './features/privacy/ui/privacy-policy.routes';

export const routes: Routes = [
  ...accountRoutes,
  ...cartRoutes,
  ...checkoutRoutes,
  ...ordersRoutes,
  contactRoute,
  shippingRoute,
  faqRoute,
  termsRoute,
  withdrawalRoute,
  privacyRoute,
  ...homeRoutes,
  ...storeCatalogRoutes,
  ...productRoutes,
  ...storeNotFoundRoute,
];
