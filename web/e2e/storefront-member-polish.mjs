import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env['CAMBA_MEMBER_BASE_URL'] ?? 'http://127.0.0.1:44861';
const shots = path.join(os.tmpdir(), 'camba-storefront-member-polish');
const buyer = {
  id: 812,
  name: 'Lucía Acosta',
  email: 'lucia.acosta@example.test',
  role: 'buyer',
  email_verified: true,
};
const addresses = [
  {
    id: 501,
    recipient: 'Lucía Acosta',
    department: 'Montevideo',
    locality: 'Cordón',
    street: 'Gaboto',
    number: '1234',
    details: null,
    phone: null,
    postal_code: null,
  },
  {
    id: 502,
    recipient: 'Lucía Acosta',
    department: 'Canelones',
    locality: 'Las Piedras',
    street: 'Rivera',
    number: '56',
    details: 'Casa al fondo',
    phone: '099123456',
    postal_code: '90200',
  },
];
const orders = ['paid', 'pending_payment', 'payment_expired'].map((status, index) => ({
  reference: `0000000${index + 1}-1111-4111-8111-111111111111`,
  status,
  fulfilment_status: 'preparing',
  subtotal_cents: 325000,
  shipping_cents: 0,
  total_cents: 325000,
  shipping_method: index === 1 ? 'pickup' : 'delivery',
  reservation_expires_at: '2026-12-01T12:00:00Z',
  created_at: `2026-11-${20 - index}T12:00:00Z`,
}));

const browser = await chromium.launch({ headless: true });
await mkdir(shots, { recursive: true });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      const body = url.pathname.endsWith('/auth/me')
        ? { data: buyer }
        : url.pathname.endsWith('/account/addresses')
          ? { data: addresses }
          : url.pathname.endsWith('/account/reminder-preferences')
            ? { data: { payment_reminders: true, cart_reminders: false } }
            : url.pathname.endsWith('/orders')
              ? { data: orders, meta: { current_page: 1, last_page: 1 } }
              : null;
      if (body) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      } else {
        await route.continue();
      }
    });

    await page.goto(new URL('/cuenta', baseUrl).href);
    await page.getByRole('heading', { name: 'Datos personales' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Mis pedidos' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Cerrar sesión' }).count(), 1);
    assert.equal(await page.getByText('Gaboto 1234').count(), 1);
    assert.equal(await page.getByText('Cordón, Montevideo').count(), 1);
    assert.equal(await page.getByText('Rivera 56').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Editar Gaboto 1234' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Agregar dirección' }).count(), 1);
    assert.equal(await page.getByRole('heading', { name: 'Recordatorios por correo' }).count(), 1);
    assert.equal(await page.getByText('Los recordatorios por correo no están disponibles en la demo.').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Cargar preferencias' }).count(), 0);
    assert.equal(await page.locator('.account-columns details, .account-reminders details').count(), 0);
    const accountColumns = await page.locator('.account-columns').evaluate((node) => getComputedStyle(node).gridTemplateColumns);
    if (width > 704) assert.equal(accountColumns.trim().split(/\s+/).length, 2);
    else assert.equal(accountColumns.trim().split(/\s+/).length, 1);
    await page.screenshot({ path: path.join(shots, `account-${width}.png`), fullPage: true });

    await page.goto(new URL('/pedidos', baseUrl).href);
    await page.getByRole('heading', { name: /Pedido del/ }).first().waitFor();
    for (const label of ['Pago confirmado', 'Pendiente de pago', 'Reserva vencida']) {
      assert.equal(await page.getByText(label, { exact: true }).count(), 1);
    }
    assert.equal(await page.getByRole('link', { name: /Ver pedido/ }).count(), 3);
    assert.equal(await page.locator('.order-total').count(), 3);
    assert.equal(await page.locator('.order-total .money').filter({ hasText: 'UYU' }).count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    await page.screenshot({ path: path.join(shots, `orders-${width}.png`), fullPage: true });
    await page.close();
  }
  process.stdout.write(`Member polish checks passed at 1440, 390, and 320px. Screenshots: ${shots}\n`);
} finally {
  await browser.close();
}
