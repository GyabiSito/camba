import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const store = 'http://127.0.0.1:4200';
const admin = 'http://127.0.0.1:4300';
const output = 'test-results/storefront-unified';
const browser = await chromium.launch();
const seedOrders = [
  ['00000000-0000-4000-8000-000000000101', 'Pago confirmado'],
  ['00000000-0000-4000-8000-000000000102', 'Pendiente de pago'],
  ['00000000-0000-4000-8000-000000000103', 'Reserva vencida'],
];
const fixtureCopy = /modo demo|en la demo|cliente de prueba|simular|sin cobros|mostrador demo/i;

async function capture(page, name) {
  await page.locator('img').evaluateAll(async (photos) => {
    for (const photo of photos) photo.loading = 'eager';
    await document.fonts.ready;
    await Promise.allSettled(photos.map((photo) => photo.decode()));
  });
  await page.screenshot({ path: `${output}/despues-${name}.png`, fullPage: true });
}

try {
  await mkdir(output, { recursive: true });
  assert.equal((await fetch(admin)).status, 200);
  assert.equal((await fetch(store + '/__camba_demo/cart')).status, 404);
  assert.equal((await (await fetch(store + '/api/v1/store-info')).json()).data.business_name, 'Camba');
  for (const { width, height } of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({
      viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      const errors = [];
      const outside = [];
      const paymentWrites = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (event) => { if (/NG05\d\d/.test(event.text())) errors.push(event.text()); });
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== store) outside.push(request.url());
        if (request.method() === 'POST' && /\/payments(?:\/|$)/.test(request.url()))
          paymentWrites.push(request.url());
      });

      const home = await page.goto(store);
      assert.match(await home.text(), /Vestite distinto\./);
      await expect(page.locator('.closing-mosaic-tile img')).toHaveCount(6);
      await capture(page, 'home-' + width);
      await page.locator('.category-panel').filter({ hasText: 'Camisas' }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe('camisas');
      await expect(page.getByRole('heading', { name: 'Tienda', exact: true })).toBeVisible();
      await expect(page.getByRole('contentinfo').getByRole('heading', { name: 'Ayuda' })).toBeVisible();
      await expect(page.getByRole('main')).not.toContainText(fixtureCopy);

      await page.goto(store + '/cuenta');
      await page.getByLabel('Correo electrónico').fill('cliente.diseno@camba.test');
      await page.getByLabel('Contraseña', { exact: true }).fill('CambaDemo2026!');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
      await expect(page.getByLabel('Nombre completo', { exact: true })).toHaveValue('Lucía Rodríguez');
      await expect(page.getByRole('main')).not.toContainText(fixtureCopy);
      await page.goto(store + '/carrito');
      const cart = page.getByRole('list', { name: 'Productos', exact: true });
      await expect(cart.getByRole('listitem')).toHaveCount(2);
      for (const photo of await cart.locator('store-product-photo img').all()) {
        await photo.scrollIntoViewIfNeeded();
        await photo.evaluate((image) => image.decode());
      }
      await cart.scrollIntoViewIfNeeded();
      await page.getByRole('link', { name: 'Continuar la compra' }).click();
      await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled();
      await expect(page.getByRole('radio', { name: /Retiro .*Camba/ })).toBeVisible();
      await expect(page.getByRole('main')).not.toContainText(fixtureCopy);
      await capture(page, 'checkout-' + width);

      for (const [reference, state] of seedOrders) {
        await page.goto(store + '/pedidos');
        const history = page.getByRole('main');
        const detail = page.locator(`a[href="/pedidos/${reference}"]`);
        const row = history.getByRole('listitem').filter({ has: detail });
        await expect(row.getByText(state, { exact: true })).toBeVisible();
        await row.getByRole('link', { name: /^Ver pedido/ }).click();
        const payment = page.getByRole('region', { name: 'Estado del pago' });
        await expect(payment.getByText(state, { exact: true })).toBeVisible();
        await expect(payment.getByRole('button', { name: /Pagar/ })).toHaveCount(0);
        await expect(page.getByRole('main')).not.toContainText(fixtureCopy);
        if (state === 'Pendiente de pago') {
          const refresh = payment.getByRole('button', { name: /Consultar|Actualizar/ });
          const orderPath = new URL(page.url()).pathname.replace('/pedidos/', '/api/v1/orders/');
          const checked = page.waitForResponse((response) =>
            new URL(response.url()).pathname === orderPath && response.request().method() === 'GET',
          );
          await refresh.click();
          assert.equal((await checked).status(), 200);
          await expect(payment.getByText(state, { exact: true })).toBeVisible();
          await capture(page, 'pedido-pendiente-' + width);
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(outside, []);
      assert.deepEqual(paymentWrites, []);
    } finally {
      await context.close();
    }
  }
  console.log('Docker SSR/Chromium at 1440 and 390: browse, account, cart, checkout, three order states; no payment writes');
} finally {
  await browser.close();
}
