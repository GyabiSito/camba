import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'UTC' });

test('withdrawal receipt shows Montevideo 24-hour time in a UTC browser', async ({ page }) => {
  const reference = randomUUID();
  await page.route('**/api/v1/withdrawals', route => route.fulfill({
    status: 201, json: { data: { reference, received_at: '2026-11-28T02:30:00Z' } },
  }));
  await page.goto('/arrepentimiento');
  await page.getByLabel('Referencia del pedido').fill(randomUUID());
  await page.getByLabel('Correo de la compra').fill('timezone@example.test');
  await page.getByRole('button', { name: 'Registrar solicitud' }).click();
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC');
  await expect(page.getByRole('status', { name: 'Solicitud recibida' })).toContainText('27/11/2026, 23:30');
});

test('withdrawal focuses an invalid reference and describes its visible error', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/arrepentimiento');
  const reference = page.getByLabel('Referencia del pedido');
  const initialBorder = await reference.evaluate(field => getComputedStyle(field).borderTopColor);
  await reference.fill('test');
  await page.getByLabel('Correo de la compra').fill('retracto@camba.test');
  const response = page.waitForRequest(request => request.url().endsWith('/api/v1/withdrawals')
    && request.method() === 'POST', { timeout: 1000 }).catch(() => null);
  await page.getByRole('button', { name: 'Registrar solicitud' }).click();

  await expect(reference).toBeFocused();
  await expect(reference).toHaveAttribute('aria-invalid', 'true');
  await expect(reference).toHaveAttribute('aria-describedby', /withdrawal-reference-error withdrawal-reference-help/);
  await expect(page.getByText('La referencia no es válida.', { exact: true })).toBeVisible();
  await expect.poll(() => reference.evaluate(field => getComputedStyle(field).borderTopColor)).not.toBe(initialBorder);
  expect(await response).toBeNull();
});

test('withdrawal waits for one response and keeps the form after a server error', async ({ page }) => {
  const reference = randomUUID();
  const email = 'retracto@camba.test';
  let release!: () => void;
  const inFlight = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/api/v1/withdrawals', async route => {
    requests++;
    await inFlight;
    await route.fulfill({ status: 503, json: { message: 'El registro no está disponible por el momento.' } });
  });

  await page.goto('/arrepentimiento');
  await page.getByLabel('Referencia del pedido').fill(reference);
  await page.getByLabel('Correo de la compra').fill(email);
  try {
    await page.getByRole('button', { name: 'Registrar solicitud' }).click();
    await expect(page.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    await expect.poll(() => requests).toBe(1);
  } finally {
    release();
  }
  await expect(page.getByRole('alert')).toContainText('No pudimos registrar la solicitud');
  await expect(page.getByLabel('Referencia del pedido')).toHaveValue(reference);
  await expect(page.getByLabel('Correo de la compra')).toHaveValue(email);
  await expect(page.getByRole('button', { name: 'Registrar solicitud' })).toBeEnabled();
  expect(requests).toBe(1);
});

test('public withdrawal provides a neutral receipt and reaches Admin from the orders screen', async ({ page, browser }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/');
  await page.locator('main').getByRole('link', { name: 'Botón de arrepentimiento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Botón de arrepentimiento' })).toBeVisible();
  await page.getByText('Plazos y condiciones del retracto', { exact: true }).click();
  const rule = page.getByText(/Hasta el 31\/12\/2026, el plazo es de 5 días hábiles/);
  await expect(rule).toContainText('10 días corridos');
  await page.getByLabel('Referencia del pedido').fill(randomUUID());
  await page.getByLabel('Correo de la compra').fill('retracto@camba.test');
  const submitted = page.waitForResponse(response => response.url().endsWith('/api/v1/withdrawals') && response.status() === 201)
    .then(async response => (await response.json()).data.reference as string);
  await page.getByRole('button', { name: 'Registrar solicitud' }).click();
  const receipt = await submitted;
  await expect(page.getByRole('status', { name: 'Solicitud recibida' })).toContainText(receipt);
  await expect(page.getByRole('status', { name: 'Solicitud recibida' })).toContainText('solo si la referencia y el correo coinciden');
  await expect(page.getByRole('heading', { name: 'Solicitud recibida' })).toBeFocused();
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.receiptPrint = 'requested'; }; });
  await page.getByRole('button', { name: 'Imprimir o guardar como PDF' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-receipt-print', 'requested');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  const admin = await browser.newPage();
  try {
    await admin.goto(`http://127.0.0.1:${process.env['CAMBA_E2E_ADMIN_PORT'] ?? '43820'}/ingresar`);
    await admin.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
    await admin.getByLabel('Contraseña').fill('Camba-test-only-2026');
    const signedIn = admin.waitForResponse(response => response.url().endsWith('/api/v1/admin/session') && response.ok());
    await admin.getByRole('button', { name: 'Ingresar' }).click();
    await signedIn;
    await admin.waitForURL(url => url.pathname !== '/ingresar');
    await admin.goto(new URL('/pedidos', admin.url()).href);
    await admin.getByRole('link', { name: 'Arrepentimientos' }).click();
    await admin.getByLabel('Buscar solicitudes').fill(receipt);
    await admin.getByRole('button', { name: 'Buscar', exact: true }).click();
    await admin.getByRole('row').filter({ hasText: receipt }).getByRole('link', { name: 'Abrir solicitud' }).click();
    const caseRow = admin.getByRole('region', { name: 'Datos de la solicitud' });
    await expect(caseRow).toContainText('Pedido no identificado');
    await caseRow.getByRole('button', { name: 'Abrir revisión' }).click();
    await expect(caseRow).toContainText('En revisión');
    await expect(caseRow).toContainText('no registrar un reintegro desde esta solicitud');
    await expect(caseRow.getByRole('button', { name: /Vincular pedido|Registrar reintegro/ })).toHaveCount(0);
    await admin.reload();
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
