import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const base = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44822';

test('the home header opens Tienda directly on desktop and from the mobile menu', async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      const mobile = width === 390;
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: mobile });
      const header = page.getByRole('banner');
      const menu = header.getByRole('button', { name: 'Menú de tienda' });
      const popover = header.locator('#home-menu');
      for (const keyboard of [false, true]) {
        await page.goto(base);
        if (mobile) {
          await expect(menu.locator('svg')).toHaveCount(0);
          if (keyboard) await menu.press('Enter');
          else await menu.tap();
          await expect(popover).toBeVisible();
        } else {
          await expect(menu).toBeHidden();
          await expect(popover).toBeHidden();
        }
        const shop = (mobile ? popover : header).getByRole('link', { name: 'Tienda', exact: true });
        await expect(shop).toHaveAttribute('href', '/tienda');
        if (keyboard) {
          await page.keyboard.press('Tab');
          await shop.focus();
          await expect(shop).toHaveCSS('outline-style', 'solid');
          await shop.press('Enter');
        } else if (mobile) await shop.tap();
        else await shop.click();
        await expect(page).toHaveURL(base + '/tienda');
        await expect(page.getByRole('main').getByRole('searchbox', { name: 'Buscar en la tienda' })).toBeVisible();
        await expect(popover).toBeHidden();
      }
      await page.close();
    }
  } finally { await browser.close(); }
});

test('the mosaic touches the story and the catalog link sits under the lockup', async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, javaScriptEnabled: width !== 1440 });
      await page.goto(base);
      await expect(page.getByRole('heading', { name: 'Explorá Camba' })).toHaveCount(0);
      const gallery = page.getByRole('region', { name: 'Galería editorial de Camba' });
      await expect(page.getByRole('link', { name: 'Ver la prenda', exact: true })).toHaveCount(0);
      const brand = gallery.locator('.closing-mosaic-brand');
      const link = brand.getByRole('link', { name: 'Ver catálogo' });
      await expect(link).toBeVisible();
      const layout = await brand.evaluate(el => {
        const logo = el.querySelector('.closing-lockup').getBoundingClientRect();
        const link = el.querySelector('a').getBoundingClientRect();
        const story = document.querySelector('.story').getBoundingClientRect();
        const mosaic = document.querySelector('.closing-mosaic');
        return {
          attached: Math.abs(story.bottom - mosaic.getBoundingClientRect().top) < 1,
          underLogo: link.top > logo.bottom && Math.abs((logo.left + logo.right) - (link.left + link.right)) < 2,
          firstPhotos: [...mosaic.querySelectorAll('.closing-mosaic-tile')].slice(0, window.innerWidth > 768 ? 3 : 2)
            .map(tile => tile.classList[1]),
        };
      });
      expect(layout).toEqual({ attached: true, underLogo: true,
        firstPhotos: ['closing-tile-remeras', 'closing-tile-cierre-silueta', 'closing-tile-cierre-trama'].slice(0, width === 1440 ? 3 : 2) });
      await expect(link).toHaveAttribute('href', '/tienda');
      await page.keyboard.press('Tab');
      await link.focus();
      await expect(link).toHaveCSS('outline-style', 'solid');
      await link.press('Enter');
      await expect(page).toHaveURL(base + '/tienda');
      await page.close();
    }
  } finally { await browser.close(); }
});

