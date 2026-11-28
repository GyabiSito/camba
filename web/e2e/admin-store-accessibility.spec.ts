import { expect, test, type Locator, type Page } from '@playwright/test';

async function contrast(locator: Locator) {
  return locator.evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const layers = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      layers.unshift(getComputedStyle(node).backgroundColor);
    }
    const luminance = () => [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
      .map((value) => value / 255)
      .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    for (const color of ['white', ...layers]) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
    }
    const background = luminance();
    context.fillStyle = getComputedStyle(element).color;
    context.fillRect(0, 0, 1, 1);
    const foreground = luminance();
    return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
  });
}

async function reflow(page: Page) {
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.setViewportSize({ width: 640, height: 900 });
  const size = await page.locator('html').evaluate((html) => parseFloat(getComputedStyle(html).fontSize));
  const zoom = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect.poll(() => page.locator('html').evaluate((html) => parseFloat(getComputedStyle(html).fontSize))).toBe(size * 2);
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await zoom.evaluate((sheet) => sheet.remove());
  await page.setViewportSize({ width: 320, height: 850 });
  await expect.poll(overflow).toBeLessThanOrEqual(1);
}

test('visible keyboard focus, reduced motion, form errors, contrast and reflow', async ({ page }, info) => {
  const admin = info.project.name === 'admin';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(admin ? '/ingresar?next=%2Fproductos' : '/cuenta');
  const submit = page.getByRole('button', { name: 'Ingresar', exact: true });
  await page.getByLabel('Correo electrónico').fill('no-existe-accesibilidad@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-a11y-invalida');
  await submit.click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await contrast(page.getByRole('alert'))).toBeGreaterThanOrEqual(4.5);
  expect(await contrast(submit)).toBeGreaterThanOrEqual(4.5);

  if (admin) {
    await page.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
    await submit.click();
    await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('published');
    const published = page.locator('.status-pill').filter({ hasText: 'Publicado' }).first();
    await expect(published).toBeVisible();
    expect(await contrast(published)).toBeGreaterThanOrEqual(4.5);
    await page.goto('/productos');
    await expect(page.getByRole('table', { name: 'Inventario de productos' })).toBeVisible();
  } else {
    await page.goto('/tienda');
    await expect(page.getByRole('link', { name: 'Remera lisa', exact: true })).toBeVisible();
  }

  const current = new URL(page.url());
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  expect(await skip.evaluate((link) => parseFloat(getComputedStyle(link).outlineWidth))).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await expect(page).toHaveURL((url) => url.pathname === current.pathname && url.search === current.search && url.hash === '#contenido');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await page.locator('main').evaluate((main) => parseFloat(getComputedStyle(main).animationDuration))).toBeLessThan(.01);
  await reflow(page);
  await page.screenshot({ path: info.outputPath(`${info.project.name}-320-reflow.png`), fullPage: true });
});
