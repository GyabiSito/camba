import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const store = 'http://127.0.0.1:4200';
const reference = process.env.CAMBA_EDITORIAL_REFERENCE;
const output = 'test-results/docker-editorial';
const browser = await chromium.launch();
const slug = 'camisa-liviana-blanca';
const name = 'Camisa liviana blanca';

async function capture(page, file, fullPage = true) {
  await page.screenshot({ path: `${output}/${file}.png`, fullPage, animations: 'disabled' });
}

async function readHome(page, origin) {
  const response = await page.goto(origin);
  assert.equal(response.status(), 200);
  assert.match(await response.text(), /<h1[^>]*>Vestite distinto\.<\/h1>/);
  const photos = page.locator('img[src*="/demo-home/"]');
  await expect(photos).toHaveCount(15);
  await expect(page.locator('.closing-mosaic-tile img')).toHaveCount(6);
  await expect(page.locator('.home-footer')).toBeVisible();
  const geometry = await photos.evaluateAll(async (images) => {
    await document.fonts.ready;
    for (const image of images) image.loading = 'eager';
    return await Promise.all(images.map(async (image) => {
      await image.decode();
      const { objectFit, objectPosition } = getComputedStyle(image);
      const { width, height } = image.getBoundingClientRect();
      return {
        path: new URL(image.currentSrc).pathname,
        natural: [image.naturalWidth, image.naturalHeight],
        crop: [objectFit, objectPosition, Math.round(width), Math.round(height)],
      };
    }));
  });
  assert(geometry.every(({ natural }) => natural.every((side) => side > 0)));
  const links = await page.locator('.category-panel, .look-items a, .closing-mosaic a').evaluateAll(
    (anchors) => anchors.map((anchor) => anchor.getAttribute('href')),
  );
  assert.deepEqual(links.slice(0, 3), ['remeras', 'camisas', 'pantalones'].map(
    (category) => '/tienda?category=' + category,
  ));
  assert(links.includes('/producto/' + slug));
  assert(links.includes('/producto/pantalon-pinzas-arena'));
  assert.equal(await page.evaluate(() => visualViewport.scale), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), page.viewportSize().width);
  return { geometry, links, footer: await page.locator('.home-footer').evaluate(
    (footer) => getComputedStyle(footer).backgroundImage,
  ) };
}

async function checkBuy(page, width) {
  await page.goto(store + '/cuenta');
  await page.getByLabel('Correo electrónico').fill('cliente.diseno@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('CambaDemo2026!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  const cart = page.getByRole('list', { name: 'Productos', exact: true }).getByRole('listitem');
  const remove = page.getByRole('button', { name: 'Quitar ' + name, exact: true });
  await page.goto(store + '/carrito');
  // Only the original seeded cart is safe to use: do not overwrite an existing buyer's edit.
  await expect(cart).toHaveCount(2);
  await expect(remove).toHaveCount(0);
  await page.goto(store + '/producto/' + slug);
  await page.locator('.main-photo img').evaluate((image) => image.decode());
  await capture(page, `ficha-${width}`);
  const add = page.getByRole('button', { name: 'Agregar al carrito', exact: true });
  const modal = page.getByRole('dialog');
  try {
    await add.click();
    await expect(modal.getByRole('heading', { name: 'Agregado al carrito' })).toBeVisible();
    await expect(modal).toContainText(name);
    await expect(modal).toContainText('UYU');
    await modal.locator('img').evaluate((image) => image.decode());
    await capture(page, `modal-${width}`, false);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(add).toBeFocused();
    await page.goto(store + '/carrito');
    await expect(cart).toHaveCount(3);
    for (const row of await cart.all()) {
      const image = row.locator('store-product-photo img');
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((img) => img.decode());
      assert.match(await image.evaluate((img) => new URL(img.currentSrc).pathname), /^\/storage\/demo\//);
    }
  } finally {
    // Clean up this run's newly added SKU, including on assertion failure.
    await page.goto(store + '/carrito');
    await expect(page.getByRole('heading', { name: 'Tu carrito' })).toBeVisible();
    await expect.poll(async () => await cart.count()).toBeGreaterThanOrEqual(2);
    if (await remove.isVisible()) await remove.click();
    await expect(cart).toHaveCount(2);
    await expect(remove).toHaveCount(0);
  }
  await capture(page, `carrito-${width}`);
}

try {
  await mkdir(output, { recursive: true });
  const files = (await readdir('projects/store/demo-assets')).filter((file) => /^atelier-.*\.webp$/.test(file));
  const audit = { assets: [], viewports: {} };
  assert(files.length > 0);
  for (const file of files) {
    const response = await fetch(store + '/demo-home/' + file);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get('content-type'), /^image\/webp/, file);
    assert.equal(body.toString('ascii', 0, 4), 'RIFF', file);
    assert.equal(body.toString('ascii', 8, 12), 'WEBP', file);
    audit.assets.push({ file, type: response.headers.get('content-type'), bytes: body.length });
  }
  assert.equal((await fetch(store + '/__camba_demo/cart')).status, 404);
  const product = await fetch(store + '/api/v1/products/' + slug);
  assert.equal(product.status, 200);
  assert.equal((await product.json()).data.name, name);

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      const actual = await readHome(page, store);
      await capture(page, 'docker-despues-' + viewport.width);
      await capture(page, 'docker-despues-hero-' + viewport.width, false);
      await page.evaluate(async (files) => {
        for (const file of files) {
          const image = new Image();
          image.src = '/demo-home/' + file;
          await image.decode();
        }
      }, files);
      let expected;
      if (reference) {
        const other = await context.newPage();
        expected = await readHome(other, reference);
        // The editorial/crops/links are the same; the product shelf deliberately uses the API.
        assert.deepEqual(actual, expected);
      }
      audit.viewports[viewport.width] = { docker: actual, reference: expected };
      await checkBuy(page, viewport.width);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
  await writeFile(`${output}/comparacion-network.json`, JSON.stringify(audit, null, 2));
  console.log(`Verified ${audit.assets.length} WebPs, 1440/390 editorial, and real cart with cleanup`);
} finally {
  await browser.close();
}
