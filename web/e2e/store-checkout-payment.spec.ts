import { expect, test, type Page } from '@playwright/test';

const sandbox = 'https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=fixture';

async function checkout(page: Page) {
  await page.goto('/producto/remera-lisa');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Seguir comprando' }).click();
  await page.goto('/checkout');
  await page.getByLabel('Nombre completo').fill('Lucía de Prueba');
  await page.getByLabel('Correo electrónico').fill('checkout-qa@camba.test');
  await page.getByRole('radio', { name: /Retiro/ }).check();
}

test('Checkout Pro opens from checkout and the owned order waits for verified evidence', async ({
  page,
}, info) => {
  await checkout(page);
  const origin = new URL(page.url()).origin;
  let reference = '';
  let orders = 0;
  let starts = 0;
  let refreshes = 0;
  let state: 'pending' | 'rejected' | 'approved' | null = null;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/orders') orders++;
  });

  await page.route('**/api/v1/orders/*/payments', async (route) => {
    starts++;
    reference = new URL(route.request().url()).pathname.split('/').at(-2)!;
    expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    await route.fulfill({ status: 201, json: { data: { status: 'ready', checkout_url: sandbox } } });
  });
  await page.route('**/api/v1/orders/*/payments/refresh', async (route) => {
    refreshes++;
    expect(route.request().postData()).toBeNull();
    await route.fulfill({ status: 204 });
  });
  await page.route(/\/api\/v1\/orders\/[^/?]+$/, async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    const { data } = await response.json();
    await route.fulfill({
      response,
      json: {
        data: {
          ...data,
          status: state === 'approved' ? 'paid' : 'pending_payment',
          payment_state: state === 'approved' ? null : state,
        },
      },
    });
  });
  await page.route(sandbox, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<a href="${origin}/pedidos/${reference}?retorno=mercadopago&amp;status=approved">Volver a Camba</a>`,
    }),
  );

  await page.screenshot({ path: info.outputPath('checkout.png'), fullPage: true });
  await page.getByRole('button', { name: 'Pagar con Mercado Pago', exact: true }).click();
  await expect(page).toHaveURL(sandbox);
  expect(starts).toBe(1);
  await page.getByRole('link', { name: 'Volver a Camba' }).click();
  await expect(page).toHaveURL(origin + '/pedidos/' + reference);
  await expect(page.getByRole('heading', { name: 'Estamos confirmando el pago' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pagar con Mercado Pago' })).toHaveCount(0);
  await expect(page.getByText('Pago confirmado', { exact: true })).toHaveCount(0);
  await expect.poll(() => refreshes).toBe(1);

  state = 'pending';
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('Pago pendiente', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pagar con Mercado Pago' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: info.outputPath('retorno-pendiente-390.png'), fullPage: true });

  state = 'rejected';
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('heading', { name: 'El pago no se completó' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar pago' })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('retorno-rechazado.png'), fullPage: true });
  await page.getByRole('button', { name: 'Reintentar pago' }).click();
  await expect(page).toHaveURL(sandbox);
  expect(starts).toBe(2);
  expect(orders).toBe(1);

  state = null;
  await page.getByRole('link', { name: 'Volver a Camba' }).click();
  await expect(page.getByRole('heading', { name: 'Estamos confirmando el pago' })).toBeVisible();
  state = 'approved';
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible();
  await expect(page.getByText('Pago confirmado', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/tienda');
  await page.screenshot({ path: info.outputPath('retorno-aprobado.png'), fullPage: true });
  expect(starts).toBe(2);
});
