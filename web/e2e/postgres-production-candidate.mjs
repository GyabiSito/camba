import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const store = process.env.CAMBA_APP_URL;
const admin = process.env.CAMBA_ADMIN_URL;
const password = process.env.CAMBA_PG_FIXTURE_PASSWORD;
for (const origin of [store, admin]) {
  assert.match(origin ?? '', /^http:\/\/127\.0\.0\.1:\d+$/, 'Use only disposable loopback origins');
}
assert.notEqual(store, admin);
assert.match(password ?? '', /^[a-f0-9]{32}$/, 'Use the generated rehearsal password');

for (const url of [store + '/ready', store + '/tienda', admin + '/ingresar']) {
  assert.equal((await fetch(url, { signal: AbortSignal.timeout(10_000) })).status, 200, url);
}

const browser = await chromium.launch();
async function open() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.route('**/*', route => [store, admin].includes(new URL(route.request().url()).origin)
    ? route.continue() : route.abort());
  return page;
}

try {
  const shopper = await open();
  await shopper.goto(store + '/cuenta');
  await shopper.getByLabel('Correo electrónico').fill('postgres-buyer@camba.test');
  await shopper.getByLabel('Contraseña', { exact: true }).fill(password);
  await shopper.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(shopper.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  await shopper.goto(store + '/tienda');
  const hydrated = shopper.waitForResponse(response =>
    response.url() === store + '/api/v1/cart' && response.request().method() === 'GET');
  await shopper.getByRole('link', { name: 'Remera PostgreSQL QA', exact: true }).click();
  assert.equal((await hydrated).status(), 200);
  const added = shopper.waitForResponse(response =>
    response.url().startsWith(store + '/api/v1/cart/items/') && response.request().method() === 'POST');
  await shopper.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
  assert.equal((await added).status(), 200);
  await shopper.getByRole('dialog').getByRole('button', { name: 'Seguir comprando' }).click();
  await shopper.goto(store + '/carrito');
  await shopper.getByRole('spinbutton', { name: 'Cantidad de Remera PostgreSQL QA' }).fill('2');
  await shopper.getByRole('button', { name: 'Actualizar' }).click();
  await expect(shopper.getByRole('status', { name: 'Carrito actualizado' })).toBeVisible();
  await shopper.getByRole('link', { name: 'Continuar la compra' }).click();
  await expect(shopper.getByRole('heading', { name: 'Resumen de la compra' })).toBeVisible();
  await shopper.getByLabel('Nombre completo').fill('Persona PostgreSQL QA');
  await shopper.getByLabel('Correo electrónico').fill('postgres-buyer@camba.test');
  await shopper.getByRole('radio', { name: /Retiro/ }).check();
  const confirmation = shopper.waitForResponse(response =>
    response.url() === store + '/api/v1/orders' && response.request().method() === 'POST',
  );
  await shopper.getByRole('button', { name: 'Confirmar pedido' }).click();
  const placed = await confirmation;
  assert.equal(placed.status(), 201);
  const order = (await placed.json()).data;
  assert.equal(order.total_cents, 24690);
  assert.equal(order.status, 'pending_payment');
  assert.match(order.reference, /^[0-9a-f-]{36}$/);
  await expect(shopper.getByRole('heading', { name: 'Tu pedido' })).toBeVisible();

  const operator = await open();
  await operator.goto(admin + '/pedidos/' + order.reference);
  await operator.getByLabel('Correo electrónico').fill('postgres-admin@camba.test');
  await operator.getByLabel('Contraseña').fill(password);
  const details = operator.waitForResponse(response => response.ok() &&
    response.url() === admin + '/api/v1/admin/orders/' + order.reference);
  await operator.getByRole('button', { name: 'Ingresar', exact: true }).click();
  const recorded = (await (await details).json()).data;
  assert.equal(recorded.reference, order.reference);
  assert.equal(recorded.total_cents, order.total_cents);
  assert.equal(recorded.items[0].quantity, 2);
  await expect(operator.getByRole('heading', { name: /^Pedido / })).toBeVisible();
  console.log(JSON.stringify({ catalog: 200, order: placed.status(), admin_order: 200, reference: order.reference }));
} finally {
  await browser.close();
}