test('home closing shows its editorial mosaic at desktop and phone widths', async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 }, reducedMotion: 'reduce',
        javaScriptEnabled: width !== 1440,
      });
      await page.goto(base);
      const mosaic = page.getByRole('region', { name: 'Galería editorial de Camba' }).locator('.closing-mosaic');
      await expect(mosaic).toBeVisible();
      await mosaic.scrollIntoViewIfNeeded();
      await expect(mosaic.locator('img')).toHaveCount(7);
      const layout = await mosaic.evaluate(async el => {
        const brand = el.querySelector('.closing-mosaic-brand');
        const cells = [...el.querySelectorAll('.closing-mosaic-tile')];
        const images = await Promise.all([...el.querySelectorAll('img')].map(async img => {
          await img.decode();
          return img.naturalWidth;
        }));
        return {
          columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
          tileWidth: brand.getBoundingClientRect().width,
          width: el.getBoundingClientRect().width,
          pageWidth: document.documentElement.scrollWidth,
          first: cells[0].getBoundingClientRect().top,
          next: cells[window.innerWidth <= 768 ? 2 : 3].getBoundingClientRect().top,
          images,
        };
      });
      expect(layout.width).toBe(width);
      expect(layout.pageWidth).toBe(width);
      expect(layout.images.every(w => w > 0)).toBe(true);
      expect(layout.columns).toBe(width === 1440 ? 5 : 2);
      if (width === 1440) expect(layout.tileWidth / width).toBeCloseTo(.4, 2);
      else expect(layout.tileWidth).toBe(width);
      expect(layout.next).toBeGreaterThan(layout.first);
      const tile = mosaic.getByRole('link', { name: 'Camisas' });
      await expect(tile).toHaveAttribute('href', '/tienda?category=camisas');
      await page.keyboard.press('Tab');
      await tile.focus();
      await expect(tile).toBeFocused();
      await expect(tile).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(base + '/tienda?category=camisas');
      await expect(page.getByRole('contentinfo')).toHaveClass('home-footer');
      await page.goto(base);
      await mosaic.getByRole('link', { name: 'Armá el look' }).click();
      await expect(page).toHaveURL(base + '/#look-title');
      await expect(page.locator('#look-title')).toBeFocused();
      await page.close();
    }
  } finally { await browser.close(); }
});


test('home footer unifies help and keeps real destinations at desktop and mobile widths', async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      await page.goto(base);
      const footer = page.getByRole('contentinfo');
      await expect(page.getByRole('main').getByText('¿Te damos una mano?')).toHaveCount(0);
      const shop = footer.getByRole('navigation', { name: 'Explorá', exact: true });
      const helpColumn = footer.getByRole('region', { name: 'Ayuda', exact: true });
      await expect(helpColumn.getByText('En la ficha de cada producto podés ver el precio y la disponibilidad.')).toBeVisible();
      await expect(helpColumn.getByText('Las opciones de entrega aparecen después del carrito, antes de confirmar el pedido.')).toBeVisible();
      await expect(footer.getByRole('heading', { name: 'Tu compra' })).toHaveCount(0);
      await expect(footer.locator('a[href="/pedidos"], a[href="/cuenta"], a[href="/carrito"]')).toHaveCount(0);
      const { x: brandLeft, y: brandTop, width: brandWidth } = await footer.locator('.closing-footer-intro').boundingBox();
      const { x: shopLeft, y: shopTop, width: shopWidth } = await shop.boundingBox();
      const { x: helpLeft, y: helpTop } = await helpColumn.boundingBox();
      if (width === 1440) {
        expect(brandLeft).toBeLessThan(shopLeft);
        expect(brandWidth).toBeGreaterThan(shopWidth);
        expect(shopLeft).toBeLessThan(helpLeft);
        expect(Math.abs(shopTop - brandTop)).toBeLessThan(2);
      } else {
        expect(brandTop).toBeLessThan(shopTop);
      }
      expect(Math.abs(helpTop - shopTop) < 2).toBe(width !== 320);
      await expect(shop.getByRole('link')).toHaveText(['Ver tienda', 'Remeras', 'Camisas', 'Pantalones']);
      const rows = await shop.getByRole('link').evaluateAll(links =>
        new Set(links.map(link => link.getBoundingClientRect().top)).size);
      expect(rows).toBe(4);
      await expect(shop.getByRole('link', { name: 'Ver tienda' })).toHaveAttribute('href', '/tienda');
      await expect(footer.getByRole('region', { name: 'Contacto' })).toHaveCount(0);
      const editorial = footer.getByRole('navigation', { name: 'Editorial de Camba' });
      await expect(editorial.getByRole('link')).toHaveText(['Armá el look']);
      const shortcut = editorial.getByRole('link', { name: 'Armá el look' });
      await expect(shortcut).toHaveAttribute('href', '#look-title');
      await expect(shortcut.locator('svg')).toHaveCount(1);
      await page.keyboard.press('Tab');
      await shortcut.focus();
      await expect(shortcut).toHaveCSS('outline-style', 'solid');
      await shortcut.press('Enter');
      await expect(page).toHaveURL(base + '/#look-title');
      await expect(page.locator('#look-title')).toBeFocused();

      const top = footer.getByRole('link', { name: /Volver arriba/ });
      await expect(top.locator('.home-footer-top-icon')).toHaveCSS('border-radius', '50%');
      await expect(footer.locator('.home-footer-base').getByRole('link')).toHaveCount(1);
      await top.focus();
      await expect(top).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(base + '/#arriba');
      await expect(page.locator('#arriba')).toBeFocused();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

      await shop.getByRole('link', { name: 'Camisas' }).click();
      await expect(page).toHaveURL(base + '/tienda?category=camisas');
      await expect(page.getByRole('contentinfo')).toHaveClass('home-footer');
      await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Ver tienda' })).toHaveAttribute('href', '/tienda');
      await page.close();
    }
  } finally { await browser.close(); }
});


