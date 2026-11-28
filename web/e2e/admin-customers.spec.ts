import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'UTC' });

const endpoint = '/api/v1/admin/users';
const instant = '2026-11-28T02:30:00Z';
const reference = 'c0ffee42-cafe-4321-babe-101010101010';
const account = { name: 'Lina Morel', email: 'lina@example.test', email_verified: true, created_at: instant };
const entry = { ...account, id: 42, orders_count: 26, last_order_at: instant };
const otherCustomers = [
  { ...entry, id: 46, name: 'Valentina Silva', email: 'valentina@example.test', orders_count: 5 },
  { ...entry, id: 45, name: 'Mateo Pereira', email: 'mateo@example.test', email_verified: false, orders_count: 0, last_order_at: null },
  { ...entry, id: 44, name: 'Lucía Cabrera', email: 'lucia@example.test', orders_count: 2 },
  { ...entry, id: 43, name: 'Sofía García', email: 'sofia@example.test', orders_count: 1 },
];
const order = { reference, created_at: instant, total_cents: 129900, status: 'paid', shipping_method: 'delivery' };
const saved = { id: 1, recipient: 'Lina Morel', street: 'Jacinto Vera', number: '155', locality: 'Montevideo',
  department: 'Montevideo', postal_code: '11800', details: 'Apartamento 2' };

async function session(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/v1/admin/session', route => route.fulfill({
    json: { data: { name: 'Camba Mesa', email: 'admin@example.test' } },
  }));
}

const dashboard = (registered_buyers?: number) => ({
  priorities: { pending_payment: 2, needs_preparation: 3, ready_for_pickup: 1, out_of_stock: 0,
    received_withdrawals: 2, registered_buyers },
  recent_orders: [],
  sales: { timezone: 'America/Montevideo', from: '2026-10-29', through: '2026-11-27',
    order_count: 0, total_cents: 0, months: [] },
});

for (const [width, size] of [[1440, 'escritorio'], [320, '320px']] as const) {
  test(`directory operator flow at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await session(page);
    let total = 31;
    await page.route('**/api/v1/admin/dashboard', route => route.fulfill({ json: { data: dashboard(total) } }));
    await page.route(`**${endpoint}*`, route => {
      const query = new URL(route.request().url()).searchParams;
      const searched = query.get('q') === 'Lina';
      const page = Number(query.get('page') ?? 1);
      return route.fulfill({ json: { data: searched ? (page === 2 ? [entry] : [{ ...entry, id: 2, name: 'Lina Santos' }])
        : [...otherCustomers, entry], meta: { total: searched ? 26 : 31, current_page: page, last_page: 2 } } });
    });
    await page.route(`**${endpoint}/42`, route => route.fulfill({ json: { data: { ...account, addresses: [saved] } } }));
    await page.route(`**${endpoint}/42/orders*`, route => {
      const page = Number(new URL(route.request().url()).searchParams.get('page') ?? 1);
      return route.fulfill({ json: { data: page === 1 ? [order] : [{
        ...order, reference: 'aabbcc44-cafe-4221-babe-101010101012', status: 'refunded',
      }], meta: { total: 26, current_page: page, last_page: 2 } } });
    });
    await page.route(`**/api/v1/admin/orders/${reference}`, route => route.fulfill({
      json: { data: { ...order, subtotal_cents: 129900, shipping_cents: 0, reservation_expires_at: instant,
        fulfilment_status: 'unstarted', contact: { name: account.name, email: account.email },
        address: { ...saved, street: 'Avenida Rivera', number: '1600' }, tracking: null, pickup_address: null, items: [],
      }, events: [], payment: { can_request_refresh: false, paid_at: instant, attempt: null, issues: [], observations: [] } },
    }));
    const capture = async (view: string) => {
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`${view}-${size}.png`), fullPage: true, animations: 'disabled' });
    };

    await page.goto('/dashboard');
    const tile = page.getByRole('region', { name: 'Qué necesita atención' }).getByRole('link', { name: /Usuarios/ });
    await expect(tile.locator('strong')).toHaveText('31');
    await capture('inicio');
    await tile.click();
    const directory = page.getByRole('table', { name: 'Clientes registrados' });
    await expect(directory.getByRole('row').filter({ hasText: 'Mateo Pereira' })).toContainText('Sin verificar');
    await capture('listado');
    await page.getByLabel('Buscar por nombre o correo').fill('Lina');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page).toHaveURL(/q=Lina/);
    await expect(directory.getByText('Lina Santos')).toBeVisible();
    await page.getByRole('link', { name: 'Siguiente' }).click();
    await expect(page).toHaveURL(/page=2/);
    await directory.getByRole('link', { name: 'Ver ficha de Lina Morel' }).click();
    await expect(page.getByRole('heading', { name: 'Lina Morel', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Direcciones guardadas' })).toContainText('Jacinto Vera 155');
    const history = page.getByRole('table', { name: 'Pedidos del cliente' });
    await expect(history.getByText('27/11/2026, 23:30')).toBeVisible();
    await expect(history.getByText('Pagado')).toBeVisible();
    await capture('ficha');
    await page.getByRole('link', { name: 'Siguiente' }).click();
    await expect(history.getByText('Reembolsado')).toBeVisible();
    await page.getByRole('link', { name: 'Anterior' }).click();
    await history.getByRole('link', { name: 'Ver pedido', exact: true }).click();
    await expect(page.getByText(/Avenida Rivera 1600/)).toBeVisible();
    await expect(page.getByText(/Jacinto Vera/)).toHaveCount(0);
    await page.goBack();
    await page.getByRole('link', { name: 'Volver a usuarios' }).click();
    await expect(page.getByLabel('Buscar por nombre o correo')).toHaveValue('Lina');
    await expect(page.getByText('Página 2 de 2')).toBeVisible();
    total = 32;
    await page.getByRole('link', { name: 'Camba, administración' }).click();
    await expect(tile.locator('strong')).toHaveText('32');
  });
}

test('dashboard shows real loading, errors and a confirmed zero distinctly', async ({ page }) => {
  await session(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let request = 0;
  await page.route('**/api/v1/admin/dashboard', async route => {
    request++;
    if (request === 1) {
      await pending;
      return route.fulfill({ status: 503, json: {} });
    }
    return route.fulfill({ json: { data: dashboard(request === 2 ? undefined : 0) } });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('status')).toContainText('Cargando el inicio');
  release();
  await expect(page.getByRole('alert')).toContainText('No pudimos cargar el inicio');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  const tile = page.getByRole('link', { name: /Usuarios/ }).filter({ has: page.locator('.priority-label') });
  await expect(tile).toContainText('No disponible');
  await expect(tile.locator('strong')).toHaveCount(0);
  await page.reload();
  await expect(tile.locator('strong')).toHaveText('0');
});

test('a customer with no saved addresses or orders has separate empty states', async ({ page }) => {
  await session(page);
  await page.route(`**${endpoint}/42`, route => route.fulfill({ json: { data: { ...account, addresses: [] } } }));
  await page.route(`**${endpoint}/42/orders*`, route => route.fulfill({
    json: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } },
  }));
  await page.goto('/usuarios/42');
  await expect(page.getByText('Este cliente no tiene direcciones guardadas.')).toBeVisible();
  await expect(page.getByText('Este cliente todavía no tiene pedidos.')).toBeVisible();
});
