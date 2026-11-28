import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'UTC' });

const orders = Array.from({ length: 5 }, (_, index) => ({
  reference: `CAM-2026-${String(index + 1).padStart(6, '0')}`,
  status: index === 0 ? 'pending_payment' : 'paid',
  created_at: '2026-11-23T01:30:00Z',
  reservation_expires_at: '2026-11-23T02:00:00Z',
  shipping_method: index === 0 ? 'delivery' : 'pickup',
  fulfilment_status: 'unstarted',
  subtotal_cents: 129950,
  shipping_cents: 0,
  total_cents: 129950,
}));
const summary = {
  priorities: { pending_payment: 1, needs_preparation: 2, ready_for_pickup: 3, out_of_stock: 4, received_withdrawals: 6, registered_buyers: 7 },
  recent_orders: orders,
  sales: {
    timezone: 'America/Montevideo', from: '2026-10-25', through: '2026-11-23',
    order_count: 4, total_cents: 519800,
    months: ['06', '07', '08', '09', '10', '11'].map((month, index) => ({
      month: `2026-${month}`, order_count: index === 0 ? 0 : 4,
      total_cents: index === 0 ? 0 : 519800,
    })),
  },
};
const empty = {
  priorities: { pending_payment: 0, needs_preparation: 0, ready_for_pickup: 0, out_of_stock: 0, received_withdrawals: 0, registered_buyers: 0 },
  recent_orders: [],
  sales: { ...summary.sales, order_count: 0, total_cents: 0,
    months: summary.sales.months.map(month => ({ ...month, order_count: 0, total_cents: 0 })) },
};

async function session(page: Page) {
  // No request in this mocked suite reaches the connected API or changes live data.
  await page.route('**/api/**', route => route.fulfill({ status: 500, json: {} }));
  await page.route('**/api/v1/admin/session', route => route.fulfill({
    json: { data: { name: 'Dashboard Test', email: 'dashboard@example.test' } },
  }));
}

test.beforeEach(async ({ page }) => session(page));

test('grouped navigation marks the withdrawal route after deep links and reloads', async ({ page }) => {
  await page.route('**/api/v1/admin/dashboard', route => route.fulfill({ json: { data: summary } }));
  await page.goto('/dashboard');
  const nav = page.getByRole('navigation', { name: 'Administración' });
  for (const [group, links] of [
    ['Operación', ['Inicio', 'Pedidos', 'Arrepentimientos', 'Avisos', 'Usuarios']],
    ['Catálogo', ['Productos', 'Categorías', 'Marcas']],
    ['Tienda', ['Portada', 'Configuración']],
  ] as const) await expect(nav.getByRole('group', { name: group }).getByRole('link')).toHaveText([...links]);
  await expect(page.getByText('Mi sesión', { exact: true })).toBeVisible();
  const actions = page.getByRole('navigation', { name: 'Acciones rápidas' });
  await expect(actions.getByRole('link', { name: 'Nuevo producto' })).toHaveAttribute('href', '/productos/nuevo');
  await expect(actions.getByRole('link', { name: 'Pedidos pendientes' })).toHaveAttribute('href', '/pedidos?status=pending_payment');
  await expect(actions.getByRole('link', { name: 'Arrepentimientos por revisar' })).toHaveCount(0);

  await page.goto('/pedidos/arrepentimientos');
  await page.reload();
  const current = nav.locator('a[aria-current="page"]');
  await expect(current).toHaveText('Arrepentimientos');

  await page.setViewportSize({ width: 320, height: 880 });
  const menu = page.getByRole('button', { name: 'Menú' });
  await expect(nav).toBeHidden();
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'Inicio' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(nav).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('main')).toBeFocused();
});

test('real pending request shows a skeleton, then recent orders, exact drilldowns and quick actions', async ({ page }, info) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/admin/dashboard', async route => {
    await pending;
    await route.fulfill({ json: { data: summary } });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('status')).toContainText('Cargando el inicio');
  release();
  await expect(page.getByRole('heading', { name: 'Pedidos recientes' })).toBeVisible();
  const priorities = page.getByRole('region', { name: 'Qué necesita atención' });
  for (const [label, route] of [
    ['Pendientes de pago', '/pedidos?status=pending_payment'],
    ['Pagados por preparar', '/pedidos?status=paid&fulfilment_status=needs_preparation'],
    ['Listos para retiro', '/pedidos?status=paid&fulfilment_status=ready_for_pickup'],
    ['Publicados sin stock', '/productos?status=published&availability=out_of_stock'],
    ['Arrepentimientos por revisar', '/pedidos/arrepentimientos?status=received'],
  ]) {
    await expect(priorities.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('href', route);
  }
  await expect(priorities.getByRole('link', { name: /Arrepentimientos por revisar/ })).toContainText('6');
  for (const [label, route] of [
    ['Nuevo producto', '/productos/nuevo'], ['Carga masiva', '/productos/importar'], ['Editar portada', '/portada'],
  ]) await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', route);
  await expect(page.getByRole('link', { name: /^Ver pedido CAM-/ })).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Ver pedido CAM-2026-000001', exact: true })).toHaveAttribute('href', '/pedidos/CAM-2026-000001');
  await expect(page.getByRole('link', { name: 'Ver todos los pedidos' })).toHaveAttribute('href', '/pedidos');
  const recent = page.getByRole('region', { name: 'Pedidos recientes' });
  await expect(recent).toContainText('22/11/2026, 22:30');
  await expect(recent).toContainText('Pago pendiente');
  await expect(recent).toContainText('Envío');
  await expect(recent).toContainText('Retiro');
  await expect(recent).toContainText('UYU');
  await expect(recent).not.toContainText('dashboard@example.test');
  const sales = page.getByRole('region', { name: 'Ventas confirmadas' });
  await expect(sales).toContainText('4 pedidos pagados');
  await expect(sales).toContainText('America/Montevideo');
  await expect(sales).toContainText('25 oct');
  await expect(sales).toContainText('23 nov');
  await expect(page.getByRole('list', { name: 'Ventas mensuales en UYU' }).getByRole('listitem')).toHaveCount(6);
  await expect(page.getByRole('listitem', { name: /jun.*2026.*UYU.*0 pedidos/ })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('dashboard-mocked-1440.png'), fullPage: true });
});

