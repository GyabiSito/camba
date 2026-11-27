import { expect, test } from '@playwright/test';

for (const fiscalName of [null, 'Empresa de prueba S.A.']) {
  test(`legal identity is ${fiscalName ? 'published' : 'draft'} on route navigation`, async ({ page }) => {
    await page.goto('/cuenta');
    await page.route('**/api/v1/store-info', route => route.fulfill({ json: { data: {
      business_name: 'Camba', fiscalName, support_email: null, support_phone: null,
      pickup_address: null, delivery_cents: null, checkout_pro_available: false,
    } } }));
    for (const title of ['Términos y condiciones', 'Política de privacidad']) {
      await page.setViewportSize({ width: title.startsWith('T') ? 1586 : 320, height: 992 });
      await page.getByRole('contentinfo').getByRole('link', { name: title, exact: true }).click();
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      if (fiscalName) {
        await expect(page.getByRole('main')).toContainText(fiscalName);
        await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
        await expect(page.getByText(/Borrador: falta completar/)).toHaveCount(0);
      } else {
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
        await expect(page.locator('[help-draft]')).toContainText('falta completar la denominación fiscal');
      }
      const screenshots = process.env['CAMBA_LEGAL_SCREENSHOT_DIR'];
      if (screenshots) await page.screenshot({ path: `${screenshots}/${title.startsWith('T') ? 'terms-desktop' : 'privacy-mobile'}-${fiscalName ? 'published' : 'draft'}.png`, fullPage: true });
    }
  });
}

test('SSR keeps a missing fiscal name in draft after reload', async ({ page }) => {
  for (const route of ['/terminos-y-condiciones?version=2026-11-27-v2', '/politica-de-privacidad']) {
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    if (route.startsWith('/terminos')) await expect(page.getByRole('button', { name: 'Imprimir o guardar como PDF' })).toBeVisible();
    await expect(page.locator('[help-draft]')).toContainText('falta completar la denominación fiscal');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await page.reload();
    if (route.startsWith('/terminos')) await expect(page.getByRole('button', { name: 'Imprimir o guardar como PDF' })).toBeVisible();
    await expect(page.locator('[help-draft]')).toContainText('falta completar la denominación fiscal');
  }
});
