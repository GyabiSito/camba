import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4300';
const password = process.env.CAMBA_DEMO_PASSWORD;
assert(password, 'Set CAMBA_DEMO_PASSWORD to the documented local demo password.');
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const menu = page.getByRole('button', { name: 'Menú', exact: true });
  const navigation = page.getByRole('navigation', { name: 'Administración' });
  const current = navigation.locator('a[aria-current="page"]');
  const active = navigation.locator('a.active');
  const checkCurrent = async (label) => {
    await expect(current).toHaveText(label);
    await expect(active).toHaveText(label);
  };
  await page.goto(origin + '/productos');
  await page.getByLabel('Correo electrónico').fill('admin.diseno@camba.test');
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, label] of [['categorias', 'Categorías'], ['marcas', 'Marcas']]) {
      await page.goto(origin + '/pedidos');
      await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible();
      if (width === 390) await menu.click();
      await checkCurrent('Pedidos');
      const section = navigation.getByRole('link', { name: label, exact: true });
      await expect(section).toHaveAttribute('href', `/productos/${route}`);
      await section.click();
      await expect(page).toHaveURL(`${origin}/productos/${route}`);
      const heading = page.getByRole('heading', { name: label, exact: true });
      await expect(heading).toBeVisible();
      await expect(page.getByRole('table', { name: label })).toBeVisible();
      if (width === 390) {
        await expect(menu).toHaveAttribute('aria-expanded', 'false');
        await menu.click();
      }
      await checkCurrent(label);
      await page.reload();
      await expect(heading).toBeVisible();
      if (width === 390) await menu.click();
      await checkCurrent(label);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + '/productos/clasificaciones');
  await expect(page).toHaveURL(origin + '/productos/categorias');
  await checkCurrent('Categorías');
  await page.goto(origin + '/productos/nuevo');
  await checkCurrent('Productos');
  console.log('Classifications navigation passed from Orders, after reload, on desktop and mobile.');
} finally {
  await browser.close();
}
