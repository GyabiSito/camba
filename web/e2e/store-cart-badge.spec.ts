import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const item = (product_id: number, name: string, quantity: number) => ({
  product_id, quantity, available: true,
  product: { name, slug: 'qa-' + product_id, price_cents: 1200, stock: 10 },
});
const purchased = item(1, 'Remera comprada', 2);
const kept = item(2, 'Pantalón que queda', 3);

async function fixture(page: Page) {
  const reference = randomUUID();
  const orderPath = '/pedidos/' + reference;
  type State = 'pending' | 'rejected' | 'paid';
  let state: State = 'pending';
  let cart = [purchased, kept];
  let refreshes = 0;
  let cartReads = 0;
  await page.route('**/api/v1/store-info', route => route.fulfill({ json: { data: { checkout_pro_available: true } } }));
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { role: 'buyer' } } }));
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/cart', route => {
    cartReads++;
    return route.fulfill({ json: { data: { currency: 'UYU', items: cart } } });
  });
  await page.route('**/api/v1' + orderPath.replace('/pedidos/', '/orders/'), route => route.fulfill({
    json: { data: {
      reference, status: state === 'paid' ? 'paid' : 'pending_payment',
      payment_state: state === 'paid' ? null : state,
      payment_rejection: state === 'rejected' ? 'a'.repeat(64) : undefined,
      fulfilment_status: 'preparing', shipping_method: 'pickup',
      subtotal_cents: 2400, shipping_cents: 0, total_cents: 2400,
      created_at: '2026-11-27T12:00:00Z', reservation_expires_at: '2026-11-27T12:10:00Z',
    } },
  }));
  await page.route('**/api/v1/orders/' + reference + '/payments/refresh', route => {
    refreshes++;
    return route.fulfill({ status: 204 });
  });
  const badge = (n: number) => page.getByRole('banner').getByRole('link', {
    name: n ? 'Carrito, ' + n : 'Carrito', exact: true,
  });
  return {
    orderPath, badge, refreshes: () => refreshes, cartReads: () => cartReads,
    setStatus: (next: State) => { state = next; },
    setCart: (items: typeof cart) => { cart = items; },
  };
}

test('only a confirmed payment updates the cart badge without reloading and keeps other units', async ({ page }) => {
  const testApi = await fixture(page);
  await page.goto(testApi.orderPath + '?retorno=mercadopago&status=approved');
  await expect(page.getByText('Pago pendiente', { exact: true })).toBeVisible();
  await expect(testApi.badge(5)).toBeVisible();
  await expect.poll(testApi.refreshes).toBe(1);
  const before = testApi.cartReads();
  await page.evaluate(() => { document.documentElement.dataset.cartBadgeProbe = 'same-document'; });

  testApi.setStatus('rejected');
  await expect(page.getByRole('heading', { name: 'El pago no se completó' })).toBeVisible();
  await expect(testApi.badge(5)).toBeVisible();
  expect(testApi.cartReads()).toBe(before);

  await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
  await expect.poll(testApi.refreshes).toBe(2);
  testApi.setCart([kept]);
  testApi.setStatus('paid');
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible();
  await expect(testApi.badge(3)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.cartBadgeProbe)).toBe('same-document');

  await testApi.badge(3).click();
  await expect(page.getByRole('heading', { name: 'Tu carrito', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: kept.product.name })).toBeVisible();
  await expect(page.getByRole('link', { name: purchased.product.name })).toHaveCount(0);
  await expect(testApi.badge(3)).toBeVisible();
});

test('opening Tu carrito reconciles a stale badge and hides zero units', async ({ page }) => {
  const testApi = await fixture(page);
  await page.goto('/tienda');
  await expect(testApi.badge(5)).toBeVisible();
  testApi.setCart([]);
  await testApi.badge(5).click();
  await expect(page.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
  await expect(testApi.badge(0)).toBeVisible();
  await expect(page.getByRole('banner').locator('.count')).toHaveCount(0);
});
