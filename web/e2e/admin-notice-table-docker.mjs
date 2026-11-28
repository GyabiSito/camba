import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4300';
const output = 'test-results/admin-notice-table-docker';
const password = process.env.CAMBA_DEMO_PASSWORD;
assert(password, 'Set CAMBA_DEMO_PASSWORD to the documented Docker-only demo password.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  const table = page.getByRole('table', { name: 'Avisos operativos' });
  const status = page.getByLabel('Estado del aviso');
  const kind = page.getByLabel('Tipo de aviso');
  const search = page.getByRole('searchbox', { name: 'Buscar aviso' });
  async function read(path) {
    const response = await page.request.get(origin + path, { headers: { Origin: origin, Accept: 'application/json' } });
    assert.equal(response.status(), 200, path);
    return response.json();
  }
  await page.goto(origin + '/ingresar');
  await page.getByLabel('Correo electrónico').fill('admin.diseno@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.getByRole('navigation', { name: 'Administración' }).getByRole('link', { name: 'Avisos', exact: true }).click();
  await expect(status).toHaveValue('active');
  await status.selectOption('all');
  const all = await read('/api/v1/admin/notices');
  assert(all.meta.total > 25, 'Use a demo with at least 26 visible notices.');
  await expect(page.getByRole('status').filter({ hasText: `${all.meta.total} avisos` })).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveText(['Aviso', 'Fecha', 'Canal', 'Estado', 'Registro']);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/avisos-tabla.png`, animations: 'disabled' });

  await page.getByRole('link', { name: 'Siguiente', exact: true }).click();
  await expect(page).toHaveURL(url => url.searchParams.get('state') === 'all' && url.searchParams.get('page') === '2');
  const second = await read('/api/v1/admin/notices?page=2');
  const target = second.data.find(row => row.order_reference && ['active', 'resolved'].includes(row.state));
  assert(target && !all.data.some(row => row.id === target.id), 'A visible order notice must originate on page two.');
  const prefix = target.order_reference.slice(0, 8).toUpperCase();
  const orderLink = table.getByRole('link', { name: `Ver pedido ${prefix}`, exact: true }).first();
  await orderLink.click();
  await expect(page).toHaveURL(url => url.pathname === `/pedidos/${target.order_reference}`);
  await page.reload();
  await page.getByRole('link', { name: 'Volver a avisos' }).click();
  await expect(page).toHaveURL(url => url.searchParams.get('state') === 'all' && url.searchParams.get('page') === '2');
  await expect(orderLink).toBeVisible();

  await search.fill(prefix);
  await expect(page).toHaveURL(url => url.searchParams.get('q') === prefix && !url.searchParams.has('page'));
  await expect(orderLink).toBeVisible();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(target.updated_at));
  await kind.selectOption(target.kind);
  await status.selectOption(target.state);
  await page.getByLabel('Desde', { exact: true }).fill(day);
  await page.getByLabel('Hasta', { exact: true }).fill(day);
  await expect(page).toHaveURL(url => url.searchParams.get('q') === prefix && !url.searchParams.has('page')
    && url.searchParams.get('kind') === target.kind && (url.searchParams.get('state') ?? 'active') === target.state
    && url.searchParams.get('date_from') === day && url.searchParams.get('date_to') === day);
  const combined = new URLSearchParams({ q: prefix, state: target.state, kind: target.kind, date_from: day, date_to: day });
  const matches = await read('/api/v1/admin/notices?' + combined);
  assert(matches.data.some(row => row.id === target.id));
  assert(matches.meta.total < all.meta.total && matches.data.every(row => row.state === target.state && row.kind === target.kind));
  await expect(page.getByRole('status').filter({ hasText: new RegExp(`^${matches.meta.total} avisos?$`) })).toBeVisible();
  await expect(orderLink).toBeVisible();
  await page.getByLabel('Hasta', { exact: true }).blur();
  await page.screenshot({ path: `${output}/avisos-filtros.png`, animations: 'disabled' });
  await table.locator(`a[href^="/pedidos/${target.order_reference}?"]`).click();
  await expect(page).toHaveURL(url => url.pathname === `/pedidos/${target.order_reference}`);
  await page.getByRole('link', { name: 'Volver a avisos' }).click();
  await expect(search).toHaveValue(prefix);
  await expect(kind).toHaveValue(target.kind);
  await expect(page.getByLabel('Hasta', { exact: true })).toHaveValue(day);

  for (const record of [/^Ver producto \d+$/, /^Ver carga \d+$/]) {
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(status).toHaveValue('active');
    const link = table.getByRole('link', { name: record }).first();
    const path = new URL(await link.getAttribute('href'), origin).pathname;
    await link.click();
    await expect(page).toHaveURL(url => url.pathname === path);
    const apiPath = path.replace('/productos/importar/', '/api/v1/admin/catalog-imports/').replace('/productos/', '/api/v1/admin/products/');
    await read(apiPath);
    await page.getByRole('link', { name: 'Volver a avisos' }).click();
    await expect(page).toHaveURL(origin + '/pedidos/avisos');
    // The next iteration still needs a non-default state to exercise clearing.
    await status.selectOption('all');
  }
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(status).toHaveValue('active');
  await search.fill('Pago aprobado');
  await expect(page).toHaveURL(url => url.searchParams.get('q') === 'Pago aprobado');
  await expect(table.getByRole('rowheader', { name: /Pago aprobado/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(table.getByRole('link', { name: /^Ver pedido/ }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  console.log(`PASS: ${all.meta.total} avisos; referencia ${prefix} encontrada desde página 2; ${matches.meta.total} coincidencias con filtros combinados; regreso y enlaces verificados.`);
} finally {
  await browser.close();
}