for (const width of [1440, 390]) {
  test(`hero and current shelf photos animate at ${width}px without delaying results`, async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width, height: width === 1440 ? 900 : 844 },
        reducedMotion: 'no-preference',
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      await page.addInitScript(() => {
        const evidence = { hero: null };
        window.homeMotionEvidence = evidence;
        const sample = () => {
          const photo = document.querySelector('.campaign img');
          const title = document.querySelector('.campaign h1');
          if (photo?.complete && photo.naturalWidth && title) {
            const style = getComputedStyle(title);
            const y = new DOMMatrix(style.transform).m42;
            const opacity = Number(style.opacity);
            if (y > 2 && opacity > .63 && opacity < .96) {
              const { top, bottom } = photo.getBoundingClientRect();
              evidence.hero = { y, opacity, visible: top < innerHeight && bottom > 0,
                imageTransform: getComputedStyle(photo).transform };
            }
          }
          if (!evidence.hero && performance.now() < 4000) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.goto(base);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.evaluate(() => window.homeMotionEvidence.hero)).toMatchObject({
        visible: true, imageTransform: 'none',
      });
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('opacity', '1');

      const filters = page.locator('.shelf-filters');
      await filters.locator('.shelf-indicator').waitFor({ state: 'visible' });
      const cards = page.locator('.home-products li > store-product-photo:not(.alternate) img');
      const shirts = filters.getByRole('button', { name: 'Camisas' });
      await (width === 390 ? shirts.tap() : shirts.click());
      await expect(shirts).toBeFocused();
      await expect(page.locator('.home-products li')).toHaveCount(2);
      await expect.poll(() => cards.first().evaluate(el => {
        const photo = getComputedStyle(el);
        return new DOMMatrix(photo.transform).m42 > 1 && Number(photo.opacity) < .99;
      }), { intervals: [15, 25, 40, 50] }).toBe(true);

      await filters.evaluate(async group => {
        for (const name of ['Remeras', 'Todo', 'Pantalones']) {
          [...group.querySelectorAll('button')].find(button => button.textContent.trim() === name).click();
          await new Promise(requestAnimationFrame);
        }
      });
      const trousers = filters.getByRole('button', { name: 'Pantalones' });
      await expect(trousers).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.home-products h3')).toHaveText(['Pantalón recto negro', 'Pantalón con pinzas arena']);
      await expect(cards.last()).toHaveCSS('opacity', '1');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(filters.locator('.shelf-indicator')).toBeHidden();
      await expect(cards.first()).toHaveCSS('transform', 'none');
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('transform', 'none');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('opacity', '1');
      await filters.getByRole('button', { name: 'Camisas' }).click();
      await expect(cards.first()).toHaveCSS('transform', 'none');
      await expect(cards.first()).toHaveCSS('opacity', '1');
    } finally { await browser.close(); }
  });
}

expect.configure({ timeout: 2500 });

