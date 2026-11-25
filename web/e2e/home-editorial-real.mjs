import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

test('real SSR handles unavailable, empty and sparse catalogs without demo assets', async () => {
  let state = 'unavailable';
  const category = { id: 1, name: 'Remeras', slug: 'remeras' };
  const product = {
    id: 1, sku: 'FIXTURE-A', slug: 'fixture-a', name: 'Remera de prueba de SSR',
    description: null, price_cents: 123450, stock: 0, in_stock: false,
    category, brand: null, images: [],
  };
  const fixture = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url?.startsWith('/api/v1/products?')) {
      if (state === 'unavailable') { res.writeHead(503).end('{}'); return; }
      const data = state === 'sparse' ? [product] : [];
      res.end(JSON.stringify({ data, meta: { current_page: 1, last_page: 1, total: data.length } }));
      return;
    }
    res.writeHead(404).end('{}');
  });
  fixture.listen(0, '127.0.0.1');
  await once(fixture, 'listening');
  const port = 44827;
  const root = 'http://127.0.0.1:' + port;
  const entry = process.env.CAMBA_REAL_SSR ?? 'dist/store/server/server.mjs';
  const store = spawn(process.execPath, [entry], {
    env: {
      ...process.env, PORT: String(port), NG_ALLOWED_HOSTS: '127.0.0.1,localhost',
      CAMBA_SSR_API_ORIGIN: 'http://127.0.0.1:' + fixture.address().port,
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  let browser;
  try {
    let healthy = false;
    for (let retries = 0; retries < 40 && !healthy && store.exitCode === null; retries++) {
      healthy = await fetch(root + '/healthz').then(res => res.ok, () => false);
      if (!healthy) await delay(100);
    }
    assert(healthy, 'real SSR server is healthy');
    const unavailable = await fetch(root + '/');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get('cache-control'), 'no-store');
    const errorHtml = await unavailable.text();
    assert.match(errorHtml, /No pudimos cargar los productos/);
    assert.match(errorHtml, /Volver a intentar/);
    assert.doesNotMatch(errorHtml, /atelier-hero|\/demo-home\//);
    state = 'empty';
    const empty = await fetch(root + '/');
    assert.equal(empty.status, 200);
    assert.match(await empty.text(), /Todavía no hay productos publicados/);
    state = 'sparse';
    browser = await chromium.launch();
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 320, height: 740 } });
    assert.equal((await page.goto(root)).status(), 200);
    await expect(page.getByRole('region', { name: 'Explorá por categoría' }).getByRole('link')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Remera de prueba de SSR' })).toBeVisible();
    await expect(page.getByText('UYU 1.234,50')).toBeVisible();
    await expect(page.getByText('Sin stock')).toBeVisible();
    await expect(page.getByText('Foto no disponible')).toBeVisible();
    await expect(page.locator('.shelf-filters')).toHaveCount(0);
    await expect(page.locator('img[src*="/demo-home/"]')).toHaveCount(0);
    await expect(page.locator('.closing-mosaic')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ver la prenda' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Editorial de Camba' })).toHaveCount(0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    assert.equal((await fetch(root + '/demo-home/atelier-hero-wide.webp')).status, 404);
    assert.equal((await fetch(root + '/__camba_demo/cart', {
      headers: { 'X-Camba-Demo': '1', Cookie: 'camba_demo_store=1' },
    })).status, 404);

    const contact = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await contact.route('**/api/v1/store-info', route => route.fulfill({
      json: { data: { business_name: 'Camba', support_email: 'contacto@example.test', support_phone: '+59829000000' } },
    }));
    await contact.goto(root);
    const channels = contact.getByRole('contentinfo').getByRole('region', { name: 'Contacto' });
    await expect(channels).toHaveAttribute('id', 'canales');
    await expect(contact.getByRole('contentinfo').locator('.home-footer-main > :nth-child(4)')).toHaveAttribute('id', 'canales');
    await expect(channels.getByRole('link', { name: 'contacto@example.test' })).toHaveAttribute('href', 'mailto:contacto@example.test');
    await expect(channels.getByRole('link', { name: '+59829000000' })).toHaveAttribute('href', 'tel:+59829000000');
    await expect(contact.getByRole('banner').getByRole('link', { name: 'Inicio', exact: true })).toHaveAttribute('href', '/');
    await expect(contact.getByRole('banner').getByRole('link', { name: 'Contacto', exact: true })).toHaveCount(0);
    await expect(channels).toBeVisible();
  } finally {
    await browser?.close();
    if (store.exitCode === null) store.kill();
    fixture.close();
  }
});

