import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Real shared Docker only. Run state prevents an interrupted check creating a second order.
const store = 'http://127.0.0.1:4200';
const admin = 'http://127.0.0.1:4300';
const out = 'test-results/storefront-docker-api';
const password = process.env.CAMBA_DEMO_PASSWORD;
assert(password, 'Set CAMBA_DEMO_PASSWORD to the README local-only demo password');
await mkdir(out, { recursive: true });
const statePath = `${out}/commerce-state.json`;
let state;
try { state = JSON.parse(await readFile(statePath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const id = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  state = { id, email: `qa-compra-${id}@camba.test`, name: `QA Compra ${id}`, productName: `QA Compra ${id}`, checks: [] };
}
async function save() { await writeFile(statePath, JSON.stringify(state, null, 2)); }
async function checked(name, details = {}) {
  state.checks = state.checks.filter((entry) => entry.name !== name);
  state.checks.push({ name, ...details });
  await save();
  console.log('PASS', name, JSON.stringify(details));
}
await save();
assert.match(state.email, /^qa-compra-\d+@camba\.test$/);
const browser = await chromium.launch();
const pages = [];
async function open(origin) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  pages.push(page);
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return [store, admin].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await page.goto(origin);
  return page;
}
async function read(page, path) {
  const response = await page.request.get(new URL(path, page.url()).href, { headers: { Referer: page.url() } });
  assert.equal(response.status(), 200, `${path}: ${response.status()}`);
  return response.json();
}
function responseFor(page, path, method) {
  return page.waitForResponse((response) => new URL(response.url()).pathname === path && response.request().method() === method);
}
async function login(page, email) {
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  const response = responseFor(page, '/api/v1/auth/login', 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  assert.equal((await response).status(), 204);
}
async function image(img) {
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((node) => node.complete && node.naturalWidth > 0)).toBe(true);
  assert.match(await img.getAttribute('src'), /\/storage\//);
}
async function shot(page, name) { await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, animations: 'disabled' }); }
async function add(page) {
  await page.goto(`${store}/producto/${state.slug}`);
  await expect(page.getByRole('button', { name: 'Agregar al carrito', exact: true })).toBeVisible();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let reached;
  const started = new Promise((resolve) => { reached = resolve; });
  const pattern = `**/api/v1/cart/items/${state.productId}`;
  await page.route(pattern, async (route) => { reached(); await held; await route.continue(); }, { times: 1 });
  const added = responseFor(page, `/api/v1/cart/items/${state.productId}`, 'POST');
  await page.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
  await started;
  try { await expect(page.getByRole('dialog')).toBeHidden(); }
  finally { release(); }
  assert.equal((await added).status(), 200);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Seguir comprando' }).click();
}
async function cart(page, quantity) {
  await page.goto(store + '/carrito');
  const items = (await read(page, '/api/v1/cart')).data.items;
  assert.equal(items.length, 1);
  assert.equal(items[0].product_id, state.productId);
  assert.equal(items[0].quantity, quantity);
  await expect(page.getByRole('spinbutton')).toHaveValue(String(quantity));
  await image(page.locator('store-product-photo img').first());
  await expect(page.locator('header a[href="/carrito"]')).toHaveAttribute('aria-label', `Carrito, ${quantity}`);
  const digits = (123475 * quantity) % 100 ? 2 : 0;
  const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', currencyDisplay: 'code', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(1234.75 * quantity);
  await expect(page.getByRole('complementary', { name: 'Resumen del carrito' })).toContainText(money);
}
async function update(page, quantity) {
  await page.getByRole('spinbutton').fill(String(quantity));
  const saved = responseFor(page, `/api/v1/cart/items/${state.productId}`, 'PUT');
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  assert.equal((await saved).status(), 200);
  await expect(page.getByRole('status', { name: 'Carrito actualizado' })).toBeVisible();
}

