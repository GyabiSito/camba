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
    viewport: { width: 320, height: 800 },
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
    const address = checkout.getByRole('group', { name: 'Dirección de entrega' });
    const quoteForCoveredAddress = async () => {
      await address.getByRole('combobox', { name: 'Departamento', exact: true }).fill('Canelones');
      await address.getByRole('option', { name: 'Canelones', exact: true }).click();
      await address.getByRole('combobox', { name: 'Localidad', exact: true }).fill('Las Piedras');
      const quoting = checkout.waitForResponse(response => response.url().endsWith('/api/v1/checkout/quote') &&
        response.request().method() === 'POST' && !!response.request().postDataJSON()?.address);
      await address.getByRole('option', { name: 'Las Piedras', exact: true }).click();
      const quote = await quoting;
      expect(quote.status()).toBe(200);
      const { data } = await quote.json();
      expect(data.subtotal_cents).toBe(89000);
      return data.shipping_options.find((option: { method: string }) => option.method === 'delivery');
    };
    const summary = checkout.getByRole('complementary', { name: 'Resumen de la compra' });
    const amount = (label: string) => summary.getByText(label, { exact: true }).locator('..').getByRole('definition');
    const eligible = checkout.getByRole('radio', { name: /Entrega a domicilio.*Envío gratis en zonas con cobertura/ });
    await expect(eligible).toBeVisible();
    await eligible.check();
    await expect(amount('Entrega')).toHaveText('Envío gratis en zonas con cobertura');
    await expect(amount('Total en UYU')).toHaveCount(0);
    await expect.poll(() => checkout.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await eligible.scrollIntoViewIfNeeded();
    await checkout.screenshot({ path: info.outputPath('checkout-antes-de-cotizar-320.png') });
    await checkout.setViewportSize({ width: 1440, height: 960 });
    expect(await quoteForCoveredAddress())
      .toMatchObject({ shipping_cents: 0, total_cents: 89000, free_delivery_applied: true });
    await expect(checkout.getByRole('radio', { name: 'Entrega a domicilio Envío gratis', exact: true })).toBeChecked();
    await expect(summary.getByText('Envío gratis', { exact: true })).toHaveCount(1);
    await expect(amount('Entrega')).toHaveText('Envío gratis');
    await expect(amount('Total en UYU')).toHaveText('UYU 890');
    await checkout.screenshot({ path: info.outputPath('checkout-envio-gratis.png') });
    await checkout.getByRole('radio', { name: /Retiro/ }).check();
    await expect(amount('Retiro')).toHaveText('Sin costo');
    await expect(summary.getByText('Envío gratis', { exact: true })).toHaveCount(0);

    await minimum.fill('890,01');
    await save.click();
    await expect(saved).toBeVisible();
    await expect(minimum).toHaveValue('890,01');
    await checkout.reload();
    await checkout.getByRole('radio', { name: /Entrega a domicilio.*185/ }).check();
    await expect(eligible).toHaveCount(0);
    const standard = await quoteForCoveredAddress();
    expect(standard).toMatchObject({ shipping_cents: 18500, total_cents: 107500 });
    expect(standard).not.toHaveProperty('free_delivery_applied');
    await expect(amount('Entrega')).toHaveText('UYU 185');
    await expect(amount('Total en UYU')).toHaveText('UYU 1.075');
  } finally {
    await store.close();
  }

  await enabled.uncheck();
  await save.click();
  await expect(saved).toBeVisible();
  await page.reload();
  await expect(enabled).not.toBeChecked();
  await expect(minimum).toBeDisabled();
  await expect(minimum).toHaveValue('890,01');
});

test('el aviso del carrito sigue el mínimo configurado y cambia con los productos guardados', async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  await page.goto('/configuracion');
  await page.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  const enabled = page.getByRole('checkbox', { name: 'Activar envío gratis desde un monto' });
  const minimum = page.getByLabel('Monto mínimo (UYU)', { exact: true });
  const save = page.getByRole('button', { name: 'Guardar cambios' });
  const saved = page.getByText('Guardamos la configuración.', { exact: true });
  await enabled.check();
  await minimum.fill('2500,00');
  await save.click();
  await expect(saved).toBeVisible();

  const store = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env['CAMBA_E2E_STORE_PORT'] ?? '43821'}`,
    viewport: { width: 1440, height: 960 },
  });
  try {
    const cart = await store.newPage();
    await cart.goto('/carrito');
    await cart.getByLabel('Correo electrónico').fill('buyer-free-delivery-cart@camba.test');
    await cart.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
    await cart.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(cart).toHaveURL(/\/carrito$/);
    for (const slug of ['remera-lisa', 'remera-con-bolsillo']) {
      await cart.goto(`/producto/${slug}`);
      await cart.getByRole('button', { name: 'Agregar al carrito' }).click();
      await cart.getByRole('dialog').getByRole('button', { name: 'Seguir comprando' }).click();
    }
    await cart.goto('/carrito');
    const summary = cart.getByRole('complementary', { name: 'Resumen del carrito' });
    const offer = summary.getByText('Envío gratis a partir de UYU 2.500', { exact: true });
    const proceed = summary.getByRole('link', { name: 'Continuar la compra' });
    await expect(offer).toBeVisible();
    await expect(summary.getByText('Te faltan UYU 620 para alcanzar el mínimo', { exact: true })).toBeVisible();
    expect((await offer.boundingBox())!.y).toBeLessThan((await proceed.boundingBox())!.y);
    await cart.screenshot({ path: info.outputPath('carrito-envio-gratis-escritorio.png') });

    await cart.setViewportSize({ width: 320, height: 800 });
    await expect(offer).toBeVisible();
    await expect.poll(() => cart.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    const line = cart.getByRole('listitem').filter({ has: cart.getByRole('link', { name: 'Remera lisa', exact: true }) });
    await line.getByRole('spinbutton').fill('2');
    await line.getByRole('button', { name: 'Actualizar' }).click();
    await expect(summary.getByText('Tu compra ya alcanza el mínimo. Aplica en zonas con cobertura', { exact: true })).toBeVisible();
    await offer.scrollIntoViewIfNeeded();
    await cart.screenshot({ path: info.outputPath('carrito-envio-gratis-320.png') });

    await cart.getByRole('button', { name: 'Quitar Remera con bolsillo' }).click();
    await expect(summary.getByText('Te faltan UYU 720 para alcanzar el mínimo', { exact: true })).toBeVisible();

    await enabled.uncheck();
    await save.click();
    await expect(saved).toBeVisible();
    await cart.reload();
    await expect(proceed).toBeVisible();
    await expect(offer).toHaveCount(0);
    await expect(summary.getByText(/Te faltan|alcanza el mínimo/)).toHaveCount(0);
  } finally {
    await store.close();
    if (await enabled.isChecked()) {
      await enabled.uncheck();
      await save.click();
      await expect(saved).toBeVisible();
    }
  }
});