test('SSR serves the first chapter, four products, and the real look links without JS', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    await page.goto(base);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vestite distinto.');
    await expect(page.getByRole('link', { name: 'Ver tienda', exact: true }).first()).toHaveAttribute('href', '/tienda');
    await expect(page.locator('.campaign img')).toHaveAttribute('fetchpriority', 'high');
    await expect(page.getByRole('region', { name: 'Explorá por categoría' }).getByRole('link'))
      .toHaveText(['Remeras', 'Camisas', 'Pantalones']);
    await expect(page.locator('store-product-grid li')).toHaveCount(4);
    await expect(page.locator('store-product-grid').getByText('Sin stock')).toBeVisible();
    const look = page.getByRole('region', { name: 'Armá el look' });
    await expect(look.getByRole('link', { name: /Pantalón con pinzas arena/ })).toHaveAttribute('href', '/producto/pantalon-pinzas-arena');
    await expect(look.getByText('UYU 1.490')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Texturas y detalles' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Inicio', exact: true })).toHaveAttribute('href', '/');
    await expect(page.locator('#contacto').getByRole('heading', { name: 'Ayuda' })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    const photo = await page.locator('.campaign-photo').boundingBox();
    const title = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(title.y).toBeGreaterThanOrEqual(photo.y + photo.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  } finally { await browser.close(); }
});

test('selection stays focused and current; shop, menu and product links keep their destinations', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    const errors = [];
    const external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      const guestSessionCheck = m.location().url === base + '/__camba_demo/auth/me' &&
        m.text().includes('status of 401');
      if (m.type() === 'error' && !guestSessionCheck) errors.push(m.text());
    });
    page.on('request', r => { if (r.url().includes('/api/v1/')) external.push(r.url()); });
    await page.goto(base);
    const menu = page.getByRole('button', { name: 'Menú de tienda' });
    await menu.tap();
    await expect(page.locator('#home-menu')).toBeVisible();
    await expect(page.locator('#home-menu').getByRole('link')).toHaveText([
      'Inicio', 'Tienda', 'Mi cuenta',
    ]);
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    await expect(page.locator('#home-menu')).toBeHidden();
    const shelf = page.getByRole('region', { name: 'Selección de Camba' });
    const shirts = shelf.getByRole('button', { name: 'Remeras' });
    await shirts.focus();
    await page.keyboard.press('Space');
    await expect(shirts).toBeFocused();
    await expect(shirts).toHaveAttribute('aria-pressed', 'true');
    await expect(shelf.getByRole('status')).toContainText('prendas');
    await expect(shelf.getByRole('link', { name: 'Remera recta carbón' })).toBeVisible();
    for (const name of ['Camisas', 'Pantalones', 'Todo']) await shelf.getByRole('button', { name }).tap();
    await expect(shelf.locator('li')).toHaveCount(4);
    const heroRequests = await page.evaluate(() => performance.getEntriesByType('resource')
      .filter(e => /atelier-hero-/.test(e.name)).map(e => e.name));
    expect(heroRequests).toHaveLength(1);
    expect(heroRequests[0]).toMatch(/atelier-hero-mobile/);

    await page.getByRole('region', { name: 'Explorá por categoría' }).getByRole('link', { name: 'Remeras' }).tap();
    await expect(page).toHaveURL(/\/tienda\?category=remeras$/);
    await page.getByRole('link', { name: 'Remera recta carbón' }).tap();
    await expect(page.getByRole('heading', { name: 'Remera recta carbón' })).toBeVisible();
    await page.getByRole('link', { name: 'Volver a la tienda' }).click();
    await expect(page).toHaveURL(/\/tienda\?category=remeras$/);
    await page.getByRole('banner').getByRole('link', { name: 'Camba, inicio' }).click();
    await expect(page).toHaveURL(base + '/');
    await page.locator('.campaign').getByRole('link', { name: 'Ver tienda', exact: true }).click();
    await expect(page).toHaveURL(base + '/tienda');
    await page.getByRole('banner').getByRole('link', { name: 'Camba, inicio' }).click();
    for (const [name, dest] of [['Buscar', '/tienda'], ['Mi cuenta', '/cuenta'], ['Carrito', '/carrito']]) {
      if (name === 'Mi cuenta') await menu.tap();
      await page.getByRole('banner').getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(base + dest);
      await expect(page.getByRole('banner').getByRole('link', { name: 'Buscar', exact: true })).toBeVisible();
      if (name === 'Buscar') {
        const search = page.getByRole('main').getByRole('searchbox', { name: 'Buscar en la tienda' });
        await search.fill('marino');
        await search.press('Enter');
        await expect(page).toHaveURL(base + '/tienda?q=marino');
      }
      await page.getByRole('banner').getByRole('link', { name: 'Camba, inicio' }).click();
    }
    await page.getByRole('region', { name: 'Armá el look' }).getByRole('link', { name: /Pantalón con pinzas arena/ }).click();
    await expect(page.getByRole('heading', { name: 'Pantalón con pinzas arena' })).toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally { await browser.close(); }
});

