import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const store = 'http://127.0.0.1:4200';
const admin = 'http://127.0.0.1:4300';
const output = 'test-results/postgres-demo';
const browser = await chromium.launch();
const fail = [];

async function open(origin) {
  // Login on different ports still shares cookie names unless contexts are separate.
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (error) => fail.push(error.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if ([store, admin].includes(url.origin)) return route.continue();
    fail.push('Unexpected outside request: ' + url.origin);
    return route.abort();
  });
  await page.goto(origin);
  return page;
}

async function login(page, email) {
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('CambaDemo2026!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}

async function photo(image) {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  assert.match(await image.evaluate((img) => new URL(img.currentSrc).pathname), /^\/storage\//);
}

async function shot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
}

async function cartItems(page) {
  const response = await page.request.get(store + '/api/v1/cart', { headers: { Referer: store + '/' } });
  assert.equal(response.status(), 200);
  return (await response.json()).data.items;
}

try {
  await mkdir(output, { recursive: true });
  const shop = await open(store);
  await shop.goto(store + '/tienda');
  const cover = shop.locator('store-product-grid li img').first();
  await photo(cover);
  await shot(shop, '01-catalogo');
  const response = await shop.request.get(store + '/api/v1/products?per_page=100');
  assert.equal(response.status(), 200);
  const products = (await response.json()).data;
  assert(products.some((item) => item.in_stock));
  assert(products.some((item) => !item.in_stock));
  assert(products.some((item) => item.brand));
  let galleryProduct;
  for (const { slug } of products.filter((item) => item.in_stock)) {
    const res = await shop.request.get(store + '/api/v1/products/' + slug);
    assert.equal(res.status(), 200);
    const { data } = await res.json();
    if (data.images.length > 1) {
      galleryProduct = data;
      break;
    }
  }
  assert(galleryProduct, 'At least one published product has a gallery');
  await shop.goto(store + '/producto/' + galleryProduct.slug);
  await shop.getByRole('button', { name: 'Ver foto 2' }).click();
  await photo(shop.locator('.main-photo img'));

  await shop.goto(store + '/cuenta');
  await login(shop, 'cliente.diseno@camba.test');
  await expect(shop.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  const addresses = shop.getByRole('region', { name: 'Direcciones guardadas' });
  await expect(addresses.getByRole('button', { name: /^Editar / })).toHaveCount(2);
  await shot(shop, '02-cuenta');
  await shop.getByRole('link', { name: 'Mis pedidos' }).click();
  await expect(shop.getByText('Reserva vencida', { exact: true }).first()).toBeVisible();
  await shot(shop, '03-historial');
  let paidReference;
  for (const state of ['Pago confirmado', 'Pendiente de pago', 'Reserva vencida']) {
    await shop
      .getByRole('listitem')
      .filter({ has: shop.getByText(state, { exact: true }) })
      .getByRole('link', { name: /^Ver pedido/ })
      .first()
      .click();
    await expect(shop.getByRole('heading', { name: 'Tu pedido', exact: true })).toBeVisible();
    await expect(shop.getByText(state, { exact: true })).toBeVisible();
    await expect(shop.getByRole('complementary', { name: 'Resumen del pedido' })).toContainText(
      'UYU',
    );
    if (state === 'Pago confirmado') paidReference = new URL(shop.url()).pathname.split('/').at(-1);
    await shop.getByRole('link', { name: 'Ver compras', exact: true }).click();
    await expect(shop).toHaveURL(store + '/pedidos');
  }

  const originalCart = await cartItems(shop);
  const shopping = originalCart.length ? shop : await open(store);
  if (shopping !== shop) {
    // The long-lived demo buyer may have already checked out. Use a fresh guest cart instead.
    await shopping.goto(store + '/producto/' + galleryProduct.slug);
    const added = shopping.waitForResponse(r => r.url().includes('/api/v1/cart/items/') && r.request().method() === 'POST');
    await shopping.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
    assert((await added).ok());
  }
  await shopping.goto(store + '/carrito');
  const cart = shopping.getByRole('list', { name: 'Productos', exact: true });
  await expect(cart.getByRole('listitem')).toHaveCount(originalCart.length || 1);
  for (const item of await cart.getByRole('listitem').all()) {
    await photo(item.locator('store-product-photo img'));
    await expect(item.getByRole('spinbutton')).toBeVisible();
  }
  await shot(shopping, '04-carrito');
  await shopping.getByRole('link', { name: 'Continuar la compra', exact: true }).click();
  await shopping.getByRole('radio', { name: /Retiro/ }).check();
  const summary = shopping.getByRole('complementary', { name: 'Resumen de la compra' });
  await expect(summary).toContainText('Sin costo');
  if (shopping === shop) {
    await shopping.getByRole('radio', { name: /Entrega a domicilio/ }).check();
    await shopping.getByLabel('Usar una dirección guardada').selectOption({ index: 1 });
    await expect(shopping.getByLabel('Calle', { exact: true })).not.toHaveValue('');
  }
  await expect(summary.getByText('Total', { exact: true })).toBeVisible();
  await expect(shopping.getByRole('button', { name: 'Confirmar pedido' })).toBeVisible();
  await shot(shopping, '05-checkout');
  if (shopping !== shop) {
    await shopping.goto(store + '/carrito');
    await shopping.getByRole('button', { name: /^Quitar / }).click();
    await expect(shopping.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
    await shopping.close();
  }

  const backoffice = await open(admin);
  await login(backoffice, 'admin.diseno@camba.test');
  await expect(backoffice.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible();
  await backoffice.getByRole('link', { name: 'Productos', exact: true }).click();
  await expect(backoffice.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  for (const status of ['published', 'draft', 'archived']) {
    const res = await backoffice.request.get(admin + '/api/v1/admin/products?status=' + status, {
      headers: { Referer: admin + '/' },
    });
    assert.equal(res.status(), 200);
    assert((await res.json()).data.some((item) => item.status === status));
  }
  await backoffice.goto(admin + '/productos/' + galleryProduct.id);
  await expect(
    backoffice.getByRole('heading', { name: galleryProduct.name, exact: true }),
  ).toBeVisible();
  await photo(backoffice.getByRole('region', { name: 'Galería' }).locator('img').first());
  await shot(backoffice, '06-admin-producto');
  await backoffice.goto(admin + '/productos/importar');
  await expect(
    backoffice.getByRole('heading', { name: 'Importar planilla', exact: true }),
  ).toBeVisible();
  await backoffice.goto(admin + '/pedidos/' + paidReference);
  await expect(backoffice.getByRole('heading', { name: /^Pedido / })).toBeVisible();
  await expect(backoffice.getByText(paidReference, { exact: true })).toBeVisible();
  await shot(backoffice, '07-admin-pedido');

  for (const [path, title] of [
    ['/productos/categorias', 'Categorías'],
    ['/productos/marcas', 'Marcas'],
    ['/productos/carga-por-fotos', 'Carga por fotos'],
    ['/pedidos', 'Pedidos'],
    ['/pedidos/avisos', 'Avisos operativos'],
    ['/configuracion', 'Configuración'],
    ['/configuracion/historial', 'Historial de configuración'],
    ['/portada', 'Portada'],
    ['/portada/vista-previa', 'Vista previa'],
  ]) {
    assert.equal((await backoffice.goto(admin + path))?.status(), 200, path);
    await expect(backoffice.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
  }
  await expect(backoffice.frameLocator('#homepage-canvas').locator('store-home')).toBeVisible();

  assert.deepEqual(await cartItems(shop), originalCart, 'Preserve the existing buyer cart');
  assert.deepEqual(fail, []);
  console.log(
    'Store and admin verified on PostgreSQL; seeded cart preserved. Order:',
    paidReference,
  );
} finally {
  await browser.close();
}
