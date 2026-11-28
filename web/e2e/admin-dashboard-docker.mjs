import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4300';
const api = '/api/v1/admin';
const password = process.env.CAMBA_DEMO_PASSWORD;
assert(password, 'Set CAMBA_DEMO_PASSWORD to the documented local demo password.');
const output = new URL('../dist/artifacts/admin-dashboard/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce', locale: 'es-UY' });
const page = await context.newPage();
const cases = [
  { metric: 'pending_payment', list: '/pedidos', endpoint: '/orders', query: { status: 'pending_payment' } },
  { metric: 'needs_preparation', list: '/pedidos', endpoint: '/orders', query: { status: 'paid', fulfilment_status: 'needs_preparation' } },
  { metric: 'ready_for_pickup', list: '/pedidos', endpoint: '/orders', query: { status: 'paid', fulfilment_status: 'ready_for_pickup' } },
  { metric: 'out_of_stock', list: '/productos', endpoint: '/products', query: { status: 'published', availability: 'out_of_stock' } },
];

function matches(url, path, query = {}) {
  const parsed = new URL(url, origin);
  return parsed.origin === origin && parsed.pathname === path && Object.entries(query).every(([name, value]) => parsed.searchParams.get(name) === value);
}

async function login(target, entry) {
  await target.goto(origin + entry);
  await target.getByLabel('Correo electrónico').fill('admin.diseno@camba.test');
  await target.getByLabel('Contraseña', { exact: true }).fill(password);
  await target.getByRole('button', { name: 'Ingresar', exact: true }).click();
}

async function get(path) {
  const res = await page.request.get(origin + api + path, { headers: { Accept: 'application/json', Referer: origin + '/' } });
  assert.equal(res.status(), 200, path);
  return res.json();
}

const screenshot = (target, name) => target.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true, animations: 'disabled' });

try {
  const loaded = page.waitForResponse(response => matches(response.url(), api + '/dashboard'));
  await login(page, '/ingresar');
  await expect(page).toHaveURL(origin + '/dashboard');
  const response = await loaded;
  assert.equal(response.status(), 200);
  assert.match(response.headers()['cache-control'], /no-store/);
  const { data } = await response.json();
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Administración' });
  await expect(navigation.getByRole('link').first()).toHaveText('Inicio');
  await expect(navigation.getByRole('link').first()).toHaveAttribute('aria-current', 'page');

  const fullOrders = await get('/orders');
  assert.deepEqual(data.recent_orders, fullOrders.data.slice(0, 5));
  assert.equal(data.recent_orders.length, 5);
  for (const order of data.recent_orders) {
    assert(!('contact' in order) && !('address' in order));
    await expect(page.getByRole('link', { name: `Ver pedido ${order.reference}`, exact: true })).toBeVisible();
  }
  const columns = await page.evaluate(() => ['.recent-labels', '.recent-orders .recent-row'].map(selector =>
    [...document.querySelector(selector).children].map(cell => cell.getBoundingClientRect().left)));
  assert.deepEqual(columns[0], columns[1], 'Desktop column headings line up with order rows.');

  // Validate these live demo confirmations from the existing paid orders and evidence endpoints, not from payment rows.
  const confirmedOrder = '00000000-0000-4000-8000-000000000101';
  const paid = await get('/orders?status=paid');
  assert.equal(paid.meta.last_page, 1, 'The Docker demo contains at most one page of paid orders.');
  const localDay = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: data.sales.timezone });
  let count = 0, cents = 0, confirmedIncluded = false;
  for (const order of paid.data) {
    const { payment } = await get(`/orders/${order.reference}`);
    if (!payment.paid_at) continue;
    const date = localDay.format(new Date(payment.paid_at));
    if (date < data.sales.from || date > data.sales.through) continue;
    count++;
    cents += order.total_cents;
    if (confirmedOrder === order.reference) confirmedIncluded = true;
  }
  assert(confirmedIncluded, 'The existing seeded confirmed order must be in the demo 30-day window.');
  assert.equal(data.sales.order_count, count);
  assert.equal(data.sales.total_cents, cents);
  assert.equal(data.sales.months.length, 6);
  await expect(page.getByRole('heading', { name: 'Ventas confirmadas' })).toBeVisible();
  const digits = cents % 100 ? 2 : 0;
  const amount = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', currencyDisplay: 'code', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
  await expect(page.getByText(amount, { exact: true }).first()).toBeVisible();

  for (const [width, height] of [[1440, 960], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    if (width !== 320) await screenshot(page, `dashboard-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 960 });

  for (const [label, path] of [['Nuevo producto', '/productos/nuevo'], ['Carga masiva', '/productos/importar'], ['Editar portada', '/portada'], ['Ver todos los pedidos', '/pedidos']]) {
    await page.goto(origin + '/dashboard');
    const link = page.getByRole('link', { name: label, exact: true });
    await expect(link).toHaveAttribute('href', path);
    await link.click();
    await expect(page).toHaveURL(origin + path);
  }
  await page.goto(origin + '/dashboard');
  await page.getByRole('link', { name: `Ver pedido ${data.recent_orders[0].reference}`, exact: true }).click();
  await expect(page).toHaveURL(`${origin}/pedidos/${data.recent_orders[0].reference}`);

  const evidence = [];
  for (const { metric, list, endpoint, query } of cases) {
    await page.goto(origin + '/dashboard');
    const filters = Object.entries(query).map(([key, value]) => `[href*="${key}=${value}"]`).join('');
    const link = page.locator(`a[href^="${list}?"]${filters}`);
    await expect(link).toBeVisible();
    await expect(link).toContainText(String(data.priorities[metric]));
    const filteredResponse = page.waitForResponse(res => matches(res.url(), api + endpoint, query));
    await link.click();
    await expect.poll(() => matches(page.url(), list, query)).toBe(true);
    const filtered = await filteredResponse;
    assert.equal(filtered.status(), 200);
    const body = await filtered.json();
    assert.equal(body.meta.total, data.priorities[metric]);
    if (metric === 'pending_payment') {
      assert(body.data.length > 0 && body.data.every(order => order.status === 'pending_payment'));
      await expect(page.getByRole('link', { name: `Ver pedido ${body.data[0].reference}`, exact: true })).toBeVisible();
    } else if (metric === 'out_of_stock') {
      assert(body.data.length > 0 && body.data.every(product => product.stock <= 0 && product.status === 'published'));
      await expect(page.getByRole('link', { name: body.data[0].name, exact: true }).first()).toBeVisible();
    }
    evidence.push({ metric, url: filtered.url(), total: body.meta.total });
  }

  const cold = await browser.newContext();
  try {
    const direct = await cold.newPage();
    const entry = '/pedidos?status=pending_payment';
    await login(direct, entry);
    await expect(direct).toHaveURL(origin + entry);
  } finally { await cold.close(); }
  await writeFile(new URL('docker-verification.json', output), JSON.stringify({
    dashboard: '/dashboard', evidence, recentCount: data.recent_orders.length, pendingInRecent: data.recent_orders.some(order => order.status === 'pending_payment'),
    sales: { order_count: count, total_cents: cents, timezone: data.sales.timezone },
  }, null, 2));
  console.log(`Dashboard, quick actions, four live filters, five recent orders and ${count} confirmed sale(s) verified; no demo data changed.`);
} finally { await browser.close(); }