test('the gallery and two motion moments work and reduced motion keeps the final state', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(base);
    const shelf = page.getByRole('region', { name: 'Selección de Camba' });
    const controls = shelf.getByRole('group');
    const marker = shelf.locator('.shelf-indicator');
    const shirts = controls.getByRole('button', { name: 'Remeras' });
    await shirts.hover();
    await expect(marker).toBeVisible();
    const initial = await marker.evaluate(el => el.style.transform);
    await shirts.click();
    await expect.poll(() => marker.evaluate(el => el.style.transform)).not.toBe(initial);
    await expect(shirts).toHaveAttribute('aria-pressed', 'true');
    const carbon = shelf.getByRole('link', { name: 'Remera recta carbón' });
    await carbon.hover();
    const alternate = shelf.locator('.alternate img');
    await expect(alternate).toHaveAttribute('src', '/demo/detail-photo.webp');
    await expect(alternate.locator('xpath=ancestor::store-product-photo')).toHaveCSS('opacity', '1');
    await controls.evaluate(async group => {
      for (const button of [...group.querySelectorAll('button')].slice(0, 3)) {
        button.click();
        await new Promise(requestAnimationFrame);
      }
    });
    const camisas = controls.getByRole('button', { name: 'Camisas' });
    await expect(camisas).toHaveAttribute('aria-pressed', 'true');
    await expect(shelf.locator('li')).toHaveCount(2);
    await expect.poll(() => camisas.evaluate(button => {
      const { left, width } = button.getBoundingClientRect();
      const marker = button.parentElement.querySelector('.shelf-indicator').getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(button).paddingInlineStart);
      return Math.round(Math.abs(marker.left - left - padding) + Math.abs(marker.width - width + 2 * padding));
    })).toBe(0);
    const details = page.locator('.story-details');
    await expect(details.locator('img[style*="translateY"]')).toHaveCount(0);
    await details.scrollIntoViewIfNeeded();
    await expect(details.locator('img[style*="translateY"]')).toHaveCount(2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(marker).toBeHidden();
    await expect(details.locator('img[style*="translateY"]')).toHaveCount(0);
    await expect(camisas).toHaveAttribute('aria-pressed', 'true');
  } finally { await browser.close(); }
});

test('an HTML response at an image URL retries a real WebP and missing photos do not leave empty modules', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.route('**/demo-home/atelier-hero-mobile-small.webp',
      route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>Not a photograph</p>' }));
    await page.route('**/demo-home/atelier-look*.webp', route => route.abort());
    await page.route('**/demo-home/atelier-story*.webp', route => route.abort());
    await page.route('**/demo-home/atelier-finish*.webp', route => route.abort());
    await page.route('**/demo-home/atelier-camisas*.webp', route => route.abort());
    await page.goto(base);
    const hero = page.locator('.campaign img');
    await expect.poll(() => hero.evaluate(img => img.naturalWidth > 0 && img.currentSrc.endsWith('atelier-hero-mobile.webp'))).toBe(true);
    const category = page.locator('.category-panel').filter({ hasText: 'Camisas' });
    await category.scrollIntoViewIfNeeded();
    await expect(category.locator('img')).toHaveCount(0);
    await expect(category).toHaveAttribute('href', '/tienda?category=camisas');
    const look = page.getByRole('region', { name: 'Armá el look' });
    await look.scrollIntoViewIfNeeded();
    await expect(look.locator('.look-photo')).toHaveCount(0);
    await expect(look.getByRole('link', { name: /Pantalón con pinzas arena/ })).toBeVisible();
    await expect.poll(() => look.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
    const details = page.getByRole('region', { name: 'Texturas y detalles' });
    await details.scrollIntoViewIfNeeded();
    await expect(details.locator('.story-lead')).toHaveCount(0);
    await expect(details.locator('.story-details img')).toHaveCount(1);
    await expect.poll(() => details.locator('.story-details img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally { await browser.close(); }
});

