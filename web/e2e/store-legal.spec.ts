import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('public withdrawal provides a neutral receipt and reaches Admin from the orders screen', async ({ page, browser }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/');
  await page.locator('main').getByRole('link', { name: 'Botón de arrepentimiento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Botón de arrepentimiento' })).toBeVisible();
  const rule = page.getByText(/Hasta el 31\/12\/2026, el plazo es de 5 días hábiles/);
  await expect(rule).toContainText('10 días corridos');
  await page.getByLabel('Referencia del pedido').fill(randomUUID());
  await page.getByLabel('Correo de la compra').fill('retracto@camba.test');
  const submitted = page.waitForResponse(response => response.url().endsWith('/api/v1/withdrawals') && response.status() === 201)
    .then(async response => (await response.json()).data.reference as string);
  await page.getByRole('button', { name: 'Registrar solicitud' }).click();
  const receipt = await submitted;
  await expect(page.getByRole('status').filter({ hasText: 'Recibimos tu solicitud' })).toContainText(receipt);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  const admin = await browser.newPage();
  try {
    await admin.goto(`http://127.0.0.1:${process.env['CAMBA_E2E_ADMIN_PORT'] ?? '43820'}/ingresar`);
    await admin.getByLabel('Correo electrónico').fill('legal-admin@camba.test');
    await admin.getByLabel('Contraseña').fill('Camba-test-only-2026');
    const signedIn = admin.waitForResponse(response => response.url().endsWith('/api/v1/admin/session') && response.ok());
    await admin.getByRole('button', { name: 'Ingresar' }).click();
    await signedIn;
    await admin.waitForURL(url => url.pathname !== '/ingresar');
    await admin.goto(new URL('/pedidos', admin.url()).href);
    await admin.getByRole('link', { name: 'Arrepentimientos' }).click();
    const caseRow = admin.getByRole('listitem').filter({ hasText: receipt });
    await expect(caseRow).toContainText('Pedido no identificado');
    await caseRow.getByRole('button', { name: 'Abrir revisión' }).click();
    await expect(caseRow).toContainText('En revisión');
    await caseRow.getByRole('button', { name: 'Vincular pedido verificado' }).click();
    await expect(admin.getByRole('alert')).toBeVisible();
    await expect(admin.getByText('Solicitud actualizada.', { exact: true })).toHaveCount(0);
    await admin.getByRole('button', { name: 'Actualizar solicitudes' }).click();
    await expect(caseRow).toContainText('En revisión');
  } finally {
    await admin.close();
  }

  await page.goto('/terminos-y-condiciones?version=2026-11-27');
  await expect(page.getByText('170245740012').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimir o guardar como PDF' })).toBeVisible();
  await expect(page.getByText(/10 días hábiles siguientes a la recepción/)).toBeVisible();
  await page.goto('/politica-de-privacidad');
  await expect(page.getByText(/María Valeria Hernández/)).toBeVisible();
  await expect(page.getByText('5 días hábiles', { exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Contactanos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contactanos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'contacto@camba.com.uy' }).first()).toHaveAttribute('href', 'mailto:contacto@camba.com.uy');
});
