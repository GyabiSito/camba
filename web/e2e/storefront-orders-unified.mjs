import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import express from 'express';
import { chromium, expect } from '@playwright/test';

// Isolated normal API contract fixture: no database, live provider or storefront on 4200.
const disabled = process.argv.includes('--no-payment');
const port = disabled ? 44942 : 44940;
const origin = `http://127.0.0.1:${port}`;
const reference = '20000000-0000-4000-8000-000000000002';
const orderPath = '/pedidos/' + reference;
const app = express();
const attempts = [];
let refreshes = 0;
let reads = 0;
let attempt = { status: 'initiating', checkout_url: null };
let order = {
  reference,
  status: 'pending_payment',
  fulfilment_status: 'preparing',
  subtotal_cents: 79000,
  shipping_cents: 0,
  total_cents: 79000,
  shipping_method: 'pickup',
  pickup_address: 'Mostrador Camba',
  created_at: new Date().toISOString(),
  reservation_expires_at: new Date(Date.now() + 3600000).toISOString(),
  items: [
    {
      product_id: 1,
      sku: 'FIXTURE',
      name: 'Remera lisa',
      quantity: 1,
      unit_price_cents: 79000,
      line_total_cents: 79000,
    },
  ],
};
app.get('/api/v1/store-info', (_req, res) =>
  res.json({
    data: {
      business_name: 'Camba',
      support_email: null,
      support_phone: null,
      pickup_address: null,
      delivery_cents: null,
      checkout_pro_available: !disabled,
    },
  }),
);
app.get('/api/v1/cart', (_req, res) => res.json({ data: { currency: 'UYU', items: [] } }));
app.get('/api/v1/auth/me', (_req, res) => res.sendStatus(401));
app.get('/sanctum/csrf-cookie', (_req, res) => res.sendStatus(204));
app.get('/api/v1/orders/' + reference, (_req, res) => {
  reads++;
  res.json({ data: order });
});
app.get('/api/v1/orders', (_req, res) =>
  res.json({ data: [order], meta: { current_page: 1, last_page: 1 } }),
);
app.post('/api/v1/orders/' + reference + '/payments', async (req, res) => {
  attempts.push(req.get('Idempotency-Key'));
  await new Promise((resolve) => setTimeout(resolve, 150));
  res.status(attempt.status === 'ready' ? 201 : 202).json({ data: attempt });
});
app.post('/api/v1/orders/' + reference + '/payments/refresh', (_req, res) => {
  refreshes++;
  res.status(202).end();
});
const api = app.listen(port + 1, '127.0.0.1');
const child = spawn(
  process.execPath,
  [
    'node_modules/@angular/cli/bin/ng.js',
    'serve',
    'store',
    '--configuration',
    disabled ? 'no-payment' : 'development',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--proxy-config',
    'proxy.conf.cjs',
  ],
  {
    windowsHide: true,
    env: {
      ...process.env,
      CAMBA_DEV_API_ORIGIN: `http://127.0.0.1:${port + 1}`,
      CAMBA_SSR_API_ORIGIN: `http://127.0.0.1:${port + 1}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
child.stdout.on('data', (chunk) => {
  logs += chunk;
});
child.stderr.on('data', (chunk) => {
  logs += chunk;
});
let browser;
try {
  for (let count = 0; ; count++) {
    try {
      if ((await fetch(origin + orderPath)).ok) break;
    } catch {}
    if (count === 180 || child.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(origin + orderPath + '?merchant_order_id=123');
  await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(origin + orderPath);
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
    'href',
    new RegExp('^\\.?' + orderPath + '#contenido$'),
  );
  const pay = page.getByRole('button', { name: 'Pagar con Mercado Pago', exact: true });
  if (disabled) {
    await expect(pay).toHaveCount(0);
    const refresh = page.getByRole('button', { name: 'Consultar estado del pago' });
    await expect(refresh).toBeEnabled();
    const before = reads;
    await refresh.evaluate((button) => {
      button.click();
      button.click();
    });
    await expect.poll(() => reads).toBe(before + 1);
    await expect(page.getByText('El estado sigue pendiente.', { exact: false })).toBeVisible();
    await expect(refresh).toBeEnabled();
    assert.equal(reads, before + 1, 'double status check produces a single order GET');
    await page.route('**/api/v1/orders/' + reference, (route) => route.abort(), { times: 1 });
    await refresh.click();
    await expect(page.getByRole('alert')).toContainText(
      'No hay conexión con Camba. Volvé a intentarlo.',
    );
    await expect(page.getByText('El estado sigue pendiente.', { exact: false })).toHaveCount(0);
    assert.equal(refreshes, 0);
    assert.deepEqual(attempts, []);
    await page.reload();
    await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible();
    await expect(pay).toHaveCount(0);
  } else {
    await expect(pay).toBeEnabled();
    await pay.click();
    await expect(page.getByText(/Estamos preparando el enlace/)).toBeVisible();
    await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible();
    const retry = page.getByRole('button', { name: 'Reintentar apertura del pago' });
    // A response loss is uncertain, not confirmation, and retries retain their identity.
    await page.route('**/payments', (route) => route.abort(), { times: 1 });
    await retry.click();
    await expect(page.getByRole('alert')).toContainText('No pudimos abrir Mercado Pago');
    attempt = { status: 'ready', checkout_url: 'http://provider.invalid/unsafe' };
    await retry.click();
    await expect(page.getByText(/Estamos preparando el enlace/)).toBeVisible();
    await expect(page).toHaveURL(origin + orderPath);
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      new RegExp('^\\.?' + orderPath + '#contenido$'),
    );
    attempt = { status: 'ready', checkout_url: 'https://provider.invalid/checkout' };
    let redirected = false;
    await page.route('https://provider.invalid/**', (route) => {
      redirected = true;
      return route.fulfill({ body: 'Provider fixture' });
    });
    await retry.evaluate((button) => {
      button.click();
      button.click();
    });
    await expect.poll(() => redirected).toBe(true);
    assert.equal(attempts.length, 3, 'busy guard prevents duplicate provider requests');
    assert.match(attempts[0], /^[0-9a-f-]{36}$/i);
    assert.ok(attempts.every((key) => key === attempts[0]));
    const before = refreshes;
    await page.goto(origin + orderPath + '?status=approved&payment_id=100&merchant_order_id=123');
    await expect.poll(() => refreshes).toBeGreaterThan(before);
    await expect(page).toHaveURL(origin + orderPath);
    await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      new RegExp('^\\.?' + orderPath + '#contenido$'),
    );
    order = { ...order, status: 'paid' };
    await expect(page.getByText('Pago confirmado', { exact: true })).toBeVisible();
    await expect(page.getByText('El pago figura confirmado.', { exact: false })).toBeVisible();
    await expect(pay).toHaveCount(0);
  }
  await mkdir('test-results/storefront-orders-unified', { recursive: true });
  await page.screenshot({
    path: `test-results/storefront-orders-unified/${disabled ? 'unavailable' : 'confirmed'}.png`,
    fullPage: true,
  });
  console.log(
    `PASS ${disabled ? 'disabled GET-only payment actions' : 'normal ready/initiating, retry, HTTPS, busy guard, authoritative return'} contract`,
  );
} finally {
  await browser?.close();
  child.kill();
  api.close();
}
