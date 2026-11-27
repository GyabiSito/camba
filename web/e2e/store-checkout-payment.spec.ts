import { expect, test, type Page } from '@playwright/test';

const sandbox = 'https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=fixture';

async function checkout(page: Page, storeInfoStatus = 200) {
  await page.route('**/api/v1/store-info', route =>
    route.fulfill({ status: storeInfoStatus, json: { data: { checkout_pro_available: true } } }),
  );
  await page.goto('/carrito');
  await expect(page).toHaveURL(/\/cuenta\?volver=carrito$/);
  await page.getByLabel('Correo electrónico').fill('buyer@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/carrito$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Tu carrito', exact: true })).toBeVisible();
  const item = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Remera lisa', exact: true }) });
  // A prior unfinished test order may have left the item in the shared test account.
  await item.or(page.getByRole('heading', { name: 'Tu carrito está vacío' })).first().waitFor();
  if (await item.count()) {
    await item.getByRole('button', { name: 'Quitar Remera lisa' }).click();
    await expect(item).toHaveCount(0);
  }
  await page.goto('/producto/remera-lisa');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Seguir comprando' }).click();
  await page.goto('/checkout');
  await page.getByLabel('Nombre completo').fill('Lucía de Prueba');
  await page.getByLabel('Correo electrónico').fill('checkout-qa@camba.test');
  await page.getByRole('radio', { name: /Retiro/ }).check();
}

test('a failed store-info request does not skip payment or hide retry on the same order', async ({ page }) => {
  await checkout(page, 503);
  let orders = 0;
  const attempts: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/orders') orders++;
  });
  await page.route('**/api/v1/orders/*/payments', route => {
    attempts.push(new URL(route.request().url()).pathname);
    return attempts.length === 1
      ? route.fulfill({ status: 503, json: { message: 'No disponible' } })
      : route.fulfill({ status: 201, json: { data: { status: 'ready', checkout_url: sandbox } } });
  });
  await page.route(sandbox, route => route.fulfill({ status: 200, body: 'Checkout Pro fixture' }));

  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
  await expect(page).toHaveURL(/\/pedidos\//);
  expect(attempts).toHaveLength(1);
  await expect(page.getByText(/Podés reintentar desde este pedido sin crear otro/)).toBeVisible();
  await page.getByRole('button', { name: 'Pagar con Mercado Pago' }).click();
  await expect(page).toHaveURL(sandbox);
  expect(orders).toBe(1);
  expect(attempts).toEqual([attempts[0], attempts[0]]);
});

test('a released Checkout Pro reservation can retry from the same checkout detail', async ({ page }) => {
  await checkout(page);
  const attempts: string[] = [];
  let orders = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/orders') orders++;
  });
  await page.route('**/api/v1/orders/*/payments', route => {
    attempts.push(new URL(route.request().url()).pathname);
    return attempts.length === 1
      ? route.fulfill({ status: 409, json: { data: { status: 'failed', checkout_url: null } } })
      : route.fulfill({ status: 201, json: { data: { status: 'ready', checkout_url: sandbox } } });
  });
  await page.route(/\/api\/v1\/orders\/[^/?]+$/, async route => {
    const response = await route.fetch();
    const { data } = await response.json();
    await route.fulfill({ response, json: { data: { ...data, status: 'payment_expired', checkout_retryable: true } } });
  });
  await page.route(sandbox, route => route.fulfill({ status: 200, body: 'Checkout Pro fixture' }));
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
  await expect(page.getByText(/liberamos la reserva/)).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar pago', exact: true }).click();
  await expect(page).toHaveURL(sandbox);
  expect(orders).toBe(1);
  expect(attempts).toEqual([attempts[0], attempts[0]]);
});

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
          fulfilment_status: state === 'approved' ? 'preparing' : data.fulfilment_status,
          payment_state: state === 'approved' ? null : state,
          payment_rejection: state === 'rejected' ? 'a'.repeat(64) : undefined,
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
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
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

  await page.getByRole('link', { name: 'Volver a Camba' }).click();
  await expect(page.getByRole('heading', { name: 'Estamos confirmando el pago' })).toBeVisible();
  await expect(page.getByText('Pago rechazado', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Reintentar pago|Volver a Mercado Pago/ })).toHaveCount(0);
  await expect.poll(() => refreshes).toBe(2);
  state = 'approved';
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Retiro' })).toContainText('En preparación');
  await expect(page.getByText('Pago confirmado', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/tienda');
  await page.screenshot({ path: info.outputPath('retorno-aprobado.png'), fullPage: true });
  expect(starts).toBe(2);

  // An older API response must not reintroduce the confirmation on the cart.
  await page.route('**/api/v1/cart', route => route.fulfill({ json: { data: {
    currency: 'UYU', items: [], checkout: { state: 'paid', reference },
  } } }));
  await page.goto('/carrito');
  await expect(page.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
  await expect(page.getByText(/Pedido confirmado|Tu pago fue aprobado/)).toHaveCount(0);
});

test('an abandoned Checkout Pro payment can reopen the same order after checking', async ({ page }) => {
  test.setTimeout(90_000);
  await checkout(page);
  const origin = new URL(page.url()).origin;
  const started: string[] = [];
  await page.route('**/api/v1/orders/*/payments', async (route) => {
    started.push(new URL(route.request().url()).pathname.split('/').at(-2)!);
    await route.fulfill({ status: 200, json: { data: { status: 'ready', checkout_url: sandbox } } });
  });
  await page.route('**/api/v1/orders/*/payments/refresh', route => route.fulfill({ status: 202 }));
  await page.route(sandbox, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<a href="${origin}/pedidos/${started.at(-1)}?retorno=mercadopago">Volver sin pagar</a>`,
  }));
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
  await expect(page).toHaveURL(sandbox);
  await page.getByRole('link', { name: 'Volver sin pagar' }).click();
  const reopen = page.getByRole('button', { name: 'Volver a Mercado Pago' });
  await expect(page.getByRole('heading', { name: 'Estamos confirmando el pago' })).toBeVisible();
  await expect(reopen).toHaveCount(0);
  await expect(reopen).toBeEnabled({ timeout: 45_000 });
  await expect(page.getByText('Si no completaste el pago, podés volver a Mercado Pago.')).toBeVisible();
  await reopen.click();
  await expect(page).toHaveURL(sandbox);
  expect(started).toEqual([started[0], started[0]]);
});
