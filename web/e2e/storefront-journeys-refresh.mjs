import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';

const phase = process.env.CAMBA_CAPTURE_PHASE ?? 'after';
const out = process.env.CAMBA_CAPTURE_OUTPUT ?? 'test-results/storefront-refresh/' + phase;
const demo = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44822';
const real = 'http://127.0.0.1:44851';
const entry = process.env.CAMBA_REAL_SSR ?? 'dist/storefront-refresh-real/server/server.mjs';
const reference = 'ebe75975-7d5e-4dc7-bf8c-4ff4e55c3730';
const category = { id: 1, name: 'Remeras', slug: 'remeras' };
const brand = { id: 1, name: 'Camba', slug: 'camba' };
const product = {
  id: 1,
  sku: 'FIXTURE-01',
  name: 'Remera de prueba',
  slug: 'remera-prueba',
  description: 'Algodón de tacto suave y corte recto.',
  price_cents: 139000,
  stock: 8,
  in_stock: true,
  category,
  brand,
  images: [
    {
      id: 1,
      url: '/fixture-media/front.webp',
      thumbnail_url: '/fixture-media/front.webp',
      alt: 'Remera de prueba',
    },
  ],
};
const address = {
  id: 1,
  recipient: 'Persona de prueba',
  department: 'Montevideo',
  locality: 'Montevideo',
  street: 'Calle de prueba',
  number: '100',
  postal_code: null,
  details: null,
  phone: null,
};
const buyer = {
  id: 1,
  name: 'Persona de prueba',
  email: 'persona@camba.test',
  role: 'buyer',
  email_verified: true,
};
const line = {
  product_id: product.id,
  sku: product.sku,
  name: product.name,
  quantity: 1,
  unit_price_cents: product.price_cents,
  line_total_cents: product.price_cents,
};
const collection = (data) => ({
  data,
  meta: { current_page: 1, last_page: 1, total: data.length },
});
const info = { business_name: 'Camba', support_email: null, support_phone: null };

// Match the existing storefront contracts. These stand-ins are browser-test-only.
function fixture(path, query) {
  if (path === '/api/v1/products') {
    const q = (query.get('q') ?? '').toLowerCase();
    return collection(product.name.toLowerCase().includes(q) ? [product] : []);
  }
  if (path === '/api/v1/products/' + product.slug) return { data: product };
  if (path === '/api/v1/categories') return { data: [category] };
  if (path === '/api/v1/brands') return { data: [brand] };
  if (path === '/api/v1/store-info') return { data: info };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const reply = fixture(url.pathname, url.searchParams);
  res
    .writeHead(reply ? 200 : 404, { 'content-type': 'application/json' })
    .end(JSON.stringify(reply ?? {}));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const storefront = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    PORT: '44851',
    NG_ALLOWED_HOSTS: '127.0.0.1,localhost',
    CAMBA_SSR_API_ORIGIN: 'http://127.0.0.1:' + server.address().port,
  },
  stdio: 'inherit',
  windowsHide: true,
});

