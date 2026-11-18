import { expect, Page, test } from '@playwright/test';

const reference = '83e8d374-c5a2-4a2d-9935-1fe488715b42';
const createdAt = '2026-10-20T15:00:00.000Z';
const orderPath = `/api/v1/admin/orders/${reference}`;
const order = {
  reference,
  created_at: createdAt,
  reservation_expires_at: createdAt,
  status: 'paid',
  shipping_method: 'pickup',
  fulfilment_status: 'unstarted',
  subtotal_cents: 8950,
  shipping_cents: 0,
  total_cents: 8950,
  contact: { name: 'Clienta de prueba', email: 'clienta@example.test' },
  pickup_address: 'Mostrador de prueba',
  address: null,
  tracking: null,
  items: [
    {
      product_id: 3,
      sku: 'SKU-021',
      name: 'Producto de prueba',
      quantity: 1,
      unit_price_cents: 8950,
      line_total_cents: 8950,
    },
  ],
};
const evidence = {
  paid_at: createdAt,
  last_checked_at: createdAt,
  next_check_at: null,
  last_result: 'verified',
  attempt: null,
  issues: [],
  observations: [{ id: 1, status: 'approved', amount_cents: 8950, updated_at: createdAt }],
};
const settings = {
  business_name: 'Camba',
  support_email: 'admin@example.test',
  support_phone: null,
  pickup_address: 'Mostrador de prueba',
  delivery_cents: 5000,
  remind_payment: false,
  payment_lead_minutes: 10,
  remind_cart: false,
  cart_delay_hours: 24,
  low_stock_threshold: 3,
  pending_fulfilment_hours: 24,
};
const meta = { current_page: 1, last_page: 1, total: 1 };

async function authorize(page: Page) {
  await page.route('**/api/v1/admin/session', (route) =>
    route.fulfill({
      json: {
        data: {
          id: 1,
          name: 'Operadora de prueba',
          email: 'admin@example.test',
          role: 'admin',
          email_verified: true,
        },
      },
    }),
  );
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
}

test('filters and pages orders, retains notes on conflict, then completes a pickup', async ({
  page,
}, testInfo) => {
  await authorize(page);
  let stage = 'unstarted';
  let conflicts = true;
  let checks = 0;
  let orderReads = 0;
  const events: { actor_id: number; to_status: string; note: string; created_at: string }[] = [];
  await page.route('**/api/v1/admin/orders?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const current_page = Number(params.get('page'));
    if (params.get('status') === 'pending_payment') {
      return route.fulfill({ json: { data: [], meta: { ...meta, total: 0 } } });
    }
    const first = { ...order, reference: '736f6415-76b0-40ca-b201-f252f20def12' };
    const data = current_page === 1 ? [first] : [order];
    return route.fulfill({ json: { data, meta: { current_page, last_page: 2, total: 26 } } });
  });
  await page.route(`**${orderPath}`, (route) => {
    orderReads++;
    return route.fulfill({
      json: { data: { ...order, fulfilment_status: stage }, events, payment: evidence },
    });
  });
  await page.route(`**${orderPath}/fulfilment`, (route) => {
    const input = route.request().postDataJSON();
    expect(input).not.toHaveProperty('tracking');
    if (conflicts) {
      conflicts = false;
      return route.fulfill({ status: 409, json: { message: 'Unavailable transition.' } });
    }
    stage = input.status;
    events.unshift({ actor_id: 1, to_status: stage, note: input.note, created_at: createdAt });
    return route.fulfill({ json: { data: { ...order, fulfilment_status: stage } } });
  });
  await page.route(`**${orderPath}/payments/refresh`, (route) => {
    checks++;
    return route.fulfill({ status: 202, body: '' });
  });

  await page.goto('/pedidos');
  await page.getByLabel('Estado del pago').selectOption('pending_payment');
  await expect(page).toHaveURL(/status=pending_payment/);
  await expect(page.getByRole('heading', { name: 'No hay pedidos para mostrar' })).toBeVisible();
  await page.getByLabel('Estado del pago').selectOption('paid');
  await page.getByLabel('Preparación y entrega').selectOption('unstarted');
  await expect(page).toHaveURL(/fulfilment_status=unstarted/);
  await page.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole('link', { name: `Ver pedido ${reference}` }).click();
  await expect(page.getByRole('heading', { name: 'Pedido 83E8D374' })).toBeVisible();
  await expect(page.getByText('Mostrador de prueba')).toBeVisible();
  await expect(page.getByText('Producto de prueba')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Pagos registrados' })).toContainText('Aprobado');
  await page.screenshot({ path: testInfo.outputPath('order-desktop.png'), fullPage: true });
  await page.getByLabel('Nota interna (opcional)').fill('Revisamos el paquete.');
  await page.getByRole('button', { name: 'Empezar preparación' }).click();
  await expect(page.getByRole('alert')).toContainText('El estado del pedido cambió');
  await expect(page.getByLabel('Nota interna (opcional)')).toHaveValue('Revisamos el paquete.');

  await page.getByRole('button', { name: 'Empezar preparación' }).click();
  await expect(page.getByText('Revisamos el paquete.')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar listo para retirar' }).click();
  await page.getByRole('button', { name: 'Confirmar retiro' }).click();
  await expect(page.getByRole('heading', { name: 'Retiro' })).toBeVisible();
  await expect(page.getByLabel('Nota interna (opcional)')).toHaveCount(0);

  await page.getByRole('button', { name: 'Solicitar verificación del pago' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'El resultado no es inmediato' }),
  ).toBeVisible();
  await expect.poll(() => checks).toBe(1);
  await expect.poll(() => orderReads).toBe(6);
});

