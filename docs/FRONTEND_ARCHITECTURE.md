# Camba frontend feature architecture

The applications own their routes, pages and workflows. Use `ui` for rendering and interactions, `data-access` for HTTP and its contracts, and `application` for operations or state that are independent of a page. Add a port only where there is a dependency to isolate. Static pages do not need empty layers.

Root routing composes the features. Share a component or a contract only when another feature actually consumes it, and make that dependency explicit through a shared module or a feature entry point. Don't import another feature's private files, or insert page components into a data layer.

## Store

```text
web/projects/store/src/app/
├── app.*                  composition and SSR routing
├── core/                  platform concerns, including metadata
├── layout/                shared header and footer
├── home-preview.ts        public renderer entry point for Admin
├── shared/                Store-only cross-feature concerns
└── features/
    ├── account
    ├── cart
    ├── catalog
    ├── checkout
    ├── contact
    ├── faq
    ├── home
    ├── orders
    ├── privacy
    ├── product
    ├── shipping
    └── terms
```

| Route | Feature | Component |
| --- | --- | --- |
| `/` | Home | `StoreHome` |
| `/tienda` | Catalog | `StoreCatalog` |
| `/producto/:slug` | Product | `StoreProduct` |
| `/carrito` | Cart | `CartPage` |
| `/checkout` | Checkout | `CheckoutPage` |
| `/cuenta` | Account | `AccountPage` |
| `/cuenta/recuperar`, `/cuenta/restablecer` | Account | `ShopperAuth`, `ResetPage` |
| `/pedidos`, `/pedidos/:reference` | Orders | `OrderHistoryPage`, `OrderPage` |
| `/contacto` | Contact | `Contact` |
| `/envios` | Shipping | `Shipping` |
| `/preguntas-frecuentes` | FAQ | `Faq` |
| `/terminos-y-condiciones` | Terms | `TermsConditions` |
| `/politica-de-privacidad` | Privacy | `PrivacyPolicy` |

The five public help/legal route files lazy-load standalone components under each feature's `ui/pages/<page>/` directory. The Terms page uses the descriptive filename `terms-conditions` and the Privacy page uses `privacy-policy`, following the active Komorebi checkout (`fa774fa`) while retaining Camba's route names.

`/catalogo` remains a redirect to `/tienda`. Store SSR retains the explicit client rendering rules for session-specific routes and the catch-all server rule for public routes. Terms and Privacy still set `noindex` in SSR. Contact sends through its own application port and API adapter; it gets published channels through the same public Store information resolver as Shipping and Privacy. The shared help article owns only its presentation, not the pages' contents or metadata.

## Admin

```text
web/projects/admin/src/app/
├── app.*                  composition
├── core/                  application-scope Admin session and guard
├── layout/                protected shell and sign-in UI
├── shared/                presentation and contracts shared by Admin features
└── features/
    ├── dashboard
    ├── homepage
    ├── notices
    ├── orders
    ├── products
    └── settings
```

| Route | Feature | Component |
| --- | --- | --- |
| `/ingresar` | Admin identity | `AdminLogin` |
| `/dashboard` | Dashboard | `DashboardPage` |
| `/productos` | Products | `Products` |
| `/productos/nuevo`, `/productos/:id` | Products | `ProductEditor` |
| `/productos/categorias`, `/productos/marcas` | Products | `Classifications` |
| `/productos/carga-por-fotos` | Products | `PhotoDrafts` |
| `/productos/importar`, `/productos/importar/:id` | Products | `SpreadsheetImport` |
| `/pedidos`, `/pedidos/:reference` | Orders | `OrderListPage`, `OrderDetailPage` |
| `/pedidos/avisos` | Notices | `NoticesPage` |
| `/configuracion`, `/configuracion/historial` | Settings | `SettingsPage`, `SettingsHistoryPage` |
| `/portada`, `/portada/secciones/:block` | Homepage | `HomepageEditor` |
| `/portada/vista-previa`, `/portada/vista-previa/lienzo` | Homepage | `HomepagePreview`, `HomepagePreviewCanvas` |

The Admin root redirects to `/dashboard`; the older `/productos/clasificaciones` redirects to Categories. There was no Admin user-management screen to migrate. The existing session serves both login and the protected shell. The homepage preview reuses the Store renderer through `home-preview.ts` without importing its feature internals. The shared demo data consumes neutral response contracts rather than importing either application's source.

## Checking the boundary

From `web/`:

```sh
node --test e2e/frontend-architecture.test.mjs
npx ng build store --configuration production
npx ng build admin --configuration production
npm run test:e2e
```

For the local Docker flows, run `node --test e2e/storefront-support-pages.mjs e2e/storefront-layout-unified.mjs` and `node e2e/postgres-local-demo.mjs`. [Public page checks](PAGINAS_PUBLICAS.md) describe the optional real Mailpit delivery check.

### Observed local verification

| Check | Result |
| --- | --- |
| Angular production builds | Store (browser + SSR) and Admin passed. The Store demo and Docker editorial builds also passed. Existing CSS size warnings remain. |
| Architecture + homepage Node tests | 12 passed, including resolved lazy import targets, cross-feature entry points, an acyclic import graph, HTTP placement, and the Admin preview integration. |
| Existing Docker Store, port 4200 | Nine support/layout checks passed, including direct SSR, navigation, Back, headings, legal metadata and responsive Contact. With a temporary synthetic recipient, exactly one message reached Mailpit with the expected Reply-To. A separate run without the recipient confirmed HTTP 503; the original setting was restored. |
| Existing Docker Admin and PostgreSQL, ports 4300/4200 | Browsed catalog, gallery, cart, checkout, account, orders and the reorganized Admin panels, including the actual homepage preview. The test preserved the live buyer's cart. Guest and buyer sessions could not enter the protected Admin canvas. |
