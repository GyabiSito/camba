import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const store = 'http://127.0.0.1:4200';
const admin = 'http://127.0.0.1:4300';
const inbox = 'http://127.0.0.1:48025';
const out = 'test-results/order-notices-docker';
const adminEmail = 'admin.diseno@camba.test';
const adminPassword = process.env.CAMBA_DEMO_PASSWORD;
const productId = Number(process.env.CAMBA_QA_PRODUCT_ID);
const existing = process.env.CAMBA_QA_ORDER_REFERENCE;
assert(adminPassword && (existing ? /^[0-9a-f-]{36}$/.test(existing) : Number.isSafeInteger(productId) && productId > 0),
  'Set the documented demo password and a QA product ID or a completed QA order reference.');

const buyer = `qa-avisos-${randomUUID()}@camba.test`;
const buyerName = 'Lucía Fernández QA';
const password = `LocalQa!${randomUUID()}`;
const browser = await chromium.launch();

async function browserPage(origin) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return [store, admin].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.goto(origin);
  return page;
}

async function mutate(page, path, body, method = 'POST', extra = {}) {
  const origin = new URL(page.url()).origin;
  const csrf = await page.request.get(origin + '/sanctum/csrf-cookie', { headers: { Origin: origin } });
  assert.equal(csrf.status(), 204);
  const cookies = await page.context().cookies(origin);
  const csrfToken = decodeURIComponent(cookies.find(cookie => cookie.name === 'XSRF-TOKEN').value);
  return page.request.fetch(origin + path, {
    method, data: body, headers: { Origin: origin, Accept: 'application/json', 'X-XSRF-TOKEN': csrfToken, ...extra },
  });
}

async function messages(to, subject, reference = '') {
  const { messages } = await fetch(inbox + '/api/v1/messages?limit=100').then(r => r.json());
  return (await Promise.all(messages.filter(mail => mail.Subject === subject && mail.To.some(address => address.Address === to))
    .map(mail => fetch(inbox + '/api/v1/message/' + encodeURIComponent(mail.ID)).then(r => r.json()))))
    .filter(mail => mail.Text?.includes(reference));
}

async function received(to, subject, reference = '') {
  let found = [];
  await expect.poll(async () => (found = await messages(to, subject, reference)).length, { timeout: 45_000, message: subject }).toBe(1);
  return found[0];
}

function project() {
  execFileSync('docker', ['exec', 'camba-v2-demo-pg-scheduler-1', 'php', 'artisan', 'camba:notices'], { timeout: 20_000, stdio: 'pipe' });
}

function simulatePayment(reference) {
  assert.match(reference, /^[0-9a-f-]{36}$/);
  assert.match(buyer, /^qa-avisos-[0-9a-f-]{36}@camba\.test$/);
  // Only the order created by this run, matched against its synthetic checkout email. No payment provider or payment record.
  const script = `<?php
  require 'vendor/autoload.php';
  $app = require 'bootstrap/app.php';
  $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
  if (! app()->environment('local') || config('database.default') !== 'pgsql' || config('database.connections.pgsql.database') !== 'camba_v2_demo') throw new RuntimeException('Not the Docker demo.');
  Illuminate\\Support\\Facades\\DB::transaction(function () {
      $order = App\\Models\\Order::query()->where('reference', '${reference}')->lockForUpdate()->sole();
      if (($order->contact['email'] ?? null) !== '${buyer}' || $order->getRawOriginal('status') !== 'pending_payment'
          || $order->shipping_method !== 'delivery' || ! $order->reservation_expires_at->isFuture()) throw new RuntimeException('Unexpected QA order.');
      $order->forceFill(['status' => 'paid', 'paid_at' => now()])->save();
  });`;
  execFileSync('docker', ['exec', '-i', 'camba-v2-demo-pg-api-1', 'php'], { input: script, timeout: 20_000, stdio: 'pipe' });
}

