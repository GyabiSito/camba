import { test } from 'node:test';
import { mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

const base = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44822';
const captures = 'test-results/home-mosaic';

test('the first shopping surface is the category mosaic and the later editorial links to its SKU', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    await page.goto(base);
    const panels = page.getByRole('region', { name: 'Comprá por categoría' }).getByRole('link');
    await expect(panels).toHaveText(['Remeras', 'Camisas', 'Pantalones']);
    expect((await panels.first().boundingBox()).width).toBeGreaterThan(1.8 * (await panels.nth(1).boundingBox()).width);
    expect((await panels.first().boundingBox()).y).toBeLessThan(230);
    const shelf = page.getByRole('heading', { name: 'Selección de Camba' });
    const editorial = page.getByRole('region', { name: 'De cerca' });
    expect((await editorial.boundingBox()).y).toBeGreaterThan((await shelf.boundingBox()).y);
    await expect(editorial.locator('img')).toHaveAttribute('src', '/demo-home/camba-escaparate-detalle.webp');
    await expect(editorial.getByRole('link')).toHaveAttribute('href', '/producto/remera-recta-carbon');
  } finally {
    await browser.close();
  }
});

test('home exposes the SSR mosaic and the demo category-to-product path at narrow widths', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(base);
    const html = await (await page.request.get(base)).text();
    expect(html.match(/<h1[^>]*>[^<]+<\/h1>/)?.[0]).toMatch(/>Vestite distinto\.<\/h1>/);
    expect(html).toContain('camba-escaparate-mobile.webp');
    expect(html).toContain('/brand/camba.svg');
    const primary = page.getByRole('link', { name: 'Ver todo el catálogo' });
    await expect(primary).toHaveAttribute('href', '/tienda');
    expect((await primary.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('store-product-grid li')).toHaveCount(7);
    await expect(page.locator('store-product-grid').getByText('Sin stock', { exact: true })).toBeVisible();
    const lead = page.locator('.category-panel img').first();
    await expect.poll(() => lead.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => performance.getEntriesByType('resource')
      .filter(({ name }) => /camba-escaparate-(desktop|mobile)\.webp/.test(name))
      .map(({ name }) => new URL(name).pathname)))
      .toEqual(['/demo-home/camba-escaparate-mobile.webp']);

    const categories = page.getByRole('region', { name: 'Comprá por categoría' });
    const shirts = categories.getByRole('link', { name: 'Remeras', exact: true });
    await expect(shirts).toHaveAttribute('href', '/tienda?category=remeras');
    await shirts.focus();
    expect(await shirts.locator('svg').evaluate(el => el.style.transform)).toBe('');
    expect(await page.locator('.editorial-accent').evaluate(el => el.style.transform)).toBe('');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tienda\?category=remeras$/);
    await page.reload();
    await page.getByRole('link', { name: 'Remera recta carbón', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Remera recta carbón' })).toBeVisible();
    await expect(page.getByRole('banner').locator('img')).toHaveCount(0);

    await page.getByRole('link', { name: 'Camba, inicio' }).click();
    await primary.click();
    await expect(page).toHaveURL(`${base}/tienda`);
    await page.goto(base);
    const header = page.getByRole('banner');
    await header.getByRole('searchbox', { name: 'Buscar productos' }).fill('marino');
    await header.getByRole('searchbox', { name: 'Buscar productos' }).press('Enter');
    await expect(page).toHaveURL(`${base}/tienda?q=marino`);
    for (const [name, route] of [['Mi cuenta', '/cuenta'], ['Carrito', '/carrito']]) {
      await page.goto(base);
      await header.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(base + route);
    }
    await page.goto(base);
    const footer = page.getByRole('contentinfo');
    await footer.getByRole('link', { name: 'Contactanos' }).click();
    await expect(page).toHaveURL(base + '/contacto');
    await expect(page.getByText('Por ahora no hay canales de atención publicados.')).toBeVisible();

    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(base);
    await page.reload();
    await expect(primary).toBeVisible();

    await page.setViewportSize({ width: 768, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
    await page.setViewportSize({ width: 320, height: 740 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await expect(primary).toBeVisible();
    await expect(page.getByRole('link', { name: 'Camisa de manga larga azul marino', exact: true })).toBeVisible();

    await page.route('**/demo-home/*.webp', route => route.abort());
    await page.route('**/demo/image-plain.webp', route => route.abort());
    await page.goto(base);
    await expect(shirts.locator('img')).toHaveCount(0);
    await expect(page.getByText('Foto no disponible').first()).toBeVisible();
    await expect(shirts).toHaveAttribute('href', '/tienda?category=remeras');
    await page.unroute('**/demo-home/*.webp');
    await page.unroute('**/demo/image-plain.webp');

    if (process.env.CAMBA_HOME_CAPTURE === '1') {
      mkdirSync(captures, { recursive: true });
      for (const [width, height] of [[1440, 900], [1280, 800], [768, 900], [390, 844], [320, 800]]) {
        await page.setViewportSize({ width, height });
        await page.goto(base, { waitUntil: 'networkidle' });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await page.locator('.category-panel img').first().evaluate(img => img.decode());
        await page.screenshot({ path: `${captures}/after-${width}x${height}.png` });
        if (width === 1440 || width === 390) {
          await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
          await page.locator('store-product-grid img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
          await page.locator('.editorial img').evaluate(img => img.decode());
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: `${captures}/after-full-${width}x${height}.png`, fullPage: true });
        }
      }
    }
  } finally {
    await browser.close();
  }
});

test('Anime.js nudges decorative arrows and cleans up on each departure', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    for (let visit = 0; visit < 2; visit++) {
      const action = page.getByRole('region', { name: 'Comprá por categoría' })
        .getByRole('link', { name: 'Remeras', exact: true });
      const arrow = action.locator('svg');
      const underline = action.locator('i');
      const accent = page.locator('.editorial-accent');
      expect(await accent.evaluate(el => el.style.transform)).toBe('');
      await accent.scrollIntoViewIfNeeded();
      await expect.poll(() => accent.evaluate(el => el.style.transform)).toContain('translateX(0px)');
      await action.hover();
      await expect.poll(() => arrow.evaluate(el => el.style.transform)).toContain('translateX(5px)');
      await expect.poll(() => underline.evaluate(el => el.style.transform)).toContain('scaleX(1)');
      await page.mouse.move(0, 0);
      await expect.poll(() => arrow.evaluate(el => el.style.transform)).toContain('translateX(0px)');
      await page.keyboard.press('Tab');
      await action.focus();
      await expect.poll(() => arrow.evaluate(el => el.style.transform)).toContain('translateX(5px)');
      const previousArrow = await arrow.elementHandle();
      await action.press('Enter');
      await expect(page).toHaveURL(`${base}/tienda?category=remeras`);
      await expect.poll(() => previousArrow.evaluate(el => el.style.transform)).toBe('');
      await page.getByRole('link', { name: 'Camba, inicio' }).click();
      await expect(page).toHaveURL(`${base}/`);
    }
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});

test('the home category and product are usable on a touch viewport', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(base);
    const categories = page.getByRole('region', { name: 'Comprá por categoría' });
    const category = categories.getByRole('link', { name: 'Remeras', exact: true });
    const box = await category.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await category.tap();
    await page.getByRole('link', { name: 'Remera recta carbón', exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Remera recta carbón' })).toBeVisible();
  } finally {
    await browser.close();
  }
});

test('the dev server does not need the motion import for navigation', {
  skip: !!process.env.CAMBA_DEMO_STORE, // The Vite dependency names do not apply to optimized bundles.
}, async () => {
  const browser = await chromium.launch();
  try {
    for (const delayed of [false, true]) {
      const page = await browser.newPage({ reducedMotion: 'no-preference' });
      const requests = [];
      await page.route('**/animejs_*.js*', route => {
        requests.push(route);
        if (!delayed) return route.abort();
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const category = page.getByRole('region', { name: 'Comprá por categoría' }).getByRole('link', { name: 'Remeras' });
      await category.hover();
      await expect.poll(() => requests.length).toBeGreaterThan(0);
      const home = await page.locator('store-home').elementHandle();
      await category.click();
      await expect(page).toHaveURL(`${base}/tienda?category=remeras`);
      if (delayed) {
        await Promise.all(requests.map(route => route.continue()));
        await page.waitForLoadState('networkidle');
      }
      expect(await home.evaluate(element => ({ connected: element.isConnected,
        animated: !!element.querySelector('svg[style]') }))).toEqual({ connected: false, animated: false });
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
