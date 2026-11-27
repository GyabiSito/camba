import { expect, test, type Page } from '@playwright/test';

const inbox = '/pedidos/arrepentimientos';
const endpoint = '/api/v1/admin/withdrawals';
const orderRef = '12345678-abcd-4321-abcd-123456789abc';
const receipt = '13579bdf-2468-4ace-8135-79bdf2468ace';
const demoDate = '2026-11-27T16:00:00Z';
const requested = {
  reference: receipt, order_reference: orderRef, order_matched: true, email: 'comprador@example.test',
  status: 'received', received_at: demoDate, refund_reference: null as string | null,
  refund_confirmed_at: null as string | null,
};
const reviewing = { ...requested, reference: '2468ace0-1357-49bd-8246-8ace013579bd', status: 'reviewing', received_at: '2026-11-27T14:45:00Z' };
const closed = {
  ...requested, reference: 'abcdabcd-abcd-4bcd-abcd-abcdabcdabcd', status: 'closed', order_matched: false,
  order_reference: '3f5e4a78-31cf-4849-948c-5b838c490ace', received_at: '2026-11-26T17:08:00Z',
};
const registered = {
  ...requested, reference: '7b5fbc66-cf79-418c-9cb0-a082c78c743e', status: 'refunded',
  order_reference: 'c4f639a2-8dd1-4821-91dc-1a2f92d95c2b', refund_reference: 'MP-DEMO-826',
  received_at: '2026-11-25T13:12:00Z', refund_confirmed_at: demoDate,
};

async function mockApi(page: Page, perPage = 2) {
  const rows = [{ ...requested }, { ...reviewing }, { ...closed }, { ...registered }];
  const actions: string[] = [];
  let refundAmount: number | null = null;
  const refreshes: number[] = [];
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/admin/session', route => route.fulfill({
    json: { data: { name: 'Camba Demo', email: 'admin@example.test' } },
  }));
  await page.route('**/api/v1/admin/dashboard', route => route.fulfill({
    json: { data: {
      priorities: { pending_payment: 0, needs_preparation: 0, ready_for_pickup: 0, out_of_stock: 0,
        received_withdrawals: rows.filter(item => item.status === 'received').length },
      recent_orders: [],
      sales: { timezone: 'America/Montevideo', from: '2026-10-29', through: '2026-11-27', order_count: 0, total_cents: 0, months: [] },
    } },
  }));
  await page.route(`**${endpoint}**`, route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'PATCH') {
      const { action } = request.postDataJSON();
      const row = rows.find(item => url.pathname.endsWith('/' + item.reference))!;
      actions.push(action);
      if (action === 'confirm_refund' && refundAmount !== 45100) return route.fulfill({ status: 409, json: { message: 'Falta verificar el reintegro.' } });
      row.status = { review: 'reviewing', close: 'closed', confirm_refund: 'refunded' }[action as 'review' | 'close' | 'confirm_refund'];
      if (action === 'confirm_refund') {
        row.refund_reference = 'MP-DEMO-451';
        row.refund_confirmed_at = demoDate;
      }
      return route.fulfill({ json: { data: row } });
    }
    const collectionPage = Number(url.searchParams.get('page') ?? 1);
    const status = url.searchParams.get('status');
    const reference = url.searchParams.get('reference');
    const filtered = rows.filter(row => (!status || row.status === status) && (!reference || row.reference === reference));
    return route.fulfill({
      json: { data: filtered.slice((collectionPage - 1) * perPage, collectionPage * perPage),
        meta: { current_page: collectionPage, last_page: Math.max(1, Math.ceil(filtered.length / perPage)), total: filtered.length },
      },
    });
  });
  await page.route(`**/api/v1/admin/orders/${orderRef}/payments/refresh`, route => {
    expect(route.request().method()).toBe('POST');
    refundAmount = refundAmount === null ? 20000 : 45100;
    refreshes.push(refundAmount);
    return route.fulfill({ status: 202, json: {} });
  });
  await page.route(`**/api/v1/admin/orders/${orderRef}`, route => route.fulfill({
    json: {
      data: { reference: orderRef, status: refundAmount === null ? 'paid' : 'refunded', created_at: demoDate,
        reservation_expires_at: demoDate, shipping_method: 'pickup', fulfilment_status: 'unstarted',
        subtotal_cents: 45100, total_cents: 45100, shipping_cents: 0, tracking: null,
        pickup_address: null, contact: { name: 'Comprador de prueba', email: 'comprador@example.test' }, address: null, items: [],
      },
      events: [],
      payment: { can_request_refresh: true, paid_at: demoDate, last_checked_at: demoDate, next_check_at: null,
        last_result: 'verified', attempt: null, issues: [], observations: refundAmount === null
          ? [] : [{ id: 1, status: 'refunded', amount_cents: refundAmount, updated_at: demoDate }],
      },
    },
  }));
  return { actions, refreshes };
}

