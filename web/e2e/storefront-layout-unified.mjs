import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const base = process.env.CAMBA_STORE ?? 'http://127.0.0.1:4200';

test('store layout keeps route-aware skip links, home mosaic and keyboard navigation', async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/');
      await expect(page.locator('store-header header')).toHaveCount(1);
      await expect(page.locator('store-footer footer')).toHaveCount(1);
      await expect(page.locator('main store-home-mosaic .closing-mosaic-tile')).toHaveCount(6);
      await expect(page.locator('store-footer .closing-mosaic')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      if (width < 768) {
        const menu = page.getByRole('button', { name: 'Menú de tienda' });
        await menu.focus();
        await menu.press('Enter');
        await expect(page.locator('#home-menu')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toBeFocused();
        await menu.press('Enter');
      }
      await page.getByRole('banner').getByRole('link', { name: 'Tienda', exact: true }).filter({ visible: true }).click();
      await expect(page).toHaveURL(base + '/tienda');
      await expect(page.locator('#home-menu')).toBeHidden();
      await expect(page.locator('.closing-mosaic')).toHaveCount(0);
      const search = page.getByRole('searchbox', { name: 'Buscar en la tienda' });
      await search.fill('camisa');
      await search.press('Enter');
      await expect(page).toHaveURL(url => url.pathname === '/tienda' && url.searchParams.get('q') === 'camisa');
      const current = new URL(page.url());
      const skip = page.getByRole('link', { name: 'Saltar al contenido' });
      await expect(skip).toHaveAttribute('href', '.' + current.pathname + current.search + '#contenido');
      await skip.focus();
      await skip.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      await expect(page).toHaveURL(url => url.pathname === current.pathname && url.search === current.search && url.hash === '#contenido');
      await page.reload();
      await expect(page.locator('store-header header')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toBeVisible();
      expect(errors).toEqual([]);
      await page.close();
    }
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    await noJs.goto(base + '/tienda?category=camisas&q=camisa&page=1');
    const skip = noJs.getByRole('link', { name: 'Saltar al contenido' });
    await skip.focus();
    await skip.press('Enter');
    await expect(noJs).toHaveURL(url => url.pathname === '/tienda' && url.searchParams.get('category') === 'camisas' && url.searchParams.get('q') === 'camisa' && url.searchParams.get('page') === '1' && url.hash === '#contenido');
    await expect(noJs.locator('main')).toBeFocused();
    const filtered = new URL(noJs.url());
    await noJs.getByRole('link', { name: 'Volver arriba' }).click();
    await expect(noJs).toHaveURL(url => url.pathname === filtered.pathname && url.search === filtered.search && url.hash === '#arriba');
    await noJs.close();
  } finally {
    await browser.close();
  }
});

test('header reuses cart quantity and CART_CHANGED refresh', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let quantity = 2;
    await page.route('**/api/v1/cart', route => route.fulfill({ json: { data: { items: [{ quantity }] } } }));
    await page.goto(base + '/tienda');
    const cart = page.getByRole('banner').getByRole('link', { name: 'Carrito, 2', exact: true });
    await expect(cart).toBeVisible();
    quantity = 4;
    await page.evaluate(() => window.dispatchEvent(new Event('camba:cart-changed')));
    await expect(page.getByRole('banner').getByRole('link', { name: 'Carrito, 4', exact: true })).toBeVisible();
    await page.close();
  } finally {
    await browser.close();
  }
});

test('shared header Contacto opens from the top and keeps the wordmark centered', async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      await page.goto(base + '/tienda');
      const header = page.getByRole('banner');
      const menu = header.getByRole('button', { name: 'Menú de tienda' });
      if (width === 390) await menu.click();
      const contact = header.getByRole('link', { name: 'Contacto', exact: true });
      await expect(contact).toHaveAttribute('href', '/contacto');
      await expect(contact).not.toHaveAttribute('aria-current', 'page');
      if (width === 390) {
        await contact.click();
      } else {
        expect(await contact.evaluate(link => [link.previousElementSibling.getAttribute('href'), link.nextElementSibling.getAttribute('href')]))
          .toEqual(['/cuenta', '/carrito']);
        await contact.evaluate(link => link.focus({ preventScroll: true }));
        await page.evaluate(() => scrollTo({ top: 180, behavior: 'instant' }));
        expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
        await page.keyboard.press('Enter');
      }
      await expect(page).toHaveURL(base + '/contacto');
      await expect(page.getByRole('heading', { name: 'Contactanos', level: 1, exact: true })).toBeInViewport();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      if (width === 390) {
        await expect(page.locator('#home-menu')).toBeHidden();
        await menu.click();
      }
      await expect(contact).toHaveAttribute('aria-current', 'page');
      expect(await header.getByRole('link', { name: 'Camba, inicio' }).evaluate(link => {
        const { left, width } = link.getBoundingClientRect();
        return Math.abs(left + width / 2 - document.documentElement.clientWidth / 2);
      })).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
