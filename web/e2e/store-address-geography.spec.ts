import { expect, test, type Page, type Route } from '@playwright/test';

test.use({ hasTouch: true });

const montevideo = { id: 1, name: 'Montevideo' };
const rioNegro = { id: 2, name: 'Río Negro' };
const prado = { id: 11, name: 'Prado' };
const sanJavier = { id: 22, name: 'San Javier' };
const young = { id: 23, name: 'Young' };
const location = (department_id: number, locality_id: number) => ({ department_id, locality_id });
const formerAddress = {
  id: 4,
  street: 'Los Fresnos',
  number: '29',
  recipient: 'Andrea Pérez',
  department: 'Departamento anterior',
  locality: 'Paraje sin coincidencia',
  department_id: null,
  locality_id: null,
  details: null,
  phone: null,
  postal_code: null,
};
type SavedAddress = Omit<typeof formerAddress, 'department_id' | 'locality_id'> & {
  department_id: number | null;
  locality_id: number | null;
};

function quote(address?: ReturnType<typeof location>) {
  const shipping = address?.locality_id === young.id ? 31000 : address ? 27000 : 19000;
  return {
    items: [{ product_id: 1, name: 'Remera', quantity: 1, line_total_cents: 50000 }],
    subtotal_cents: 50000,
    shipping_options: [
      { method: 'pickup', shipping_cents: 0, total_cents: 50000, quote_token: 'pickup' },
      {
        method: 'delivery',
        shipping_cents: shipping,
        total_cents: 50000 + shipping,
        quote_token: address ? `delivery-${address.locality_id}` : 'delivery-initial',
      },
    ],
  };
}

function gate() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

async function mockShopper(page: Page, member = true, saved: SavedAddress[] = [formerAddress]) {
  const writes: Record<string, unknown>[] = [];
  const addressByLocality = new Map([
    [prado.id, [montevideo.name, prado.name]],
    [sanJavier.id, [rioNegro.name, sanJavier.name]],
    [young.id, [rioNegro.name, young.name]],
  ]);
  const json = (route: Route, data: unknown) => route.fulfill({ json: { data } });
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    if (path === 'auth/me')
      return member
        ? json(route, {
            id: 1,
            name: 'Persona',
            email: 'persona@camba.test',
            role: 'buyer',
            email_verified: true,
          })
        : route.fulfill({ status: 401, json: {} });
    if (path === 'account/reminder-preferences') return json(route, {});
    if (path === 'categories') return json(route, []);
    if (path === 'account/addresses' && request.method() === 'GET') return json(route, saved);
    if (/^account\/addresses(?:\/\d+)?$/.test(path)) {
      const body = request.postDataJSON();
      writes.push(body);
      const id = path === 'account/addresses' ? 8 : Number(path.split('/').at(-1));
      const [department, locality] = addressByLocality.get(body.locality_id) ?? [];
      const address = { ...body, id, department, locality };
      saved = [...saved.filter((item) => item.id !== id), address];
      return json(route, address);
    }
    if (path === 'geography/departments') return json(route, [montevideo, rioNegro]);
    if (path === 'geography/departments/1/localities') return json(route, [prado]);
    if (path === 'geography/departments/2/localities') return json(route, [sanJavier, young]);
    if (path === 'cart')
      return json(route, {
        currency: 'UYU',
        items: [{ product_id: 1, quantity: 1, available: true }],
      });
    if (path === 'checkout/quote') return json(route, quote(request.postDataJSON().address));
    return json(route, {});
  });
  return writes;
}

const department = (page: Page) =>
  page.getByRole('combobox', { name: 'Departamento', exact: true });
const locality = (page: Page) => page.getByRole('combobox', { name: 'Localidad', exact: true });