async function simulatedPage(browser, width, initial = {}) {
  const page = await browser.newPage({
    viewport: { width, height: width === 1440 ? 900 : 844 },
    reducedMotion: 'reduce',
  });
  const state = {
    cart: 0,
    signed: false,
    paid: false,
    orders: true,
    verified: true,
    addresses: [],
    ...initial,
  };
  const currentLine = () => ({
    ...line,
    quantity: state.cart || 1,
    line_total_cents: line.unit_price_cents * (state.cart || 1),
  });
  const order = () => ({
    reference,
    status: state.paid ? 'paid' : 'pending_payment',
    fulfilment_status: 'preparing',
    subtotal_cents: currentLine().line_total_cents,
    shipping_cents: 0,
    total_cents: currentLine().line_total_cents,
    shipping_method: 'pickup',
    reservation_expires_at: '2099-12-05T15:00:00Z',
    created_at: '2026-11-22T18:00:00Z',
    pickup_address: 'Mostrador de prueba',
    items: [currentLine()],
  });
  const cart = () => ({
    data: {
      currency: 'UYU',
      items:
        state.cart > 0
          ? [
              {
                product_id: 1,
                quantity: state.cart,
                available: true,
                product,
              },
            ]
          : [],
    },
  });
  const respond = (route, data, status = 200) => route.fulfill({ status, json: data });
  // Prevent any requests to a real service in the operational fixture.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.origin === real ? route.continue() : route.abort();
  });
  await page.route('**/fixture-media/front.webp', (route) =>
    route.fulfill({
      path: 'projects/admin/public/demo/image-plain.webp',
      contentType: 'image/webp',
    }),
  );
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/me')
      return state.signed
        ? respond(route, { data: { ...buyer, email_verified: state.verified } })
        : respond(route, { message: 'Iniciá sesión.' }, 401);
    if (path === '/auth/login') {
      state.signed = true;
      return route.fulfill({ status: 204 });
    }
    if (path === '/auth/logout') {
      state.signed = false;
      return route.fulfill({ status: 204 });
    }
    if (path === '/account/addresses') return respond(route, { data: state.addresses });
    if (path === '/account/preferences')
      return respond(route, { data: { payment_reminders: false, cart_reminders: false } });
    if (path === '/cart') return respond(route, cart());
    if (path === '/cart/items/1') {
      const quantity = req.postDataJSON()?.quantity ?? 1;
      state.cart =
        req.method() === 'DELETE' ? 0 : req.method() === 'POST' ? state.cart + quantity : quantity;
      return respond(route, cart());
    }
    if (path === '/checkout/quote') {
      const subtotal = currentLine().line_total_cents;
      return respond(route, {
        data: {
          items: [currentLine()],
          subtotal_cents: subtotal,
          shipping_options: [
            {
              method: 'delivery',
              total_cents: subtotal + 16900,
              shipping_cents: 16900,
              pickup_address: null,
              quote_token: 'delivery-fixture',
            },
            {
              method: 'pickup',
              total_cents: subtotal,
              shipping_cents: 0,
              pickup_address: 'Mostrador de prueba',
              quote_token: 'pickup-fixture',
            },
          ],
        },
      });
    }
    if (path === '/orders')
      return req.method() === 'POST'
        ? respond(route, { data: order() }, 201)
        : respond(route, collection(state.orders ? [order()] : []));
    if (path === '/orders/' + reference) return respond(route, { data: order() });
    if (path === '/orders/' + reference + '/payments/refresh')
      return respond(route, { data: order() });
    if (path === '/orders/' + reference + '/payments')
      return respond(route, { message: 'Pago no disponible en la prueba.' }, 503);
    const reply = fixture(url.pathname, url.searchParams);
    return respond(route, reply ?? {}, reply ? 200 : 404);
  });
  return page;
}

async function shot(page, width, name) {
  await page.locator('main').waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled([...document.images].map((image) => image.decode()));
  });
  assert(
    (await page.evaluate(() => document.documentElement.scrollWidth)) <= width,
    name + ' overflows at ' + width,
  );
  if (width !== 320)
    await page.screenshot({
      path: out + '/' + name + '-' + width + '.png',
      fullPage: true,
      animations: 'disabled',
    });
}

