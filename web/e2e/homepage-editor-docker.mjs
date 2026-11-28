import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const adminOrigin = 'http://127.0.0.1:4300';
const storeOrigin = 'http://127.0.0.1:4200';
const editor = '/api/v1/admin/homepage';
const publication = '/api/v1/homepage';
const password = process.env.CAMBA_DEMO_PASSWORD;
assert(password, 'Set CAMBA_DEMO_PASSWORD to the documented local demo password.');
const output = new URL('../dist/artifacts/admin-portada/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const buyerContext = await browser.newContext();
const admin = await adminContext.newPage();
const shop = await publicContext.newPage();
const buyer = await buyerContext.newPage();
const tag = 'QA portada · Después del taller';
// The default journey never publishes or uploads into the live demo.
const checkPublication = process.env.CAMBA_PUBLISH_HOMEPAGE_TEST === '1';
let original;
let uploadKey;
let lastOwnRevision;
let publishedTest = false;

const securityHeaders = { Accept: 'application/json', Referer: `${adminOrigin}/` };
const adminState = async () => {
  const res = await admin.request.get(`${adminOrigin}${editor}`, { headers: securityHeaders });
  assert.equal(res.status(), 200, await res.text());
  return (await res.json()).data;
};
const publicState = async () => {
  const res = await shop.request.get(`${storeOrigin}${publication}`, { headers: { Accept: 'application/json' } });
  assert.equal(res.status(), 200, await res.text());
  return (await res.json()).data;
};
const button = name => admin.getByRole('button', { name, exact: true });
const link = name => admin.getByRole('link', { name, exact: true });
const screenshot = (page, name, fullPage = true) =>
  page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage, animations: 'disabled' });

async function login(page, origin, email, path = '/ingresar') {
  await page.goto(origin + path);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}

async function editorOperation(method, endpoint, action) {
  const pending = admin.waitForResponse(res => new URL(res.url()).pathname === `${editor}${endpoint}` &&
    res.request().method() === method);
  await action();
  const res = await pending;
  expect(res.ok(), `${method} ${endpoint}: ${await res.text()}`).toBeTruthy();
  const data = (await res.json()).data;
  if (data.revision !== undefined) lastOwnRevision = data.revision;
  return data;
}

async function restoreCall(method, endpoint, payload) {
  const res = await admin.evaluate(async ({ url, method, payload }) => {
    await fetch('/api/v1/admin/auth/csrf-cookie', { cache: 'no-store' });
    const token = document.cookie.split('; ').find(cookie => cookie.startsWith('CAMBA-ADMIN-XSRF-TOKEN='));
    if (!token) throw new Error('No Admin CSRF cookie for fixture cleanup.');
    const response = await fetch(url, { method, credentials: 'same-origin', headers: {
      'Content-Type': 'application/json', Accept: 'application/json',
      'X-XSRF-TOKEN': decodeURIComponent(token.slice('CAMBA-ADMIN-XSRF-TOKEN='.length)),
    }, body: JSON.stringify(payload) });
    return { status: response.status, payload: await response.json() };
  }, { url: editor + endpoint, method, payload });
  assert.equal(res.status, 200, JSON.stringify(res));
  return res.payload.data;
}

async function shopImages(page) {
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    await Promise.all([...document.images].map(img => img.decode()));
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  return page.evaluate(() => ({
    width: innerWidth,
    overflow: document.documentElement.scrollWidth - innerWidth,
    headings: [...document.querySelectorAll('main h1,main h2')].map(el => el.textContent.trim()),
    images: [...document.querySelectorAll('main img')].map(img => ({
      path: new URL(img.currentSrc).pathname, width: img.naturalWidth, alt: img.alt,
    })),
    links: [...document.querySelectorAll('.closing-mosaic a')].map(link => link.getAttribute('href')),
    tiles: document.querySelectorAll('.closing-mosaic-tile').length,
  }));
}

