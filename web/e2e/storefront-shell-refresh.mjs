import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const base = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44822';

test('editorial storefront shell is shared without duplicating the home mosaic', async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 768, reducedMotion: 'reduce' });
      for (const path of ['/', '/tienda', '/cuenta']) {
        await page.goto(base + path);
        const header = page.getByRole('banner');
        await expect(header.locator('img')).toHaveAttribute('src', '/brand/camba.svg');
        await expect(page.getByRole('contentinfo')).toHaveClass('home-footer');
        await expect(page.locator('.closing-mosaic-tile')).toHaveCount(path === '/' ? 6 : 0);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        if (width < 768) await header.getByRole('button', { name: 'Menú de tienda' }).click();
        const storeLink = header.getByRole('link', { name: 'Tienda', exact: true });
        await expect(storeLink).toHaveAttribute('href', '/tienda');
        await expect(header.getByRole('link', { name: 'Ayuda', exact: true })).toHaveCount(0);
        await expect(page.getByRole('contentinfo').getByRole('region', { name: 'Ayuda' })).toBeVisible();
        const homeLink = header.getByRole('link', { name: 'Inicio', exact: true });
        await expect(homeLink).toHaveAttribute('href', '/');
        if (path === '/') {
          await expect(homeLink).toHaveAttribute('aria-current', 'page');
        } else {
          await expect(homeLink).not.toHaveAttribute('aria-current', 'page');
          if (width < 768) await homeLink.tap();
          else await homeLink.press('Enter');
          await expect(page).toHaveURL(base + '/');
          await expect(header.locator('#home-menu')).toBeHidden();
        }
      }
      await page.goto(base + '/tienda');
      const look = page.getByRole('contentinfo').getByRole('link', { name: 'Armá el look' });
      await expect(look).toHaveAttribute('href', '/#look-title');
      await look.click();
      await expect(page).toHaveURL(base + '/#look-title');
      await expect(page.locator('#look-title')).toBeFocused();
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