test('dashboard drilldown opens the received inbox; order return preserves search, status and case on desktop and mobile', async ({ page }) => {
  await mockApi(page);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 880 });
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Arrepentimientos por revisar' }).click();
    await expect(page).toHaveURL(new RegExp(inbox + '\\?status=received$'));
    await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('received');
    await page.getByLabel('Buscar solicitudes').fill('13579bdf');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('link', { name: 'Abrir solicitud' }).click();
    await expect(page.getByRole('button', { name: 'Abrir revisión' })).toBeVisible();
    await page.getByRole('link', { name: 'Ver pedido', exact: true }).click();
    await expect(page.locator('.section-nav a[aria-current="page"]')).toHaveText('Pedidos');
    await page.reload();
    await page.getByRole('link', { name: 'Volver a la bandeja' }).click();
    await expect(page.locator('.section-nav a[aria-current="page"]')).toHaveText('Arrepentimientos');
    await expect(page.getByRole('button', { name: 'Abrir revisión' })).toBeVisible();
    await expect(page).toHaveURL(/status=received/);
    await expect(page).toHaveURL(/q=13579bdf/);
    await page.getByRole('link', { name: 'Volver a la bandeja' }).click();
    await expect(page.getByLabel('Buscar solicitudes')).toHaveValue('13579bdf');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test('the dashboard count matches the received inbox and refreshes after opening a review', async ({ page }) => {
  const { actions } = await mockApi(page);
  await page.goto('/dashboard');
  const card = page.getByRole('region', { name: 'Qué necesita atención' }).getByRole('link', { name: /Arrepentimientos por revisar/ });
  await expect(card.locator('strong')).toHaveText('1');
  await card.click();
  await expect(page.getByRole('status').filter({ hasText: /^1 solicitud$/ })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir solicitud' }).click();
  await page.getByRole('button', { name: 'Abrir revisión' }).click();
  await expect(page.getByText('Revisión abierta.')).toBeVisible();
  await page.getByRole('link', { name: 'Ver pedido', exact: true }).click();
  await page.getByRole('link', { name: 'Volver a la bandeja' }).click();
  await expect(page.getByRole('region', { name: 'Datos de la solicitud' })).toContainText('En revisión');
  await page.getByRole('navigation', { name: 'Administración' }).getByRole('link', { name: 'Inicio' }).click();
  await expect(card.locator('strong')).toHaveText('0');
  await card.click();
  await expect(page.getByRole('status').filter({ hasText: /^0 solicitudes$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
  expect(actions).toEqual(['review']);
});

test('matches full receipts and order references beyond the first page and separates empty results', async ({ page }) => {
  await mockApi(page);
  await page.goto(inbox);
  await page.getByLabel('Estado', { exact: true }).selectOption('closed');
  await expect(page.getByRole('link', { name: 'Abrir solicitud' })).toHaveCount(1);
  await expect(page.getByText(closed.reference, { exact: true })).toBeVisible();
  for (const term of [closed.reference, closed.order_reference, 'inexistente']) {
    await page.getByLabel('Buscar solicitudes').fill(term);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    if (term === 'inexistente') await expect(page.getByText('No encontramos solicitudes con esos filtros.')).toBeVisible();
    else await expect(page.getByText(closed.reference, { exact: true })).toBeVisible();
  }
});

test('opens a review and records only a reconciled total refund after returning from the order', async ({ page, context }) => {
  const { actions, refreshes } = await mockApi(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`${inbox}?solicitud=${receipt}`);
  await page.getByRole('button', { name: 'Copiar constancia' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(receipt);
  await page.getByRole('button', { name: 'Abrir revisión' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Revisión abierta.' })).toBeVisible();
  const register = page.getByRole('button', { name: 'Registrar reintegro confirmado' });
  await expect(register).toHaveCount(0);
  await expect(page.getByText(/Falta verificar el reintegro total/)).toBeVisible();
  for (const amount of [20000, 45100]) {
    await page.getByRole('link', { name: 'Ver pedido', exact: true }).click();
    await page.getByRole('button', { name: 'Solicitar verificación del pago' }).click();
    await expect(page.getByText(/Solicitamos la verificación a Mercado Pago/)).toBeVisible();
    await page.getByRole('link', { name: 'Volver a la bandeja' }).click();
    if (amount < 45100) {
      await expect(page.getByText(/Falta verificar el reintegro total/)).toBeVisible();
      await expect(register).toHaveCount(0);
      expect(actions).toEqual(['review']);
    }
  }
  await expect(register).toBeEnabled();
  await register.click();
  await expect(page.getByRole('status')).toContainText('Reintegro confirmado registrado.');
  await expect(page.getByText('MP-DEMO-451', { exact: true })).toBeVisible();
  expect(actions).toEqual(['review', 'confirm_refund']);
  expect(refreshes).toEqual([20000, 45100]);
});

test('closing without a refund requires deliberate confirmation and closed cases show no close action', async ({ page }) => {
  const { actions } = await mockApi(page);
  await page.setViewportSize({ width: 320, height: 880 });
  await page.goto(`${inbox}?solicitud=${reviewing.reference}`);
  const close = page.getByRole('button', { name: 'Cerrar sin reintegro', exact: true });
  await close.click();
  await expect(page.getByRole('button', { name: 'Confirmar cierre' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  expect(actions).toEqual([]);
  await close.click();
  await page.getByRole('button', { name: 'Confirmar cierre' }).click();
  await expect(page.getByRole('status')).toContainText('Solicitud cerrada sin reintegro.');
  await expect(close).toHaveCount(0);
  expect(actions).toEqual(['close']);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('shows a pending skeleton, recoverable error and true empty state', async ({ page }) => {
  await mockApi(page);
  let release!: () => void;
  let calls = 0;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${endpoint}**`, async route => {
    if (++calls === 1) {
      await wait;
      return route.fulfill({ status: 503, json: {} });
    }
    return route.fulfill({ json: { data: [], meta: { current_page: 1, last_page: 1, total: 0 } } });
  });
  await page.goto(inbox);
  await expect(page.getByRole('status').filter({ hasText: 'Cargando solicitudes' })).toBeVisible();
  release();
  await expect(page.getByRole('alert')).toContainText('No pudimos cargar las solicitudes.');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Todavía no hay solicitudes' })).toBeVisible();
  expect(calls).toBe(2);
});

test('filtered search discloses its scope and can continue into the next block', async ({ page }) => {
  await mockApi(page);
  const pages: number[] = [];
  await page.route(`**${endpoint}**`, route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'));
    pages.push(current);
    return route.fulfill({
      json: { data: current === 4 ? [closed] : [], meta: { current_page: current, last_page: 4, total: 76 } },
    });
  });
  await page.goto(inbox + '?status=closed&q=abcdabcd');
  await expect(page.getByText('No encontramos solicitudes con esos filtros en este bloque.')).toBeVisible();
  expect(pages.slice().sort()).toEqual([1, 2, 3]);
  await page.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page.getByText(closed.reference, { exact: true })).toBeVisible();
  expect(pages.slice().sort()).toEqual([1, 2, 3, 4]);
});

test('all inbox states fit on desktop and at 320 px', async ({ page }, info) => {
  await mockApi(page, 25);
  for (const [width, label] of [[1440, 'escritorio'], [320, '320px']] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(inbox);
    const table = page.getByRole('table', { name: 'Solicitudes de arrepentimiento' });
    await expect(table.getByRole('link', { name: 'Abrir solicitud' })).toHaveCount(4);
    for (const status of ['Recibida', 'En revisión', 'Cerrada', 'Reintegro confirmado']) await expect(table.getByText(status, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`bandeja-${label}.png`), fullPage: true, animations: 'disabled' });
  }
});