const browser = await chromium.launch();
try {
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(real + '/healthz').then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    if (attempt >= 60 || storefront.exitCode !== null)
      throw Error('The isolated SSR build did not start');
    await delay(100);
  }
  await mkdir(out, { recursive: true });
  for (const width of phase === 'before' ? [1440, 390] : [1440, 390, 320]) {
    const preview = await browser.newPage({
      viewport: { width, height: width === 1440 ? 900 : 844 },
      reducedMotion: 'reduce',
    });
    for (const [key, path] of [
      ['home', '/'],
      ['tienda', '/tienda'],
      ['categoria', '/tienda?category=remeras'],
      ['sin-resultados', '/tienda?q=no-encontrable'],
      ['ficha', '/producto/remera-recta-carbon'],
      ['ficha-una-foto', '/producto/camisa-liviana-blanca'],
      ['agotado', '/producto/remera-amplia-crudo'],
      ['producto-no-encontrado', '/producto/prenda-no-encontrada'],
      ['error', '/pagina-no-encontrada'],
    ]) {
      await preview.goto(demo + path);
      await preview.getByRole('main').getByRole('heading', { level: 1 }).waitFor();
      await shot(preview, width, key);
    }
    await preview.close();
    const capture = async (key, path, state, waitFor, action) => {
      const page = await simulatedPage(browser, width, state);
      await page.goto(real + path);
      await waitFor(page);
      if (action) await action(page);
      await shot(page, width, key);
      await page.close();
    };
    const heading = (name) => (page) => page.getByRole('heading', { name }).first().waitFor();
    const visible = (text) => (page) => page.getByText(text).first().waitFor();
    await capture('carrito', '/carrito', { cart: 2 }, visible('Remera de prueba'));
    await capture('carrito-vacio', '/carrito', {}, heading(/carrito está vacío/i));
    await capture('checkout', '/checkout', { cart: 2 }, heading('Resumen de la compra'));
    await capture('checkout-vacio', '/checkout', {}, heading(/carrito está vacío/i));
    await capture(
      'checkout-entrega',
      '/checkout',
      { cart: 2 },
      heading('Resumen de la compra'),
      async (page) => {
        await page.getByRole('radio', { name: /Entrega a domicilio/ }).check();
        await page.getByLabel('Calle', { exact: true }).waitFor();
      },
    );
    await capture('pedido-pendiente', '/pedidos/' + reference, {}, visible('Pendiente de pago'));
    await capture(
      'pedido-confirmado',
      '/pedidos/' + reference,
      { paid: true },
      visible('Pago confirmado'),
    );
    await capture('acceso', '/cuenta', {}, heading('Ingresá a tu cuenta'));
    await capture('registro', '/cuenta', {}, heading('Ingresá a tu cuenta'), async (page) => {
      await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
      await heading('Creá tu cuenta')(page);
    });
    await capture('recuperacion', '/cuenta', {}, heading('Ingresá a tu cuenta'), async (page) => {
      await page.getByRole('button', { name: /Olvid/ }).click();
      await heading('Recuperá tu contraseña')(page);
    });
    await capture(
      'restablecer',
      phase === 'before'
        ? '/cuenta/restablecer?email=persona%40camba.test#token=fixture-reset'
        : '/cuenta/restablecer#reset=fixture-reset',
      {},
      (page) => page.getByLabel('Nueva contraseña').waitFor(),
    );
    await capture(
      'restablecer-incompleto',
      '/cuenta/restablecer',
      {},
      heading('Restablecé tu contraseña'),
    );
    await capture(
      'cuenta',
      '/cuenta',
      { signed: true, addresses: [address] },
      heading('Datos personales'),
    );
    await capture(
      'direcciones',
      '/cuenta',
      { signed: true, addresses: [address] },
      heading('Datos personales'),
      async (page) => {
        if (phase === 'before') await page.locator('summary').filter({ hasText: /Direcciones/ }).click();
        await page.getByText('Calle de prueba 100').waitFor();
      },
    );
    await capture(
      'sin-direcciones',
      '/cuenta',
      { signed: true },
      heading('Datos personales'),
      async (page) => {
        if (phase === 'before') await page.locator('summary').filter({ hasText: /Direcciones/ }).click();
        await page.getByText(/no guardaste direcciones|no tenés direcciones/i).waitFor();
      },
    );
    await capture(
      'verificacion',
      '/cuenta',
      { signed: true, verified: false },
      heading('Verificá tu correo'),
    );
    await capture('pedidos', '/pedidos', { signed: true }, visible('Pendiente de pago'));
    await capture(
      'sin-pedidos',
      '/pedidos',
      { signed: true, orders: false },
      heading(/no hay compras/i),
    );
    await capture(
      'pedido-no-encontrado',
      '/pedidos/no-encontrado',
      {},
      heading('No encontramos este pedido'),
    );
    console.log(phase + ': route/state captures at ' + width + ' px');
  }
  if (phase !== 'before') {
    const shopper = await simulatedPage(browser, 390);
    await shopper.goto(real + '/');
    const nav = shopper.getByRole('banner');
    await nav.getByRole('button', { name: 'Menú de tienda' }).click();
    await nav.getByRole('link', { name: 'Tienda', exact: true }).click();
    await expect(shopper).toHaveURL(real + '/tienda');
    const filterButton = shopper.getByRole('button', { name: /^Filtros/ });
    if (await filterButton.isVisible()) await filterButton.click();
    await shopper.getByLabel('Categoría', { exact: true }).selectOption('remeras');
    await shopper.getByRole('main').locator('form button[type="submit"]').first().click();
    await expect(shopper).toHaveURL(/category=remeras/);
    await shopper.getByRole('link', { name: product.name, exact: true }).click();
    await shopper.getByRole('link', { name: /Volver a la tienda/ }).click();
    await expect(shopper).toHaveURL(/category=remeras/);
    await shopper.getByRole('link', { name: product.name, exact: true }).click();
    await shopper.getByRole('button', { name: /Agregar al carrito/ }).click();
    const confirmation = shopper.getByRole('dialog');
    await expect(confirmation.getByRole('heading', { name: 'Agregado al carrito' })).toBeVisible();
    await confirmation.getByRole('button', { name: 'Seguir comprando' }).click();
    const writes = [];
    shopper.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/v1/cart/items/1') {
        writes.push([request.method(), request.postDataJSON()]);
      }
    });
    await shopper.getByLabel('Cantidad').fill('2');
    await shopper.getByLabel('Cantidad').blur();
    await shopper.getByRole('button', { name: 'Guardar cantidad en el carrito' }).click();
    await expect(confirmation.getByRole('heading', { name: 'Carrito actualizado' })).toBeVisible();
    assert.deepEqual(writes, [['PUT', { quantity: 2 }]]);
    await confirmation.getByRole('link', { name: 'Ver carrito' }).click();
    await shopper.getByRole('link', { name: 'Continuar la compra' }).click();
    await expect(shopper.getByRole('radio', { name: /Entrega a domicilio/ })).toBeVisible();
    await shopper.getByRole('radio', { name: /Retiro/ }).check();
    await shopper.getByLabel('Nombre completo').fill('Persona de prueba');
    await shopper.getByLabel('Correo electrónico').fill('persona@camba.test');
    await shopper.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(shopper.getByText('Pendiente de pago', { exact: true })).toBeVisible();
    await shopper.goto(real + '/pedidos/' + reference + '?status=approved&payment_id=fixture');
    await expect(shopper.getByText('Pendiente de pago', { exact: true })).toBeVisible();
    await expect(shopper).toHaveURL(real + '/pedidos/' + reference);
    const paymentAttempt = (label) =>
      Promise.all([
        shopper.waitForRequest(
          (request) =>
            request.method() === 'POST' &&
            new URL(request.url()).pathname === '/api/v1/orders/' + reference + '/payments',
        ),
        shopper.getByRole('button', { name: label }).click(),
      ]).then(([request]) => request.headers()['idempotency-key']);
    const paymentKey = await paymentAttempt('Pagar con Mercado Pago');
    await expect(shopper.getByRole('alert')).toContainText('No pudimos abrir Mercado Pago');
    assert(paymentKey);
    assert.equal(await paymentAttempt('Reintentar apertura del pago'), paymentKey);
    await shopper.goto(real + '/cuenta');
    await shopper.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await shopper.getByRole('button', { name: 'Registrarme', exact: true }).click();
    await expect(shopper.getByLabel('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    await shopper.goto(real + '/cuenta');
    await shopper.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(shopper.getByLabel('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    await shopper.getByLabel('Correo electrónico').fill('persona@camba.test');
    await shopper.getByLabel('Contraseña', { exact: true }).fill('ClaveDePrueba01');
    await shopper.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(shopper.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
    await shopper.locator('main a[href="/pedidos"]').first().click();
    await expect(shopper.getByText('Pendiente de pago', { exact: true })).toBeVisible();
    console.log(
      'Catalog → detail → filtered listing → cart → guest checkout → payment state, and login → account → orders: passed using isolated browser fixtures.',
    );
  }
} finally {
  await browser.close();
  storefront.kill();
  server.close();
}