test('shows the shipping address and sends tracking only when marking the order as shipped', async ({
  page,
}) => {
  await authorize(page);
  const delivery = {
    ...order,
    shipping_method: 'delivery',
    pickup_address: null,
    fulfilment_status: 'preparing',
    tracking: null as string | null,
    address: {
      recipient: 'Clienta de prueba',
      department: 'Montevideo',
      locality: 'Montevideo',
      street: 'Calle de prueba',
      number: '12B',
    },
  };
  await page.route(`**${orderPath}`, (route) =>
    route.fulfill({ json: { data: delivery, events: [], payment: evidence } }),
  );
  await page.route(`**${orderPath}/fulfilment`, (route) => {
    const input = route.request().postDataJSON();
    expect(input).toEqual({ status: 'shipped', note: null, tracking: 'GUIA-234' });
    delivery.fulfilment_status = input.status;
    delivery.tracking = input.tracking;
    return route.fulfill({ json: { data: delivery } });
  });

  await page.goto(`/pedidos/${reference}`);
  await expect(page.getByText('Calle de prueba 12B')).toBeVisible();
  await page.getByLabel('Código de seguimiento (opcional)').fill('GUIA-234');
  await page.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(page.getByText('GUIA-234')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar como entregado' })).toBeVisible();
});

test('shows the denial and filters notices with links to their protected source', async ({
  page,
}) => {
  await authorize(page);
  let permitted = false;
  await page.route('**/api/v1/admin/notices?*', (route) => {
    if (!permitted) return route.fulfill({ status: 403, json: { message: 'Forbidden.' } });
    const state = new URL(route.request().url()).searchParams.get('state');
    const notice = {
      id: 1,
      kind: 'payment_issue',
      channel: 'panel',
      state: 'active',
      error_code: null,
      issue: 'multiple_approved_payments',
      subject_type: 'order',
      subject_id: 12,
      order_reference: reference,
      updated_at: createdAt,
      attempts: 0,
    };
    const entries = state === 'active' ? [notice] : [];
    return route.fulfill({ json: { data: entries, meta: { ...meta, total: entries.length } } });
  });
  await page.route(`**${orderPath}`, (route) =>
    route.fulfill({ json: { data: order, events: [], payment: evidence } }),
  );

  await page.goto('/pedidos/avisos');
  await expect(page.getByRole('alert')).toContainText('No tenés permiso');
  permitted = true;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'No hay avisos para mostrar' })).toBeVisible();
  await page.getByLabel('Estado del aviso').selectOption('active');
  await expect(page.getByRole('heading', { name: 'Incidencia de pago' })).toBeVisible();
  await expect(page.getByText('Hay más de un pago aprobado para este pedido.')).toBeVisible();
  await page.getByRole('link', { name: 'Ver pedido 83E8D374' }).click();
  await expect(page.getByRole('heading', { name: 'Pedido 83E8D374' })).toBeVisible();
});