async function verifyPublished(document) {
  const { version, document: visible } = await publicState();
  assert.deepEqual(visible, document);
  const response = await shop.goto(storeOrigin, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.match(await response.text(), /QA portada/); // Visible in the initial, public SSR response.
  await expect(shop.getByRole('heading', { name: tag, exact: true })).toBeVisible();
  await expect(shop.locator('.category-label')).toHaveText(['Pantalones', 'Camisas']);
  assert.deepEqual(await shop.locator('.selection store-product-grid a[href^="/producto/"]').evaluateAll(links => links.map(link => link.getAttribute('href'))),
    ['/producto/pantalon-pinzas-arena', '/producto/camisa-liviana-blanca']);
  await expect(shop.locator('.closing-mosaic-tile').nth(1).locator('img')).toHaveAttribute('alt', 'Trama de la sobrecamisa de la portada');
  const results = await shopImages(shop);
  assert.equal(results.overflow, 0);
  assert.equal(results.tiles, 6);
  return version;
}

function restartServices() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const compose = ['compose', '--env-file', 'infra/dev/demo.env.local', '-f', 'infra/compose.dev.yml', '-f', 'infra/compose.dev.apps.yml'];
  for (const args of [['restart', 'api', 'store', 'admin'], ['up', '-d', '--no-recreate', '--wait', '--wait-timeout', '180']]) {
    const result = spawnSync('docker', [...compose, ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
    assert.equal(result.status, 0, String(result.error ?? `docker compose ${args.join(' ')}`));
  }
}

async function verifyPublicationJourney(draft) {
  const imagePath = draft.assets[uploadKey].url.replace('/admin/homepage/', '/homepage/');
  assert.equal((await shop.request.get(storeOrigin + imagePath)).status(), 404);
  await editorOperation('POST', '/publish', () => button('Publicar').click());
  publishedTest = true;
  await shop.setViewportSize({ width: 1440, height: 900 });
  const version = await verifyPublished(draft.draft);
  const imageResponse = await shop.request.get(storeOrigin + imagePath);
  assert.equal(imageResponse.status(), 200);
  assert.match(imageResponse.headers()['content-type'], /^image\/webp/);
  await expect(shop.locator('.campaign img')).toHaveAttribute('src', imagePath);
  if (process.env.CAMBA_RESTART_FOR_HOMEPAGE === '1') {
    restartServices();
    assert.equal(await verifyPublished(draft.draft), version);
  }
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await shop.setViewportSize({ width, height });
    await shop.reload({ waitUntil: 'networkidle' });
    await expect(shop.getByRole('heading', { name: tag, exact: true })).toBeVisible();
    assert.equal((await shopImages(shop)).overflow, 0);
    await screenshot(shop, `resultado-${width}`);
  }
  assert.equal((await adminState()).draft, null);
  await admin.reload();
  await openSection('Hero', 'hero');
  await admin.getByLabel('Título del hero').fill(`${tag} · descarte`);
  await saveSection();
  await returnToSummary();
  await button('Descartar borrador').click();
  await editorOperation('POST', '/discard', () => button('Confirmar descarte').click());
  assert.equal((await adminState()).draft, null);
  assert.deepEqual((await publicState()).document, draft.draft);
  console.log(`Admin draft, preview, publication ${version}, media, permissions and real store sessions passed.`);
}

async function verifyPermissions() {
  const options = { headers: { Accept: 'application/json', Referer: `${adminOrigin}/` } };
  for (const path of [editor, `${editor}/preview`]) {
    assert.equal((await shop.request.get(adminOrigin + path, options)).status(), 401);
  }
  const anonymousPreview = await shop.goto(`${storeOrigin}/portada/vista-previa`);
  assert.equal(anonymousPreview.status(), 404);
  assert.doesNotMatch(await anonymousPreview.text(), /ng-state[^]*QA portada/);
  const guestAdmin = await publicContext.newPage();
  for (const path of ['/portada/vista-previa', '/portada/vista-previa/lienzo']) {
    await guestAdmin.goto(adminOrigin + path);
    await expect(guestAdmin).toHaveURL(/\/ingresar\?next=/);
    await expect(guestAdmin.locator('store-home')).toHaveCount(0);
  }
  await guestAdmin.close();
  await login(buyer, storeOrigin, 'cliente.diseno@camba.test', '/cuenta');
  await expect.poll(async () => (await buyer.request.get(`${storeOrigin}/api/v1/auth/me`, { headers: { ...options.headers, Referer: `${storeOrigin}/` } })).status()).toBe(200);
  for (const path of [editor, `${editor}/preview`]) {
    assert.equal((await buyer.request.get(adminOrigin + path, options)).status(), 403);
  }
  await buyer.goto(`${adminOrigin}/portada/vista-previa`);
  await expect(buyer).toHaveURL(/\/ingresar\?.*reason=ineligible/);
}

async function openSection(label, key) {
  await link(`Editar ${label}`).click();
  await expect(admin).toHaveURL(`${adminOrigin}/portada/secciones/${key}`);
  await expect(button('Publicar')).toHaveCount(0);
}

async function saveSection() {
  const saved = await editorOperation('PUT', '', () => button('Guardar borrador').click());
  await expect(button('Guardar borrador')).toBeDisabled();
  return saved;
}

async function returnToSummary() {
  await link('Volver a Portada').click();
  await expect(admin).toHaveURL(`${adminOrigin}/portada`);
}

async function editHomepage() {
  await expect(link('Editar Hero')).toBeVisible();
  await expect(admin.getByLabel('Título del hero')).toHaveCount(0);
  await screenshot(admin, 'editor-1440');
  await admin.setViewportSize({ width: 390, height: 844 });
  const menu = admin.getByRole('button', { name: 'Menú', exact: true });
  await menu.click();
  await expect(admin.getByRole('link', { name: 'Portada', exact: true })).toHaveAttribute('aria-current', 'page');
  await menu.click();
  await screenshot(admin, 'editor-390');
  await admin.setViewportSize({ width: 320, height: 844 });
  await openSection('Hero', 'hero');
  await expect.poll(() => admin.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const title = admin.getByLabel('Título del hero');
  await title.fill(`${tag} · cambio sin guardar`);
  const prompt = admin.waitForEvent('dialog').then(async dialog => {
    assert.equal(dialog.type(), 'confirm');
    assert.match(dialog.message(), /cambios sin guardar/i);
    await dialog.dismiss();
  });
  await Promise.all([prompt, link('Volver a Portada').click()]);
  await expect(title).toHaveValue(`${tag} · cambio sin guardar`);
  await title.fill(tag);
  if (!checkPublication) {
    const saved = await saveSection();
    await admin.reload();
    await expect(admin.getByLabel('Título del hero')).toHaveValue(tag);
    await screenshot(admin, 'edicion-hero-320');
    await admin.setViewportSize({ width: 1440, height: 900 });
    await returnToSummary();
    return saved;
  }
  const hero = admin.getByRole('group', { name: 'Imagen de escritorio', exact: true });
  await hero.getByText('Elegir otra foto', { exact: true }).click();
  const upload = hero.locator('input[type=file]');
  const invalidRequest = admin.waitForResponse(res => new URL(res.url()).pathname === `${editor}/media` &&
    res.request().method() === 'POST');
  await upload.setInputFiles({ name: 'foto-invalida.webp', mimeType: 'image/webp', buffer: Buffer.from('not an image') });
  assert.equal((await invalidRequest).status(), 422);
  await expect(hero.getByRole('alert')).toBeVisible();
  const picture = fileURLToPath(new URL('../projects/store/demo-assets/atelier-cierre-silueta.webp', import.meta.url));
  ({ key: uploadKey } = await editorOperation('POST', '/media', () => upload.setInputFiles(picture)));
  await expect(hero.getByRole('alert')).toHaveCount(0);
  await hero.getByLabel('Descripción de la foto').fill('Modelo sentada junto a una pared de ladrillo');
  await hero.getByText('Ajustar punto de recorte', { exact: true }).click();
  await hero.getByRole('slider', { name: /^Horizontal/ }).press('ArrowRight');
  await admin.getByLabel('Título del hero').fill(tag);
  await admin.setViewportSize({ width: 390, height: 844 });
  await screenshot(admin, 'editor-recorte-390');
  await admin.setViewportSize({ width: 1440, height: 900 });
  const savedHero = await saveSection();
  assert.equal(savedHero.draft.hero.desktop.key, uploadKey);
  assert.equal(savedHero.draft.hero.desktop.x, 51);
  await returnToSummary();
  await openSection('Categorías', 'categories');
  await button('Quitar Remeras').click();
  await button('Subir categoría Pantalones').click();
  await saveSection();
  await returnToSummary();
  await openSection('Selección de Camba', 'selection');
  await admin.getByLabel('Selección de productos').selectOption('manual');
  await button('Agregar Camisa liviana blanca').click();
  await button('Agregar Pantalón con pinzas arena').click();
  await button('Subir Pantalón con pinzas arena en selección').click();
  await saveSection();
  await returnToSummary();
  await openSection('Mosaico final', 'mosaic');
  await admin.getByText('Casilla 2', { exact: true }).click();
  const tile = admin.getByRole('group', { name: 'Foto de casilla 2', exact: true });
  await tile.getByText('Elegir otra foto', { exact: true }).click();
  const texture = tile.getByRole('button', { name: /cierre-trama|sobrecamisa|trama/i });
  await texture.click();
  await expect(texture).toHaveAttribute('aria-pressed', 'true');
  await tile.getByLabel('Descripción de la foto').fill('Trama de la sobrecamisa de la portada');
  const saved = await saveSection();
  await returnToSummary();
  assert.equal(saved.draft.hero.desktop.key, uploadKey);
  assert.equal(saved.draft.hero.desktop.x, 51);
  assert.equal(saved.draft.hero.mobile.key, original.hero.mobile.key);
  assert.deepEqual(saved.draft.categories.cards.map(card => card.categoryId),
    [original.categories.cards[2].categoryId, original.categories.cards[1].categoryId]);
  assert.equal(saved.draft.selection.mode, 'manual');
  const products = (await (await shop.request.get(`${storeOrigin}/api/v1/products?per_page=12`)).json()).data;
  assert.deepEqual(saved.draft.selection.productIds, ['pantalon-pinzas-arena', 'camisa-liviana-blanca'].map(slug => products.find(item => item.slug === slug).id));
  assert.equal(saved.draft.mosaic.tiles[1].image.key, 'cierre-trama');
  return saved;
}

try {
  await login(admin, adminOrigin, 'admin.diseno@camba.test');
  await expect(admin).toHaveURL(`${adminOrigin}/dashboard`);
  await admin.getByRole('navigation', { name: 'Administración' }).getByRole('link', { name: 'Portada' }).click();
  await expect(admin.getByRole('heading', { name: 'Portada', exact: true })).toBeVisible();
  const initial = await adminState();
  assert.equal(initial.draft, null, 'This workflow preserves an existing draft; run only when there is no unsaved publication.');
  assert.equal(initial.published.hero.title, 'Vestite distinto.');
  original = initial.published;
  lastOwnRevision = initial.revision;
  assert.deepEqual((await publicState()).document, original);
  const baselineBefore = [];
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const snapshot = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await snapshot.goto(storeOrigin, { waitUntil: 'networkidle' });
    const evidence = await shopImages(snapshot);
    assert.equal(evidence.tiles, 6);
    assert.equal(evidence.overflow, 0);
    baselineBefore.push(evidence);
    await screenshot(snapshot, `portada-migrada-${width}`);
    await snapshot.close();
  }
  await writeFile(new URL('migrada.json', output), JSON.stringify(baselineBefore, null, 2));
  await verifyPermissions();
  // A UI-only editor journey is defined below; restore only the content owned by this test.
  const draft = await editHomepage();
  const previewRequest = admin.waitForResponse(res => res.url() === `${adminOrigin}${editor}/preview` && res.request().method() === 'GET');
  await link('Vista previa').click();
  await expect(admin).toHaveURL(`${adminOrigin}/portada/vista-previa`);
  const response = await previewRequest;
  assert.equal(response.status(), 200);
  assert.match(response.headers()['cache-control'], /private.*no-store|no-store.*private/);
  const frame = admin.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: tag, exact: true })).toBeVisible();
  await expect(frame.locator('.closing-mosaic-tile')).toHaveCount(6);
  const picture = frame.locator('.campaign img');
  await expect.poll(() => picture.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect.poll(() => picture.evaluate(img => img.ownerDocument.defaultView.innerWidth)).toBeGreaterThan(768);
  await screenshot(admin, 'vista-previa-escritorio');
  await admin.getByRole('button', { name: 'Móvil', exact: true }).click();
  await expect.poll(() => picture.evaluate(img => img.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(480);
  await expect.poll(() => picture.evaluate(img => new URL(img.currentSrc).pathname)).toMatch(/hero-mobile/);
  await screenshot(admin, 'vista-previa-movil');
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.reload();
  await expect(admin.frameLocator('iframe').getByRole('heading', { name: tag, exact: true })).toBeVisible();
  await expect(button('Móvil')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => admin.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await screenshot(admin, 'vista-previa-admin-390');
  await returnToSummary();
  assert.deepEqual((await publicState()).document, original);
  assert.equal((await shop.goto(`${storeOrigin}/portada/vista-previa`)).status(), 404);
  await expect(shop.getByRole('heading', { name: tag, exact: true })).toHaveCount(0);
  await shop.goto(storeOrigin);
  await expect(shop.getByRole('heading', { name: tag, exact: true })).toHaveCount(0);
  const oldPreviewAsAdmin = await adminContext.newPage();
  assert.equal((await oldPreviewAsAdmin.goto(`${storeOrigin}/portada/vista-previa`)).status(), 404);
  await expect(oldPreviewAsAdmin.locator('store-home')).toHaveCount(0);
  await oldPreviewAsAdmin.close();
  if (!checkPublication) {
    await button('Descartar borrador').click();
    await editorOperation('POST', '/discard', () => button('Confirmar descarte').click());
    assert.equal((await adminState()).draft, null);
    assert.equal((await publicState()).version, initial.published_version);
    console.log('Dedicated edit, reload, guarded navigation, private Admin desktop/mobile preview and public 404 passed. Published data unchanged.');
  } else {
    await verifyPublicationJourney(draft);
  }
} finally {
  try {
    if (original) {
      const current = await adminState();
      const ownsWrite = current.revision === lastOwnRevision &&
        (current.draft?.hero.title === tag || current.published.hero.title === tag);
      if (ownsWrite) {
        if (publishedTest || current.published.hero.title === tag) {
          const restored = await restoreCall('PUT', '', { revision: current.revision, document: original });
          await restoreCall('POST', '/publish', { revision: restored.revision });
        } else {
          await restoreCall('POST', '/discard', { revision: current.revision });
        }
        assert.deepEqual((await publicState()).document, original);
        assert.equal((await adminState()).draft, null);
        if (publishedTest) {
          const rendition = (await adminState()).assets[uploadKey].url.replace('/admin/homepage/', '/homepage/');
          assert.equal((await shop.request.get(storeOrigin + rendition)).status(), 200);
        }
        console.log(publishedTest ? 'Restored the original homepage; previously published test image retained.' : 'Discarded the test draft; original homepage unchanged.');
      }
    }
  } finally {
    await browser.close();
  }
}
