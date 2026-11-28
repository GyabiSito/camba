import { expect, test } from '@playwright/test';

test('configura el mínimo y el checkout muestra el envío gratis cotizado por Laravel', async ({ page, browser }, info) => {
  test.setTimeout(110_000);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/configuracion');
  await page.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  const enabled = page.getByRole('checkbox', { name: 'Activar envío gratis desde un monto' });
  const minimum = page.getByLabel('Monto mínimo (UYU)', { exact: true });
  const save = page.getByRole('button', { name: 'Guardar cambios' });
  const saved = page.getByText('Guardamos la configuración.', { exact: true });
  await expect(page.getByLabel('Costo del envío en UYU', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(enabled).toBeVisible();
  await expect(enabled).not.toBeChecked();
  await expect(minimum).toBeDisabled();
  await enabled.check();
  await minimum.fill('0');
  await save.click();
  await expect(minimum).toHaveAttribute('aria-invalid', 'true');
  await expect(minimum).toBeFocused();
  await minimum.fill('890,001');
  await save.click();
  await expect(minimum).toHaveAttribute('aria-invalid', 'true');
  await minimum.fill('890,00');
  const written = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/settings') &&
    response.request().method() === 'PATCH');
  await save.click();
  const patch = await written;
  expect(patch.status()).toBe(200);
  expect(patch.request().postDataJSON()).toMatchObject({ free_delivery_enabled: true, free_delivery_minimum_cents: 89000 });
  await expect(saved).toBeVisible();
  await page.reload();
  await expect(enabled).toBeChecked();
  await expect(minimum).toHaveValue('890,00');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await minimum.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('admin-envio-gratis-320.png') });

  const store = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env['CAMBA_E2E_STORE_PORT'] ?? '43821'}`,
    viewport: { width: 1440, height: 960 },
  });
  try {
    const checkout = await store.newPage();
    await checkout.goto('/carrito');
    await checkout.getByLabel('Correo electrónico').fill('buyer-payment-retry@camba.test');
    await checkout.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
    await checkout.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(checkout).toHaveURL(/\/carrito$/);
    await checkout.goto('/producto/remera-lisa');
    await checkout.getByRole('button', { name: 'Agregar al carrito' }).click();
    await checkout.getByRole('dialog').getByRole('button', { name: 'Seguir comprando' }).click();
    await checkout.goto('/checkout');
    await checkout.getByRole('radio', { name: /Entrega a domicilio.*185/ }).check();
    const address = checkout.getByRole('group', { name: 'Dirección de entrega' });
    await address.getByRole('combobox', { name: 'Departamento', exact: true }).fill('Canelones');
    await address.getByRole('option', { name: 'Canelones', exact: true }).click();
    await address.getByRole('combobox', { name: 'Localidad', exact: true }).fill('Las Piedras');
    const quoting = checkout.waitForResponse(response => response.url().endsWith('/api/v1/checkout/quote') &&
      !!response.request().postDataJSON()?.address);
    await address.getByRole('option', { name: 'Las Piedras', exact: true }).click();
    const quote = await quoting;
    expect(quote.status()).toBe(200);
    const { data } = await quote.json();
    expect(data.subtotal_cents).toBe(89000);
    expect(data.shipping_options.find((option: { method: string }) => option.method === 'delivery'))
      .toMatchObject({ shipping_cents: 0, total_cents: 89000, free_delivery_applied: true });
    const summary = checkout.getByRole('complementary', { name: 'Resumen de la compra' });
    await expect(summary.getByText('Entrega', { exact: true }).locator('..').getByRole('definition'))
      .toHaveText('Envío gratis');
    await expect(summary.getByText('Total en UYU', { exact: true }).locator('..').getByRole('definition'))
      .toHaveText('UYU 890');
    await checkout.screenshot({ path: info.outputPath('checkout-envio-gratis.png') });
    await checkout.getByRole('radio', { name: /Retiro/ }).check();
    await expect(summary.getByText('Retiro', { exact: true }).locator('..').getByRole('definition'))
      .toHaveText('Sin costo');
    await expect(summary.getByText('Envío gratis', { exact: true })).toHaveCount(0);
  } finally {
    await store.close();
  }

  await minimum.fill('890,01');
  await save.click();
  await expect(saved).toBeVisible();
  await expect(minimum).toHaveValue('890,01');
  await enabled.uncheck();
  await save.click();
  await expect(saved).toBeVisible();
  await page.reload();
  await expect(enabled).not.toBeChecked();
  await expect(minimum).toBeDisabled();
  await expect(minimum).toHaveValue('890,01');
});
