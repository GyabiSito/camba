import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4300';
const output = 'test-results/admin-redesign';
const password = process.env.CAMBA_DEMO_PASSWORD;
assert(password, 'Set CAMBA_DEMO_PASSWORD to the documented local demo password.');
const browser = await chromium.launch();
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const shot = (label, width) =>
  page.screenshot({ path: `${output}/after-${label}-${width}.png`, animations: 'disabled' });
const api = async (path) => {
  const response = await page.request.get(`${origin}/api/v1/admin/${path}`, {
    headers: { Referer: `${origin}/` },
  });
  assert.equal(response.status(), 200, path);
  return (await response.json()).data;
};
const heading = (name) => expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
const reflow = () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/`);
  const email = page.getByLabel('Correo electrónico', { exact: true });
  const pass = page.getByLabel('Contraseña', { exact: true });
  const login = page.getByRole('button', { name: 'Ingresar', exact: true });
  await expect(login).toBeVisible();
  await shot('login', 1440);
  await page.setViewportSize({ width: 390, height: 900 });
  await shot('login', 390);
  await page.setViewportSize({ width: 320, height: 900 });
  await reflow();
  await email.fill('no-existe-admin-preview@camba.test');
  await pass.fill('invalid-demo-password');
  await login.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await shot('login-error', 320);
  await email.fill('admin.diseno@camba.test');
  await pass.fill(password);
  await login.click();
  await heading('Productos');

  const products = await api('products');
  const product = products.find(({ sku }) => sku === 'CAMBA-DEMO-009') ?? products[0];
  const [order] = await api('orders');
  assert(product?.name && order?.reference, 'Expected the preloaded catalog and orders.');

  const inventory = page.getByRole('table', { name: 'Inventario de productos' });
  await expect(inventory).toBeVisible();
  await reflow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('link', { name: 'Nuevo producto' })).toBeVisible();
  await expect(page.getByText('Carga masiva', { exact: true }).first()).toBeVisible();
  await shot('productos', 1440);
  await page.setViewportSize({ width: 390, height: 900 });
  await shot('productos', 390);
  const menu = page.getByRole('button', { name: 'Menú' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  const navigation = page.getByRole('navigation', { name: 'Administración' });
  await expect(navigation.getByRole('link', { name: 'Inicio', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(navigation).toBeHidden();

  const search = page.getByRole('searchbox');
  await search.fill('ADMIN-REVIEW-NO-MATCH-000');
  await expect(inventory).toBeHidden();
  await expect(page.getByText(/no (?:encontramos|se encontraron|hay).*(?:productos|coincidencias)/i).first()).toBeVisible();
  await shot('productos-vacio', 390);
  await search.clear();
  await expect(inventory).toBeVisible();
  await page.locator(`a[href="/productos/${product.id}"]`).first().click();
  await heading(product.name);
  const gallery = page.getByRole('region', { name: /galería/i });
  const photo = gallery.locator('img').first();
  await expect(photo).toBeVisible();
  await photo.scrollIntoViewIfNeeded();
  await expect.poll(() => photo.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);

  const capture = async (label, anchor) => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      if (anchor) await anchor.scrollIntoViewIfNeeded();
      else await page.evaluate(() => window.scrollTo(0, 0));
      await reflow();
      if (width !== 320) await shot(label, width);
    }
  };
  await capture('producto-edicion');
  await capture('producto-galeria', gallery.getByRole('heading', { name: /galería/i }));
  await page.goto(`${origin}/productos/nuevo`);
  await heading('Nuevo producto');
  await capture('productos-nuevo');

  await page.goto(`${origin}/productos`);
  await expect(inventory).toBeVisible();
  const batch = page.getByText('Carga masiva', { exact: true }).first();
  const spreadsheet = page.locator('a[href="/productos/importar"]').filter({ visible: true }).first();
  if (!(await spreadsheet.isVisible())) await batch.click();
  await spreadsheet.click();
  await heading(/importar planilla|carga masiva/i);
  await capture('productos-importar');
  const csv = Buffer.from([
    'codigo,nombre,precio_uyu,stock,categoria,marca,descripcion,fotos',
    'ADMIN-UI-PREVIEW-TEST-01,Validación de vista previa admin,1590,4,remeras,,,',
    'ADMIN-UI-PREVIEW-TEST-02,Ejemplo de error admin,1590,4,categoria-inexistente,,,',
    '',
  ].join('\n'));
  // This intentionally creates only an unconfirmed preview; never apply it to the live demo.
  await page.getByLabel(/Archivo CSV o XLSX/).setInputFiles({
    name: 'admin-vista-previa.csv', mimeType: 'text/csv', buffer: csv,
  });
  await page.getByRole('button', { name: 'Ver vista previa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vista previa', exact: true })).toBeVisible();
  await expect(page.getByText('ADMIN-UI-PREVIEW-TEST-02', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled();
  const batchUrl = page.url();
  assert.match(batchUrl, /\/productos\/importar\/\d+$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vista previa', exact: true })).toBeVisible();
  await expect(page).toHaveURL(batchUrl);
  await capture('importacion-vista-previa');
  console.log(`Unconfirmed preview survived reload: ${batchUrl}`);

  await menu.click();
  await navigation.getByRole('link', { name: 'Pedidos' }).click();
  await heading('Pedidos');
  const orderLink = page.locator(`a[href="/pedidos/${order.reference}"]`).first();
  await expect(orderLink).toBeVisible();
  await capture('pedidos');
  await orderLink.click();
  await heading(/^Pedido /);
  await expect(page.getByText(order.reference, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Productos del pedido' })).toBeVisible();
  await capture('pedido-detalle');

  for (const [label, route, name] of [
    ['categorias', '/productos/categorias', /^Categorías$/],
    ['marcas', '/productos/marcas', /^Marcas$/],
    ['carga-por-fotos', '/productos/carga-por-fotos', /Carga por fotos/],
    ['avisos', '/pedidos/avisos', /Avisos operativos/],
    ['configuracion', '/configuracion', /Configuración/],
    ['configuracion-historial', '/configuracion/historial', /Historial de configuración/],
  ]) {
    await page.goto(origin + route);
    await heading(name);
    await page.waitForLoadState('networkidle');
    await capture(label);
  }

  const store = await browser.newPage();
  assert.equal((await store.goto('http://127.0.0.1:4200/tienda')).status(), 200);
  const catalog = await store.request.get('http://127.0.0.1:4200/api/v1/products');
  assert.equal(catalog.status(), 200);
  assert((await catalog.json()).data.some((item) => item.slug === product.slug));
  assert.deepEqual(errors, []);
  console.log('Docker Admin journeys, 320 px reflow, keyboard, errors and Store catalog passed.');
} finally {
  await browser.close();
}