test('recent order instants use Montevideo and display midnight as 00:00 in a UTC browser', async ({ page }) => {
  const instants = [
    ['2026-11-28T02:30:00Z', '27/11/2026, 23:30'],
    ['2026-12-01T02:59:59Z', '30/11/2026, 23:59'],
    ['2026-12-01T03:00:00Z', '01/12/2026, 00:00'],
  ];
  await page.route('**/api/v1/admin/dashboard', route => route.fulfill({
    json: { data: { ...summary, recent_orders: instants.map(([created_at], i) => ({ ...orders[i], created_at })) } },
  }));
  await page.goto('/dashboard');
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC');
  for (const [iso, label] of instants) await expect(page.locator(`time[datetime="${iso}"]`)).toHaveText(label);
});

test('failure is recoverable and zero summaries teach the empty state', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/admin/dashboard', route => ++calls === 1
    ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: { data: empty } }));
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toContainText('No pudimos cargar el inicio');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('Todavía no hay pedidos', { exact: true })).toBeVisible();
  await expect(page.getByText('No hubo ventas confirmadas en estos 30 días.', { exact: true })).toBeVisible();
  await expect(page.getByText('Todavía no hay ventas confirmadas en estos seis meses.', { exact: true })).toBeVisible();
  expect(calls).toBe(2);
  await expect(page.getByRole('region', { name: 'Qué necesita atención' }).getByRole('link')).toHaveCount(6);
});

test('older monthly sales remain visible when the last 30 days are empty', async ({ page }) => {
  await page.route('**/api/v1/admin/dashboard', route => route.fulfill({ json: {
    data: { ...summary, sales: { ...summary.sales, order_count: 0, total_cents: 0 } },
  } }));
  await page.goto('/dashboard');
  await expect(page.getByText('No hubo ventas confirmadas en estos 30 días.', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Ventas mensuales en UYU' })).toBeVisible();
});

test('a missing withdrawal count is visibly unavailable rather than zero', async ({ page }) => {
  const { received_withdrawals: _count, ...otherPriorities } = summary.priorities;
  await page.route('**/api/v1/admin/dashboard', route => route.fulfill({
    json: { data: { ...summary, priorities: otherPriorities } },
  }));
  await page.goto('/dashboard');
  const card = page.getByRole('link', { name: /Arrepentimientos por revisar/ });
  await expect(card).toContainText('No disponible');
  await expect(card.locator('strong')).toHaveCount(0);
});

test('priority cards keep their icons, counters and arrows aligned with long labels', async ({ page }) => {
  await page.route('**/api/v1/admin/dashboard', route => route.fulfill({ json: { data: summary } }));
  for (const [width, expectedRows] of [[1920, 1], [1440, 2], [1180, 2], [390, 6]] as const) {
    await page.setViewportSize({ width, height: 880 });
    await page.goto('/dashboard');
    const cards = page.getByRole('region', { name: 'Qué necesita atención' }).getByRole('link');
    await expect(cards.locator('.priority-icon')).toHaveCount(6);
    await expect(page.getByRole('navigation', { name: 'Acciones rápidas' }).locator('a svg[aria-hidden="true"]')).toHaveCount(2);
    const rects = await cards.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().y));
    expect(new Set(rects).size).toBe(expectedRows);
    await cards.first().locator('.priority-label').evaluate(label => {
      label.textContent = 'Pedidos que todavía necesitan confirmación del pago antes de la preparación';
    });
    for (const card of await cards.all()) {
      const layout = await card.evaluate(element => {
        const base = element.querySelector('.priority-icon')!.getBoundingClientRect();
        const icon = element.querySelector('.priority-icon svg')!.getBoundingClientRect();
        const label = element.querySelector<HTMLElement>('.priority-label')!;
        const count = element.querySelector('strong')!;
        const arrow = element.querySelector('.priority-arrow')!.getBoundingClientRect();
        const rect = label.getBoundingClientRect();
        return {
          base: [base.width, base.height], icon: icon.width,
          countFont: parseFloat(getComputedStyle(count).fontSize),
          fits: label.scrollWidth <= label.clientWidth && rect.left >= base.right && rect.right <= arrow.left
            && count.getBoundingClientRect().top >= rect.bottom,
        };
      });
      expect(layout.base).toEqual([40, 40]);
      expect(layout.icon).toBeGreaterThanOrEqual(20);
      expect(layout.icon).toBeLessThanOrEqual(22);
      expect(layout.countFont).toBeGreaterThanOrEqual(26);
      expect(layout.countFont).toBeLessThanOrEqual(30);
      expect(layout.fits).toBe(true);
    }
  }
});

test('dashboard survives reload with 44px order actions and no 390/320px overflow', async ({ page }, info) => {
  await page.route('**/api/v1/admin/dashboard', route => route.fulfill({ json: { data: summary } }));
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 880 });
    await page.goto('/dashboard');
    await page.reload();
    const action = page.getByRole('link', { name: 'Ver pedido CAM-2026-000001', exact: true });
    await expect(action).toBeVisible();
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`dashboard-mocked-${width}.png`), fullPage: true });
  }
});
