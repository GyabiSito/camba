import { expect, test } from '@playwright/test';

test('a guest reviews the server quote before placing an order', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/producto/remera-lisa');
  const added = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/cart/items/') && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: /agregar al carrito/i }).click();
  expect((await added).ok()).toBeTruthy();
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

test('a buyer edits profile and saves reminder preferences after signing in', async ({
  page,
}, info) => {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill('buyer@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Tu cuenta' })).toBeVisible();
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