test('saves exact settings at 320 px, retains data on error and reads the audit', async ({
  page,
}, testInfo) => {
  await authorize(page);
  let updates = 0;
  const after = { ...settings, delivery_cents: 7599, remind_cart: true };
  await page.route('**/api/v1/admin/settings', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: settings } });
    expect(route.request().postDataJSON()).toEqual({ delivery_cents: 7599, remind_cart: true });
    updates++;
    if (updates === 1)
      return route.fulfill({
        status: 422,
        json: { errors: { delivery_cents: ['Invalid test value.'] } },
      });
    return route.fulfill({ json: { data: after } });
  });
  await page.route('**/api/v1/admin/settings/history?*', (route) =>
    route.fulfill({
      json: {
        ...meta,
        data: [{ id: 1, actor_id: 1, created_at: createdAt, before: settings, after }],
      },
    }),
  );

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/configuracion');
  const price = page.getByLabel('Costo del envío en UYU');
  await expect(price).toHaveValue('50,00');
  await price.fill('75,999');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(price).toBeFocused();
  await expect(page.getByText('Usá un importe entre 0 y 21.474.836,47')).toBeVisible();
  await price.fill('75,99');
  const remindCart = page.getByRole('checkbox', { name: 'Recordar un carrito sin finalizar' });
  await remindCart.focus();
  await page.keyboard.press('Space');
  await expect(remindCart).toBeChecked();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('alert')).toContainText('Tus datos siguen disponibles');
  await expect(price).toHaveValue('75,99');
  await expect(price).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('Guardamos la configuración');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath('settings-mobile.png'), fullPage: true });

  await page.getByRole('link', { name: 'Historial de cambios' }).click();
  await expect(page.getByRole('heading', { name: 'Historial de configuración' })).toBeVisible();
  await page.getByText('Usuario 1').click();
  await expect(page.getByText('Activado', { exact: true })).toBeVisible();
  await expect(page.getByText('Desactivado', { exact: true })).toBeVisible();
  await expect(page.getByText('Costo del envío en UYU')).toBeVisible();
});

test('a verified administrator can record settings and pickup progress through Laravel', async ({
  page,
}) => {
  await page.goto('/configuracion');
  await expect(page.getByRole('heading', { name: 'Ingresar a administración' })).toBeVisible();
  await page.getByLabel('Correo electrónico').fill('ops-admin@camba.test');
  await page.getByLabel('Contraseña').fill('Camba-test-only-2026');
  const session = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/admin/session') && response.ok(),
  );
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nombre comercial')).toHaveValue('Camba');
  await page.getByLabel('Teléfono de contacto').fill('099 121 242');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('Guardamos la configuración');

  const info = await page.request.get('/api/v1/store-info');
  expect(info.ok()).toBeTruthy();
  expect(await info.json()).toMatchObject({ data: { support_phone: '099 121 242' } });

  const { data: operator } = await (await session).json();
  await page.getByRole('link', { name: 'Historial de cambios' }).click();
  await page.getByText(`Usuario ${operator.id}`).click();
  await expect(page.getByText('Teléfono de contacto')).toBeVisible();
  await expect(page.getByText('099 121 242', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  await page.getByRole('link', { name: 'Avisos operativos' }).click();
  await page.getByLabel('Estado del aviso').selectOption('active');
  await page.getByRole('link', { name: 'Ver pedido 11111111' }).click();
  await expect(page.getByRole('heading', { name: 'Pedido 11111111' })).toBeVisible();
  await page.getByLabel('Nota interna (opcional)').fill('Pedido controlado en Chromium.');
  await page.getByRole('button', { name: 'Empezar preparación' }).click();
  await expect(page.getByRole('button', { name: 'Marcar listo para retirar' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pedido controlado en Chromium.')).toBeVisible();

  const refresh = page.waitForResponse(
    (response) =>
      response.url().endsWith('/payments/refresh') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Solicitar verificación del pago' }).click();
  expect((await refresh).status()).toBe(202);
  await expect(
    page.getByRole('status').filter({ hasText: 'El resultado no es inmediato' }),
  ).toBeVisible();
});
