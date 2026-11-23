import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.CAMBA_PURCHASE_ORIGIN ?? 'http://127.0.0.1:44383';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let cart = {
  currency: 'UYU',
  items: [
    {
      product_id: 14,
      quantity: 1,
      available: true,
      product: { name: 'Camisa de algodón', slug: 'camisa-algodon', price_cents: 129000, stock: 5 },
    },
  ],
};
let orderBody;

await page.route('**/api/v1/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const json = (data, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) });
  if (url.pathname.endsWith('/auth/me')) return json(null, 401);
  if (url.pathname.endsWith('/account/addresses')) return json([]);
  if (url.pathname.endsWith('/cart/items/14') && request.method() === 'PUT') {
    cart.items[0].quantity = request.postDataJSON().quantity;
    return json(cart);
  }
  if (url.pathname.endsWith('/cart/items/14') && request.method() === 'DELETE') {
    cart.items = [];
    return route.fulfill({ status: 204 });
  }
  if (url.pathname.endsWith('/cart') && request.method() === 'GET') return json(cart);
  if (url.pathname.endsWith('/checkout/quote'))
    return json({
      items: [
        {
          product_id: 14,
          sku: 'CAM-014',
          name: 'Camisa de algodón',
          quantity: cart.items[0].quantity,
          unit_price_cents: 129000,
          line_total_cents: 129000 * cart.items[0].quantity,
        },
      ],
      subtotal_cents: 129000 * cart.items[0].quantity,
      shipping_options: [
        {
          method: 'pickup',
          shipping_cents: 0,
          total_cents: 129000 * cart.items[0].quantity,
          pickup_address: 'Centro, Montevideo',
          quote_token: 'demo-pickup',
        },
        {
          method: 'delivery',
          shipping_cents: 18500,
          total_cents: 129000 * cart.items[0].quantity + 18500,
          pickup_address: null,
          quote_token: 'demo-delivery',
        },
      ],
    });
  if (url.pathname.endsWith('/orders') && request.method() === 'POST') {
    orderBody = request.postDataJSON();
    return json(
      {
        reference: 'CAM-DEMO-014',
        status: 'pending_payment',
        fulfilment_status: 'preparing',
        subtotal_cents: 129000,
        shipping_cents: 0,
        total_cents: 129000,
        shipping_method: 'pickup',
        reservation_expires_at: '2026-12-01T12:00:00Z',
        created_at: '2026-11-22T12:00:00Z',
      },
      201,
    );
  }
  return route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Unmocked request blocked by purchase test.' }),
  });
});
await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));

try {
  await page.goto(`${origin}/carrito`);
  await page.getByRole('heading', { name: 'Tu carrito' }).waitFor();
  assert.equal(
    await page.locator('.purchase-layout').count(),
    1,
    'cart uses the refreshed purchase layout',
  );
  await page.getByRole('spinbutton', { name: 'Cantidad de Camisa de algodón' }).fill('2');
  const update = page.getByRole('button', { name: 'Actualizar' });
  await update.focus();
  assert.equal(
    await update.evaluate((node) => getComputedStyle(node).outlineWidth),
    '3px',
    'keyboard focus stays visible',
  );
  await update.click();
  await page.getByRole('status', { name: 'Carrito actualizado' }).waitFor();
  await page.getByRole('link', { name: 'Continuar la compra' }).click();
  await page.getByRole('group', { name: 'Datos de contacto' }).waitFor();
  await page.getByLabel('Nombre completo').fill('Compradora Demo');
  await page.getByLabel('Correo electrónico').fill('demo@camba.test');
  await page.getByRole('radio', { name: /Retiro/ }).check();
  assert.equal(
    await page.locator('.purchase-summary').count(),
    1,
    'checkout keeps a distinct order summary',
  );
  await page.setViewportSize({ width: 320, height: 800 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    320,
    'checkout fits a narrow viewport',
  );
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await page.waitForURL(/\/pedidos\/CAM-DEMO-014$/);
  assert.equal(orderBody.contact.email, 'demo@camba.test');
  assert.equal(orderBody.items[0].quantity, 2);
  assert.equal(orderBody.shipping_method, 'pickup');
  await page.goto(`${origin}/carrito`);
  await page.getByRole('button', { name: 'Quitar Camisa de algodón' }).click();
  await page.getByRole('heading', { name: 'Tu carrito está vacío' }).waitFor();
  cart = {
    currency: 'UYU',
    items: [
      {
        product_id: 14,
        quantity: 1,
        available: true,
        product: {
          name: 'Camisa de algodón',
          slug: 'camisa-algodon',
          price_cents: 129000,
          stock: 5,
        },
      },
    ],
  };
  await page.goto(`${origin}/carrito`);
  await page.getByRole('link', { name: 'Continuar la compra' }).click();
  await page.getByLabel('Nombre completo').fill('Compradora Demo');
  await page.getByLabel('Correo electrónico').fill('demo@camba.test');
  await page.getByRole('radio', { name: /Entrega a domicilio/ }).check();
  await page.getByLabel('Nombre de quien recibe').fill('Compradora Demo');
  await page.getByLabel('Departamento').fill('Montevideo');
  await page.getByLabel('Localidad').fill('Centro');
  await page.getByLabel('Calle').fill('18 de Julio');
  await page.getByLabel('Número de puerta').fill('1234');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await page.waitForURL(/\/pedidos\/CAM-DEMO-014$/);
  assert.equal(orderBody.shipping_method, 'delivery');
  assert.equal(orderBody.address.locality, 'Centro');
  console.log('PASS: cart quantity, guest checkout, pickup and order summary stay connected.');
} finally {
  await browser.close();
}
