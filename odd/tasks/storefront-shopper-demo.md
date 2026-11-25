# Storefront shopper demo
Branch: `feat/camba-v2` · baseline `8fe4527` plus inherited dirty storefront/demo files · local only, no publication.
Runner: Angular demo/normal SSR and Playwright · delivery: ask-on-risk if publication is requested · forecast ~500 authored lines.

## Specs

### S1 — Existing fixtures and member account
> Dejá la demo local de Camba v2 completamente cargada con datos de prueba, lista para que pueda entrar como cliente y revisar el rediseño de Mi cuenta, carrito, checkout y pedidos. Primero revisá los datos y usuarios de demo que ya existen. Reutilizalos y completá lo que falte.
> - Mi cuenta. Dejá un cliente de prueba con perfil completo, dos direcciones y acceso a su historial de pedidos.

### S2 — Cart
> - Carrito. Precargá un par de productos. Quiero poder agregar y quitar artículos, cambiar cantidades y ver que se recalculen los totales. El carrito debe conservarse al recargar.

### S3 — Historical orders
> - Pedidos anteriores. Cargá pedidos en distintos estados que la app ya soporte. Cada uno tiene que abrir su detalle con productos, cantidades, totales, datos de entrega y estado.

### S4 — Checkout and demo payment
> - Compra nueva. Probá el flujo completo desde el carrito. Elegí una dirección y un método de entrega, completá el pago simulado y verificá que el pedido aparezca en Mi cuenta → Mis pedidos, incluso después de recargar. Usá datos sintéticos y mantené el flujo dentro del modo demo.

### S5 — Documentation and live handoff
> - README.md. Agregá una sección Demo local con la URL exacta, el correo y la contraseña de prueba que verificaste, el comando para levantar la demo y cómo volver a los datos iniciales después de probar una compra.
> Dejá la demo corriendo y pasame en la entrega la URL, el usuario, la contraseña y el número del pedido que generaste al verificar el flujo. Adjuntá capturas de Mi cuenta, el carrito, la confirmación de compra y el detalle del pedido para que pueda revisar todas esas pantallas.

## Tasks

- [x] T1 · S1–S4 · inline · demo-only shopper storage, synthetic fixture reuse and payment UI; RED account addresses before implementation, GREEN end to end; normal SSR and demo-path isolation tested.
- [x] T2 · S4–S5 · inline · demo on loopback 44858; matched browser cross-session/reload and restart probes, captures and README delivered.

## Log

### L1 — User request
Dejá la demo local de Camba v2 completamente cargada con datos de prueba, lista para que pueda entrar como cliente y revisar el rediseño de Mi cuenta, carrito, checkout y pedidos. Primero revisá los datos y usuarios de demo que ya existen. Reutilizalos y completá lo que falte.
- Mi cuenta. Dejá un cliente de prueba con perfil completo, dos direcciones y acceso a su historial de pedidos.
- Carrito. Precargá un par de productos. Quiero poder agregar y quitar artículos, cambiar cantidades y ver que se recalculen los totales. El carrito debe conservarse al recargar.
- Pedidos anteriores. Cargá pedidos en distintos estados que la app ya soporte. Cada uno tiene que abrir su detalle con productos, cantidades, totales, datos de entrega y estado.
- Compra nueva. Probá el flujo completo desde el carrito. Elegí una dirección y un método de entrega, completá el pago simulado y verificá que el pedido aparezca en Mi cuenta → Mis pedidos, incluso después de recargar. Usá datos sintéticos y mantené el flujo dentro del modo demo.
- README.md. Agregá una sección Demo local con la URL exacta, el correo y la contraseña de prueba que verificaste, el comando para levantar la demo y cómo volver a los datos iniciales después de probar una compra.
Dejá la demo corriendo y pasame en la entrega la URL, el usuario, la contraseña y el número del pedido que generaste al verificar el flujo. Adjuntá capturas de Mi cuenta, el carrito, la confirmación de compra y el detalle del pedido para que pueda revisar todas esas pantallas.

### L2 — Baseline and approach
- Existing Angular demo provides the original mock buyer/admin credentials and published demo catalog; cart, addresses, quotes and orders return fixture-path 404 on the untouched demo. Normal API and admin are outside scope.
- Save synthetic shopper state in the local storefront demo process, not a Playwright-only browser context. A second browser should see the same paid order; restart restores all initial fixtures. Use the demo build replacement to keep the shopper gateway out of normal builds.
- Inline because the gateway, demo interceptor, payment action and browser proof share the same state and protocol; there are no independent writers.

### L3 — Delivery evidence
- The final optimized `production,demo` build runs at `http://127.0.0.1:44858/`. A clean process restart restored two cart lines and three seeded orders. The final browser test created and paid `44431a9b-8b11-4629-9505-8e091d53846e` with a saved delivery address and verified it from another browser after reloading. It put the two original items back in the cart. Captures: `web/test-results/shopper-demo/`.
- The Playwright run forbids outside-origin requests. Normal SSR passes and returns 404 for the fixture gateway even with demo headers; the compiled normal build has no seeded shopper fixtures. Anonymous access to private demo addresses was denied. `api/` and contracts unchanged. Only existing home CSS size warnings remain.
- README documents the review URL, public synthetic credentials, launch, and reset. In-memory state is shared by local demo visitors, not transferred to production.
- Worktree delivery preserves inherited, uncommitted Angular demo configuration and fixture files; no publish or commit that mixes prior work. Native assess was unassessable owing to the mixed untracked inventory; no native approval claimed. Risk: none (demo-only routing and synthetic data; no production auth, payments, deployments, dependencies, or migrations changed).
