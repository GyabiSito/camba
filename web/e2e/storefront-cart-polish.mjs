import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44858';
const phase = process.env.CAMBA_CAPTURE_PHASE ?? 'after';
const out = 'test-results/storefront-polish/' + phase;
const browser = await chromium.launch();

async function signIn(page) {
  await page.goto(base + '/cuenta');
  await page.getByLabel('Correo electrónico').fill('cliente.diseno@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('CambaDemo2026!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
}

async function shot(page, name, width) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, name);
  await page.screenshot({
    path: `${out}/${name}-${width}.png`,
    fullPage: !['agregado', 'actualizado'].includes(name),
    animations: 'disabled',
  });
}

try {
  await mkdir(out, { recursive: true });
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      hasTouch: width < 600,
      reducedMotion: 'reduce',
    });
    await signIn(page);
    await page.goto(base + '/checkout');
    await page.getByRole('radio', { name: /Entrega a domicilio/ }).check();
    await page.getByLabel('Usar una dirección guardada').selectOption('1');
    const checkout = page.getByRole('complementary', { name: 'Resumen de la compra' });
    await expect(checkout).toContainText('UYU 2.470');
    await shot(page, 'checkout', width);
    await page.goto(base + '/carrito');
    const total = page.getByRole('complementary', { name: 'Resumen del carrito' });
    await expect(total).toContainText('UYU 2.280');
    const line = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: 'Remera lisa negra', exact: true }) });
    if (phase !== 'before') {
      const cover = line.locator('store-product-photo');
      await expect(cover.locator('img')).toHaveAttribute('src', '/demo/image-plain.webp');
      await expect
        .poll(() => cover.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0))
        .toBe(true);
      const { width: w, height: h } = await cover.boundingBox();
      assert.deepEqual([w, h], width === 1440 ? [80, 100] : [56, 70]);
    }
    await shot(page, 'carrito', width);
    if (phase === 'before') {
      await page.goto(base + '/cuenta');
      await page.getByText('Direcciones guardadas', { exact: true }).click();
      await expect(page.getByText('Calle Muestra 120')).toBeVisible();
      await shot(page, 'cuenta', width);
      await page.goto(base + '/pedidos');
      await expect(page.getByText('Reserva vencida', { exact: true })).toBeVisible();
      await shot(page, 'pedidos', width);
      await page.close();
      continue;
    }
    const quantity = line.getByRole('spinbutton');
    for (const [value, subtotal] of [
      ['2', '3.070'],
      ['1', '2.280'],
    ]) {
      await quantity.fill(value);
      await line.getByRole('button', { name: 'Actualizar' }).click();
      await expect(total).toContainText('UYU ' + subtotal);
    }

    await page.goto(base + '/producto/camisa-algodon-blanca');
    const add = page.getByRole('button', { name: 'Agregar al carrito' });
    const dialog = page.getByRole('dialog');
    const header = page.locator('header.home-header');
    await add.press('Enter');
    await expect(dialog.getByRole('heading', { name: 'Agregado al carrito' })).toBeVisible();
    await expect(dialog.getByText('Camisa de algodón blanca')).toBeVisible();
    await expect(dialog.getByText('Cantidad: 1')).toBeVisible();
    await expect(dialog).toContainText('UYU 1.390');
    await expect(dialog.locator('img')).toBeVisible();
    await expect(header.locator('a[href="/carrito"]')).toHaveAttribute('aria-label', 'Carrito, 3');
    await shot(page, 'agregado', width);
    await expect(dialog.getByRole('button', { name: 'Seguir comprando' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('link', { name: 'Ver carrito' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cerrar' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('link', { name: 'Ver carrito' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Seguir comprando' }).click();
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();

    await add.click();
    await expect(dialog.getByRole('heading', { name: 'Carrito actualizado' })).toBeVisible();
    await expect(dialog.getByText('Cantidad: 2')).toBeVisible();
    await expect(header.locator('a[href="/carrito"]')).toHaveAttribute('aria-label', 'Carrito, 4');
    await shot(page, 'actualizado', width);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
    await add.click();
    await dialog.getByRole('button', { name: 'Cerrar' }).click();
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();

    const field = page.getByRole('spinbutton', { name: 'Cantidad' });
    await field.fill('2');
    await field.blur();
    await page.getByRole('button', { name: 'Guardar cantidad en el carrito' }).click();
    await expect(dialog.getByRole('heading', { name: 'Carrito actualizado' })).toBeVisible();
    await expect(dialog.getByText('Cantidad: 2')).toBeVisible();
    await dialog.getByRole('link', { name: 'Ver carrito' }).click();
    await expect(page).toHaveURL(base + '/carrito');
    await expect(total).toContainText('UYU 5.060');
    await page.getByRole('button', { name: 'Quitar Camisa de algodón blanca' }).click();
    await expect(total).toContainText('UYU 2.280');

    await page.goto(base + '/producto/remera-amplia-crudo');
    await expect(page.getByText('Sin stock', { exact: true })).toBeVisible();
    await expect(add).toHaveCount(0);
    await expect(dialog).toBeHidden();
    if (width === 320) {
      await page.route('**/__camba_demo/cart/items/2', (route) =>
        route.fulfill({
          status: 422,
          json: { errors: { quantity: ['Cantidad fuera del stock.'] } },
        }),
      );
      await page.goto(base + '/producto/camisa-algodon-blanca');
      await add.tap();
      await expect(page.getByRole('alert')).toContainText('No hay stock para agregar otra unidad');
      await expect(dialog).toBeHidden();
    }
    await page.route('**/demo/image-plain.webp', (route) => route.abort());
    await page.goto(base + '/carrito');
    await expect(line.locator('store-product-photo svg')).toBeVisible();
    await expect(total).toContainText('UYU 2.280');

    await page.goto(base + '/cuenta');
    await expect(page.getByRole('heading', { name: 'Direcciones guardadas' })).toBeVisible();
    await expect(page.getByText('Calle Muestra 120')).toBeVisible();
    await expect(page.getByText('Camino de Prueba 42')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recordatorios por correo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar preferencias' })).toHaveCount(0);
    await shot(page, 'cuenta', width);
    await page.getByRole('link', { name: 'Mis pedidos' }).click();
    await expect(page).toHaveURL(base + '/pedidos');
    await expect(page.getByText('Reserva vencida', { exact: true })).toBeVisible();
    for (const [state, color] of [
      ['Pago confirmado', 'rgb(237, 244, 237)'],
      ['Pendiente de pago', 'rgb(251, 245, 229)'],
      ['Reserva vencida', 'rgb(251, 239, 237)'],
    ]) {
      await expect(page.getByText(state, { exact: true })).toHaveCSS('background-color', color);
    }
    await shot(page, 'pedidos', width);
    for (const [stub, state] of [
      ['10000000', 'Pago confirmado'],
      ['20000000', 'Pendiente de pago'],
      ['30000000', 'Reserva vencida'],
    ]) {
      await page.getByRole('link', { name: 'Ver pedido ' + stub, exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Tu pedido', exact: true })).toBeVisible();
      await expect(page.getByText(state, { exact: true })).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Resumen del pedido' })).toContainText(
        'UYU',
      );
      if (width === 390) await shot(page, 'pedido-' + stub, width);
      await page.getByRole('link', { name: 'Ver compras', exact: true }).click();
      await expect(page).toHaveURL(base + '/pedidos');
    }
    await page.close();
    console.log(`Cart cover, real totals, confirmed modal and focus: ${width}px`);
  }
} finally {
  await browser.close();
}
