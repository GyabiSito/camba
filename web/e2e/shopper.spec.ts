import { expect, test, type Page } from '@playwright/test';
import { fixtureCatalog } from './fixtures/store-products';

async function openProduct(page: Page, slug: string) {
  const hydrated = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/cart') && response.request().method() === 'GET',
    { timeout: 20_000 },
  );
  await page.goto(`/producto/${slug}`);
  expect((await hydrated).status()).toBe(200);
}

async function addToCart(page: Page, slug: string) {
  await openProduct(page, slug);
  const added = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/cart/items/') &&
      ['POST', 'PUT'].includes(response.request().method()),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: /agregar al carrito/i }).click();
  expect((await added).status()).toBe(200);
}

async function signInBuyer(page: Page) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill('buyer@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

test('a guest reviews the server quote before placing an order', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await addToCart(page, 'remera-lisa');
  await page.goto('/carrito');
  await expect(page.getByRole('link', { name: 'Remera lisa' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Cantidad de Remera lisa' }).fill('2');
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect(page.getByRole('status', { name: 'Carrito actualizado' })).toBeVisible();
  await page.getByRole('link', { name: 'Continuar la compra' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen de la compra' })).toBeVisible();
  await page.getByLabel('Nombre completo').fill('Persona de Prueba');
  await page.getByLabel('Correo electrónico').fill('invitada@camba.test');
  await page.getByRole('radio', { name: /Retiro/ }).check();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: info.outputPath('checkout-320.png'), fullPage: true });
  let firstKey: string | undefined;
  let firstReference: string | undefined;
  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST' || firstKey) return route.continue();
    firstKey = route.request().headers()['idempotency-key'];
    const committed = await route.fetch();
    expect(committed.ok()).toBeTruthy();
    firstReference = (await committed.json()).data.reference;
    await route.abort();
  });
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos comprobar si el pedido se creó');
  const placed = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/orders') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Reintentar el mismo pedido' }).click();
  const response = await placed;
  expect(response.ok()).toBeTruthy();
  expect(response.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.request().headers()['idempotency-key']).toBe(firstKey);
  expect((await response.json()).data.reference).toBe(firstReference);
  expect(response.request().postDataJSON()).toMatchObject({
    items: [{ quantity: 2 }],
    shipping_method: 'pickup',
  });
  await expect(page.getByRole('heading', { name: 'Tu pedido' })).toBeVisible();
  await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible();

  const attempt = async () => {
    const requested = page.waitForResponse(
      (response) => response.url().endsWith('/payments') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Pagar con Mercado Pago|Reintentar apertura/ }).click();
    const response = await requested;
    expect(response.status()).toBe(503); // Provider credentials are disabled in the isolated fixture.
    await expect(page.getByRole('alert')).toContainText('Podés reintentar desde este pedido');
    return response.request().headers()['idempotency-key'];
  };
  const paymentKey = await attempt();
  expect(paymentKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(await attempt()).toBe(paymentKey);

  const orderPath = new URL(page.url()).pathname;
  const refresh = page.waitForRequest(
    (request) => request.url().endsWith('/payments/refresh') && request.method() === 'POST',
  );
  await page.goto(orderPath + '?status=approved&payment_id=1000');
  expect((await refresh).postData()).toBeNull();
  await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(orderPath + '$'));
  await page.getByRole('link', { name: 'Ver compras' }).click();
  await expect(page.getByRole('link', { name: /Ver pedido/ })).toBeVisible();
});