async function createAndDeliver(seller) {
  const details = await seller.request.get(`${admin}/api/v1/admin/products/${productId}`, { headers: { Origin: admin, Accept: 'application/json' } });
  assert.equal(details.status(), 200);
  const { data: product } = await details.json();
  assert(product.status === 'published' && /^qa[-_]/i.test(product.slug) && product.stock > 1, 'Refusing to order a non-QA product.');

  const customer = await browserPage(store + '/cuenta');
  const registration = await mutate(customer, '/api/v1/auth/register', { name: buyerName, email: buyer, password, password_confirmation: password });
  assert.equal(registration.status(), 201);
  const verify = (await received(buyer, 'Verificá tu correo')).Text.match(/https?:\/\/[^\s<>]+/)?.[0];
  assert(verify?.startsWith(store + '/email/verify/'));
  assert.equal((await customer.request.get(verify, { headers: { Accept: 'application/json' } })).status(), 204);
  assert.equal((await mutate(customer, '/api/v1/auth/login', { email: buyer, password })).status(), 204);
  const account = await customer.request.get(store + '/api/v1/auth/me', { headers: { Origin: store, Accept: 'application/json' } });
  assert.equal(account.status(), 200);
  assert.equal((await account.json()).data.email, buyer);

  const items = [{ product_id: productId, quantity: 1 }];
  assert.equal((await mutate(customer, `/api/v1/cart/items/${productId}`, { quantity: 1 })).status(), 200);
  const quote = await mutate(customer, '/api/v1/checkout/quote', { items });
  assert.equal(quote.status(), 200);
  const shipping = (await quote.json()).data.shipping_options.find(option => option.method === 'delivery');
  assert(shipping, 'Delivery must be enabled in the local store.');
  const payload = { items, shipping_method: 'delivery', quote_token: shipping.quote_token,
    contact: { name: buyerName, email: buyer },
    address: { recipient: buyerName, department_id: 10, locality_id: 1052, street: 'Calle QA', number: '123' },
  };
  const key = { 'Idempotency-Key': randomUUID() };
  const created = await mutate(customer, '/api/v1/orders', payload, 'POST', key);
  assert.equal(created.status(), 201);
  const { data: order } = await created.json();
  assert.equal(order.status, 'pending_payment');
  const replay = await mutate(customer, '/api/v1/orders', payload, 'POST', key);
  assert.equal(replay.status(), 200);
  assert.equal((await replay.json()).data.reference, order.reference);

  project();
  const administrative = await received(adminEmail, 'Nuevo pedido en Camba', order.reference);
  assert(administrative.Text.includes('Pago: Pendiente de pago') && administrative.Text.includes('Modalidad: Envío'));
  const adminUrl = `${admin}/pedidos/${order.reference}`;
  assert(administrative.Text.includes(adminUrl) && administrative.HTML.includes(`href="${adminUrl}"`));
  await seller.goto(adminUrl);
  await expect(seller.getByRole('heading', { name: /^Pedido / })).toBeVisible();
  simulatePayment(order.reference);
  await seller.reload();

  const actionPath = `/api/v1/admin/orders/${order.reference}/fulfilment`;
  for (const label of ['Empezar preparación', 'Marcar como enviado', 'Marcar como entregado']) {
    const saved = seller.waitForResponse(r => new URL(r.url()).pathname === actionPath && r.request().method() === 'PATCH');
    await seller.getByRole('button', { name: label, exact: true }).click();
    assert.equal((await saved).status(), 200);
  }
  for (const status of ['shipped', 'completed']) {
    assert.equal((await mutate(seller, actionPath, { status }, 'PATCH')).status(), 409);
  }
  project();
  return order;
}

try {
  await mkdir(out, { recursive: true });
  const seller = await browserPage(admin + '/ingresar');
  await seller.getByLabel('Correo electrónico').fill(adminEmail);
  await seller.getByLabel('Contraseña', { exact: true }).fill(adminPassword);
  await seller.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(seller.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible();

  let order;
  if (existing) {
    const response = await seller.request.get(`${admin}/api/v1/admin/orders/${existing}`, { headers: { Origin: admin, Accept: 'application/json' } });
    assert.equal(response.status(), 200);
    order = (await response.json()).data;
    assert.equal(order.fulfilment_status, 'completed');
  } else {
    order = await createAndDeliver(seller);
  }
  const recipient = order.contact.email;
  assert.match(recipient, /^qa-avisos-[0-9a-f-]{36}@camba\.test$/);
  const administrative = await received(adminEmail, 'Nuevo pedido en Camba', order.reference);
  assert(administrative.Text.includes('Pago: Pendiente de pago') && administrative.Text.includes('Modalidad: Envío'));
  assert(administrative.HTML.includes(`href="${admin}/pedidos/${order.reference}"`));
  const shipment = 'Camba: enviamos tu pedido';
  const delivery = 'Tu pedido fue entregado';
  for (const subject of [shipment, delivery]) {
    const mail = await received(recipient, subject, order.reference);
    assert(mail.Text.includes(`${store}/pedidos/${order.reference}`));
  }
  if (!existing) project();
  for (const [to, subject] of [[adminEmail, 'Nuevo pedido en Camba'], [recipient, shipment], [recipient, delivery]]) {
    assert.equal((await messages(to, subject, order.reference)).length, 1);
  }

  const nav = seller.getByRole('navigation', { name: 'Administración' });
  await nav.getByRole('link', { name: 'Pedidos', exact: true }).click();
  const row = seller.getByRole('listitem').filter({ has: seller.getByRole('link', { name: `Ver pedido ${order.reference}` }) });
  await expect(row.getByRole('group', { name: 'Pago del pedido' })).toContainText('Pagado');
  await expect(row.getByRole('group', { name: 'Entrega del pedido' })).toContainText('Entregado');
  await seller.screenshot({ path: `${out}/pedidos.png`, animations: 'disabled' });
  await nav.getByRole('link', { name: 'Avisos', exact: true }).click();
  await expect(seller.getByLabel('Estado del aviso')).toHaveValue('active');
  await expect(seller.getByRole('link', { name: `Ver pedido ${order.reference.slice(0, 8).toUpperCase()}` }).first()).toBeVisible();
  await seller.screenshot({ path: `${out}/avisos.png`, animations: 'disabled' });
  await seller.getByLabel('Estado del aviso').selectOption('resolved');
  await expect(seller).toHaveURL(/state=resolved/);
  await seller.getByLabel('Estado del aviso').selectOption('all');
  await expect(seller).toHaveURL(/state=all/);
  console.log(`PASS ${order.reference}: pending admin mail ×1, buyer shipment ×1 and receipt ×1; ${existing ? 'existing QA evidence only' : 'replays 200/409/409; real queue, no provider'}.`);
} finally {
  await browser.close();
}