test('address creation, edit, reload and correction use only a selected geography pair', async ({
  page,
}, info) => {
  const writes = await mockShopper(page);
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Agregar dirección' }).click();
  await expect(locality(page)).toBeDisabled();
  await department(page).fill('rio');
  await expect(page.getByRole('option', { name: 'Río Negro' })).toBeVisible();
  await department(page).press('ArrowDown');
  await department(page).press('Enter');
  await expect(department(page)).toHaveValue('Río Negro');
  await locality(page).fill('javier');
  await page.getByRole('option', { name: 'San Javier' }).click();
  await page.getByLabel('Nombre de quien recibe').fill('Persona de prueba');
  await page.getByLabel('Calle', { exact: true }).fill('Rivera');
  await page.getByLabel('Número de puerta').fill('41');
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(page.getByRole('button', { name: 'Editar Rivera 41' })).toBeVisible();
  expect(writes[0]).toMatchObject(location(rioNegro.id, sanJavier.id));
  expect(writes[0]).not.toHaveProperty('department');
  expect(writes[0]).not.toHaveProperty('locality');

  await page.reload();
  await page.getByRole('button', { name: 'Editar Rivera 41' }).click();
  await expect(department(page)).toHaveValue('Río Negro');
  await expect(locality(page)).toHaveValue('San Javier');
  await locality(page).fill('texto libre');
  await locality(page).press('Escape');
  await expect(locality(page)).toHaveValue('San Javier');
  await department(page).fill('monte');
  await page.getByRole('option', { name: 'Montevideo' }).tap();
  await expect(locality(page)).toHaveValue('');
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(page.getByRole('alert')).toContainText('Elegí un departamento y una localidad');
  expect(writes).toHaveLength(1);
  await locality(page).fill('prado');
  await page.getByRole('option', { name: 'Prado' }).click();
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(page.getByText('Prado, Montevideo', { exact: true })).toBeVisible();
  expect(writes[1]).toMatchObject(location(montevideo.id, prado.id));

  await page.getByRole('button', { name: 'Editar Los Fresnos 29' }).click();
  await expect(
    page.getByText(/Dirección anterior: Paraje sin coincidencia, Departamento anterior/),
  ).toBeVisible();
  await expect(department(page)).toHaveValue('');
  await expect(locality(page)).toBeDisabled();
  await page.screenshot({ path: info.outputPath('account-legacy-address.png'), fullPage: true });
});