test('two tabs each add a unit of the same product without losing an increment', async ({
  context,
  page,
}) => {
  await addToCart(page, 'remera-lisa');
  await expect(page.getByText('Producto agregado al carrito.', { exact: true })).toBeVisible();
  const other = await context.newPage();
  await openProduct(other, 'remera-lisa');

  let writes = 0;
  let release!: () => void;
  const together = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/api/v1/cart/items/*', async (route) => {
    if (!['POST', 'PUT'].includes(route.request().method())) return route.continue();
    if (++writes === 2) release();
    await together;
    return route.continue();
  });
  try {
    await Promise.all(
      [page, other].map(async (tab) => {
        const saved = tab.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/cart/items/') &&
            ['POST', 'PUT'].includes(response.request().method()),
          { timeout: 20_000 },
        );
        await tab.getByRole('button', { name: /agregar al carrito/i }).click();
        expect((await saved).status()).toBe(200);
        await expect(tab.getByText('Producto agregado al carrito.', { exact: true })).toBeVisible();
      }),
    );
  } finally {
    release();
    await context.unroute('**/api/v1/cart/items/*');
  }
  expect(writes).toBe(2);
  await page.goto('/carrito');
  await expect(page.getByRole('spinbutton', { name: 'Cantidad de Remera lisa' })).toHaveValue('3', {
    timeout: 15_000,
  });
});

test('product detail explains all available units are already in the cart', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await addToCart(page, 'remera-lisa');
  await page.goto('/carrito');
  const quantity = page.getByRole('spinbutton', { name: 'Cantidad de Remera lisa' });
  await expect(quantity).toBeVisible();
  const stock = Number(await quantity.getAttribute('max'));
  expect(stock).toBeGreaterThan(1);
  await quantity.fill(String(stock));
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect(page.getByRole('status', { name: 'Carrito actualizado' })).toBeVisible();

  await openProduct(page, 'remera-lisa');
  const rejected = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/api/v1/cart/items/'),
  );
  await page.getByRole('button', { name: 'Agregar al carrito' }).press('Enter');
  const response = await rejected;
  expect(response.status()).toBe(422);
  expect((await response.json()).errors.quantity).toBeDefined();
  const notice = page.getByRole('status').filter({
    hasText: 'Ya tenés en el carrito todas las unidades disponibles.',
  });
  await expect(notice.getByRole('link', { name: 'Ver carrito' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await notice.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('cart-stock-limit-320.png') });
  await notice.getByRole('link', { name: 'Ver carrito' }).click();
  await expect(quantity).toHaveValue(String(stock));
});

test('a buyer edits profile and saves reminder preferences after signing in', async ({
  page,
}, info) => {
  await signInBuyer(page);
  const name = page.getByLabel('Nombre completo');
  await expect(name).toBeVisible();
  const originalName = await name.inputValue();
  await name.fill('Nombre de prueba actualizado');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.getByText('Tus datos se guardaron.')).toBeVisible();
  await page.getByText('Direcciones guardadas', { exact: true }).click();
  await page.getByRole('button', { name: 'Agregar dirección' }).click();
  await page.getByLabel('Nombre de quien recibe').fill('Persona de Prueba');
  await page.getByLabel('Departamento').fill('Montevideo');
  await page.getByLabel('Localidad').fill('Montevideo');
  await page.getByLabel('Calle').fill('Calle de prueba');
  await page.getByLabel('Número de puerta').fill('10');
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(page.getByText('Dirección guardada.')).toBeVisible();
  await page.getByRole('button', { name: 'Editar Calle de prueba 10' }).click();
  await page.getByLabel('Número de puerta').fill('12');
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(page.getByText('Calle de prueba 12', { exact: true })).toBeVisible();
  await page.getByText('Recordatorios por correo', { exact: true }).click();
  const reminders = page.getByRole('checkbox', { name: 'Pagos pendientes' });
  const wasChecked = await reminders.isChecked();
  const save = page.getByRole('button', { name: 'Guardar preferencias' });
  await reminders.setChecked(!wasChecked);
  await save.click();
  await expect(page.getByText('Preferencias guardadas.')).toBeVisible();
  await page.screenshot({ path: info.outputPath('account-desktop.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tu cuenta' })).toBeVisible();
  await expect(name).toHaveValue('Nombre de prueba actualizado');
  await name.fill(originalName);
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.getByText('Tus datos se guardaron.')).toBeVisible();
  await page.getByText('Recordatorios por correo', { exact: true }).click();
  await expect(reminders).toBeVisible();
  expect(await reminders.isChecked()).toBe(!wasChecked);
  await reminders.setChecked(wasChecked);
  await save.click();
  await expect(page.getByText('Preferencias guardadas.')).toBeVisible();
  await page.getByText('Direcciones guardadas', { exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar Calle de prueba 12' }).click();
  await page.getByRole('button', { name: 'Eliminar dirección' }).click();
  await expect(page.getByText('Dirección eliminada.')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});

test('a guest cart merges at login and two tabs persist valid quantities at current server prices', async ({
  baseURL,
  browser,
  context,
  page,
}) => {
  test.slow(); // Multiple isolated browser sessions and real catalog setup.
  const settled = expect.configure({ timeout: 15_000 }); // Requests may queue in the Windows fixture.
  const fixture = await fixtureCatalog(browser, baseURL!);
  const quantity = (tab: Page, name: string) =>
    tab.getByRole('spinbutton', { name: `Cantidad de ${name}`, exact: true });
  const update = async (tab: Page, product: { id: number; name: string }, value: number) => {
    const input = quantity(tab, product.name);
    await input.fill(String(value));
    const saving = tab.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/cart/items/${product.id}`) &&
        response.request().method() === 'PUT',
      { timeout: 20_000 },
    );
    const line = tab.getByRole('listitem').filter({ has: input });
    await line.getByRole('button', { name: 'Actualizar' }).click();
    return saving;
  };
  try {
    const category_id = await fixture.classification('categories', 'remeras');
    const common = await fixture.publish({
      name: 'Prenda E2E común',
      category_id,
      price_cents: 12345,
      stock: 5,
    });
    const guestOnly = await fixture.publish({
      name: 'Prenda E2E invitado',
      category_id,
      price_cents: 23456,
      stock: 7,
    });

    const accountContext = await browser.newContext({ baseURL });
    try {
      const account = await accountContext.newPage();
      await signInBuyer(account);
      await addToCart(account, common.slug);
      await account.goto('/carrito');
      expect((await update(account, common, 3)).status()).toBe(200);
    } finally {
      await accountContext.close();
    }

    await addToCart(page, common.slug);
    await addToCart(page, guestOnly.slug);
    await page.goto('/carrito');
    await settled(quantity(page, common.name)).toHaveValue('1');
    expect((await update(page, common, 4)).status()).toBe(200);
    await signInBuyer(page);
    await page.goto('/carrito');
    await settled(quantity(page, common.name)).toHaveValue('5'); // 3 + 4 capped at stock.
    await expect(quantity(page, guestOnly.name)).toHaveValue('1');

    const other = await context.newPage();
    await other.goto('/carrito');
    await settled(quantity(other, common.name)).toHaveValue('5');
    await expect(quantity(other, guestOnly.name)).toHaveValue('1');
    const saves = await Promise.all([update(page, common, 4), update(other, guestOnly, 2)]);
    expect(saves.map((response) => response.status())).toEqual([200, 200]);
    expect(saves.map((response) => response.request().postDataJSON())).toEqual([
      { quantity: 4 },
      { quantity: 2 },
    ]);
    await Promise.all([page.reload(), other.reload()]);
    for (const tab of [page, other]) {
      await settled(quantity(tab, common.name)).toHaveValue('4');
      await expect(quantity(tab, guestOnly.name)).toHaveValue('2');
    }

    await fixture.adjust(common.id, { stock: 3, price_cents: 13567 });
    // The tab still displays stock 5, so only the server sees that this edit is invalid.
    const rejected = await update(other, common, 5);
    expect(rejected.status()).toBe(422);
    expect((await rejected.json()).errors.quantity).toBeDefined();
    await expect(other.getByRole('alert')).toBeVisible();
    await other.reload();
    await settled(quantity(other, common.name)).toHaveValue('4');
    await expect(quantity(other, common.name)).toHaveAttribute('max', '3');
    await expect(other.getByText(/UYU\s+542,68/)).toBeVisible();
    await expect(other.getByRole('link', { name: 'Continuar la compra' })).toHaveCount(0);
    expect((await update(other, common, 3)).status()).toBe(200);
    await expect(other.getByRole('link', { name: 'Continuar la compra' })).toBeVisible();
    await page.reload();
    await settled(quantity(page, common.name)).toHaveValue('3');
    await expect(quantity(page, guestOnly.name)).toHaveValue('2');
    await expect(page.getByText(/UYU\s+407,01/)).toBeVisible();
    await page.getByRole('button', { name: `Quitar ${common.name}` }).click();
    await expect(quantity(page, common.name)).toHaveCount(0);
    await page.getByRole('button', { name: `Quitar ${guestOnly.name}` }).click();
    await expect(page.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test('a guest sees the API delivery rate and confirms a persisted delivery order at 320 px', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await addToCart(page, 'remera-lisa');
  await page.goto('/carrito');
  const quoting = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/checkout/quote') && response.request().method() === 'POST',
  );
  await page.getByRole('link', { name: 'Continuar la compra' }).click();
  const quote = await quoting;
  expect(quote.status()).toBe(200);
  const { data } = await quote.json();
  expect(data).toMatchObject({ currency: 'UYU', subtotal_cents: 89000 });
  const delivery = data.shipping_options.find(
    ({ method }: { method: string }) => method === 'delivery',
  );
  expect(delivery).toMatchObject({
    shipping_cents: 18500,
    total_cents: 107500,
    pickup_address: null,
  });

  await page.getByLabel('Nombre completo').fill('Cliente de entrega E2E');
  await page.getByLabel('Correo electrónico').fill('entrega@camba.test');
  await page.getByRole('radio', { name: /Entrega a domicilio.*185/ }).check();
  const address = {
    recipient: 'Destinataria de prueba',
    department: 'Canelones',
    locality: 'Las Piedras',
    street: 'Calle de prueba',
    number: '78',
    details: 'Apartamento 2',
  };
  const fields = page.getByRole('group', { name: 'Dirección de entrega' });
  await fields.getByLabel('Nombre de quien recibe').fill(address.recipient);
  await fields.getByLabel('Departamento').fill(address.department);
  await fields.getByLabel('Localidad').fill(address.locality);
  await fields.getByLabel('Calle').fill(address.street);
  await fields.getByLabel('Número de puerta').fill(address.number);
  await fields.getByLabel('Apartamento o indicaciones (opcional)').fill(address.details);
  const totals = page.getByRole('complementary', { name: 'Resumen de la compra' });
  const amount = (summary: typeof totals, label: string) =>
    summary.getByText(label, { exact: true }).locator('..').getByRole('definition');
  await expect(amount(totals, 'Entrega')).toHaveText('UYU 185');
  await expect(amount(totals, 'Total')).toHaveText('UYU 1.075');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: info.outputPath('checkout-delivery-320.png'), fullPage: true });

  const ordering = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/orders') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  const order = await ordering;
  expect(order.status()).toBe(201);
  expect(order.request().postDataJSON()).toMatchObject({
    shipping_method: 'delivery',
    address,
    quote_token: delivery.quote_token,
  });
  const { data: placed } = await order.json();
  expect(placed).toMatchObject({
    shipping_method: 'delivery',
    address,
    pickup_address: null,
    status: 'pending_payment',
    subtotal_cents: 89000,
    shipping_cents: 18500,
    total_cents: 107500,
  });
  await expect(page).toHaveURL(`/pedidos/${placed.reference}`);
  const status = page.getByText('Pendiente de pago', { exact: true });
  await expect(status).toBeVisible({ timeout: 15_000 });
  const persisted = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/orders/${placed.reference}`) &&
      response.request().method() === 'GET',
  );
  await page.reload();
  expect((await persisted).status()).toBe(200);
  const shipment = page.getByRole('region', { name: 'Entrega a domicilio' });
  await expect(shipment).toContainText(address.recipient);
  await expect(shipment).toContainText('Calle de prueba 78 · Apartamento 2');
  await expect(shipment).toContainText('Las Piedras, Canelones');
  await expect(
    amount(page.getByRole('complementary', { name: 'Resumen del pedido' }), 'Total'),
  ).toHaveText('UYU 1.075');
  await expect(status).toBeVisible();
});