try {
  const backoffice = await open(admin);
  await login(backoffice, 'admin.diseno@camba.test');
  await expect(backoffice.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  if (!state.productId) {
    await backoffice.getByRole('link', { name: 'Nuevo producto', exact: true }).click();
    await backoffice.getByLabel('Nombre', { exact: true }).fill(state.productName);
    await backoffice.getByLabel('Precio (UYU)').fill('1234,50');
    await backoffice.getByLabel('Stock', { exact: true }).fill('8');
    await backoffice.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ index: 1 });
    const created = responseFor(backoffice, '/api/v1/admin/products', 'POST');
    await backoffice.getByRole('button', { name: 'Crear borrador' }).click();
    const response = await created;
    assert.equal(response.status(), 201);
    const product = (await response.json()).data;
    state.productId = product.id; state.slug = product.slug;
    await save();
  }
  await backoffice.goto(`${admin}/productos/${state.productId}`);
  let product = (await read(backoffice, `/api/v1/admin/products/${state.productId}`)).data;
  assert.equal(product.name, state.productName);
  if (product.status === 'draft') {
    await backoffice.getByLabel('Agregar fotos').setInputFiles([
      resolve('projects/admin/public/demo/image-plain.webp'), resolve('projects/admin/public/demo/detail-photo.webp'),
    ]);
    await backoffice.getByRole('button', { name: 'Subir fotos' }).click();
    await expect(backoffice.getByText('Fotos agregadas a la galería.')).toBeVisible();
    const publication = responseFor(backoffice, `/api/v1/admin/products/${state.productId}/publish`, 'POST');
    await backoffice.getByRole('button', { name: 'Publicar', exact: true }).click();
    assert.equal((await publication).status(), 200);
  }
  product = (await read(backoffice, `/api/v1/admin/products/${state.productId}`)).data;
  if (product.price_cents !== 123475) {
    await backoffice.getByLabel('Precio (UYU)').fill('1234,75');
    const updated = responseFor(backoffice, `/api/v1/admin/products/${state.productId}`, 'PATCH');
    await backoffice.getByRole('button', { name: 'Guardar cambios' }).click();
    assert.equal((await updated).status(), 200);
  }
  product = (await read(backoffice, `/api/v1/admin/products/${state.productId}`)).data;
  state.slug = product.slug;
  await checked('admin-published-updated', { productId: product.id, slug: product.slug, price_cents: product.price_cents });

  const buyer = await open(store);
  const catalog = await read(buyer, '/api/v1/products?per_page=1&page=2');
  assert.equal(catalog.meta.current_page, 2);
  assert.equal(catalog.data.length, 1);
  await checked('real-api-pagination', { total: catalog.meta.total, per_page: catalog.meta.per_page, visualSecondPageAvailable: catalog.meta.total > 12 });
  await buyer.goto(store + '/tienda');
  await buyer.getByRole('searchbox', { name: 'Buscar en la tienda' }).fill(state.id);
  await buyer.getByLabel('Categoría', { exact: true }).selectOption(product.category.slug);
  await buyer.getByLabel('Orden', { exact: true }).selectOption('price_asc');
  await buyer.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(buyer).toHaveURL(new RegExp(`q=${state.id}`));
  await expect(buyer.locator('store-product-grid li')).toHaveCount(1);
  await expect(buyer.getByRole('link', { name: state.productName, exact: true })).toBeVisible();
  await image(buyer.locator('store-product-grid img').first());
  await shot(buyer, 'commerce-catalog');
  await buyer.getByRole('link', { name: state.productName, exact: true }).click();
  await expect(buyer.getByRole('heading', { name: state.productName })).toBeVisible();
  const publicProduct = (await read(buyer, `/api/v1/products/${state.slug}`)).data;
  assert.equal(publicProduct.price_cents, 123475);
  assert.equal(publicProduct.images.length, 2);
  await image(buyer.locator('.main-photo img'));
  await buyer.getByRole('button', { name: 'Ver foto 2' }).click();
  await image(buyer.locator('.main-photo img'));
  await checked('catalog-filter-detail-images-admin-parity');
  const unavailable = (await read(buyer, '/api/v1/products?per_page=100')).data.find((item) => !item.in_stock);
  assert(unavailable, 'Seed includes an unavailable product for read-only browsing');
  await buyer.goto(`${store}/producto/${unavailable.slug}`);
  await expect(buyer.getByText('Sin stock', { exact: true })).toBeVisible();
  await expect(buyer.getByRole('button', { name: 'Agregar al carrito', exact: true })).toHaveCount(0);
  await buyer.goto(`${store}/tienda?q=${state.id}&page=2`);
  await expect(buyer.getByRole('heading', { name: 'Esta página no tiene productos' })).toBeVisible();
  await buyer.getByRole('link', { name: 'Ir a la última página' }).click();
  await expect(buyer.getByRole('link', { name: state.productName, exact: true })).toBeVisible();
  await checked('unavailable-product-and-out-of-range-page-recovery');

  await buyer.goto(store + '/cuenta');
  if (!state.registered) {
    await buyer.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await buyer.getByLabel('Nombre completo').fill(state.name);
    await buyer.getByLabel('Correo electrónico').fill(state.email);
    await buyer.getByLabel('Contraseña', { exact: true }).fill(password);
    await buyer.getByLabel('Confirmá la contraseña', { exact: true }).fill(password);
    const registered = responseFor(buyer, '/api/v1/auth/register', 'POST');
    await buyer.getByRole('button', { name: 'Registrarme', exact: true }).click();
    assert.equal((await registered).status(), 201);
    state.registered = true; await save();
    await expect(buyer.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
    await login(buyer, state.email);
  } else { await login(buyer, state.email); }
  await expect(buyer.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  const me = (await read(buyer, '/api/v1/auth/me')).data;
  assert.equal(me.email, state.email); assert.equal(me.role, 'buyer');
  state.buyerId = me.id; await save();
  if (!state.addressId) {
    await buyer.getByRole('button', { name: 'Agregar dirección' }).click();
    for (const [label, value] of Object.entries({ 'Nombre de quien recibe': state.name, Departamento: 'Montevideo', Localidad: 'Montevideo', Calle: 'Calle QA Compra', 'Número de puerta': '123' })) await buyer.getByLabel(label, { exact: true }).fill(value);
    const saved = responseFor(buyer, '/api/v1/account/addresses', 'POST');
    await buyer.getByRole('button', { name: 'Guardar dirección' }).click();
    const response = await saved; assert.equal(response.status(), 201);
    state.addressId = (await response.json()).data.id; await save();
  }
  if (!state.order) {
    // Only this freshly registered buyer and this QA product are ever mutated.
    const previous = (await read(buyer, '/api/v1/cart')).data.items;
    if (previous.length) {
      assert.equal(previous.length, 1); assert.equal(previous[0].product_id, state.productId);
      await buyer.goto(store + '/carrito');
      const removed = responseFor(buyer, `/api/v1/cart/items/${state.productId}`, 'DELETE');
      await buyer.getByRole('button', { name: `Quitar ${state.productName}` }).click();
      assert.equal((await removed).status(), 204);
    }
    await add(buyer); await cart(buyer, 1); await update(buyer, 2);
    await buyer.reload(); await cart(buyer, 2);
    await update(buyer, 1);
    const guest = await open(store);
    await add(guest); await cart(guest, 1); await update(guest, 2);
    await guest.reload(); await cart(guest, 2);
    const removed = responseFor(guest, `/api/v1/cart/items/${state.productId}`, 'DELETE');
    await guest.getByRole('button', { name: `Quitar ${state.productName}` }).click();
    assert.equal((await removed).status(), 204);
    await expect(guest.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
    await add(guest);
    await guest.goto(store + '/cuenta'); await login(guest, state.email);
    await expect(guest.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
    await cart(guest, 2);
    await checked('guest-buyer-api-cart-merge-reload-remove-confirmation');
    await update(guest, 8);
    await guest.goto(`${store}/producto/${state.slug}`);
    const rejected = responseFor(guest, `/api/v1/cart/items/${state.productId}`, 'POST');
    await guest.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
    assert.equal((await rejected).status(), 422);
    await expect(guest.getByRole('dialog')).toBeHidden();
    await expect(guest.getByText('Ya tenés en el carrito todas las unidades disponibles.')).toBeVisible();
    await cart(guest, 8); await update(guest, 2);
    await checked('real-api-stock-limit');
    const quoted = responseFor(guest, '/api/v1/checkout/quote', 'POST');
    await guest.getByRole('link', { name: 'Continuar la compra', exact: true }).click();
    const quote = (await (await quoted).json()).data;
    assert.equal(quote.subtotal_cents, 246950);
    assert.deepEqual(quote.shipping_options.map((x) => x.method).sort(), ['delivery', 'pickup']);
    await guest.getByRole('radio', { name: /Retiro/ }).check();
    await expect(guest.getByRole('complementary', { name: 'Resumen de la compra' })).toContainText('Sin costo');
    await guest.getByRole('radio', { name: /Entrega a domicilio/ }).check();
    await guest.getByLabel('Usar una dirección guardada').selectOption(String(state.addressId));
    await expect(guest.getByLabel('Calle', { exact: true })).toHaveValue('Calle QA Compra');
    await shot(guest, 'commerce-checkout');
    await checked('quote-pickup-delivery-saved-address', { subtotal_cents: quote.subtotal_cents });
    const before = (await read(backoffice, `/api/v1/admin/products/${state.productId}`)).data.stock;
    let firstKey, firstBody;
    await guest.route('**/api/v1/orders', async (route) => {
      if (route.request().method() !== 'POST' || firstKey) return route.continue();
      firstKey = route.request().headers()['idempotency-key']; firstBody = route.request().postData();
      const committed = await route.fetch(); assert.equal(committed.status(), 201);
      const order = (await committed.json()).data;
      state.order = { reference: order.reference, total_cents: order.total_cents, subtotal_cents: order.subtotal_cents, shipping_cents: order.shipping_cents, status: order.status };
      state.stockBefore = before; await save();
      await route.abort();
    });
    await guest.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
    await expect(guest.getByRole('alert')).toContainText('No pudimos comprobar si el pedido se creó');
    const retried = responseFor(guest, '/api/v1/orders', 'POST');
    await guest.getByRole('button', { name: 'Reintentar el mismo pedido' }).click();
    const response = await retried; assert(response.ok());
    assert.equal(response.request().headers()['idempotency-key'], firstKey);
    assert.equal(response.request().postData(), firstBody);
    assert.equal((await response.json()).data.reference, state.order.reference);
    await checked('real-committed-order-transport-loss-idempotent-retry', { reference: state.order.reference });
  }
  const order = (await read(buyer, `/api/v1/orders/${state.order.reference}`)).data;
  assert.equal(order.status, 'pending_payment');
  assert.equal(order.total_cents, state.order.total_cents);
  assert.equal(order.items.length, 1); assert.equal(order.items[0].product_id, state.productId); assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].unit_price_cents, 123475);
  const adminOrder = (await read(backoffice, `/api/v1/admin/orders/${order.reference}`)).data;
  for (const field of ['reference', 'total_cents', 'subtotal_cents', 'shipping_cents', 'status']) assert.equal(adminOrder[field], order[field]);
  assert.deepEqual(adminOrder.items, order.items);
  const after = (await read(backoffice, `/api/v1/admin/products/${state.productId}`)).data.stock;
  assert.equal(after, state.stockBefore - 2);
  const orders = (await read(buyer, '/api/v1/orders')).data;
  assert.equal(orders.length, 1); assert.equal(orders[0].reference, order.reference);
  await buyer.goto(`${store}/pedidos/${order.reference}`);
  await expect(buyer.getByRole('heading', { name: 'Tu pedido', exact: true })).toBeVisible();
  await expect(buyer.getByText('Pendiente de pago', { exact: true })).toBeVisible();
  await expect(buyer.getByRole('complementary', { name: 'Resumen del pedido' })).toContainText(`2 × ${state.productName}`);
  await expect(buyer.getByRole('button', { name: /Pagar con Mercado Pago/ })).toHaveCount(0);
  await buyer.reload(); await expect(buyer.getByText(`Referencia: ${order.reference}`, { exact: true })).toBeVisible();
  await shot(buyer, 'commerce-order-buyer');
  await buyer.goto(store + '/pedidos');
  await expect(buyer.getByRole('link', { name: /^Ver pedido/ })).toHaveCount(1);
  await backoffice.goto(`${admin}/pedidos/${order.reference}`);
  await expect(backoffice.getByRole('heading', { name: /^Pedido / })).toBeVisible();
  await expect(backoffice.getByText(order.reference, { exact: true })).toBeVisible();
  await expect(backoffice.getByRole('list', { name: 'Líneas de pedido' }).getByText(state.productName, { exact: true })).toBeVisible();
  await shot(backoffice, 'commerce-order-admin');
  await checked('single-order-stock-once-buyer-admin-api-ui', { reference: order.reference, total_cents: order.total_cents, stockBefore: state.stockBefore, stockAfter: after });
  const inspectCart = (await read(buyer, '/api/v1/cart')).data.items;
  if (!inspectCart.length) await add(buyer);
  else {
    assert.equal(inspectCart.length, 1); assert.equal(inspectCart[0].product_id, state.productId);
    await buyer.goto(store + '/carrito');
    if (inspectCart[0].quantity !== 1) await update(buyer, 1);
  }
  await cart(buyer, 1);
  await shot(buyer, 'commerce-cart-left-for-inspection');
  state.status = 'passed'; delete state.failure; await save();
  console.log(JSON.stringify({ status: state.status, email: state.email, productId: state.productId, reference: order.reference, checks: state.checks.length }));
} catch (error) {
  state.status = 'partial'; state.failure = error.message; await save();
  for (const [index, page] of pages.entries()) await shot(page, `commerce-failure-${index}`).catch(() => {});
  throw error;
} finally { await browser.close(); }