test('guest delivery ignores obsolete location lists and quotes at 320px; pickup remains available', async ({
  page,
}, info) => {
  await mockShopper(page, false);
  await page.setViewportSize({ width: 320, height: 800 });
  const slowLocalities = gate();
  const slowQuote = gate();
  const requests: unknown[] = [];
  await page.route('**/geography/departments/1/localities', async (route) => {
    await slowLocalities.wait;
    await route.fulfill({ json: { data: [prado] } });
  });
  await page.route('**/checkout/quote', async (route) => {
    const address = route.request().postDataJSON().address;
    requests.push(address);
    if (address?.locality_id === sanJavier.id) await slowQuote.wait;
    await route.fulfill({ json: { data: quote(address) } });
  });

  await page.goto('/checkout');
  await page.getByRole('radio', { name: /Entrega a domicilio/ }).check();
  const first = page.waitForRequest('**/geography/departments/1/localities');
  await department(page).fill('monte');
  await page.getByRole('option', { name: 'Montevideo' }).click();
  await first;
  await department(page).fill('rio');
  await page.getByRole('option', { name: 'Río Negro' }).tap();
  await locality(page).fill('prado');
  await expect(page.getByText('No encontramos coincidencias.')).toBeVisible();
  slowLocalities.release();
  await locality(page).fill('');
  await expect(page.getByRole('option', { name: 'San Javier' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Prado' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: info.outputPath('checkout-localities-320.png'), fullPage: true });
  const stale = page.waitForRequest(
    (request) =>
      request.url().endsWith('/checkout/quote') &&
      request.postDataJSON().address?.locality_id === sanJavier.id,
  );
  await page.getByRole('option', { name: 'San Javier' }).tap();
  await stale;
  await locality(page).fill('young');
  await page.getByRole('option', { name: 'Young' }).tap();
  await expect(page.locator('.purchase-summary .total')).toContainText('810');
  slowQuote.release();
  await expect(page.locator('.purchase-summary .total')).toContainText('810');
  expect(requests).toEqual([
    undefined,
    location(rioNegro.id, sanJavier.id),
    location(rioNegro.id, young.id),
  ]);
  await page.getByRole('radio', { name: /Retiro/ }).check();
  await expect(department(page)).toHaveCount(0);
  await expect(page.locator('.purchase-summary .total')).toContainText('500');

  await page.route('**/api/v1/orders', (route) => route.fulfill({ status: 422, json: {} }));
  await page.getByRole('radio', { name: /Entrega a domicilio/ }).check();
  await expect(locality(page)).toHaveValue('Young');
  await page.getByLabel('Nombre completo').fill('Persona de prueba');
  await page.getByLabel('Correo electrónico').fill('invitada@camba.test');
  await page.getByLabel('Nombre de quien recibe').fill('Persona de prueba');
  await page.getByLabel('Calle', { exact: true }).fill('Los Cedros');
  await page.getByLabel('Número de puerta').fill('2');
  await expect(page.locator('.purchase-summary .total')).toContainText('810');
  const sent = page.waitForRequest(
    (request) => request.url().endsWith('/api/v1/orders') && request.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  const order = (await sent).postDataJSON();
  expect(order).toMatchObject({
    shipping_method: 'delivery',
    quote_token: 'delivery-23',
    address: { ...location(rioNegro.id, young.id), street: 'Los Cedros', number: '2' },
  });
  expect(order.address).not.toHaveProperty('department');
  expect(order.address).not.toHaveProperty('locality');
});

test('checkout prefills valid saved geography and requires correction of unmatched text', async ({
  page,
}) => {
  await mockShopper(page, true, [
    formerAddress,
    {
      ...formerAddress,
      id: 5,
      street: 'Rivera',
      department: rioNegro.name,
      locality: young.name,
      ...location(rioNegro.id, young.id),
    },
  ]);
  await page.goto('/checkout');
  await page.getByRole('radio', { name: /Entrega a domicilio/ }).check();
  const saved = page.getByLabel('Usar una dirección guardada');
  const quoteRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/checkout/quote') &&
      request.postDataJSON().address?.locality_id === young.id,
  );
  await saved.selectOption('5');
  expect((await quoteRequest).postDataJSON().address).toEqual(location(rioNegro.id, young.id));
  await expect(department(page)).toHaveValue('Río Negro');
  await expect(locality(page)).toHaveValue('Young');
  await saved.selectOption('4');
  await expect(
    page.getByText(/Dirección anterior: Paraje sin coincidencia, Departamento anterior/),
  ).toBeVisible();
  await expect(page.getByLabel('Calle', { exact: true })).toHaveValue('Los Fresnos');
  await expect(department(page)).toHaveValue('');
  await expect(locality(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByRole('alert')).toContainText('Elegí un departamento y una localidad');
});

test('checkout optionally saves a new delivery address without placing an order', async ({ page }) => {
  const writes = await mockShopper(page, true, []);
  let orders = 0;
  let attempts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/orders')) orders++;
  });
  await page.route('**/api/v1/account/addresses', (route) => {
    if (route.request().method() !== 'POST' || ++attempts !== 1) return route.fallback();
    return route.fulfill({ status: 422, json: { message: 'Revisá la dirección y volvé a guardar.' } });
  });

  await page.goto('/checkout');
  const save = page.getByRole('button', { name: 'Guardar en mis direcciones' });
  await page.getByRole('radio', { name: /Retiro/ }).check();
  await expect(save).toBeHidden();
  await page.getByRole('radio', { name: /Entrega a domicilio/ }).check();
  await expect(save).toHaveAttribute('type', 'button');
  await save.click();
  const fields = page.getByRole('group', { name: 'Dirección de entrega' });
  await expect(fields.getByRole('alert')).toContainText('Completá');
  expect(attempts).toBe(0);

  await department(page).fill('rio');
  await page.getByRole('option', { name: 'Río Negro' }).click();
  await locality(page).fill('young');
  await page.getByRole('option', { name: 'Young' }).click();
  await page.getByLabel('Nombre de quien recibe').fill('Persona de prueba');
  const street = page.getByLabel('Calle', { exact: true });
  await street.fill('Nueva calle');
  await page.getByLabel('Número de puerta').fill('42');
  await save.click();
  await expect(fields.getByRole('alert')).toHaveText('Revisá la dirección y volvé a guardar.');
  await expect(street).toHaveValue('Nueva calle');
  await expect(locality(page)).toHaveValue('Young');

  await save.tap();
  await expect(fields.getByRole('status')).toContainText('Dirección guardada');
  await expect(page.getByLabel('Usar una dirección guardada')).toHaveValue('8');
  await expect(save).toBeHidden();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ ...location(rioNegro.id, young.id), street: 'Nueva calle' });
  expect(writes[0]).not.toHaveProperty('department');
  expect(writes[0]).not.toHaveProperty('locality');
  expect(orders).toBe(0);

  await page.goto('/cuenta');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Editar Nueva calle 42' })).toBeVisible();
  expect(orders).toBe(0);
});
