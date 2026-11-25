import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const base = process.env.CAMBA_STORE ?? 'http://127.0.0.1:4200';
const loopback = url => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
const destinations = [
  ['/envios', 'Envíos', 'store-shipping'],
  ['/preguntas-frecuentes', 'Preguntas frecuentes', 'store-faq'],
  ['/contacto', 'Contactanos', 'store-contact'],
  ['/politica-de-privacidad', 'Política de privacidad', 'store-privacy-policy'],
  ['/terminos-y-condiciones', 'Términos y condiciones', 'store-terms-conditions'],
];
const output = 'test-results/storefront-support-pages';

test('five pages render in SSR and are linked from every shared footer', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 320, height: 760 } });
    const { data: settings } = await fetch(base + '/api/v1/store-info').then(r => r.json());
    for (const [path, title, component] of destinations) {
      expect((await page.goto(base + path))?.status()).toBe(200);
      const main = page.getByRole('main');
      await expect(main.locator(component)).toHaveCount(1);
      await expect(main.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
      if (path === '/envios') {
        await expect(main.getByRole('heading', { name: 'Retiro', exact: true })).toHaveCount(settings.pickup_address ? 1 : 0);
        await expect(main.getByRole('heading', { name: 'Envío a domicilio', exact: true })).toHaveCount(settings.delivery_cents === null ? 0 : 1);
        if (settings.pickup_address) await expect(main.getByText(settings.pickup_address, { exact: true })).toBeVisible();
      }
      if (path === '/contacto') {
        await expect(main.getByRole('heading', { name: 'Estamos para ayudarte', exact: true })).toBeVisible();
        await expect(main.locator('a[href^="mailto:"]')).toHaveCount(settings.support_email ? 1 : 0);
        await expect(main.locator('a[href^="tel:"]')).toHaveCount(settings.support_phone ? 1 : 0);
        await expect(main.getByRole('button', { name: 'Enviar consulta' })).toHaveCount(1);
        await expect(main.getByLabel('Correo electrónico')).toBeVisible();
      }
      if (path.startsWith('/politica') || path.startsWith('/terminos')) {
        await expect(main.getByText('Borrador pendiente de aprobación.', { exact: true })).toBeVisible();
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      }
      if (path === '/preguntas-frecuentes') {
        const question = main.locator('summary', { hasText: '¿Puedo comprar sin una cuenta?' });
        await question.focus();
        await page.keyboard.press('Enter');
        await expect(main.getByText('Sí. Podés seguir como invitado', { exact: false })).toBeVisible();
      }
      expect((await page.reload())?.status()).toBe(200);
      await expect(main.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
    }

    const { data: products } = await fetch(base + '/api/v1/products').then(r => r.json());
    const { data: categories } = await fetch(base + '/api/v1/categories').then(r => r.json());
    expect(products.length).toBeGreaterThan(0);
    const live = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await mkdir(output, { recursive: true });
    for (const origin of ['/', '/tienda', `/producto/${products[0].slug}`]) {
      for (const [path, title, component] of destinations) {
        expect((await live.goto(base + origin))?.ok()).toBe(true);
        const footer = live.getByRole('contentinfo');
        await expect(footer.getByRole('navigation', { name: 'Explorá' }).getByRole('link')).toHaveCount(categories.length + 1);
        await footer.getByRole('link', { name: title, exact: true }).click();
        await expect(live).toHaveURL(base + path);
        await expect(live.locator(component)).toHaveCount(1);
        await expect(live.getByRole('main').getByRole('heading', { name: title, level: 1, exact: true }), `${origin} → ${path}`).toBeInViewport({ ratio: 1 });
      }
    }

    for (const width of [1440, 320]) {
      await live.setViewportSize({ width, height: 900 });
      await live.goto(base + '/tienda');
      const footer = live.getByRole('contentinfo');
      await expect(footer.getByRole('navigation', { name: 'Explorá' }).getByRole('link')).toHaveCount(categories.length + 1);
      expect(await live.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await footer.screenshot({ path: `${output}/footer-${width}.png` });
      await footer.getByRole('link', { name: 'Envíos', exact: true }).focus();
      for (const [, title] of destinations) {
        const link = footer.getByRole('link', { name: title, exact: true });
        await expect(link).toBeFocused();
        expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
        await live.keyboard.press('Tab');
      }
      const top = footer.getByRole('link', { name: 'Volver arriba' });
      await expect(top).toBeFocused();
      await live.keyboard.press('Enter');
      await expect(live).toHaveURL(base + '/tienda#arriba');
    }
  } finally {
    await browser.close();
  }
});

test('footer navigation reaches the title and Back restores the previous scroll', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(base + '/');
    for (const [path, title] of destinations) {
      const link = page.getByRole('contentinfo').getByRole('link', { name: title, exact: true });
      await link.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => scrollY);
      expect(before).toBeGreaterThan(0);
      await link.click();
      await expect(page).toHaveURL(base + path);
      await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeInViewport({ ratio: 1 });
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await page.goBack();
      await expect(page).toHaveURL(base + '/');
      await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThanOrEqual(1);
    }
    await page.getByRole('link', { name: 'Volver arriba' }).click();
    await expect(page).toHaveURL(base + '/#arriba');
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  } finally {
    await browser.close();
  }
});

test('catalog filter and clear navigations retain the scroll position', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 660 }, reducedMotion: 'reduce' });
    await page.goto(base + '/tienda');
    await page.getByRole('button', { name: /^Filtros/ }).click();
    const order = page.getByLabel('Orden', { exact: true });
    const sort = await order.locator('option').nth(1).getAttribute('value');
    await order.selectOption(sort);
    const apply = page.getByRole('button', { name: 'Aplicar', exact: true });
    await page.evaluate(() => scrollTo({ top: 120, behavior: 'instant' }));
    await expect(apply).toBeInViewport();
    await apply.click();
    await expect(page).toHaveURL(base + '/tienda?sort=' + sort);
    const clear = page.getByRole('link', { name: 'Limpiar filtros' });
    await expect(clear).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(120);
    await clear.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await clear.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(base + '/tienda');
    await expect(clear).toHaveCount(0);
    expect(await page.evaluate(() => scrollY)).toBe(before);
  } finally {
    await browser.close();
  }
});

test('contact blocks stay visible and respect the motion preference at both widths', async () => {
  const browser = await chromium.launch();
  await mkdir(output, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion });
        await page.addInitScript(() => {
          window.contactMotion = new Set();
          new MutationObserver(records => {
            for (const { target } of records) {
              if (target.matches('.contact-grid > section') && target.style.transform.includes('translateY')) {
                window.contactMotion.add(target.getAttribute('aria-labelledby'));
              }
            }
          }).observe(document, { attributes: true, attributeFilter: ['style'], subtree: true });
        });
        await page.goto(base + '/contacto');
        const blocks = page.locator('.contact-grid > section');
        await expect(blocks.first()).toBeVisible();
        await expect(blocks.last()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Enviar consulta' })).toBeEnabled();
        if (reducedMotion === 'no-preference') {
          await expect.poll(() => page.evaluate(() => window.contactMotion.size)).toBe(2);
          await expect.poll(() => blocks.last().evaluate(el => el.style.transform)).toMatch(/translateY\(0px\)/);
        } else {
          expect(await page.evaluate(() => window.contactMotion.size)).toBe(0);
          expect(await blocks.evaluateAll(elements => elements.map(el => el.style.transform))).toEqual(['', '']);
        }
        const [form, channels] = await blocks.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
        if (width === 1440) expect(form.right).toBeLessThan(channels.left);
        else expect(form.bottom).toBeLessThan(channels.top);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await page.screenshot({ path: `${output}/contacto-${width}-${reducedMotion}.png`, fullPage: true });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('contact links use their configured public destinations and collapse individually', async () => {
  const { data } = await fetch(base + '/api/v1/store-info').then(r => r.json());
  const destinations = [
    ['Teléfono', data.support_phone, data.support_phone && 'tel:' + data.support_phone.replace(/[^+\d]/g, '')],
    ['Correo', data.support_email, data.support_email && 'mailto:' + encodeURIComponent(data.support_email).replace(/%40([^%]+)$/, '@$1')],
  ];
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(base + '/contacto');
      const section = page.getByRole('region', { name: 'Estamos para ayudarte' });
      const banner = page.locator('.contact-banner');
      await expect(banner.getByRole('heading', { name: 'Contactanos', level: 1 })).toBeVisible();
      expect(await banner.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        return bounds.left === 0 && Math.abs(bounds.right - document.documentElement.clientWidth) <= 1;
      })).toBe(true);
      if (process.env.CAMBA_CONTACT_EXPECT_EDITORIAL === '1') {
        await expect.poll(() => banner.locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
      }
      const card = page.getByRole('region', { name: 'Mandanos un mensaje' });
      const [formBox, helpBox, fieldsBox, buttonBox] = await Promise.all([
        card.boundingBox(), section.boundingBox(), card.locator('fieldset').boundingBox(),
        card.getByRole('button', { name: 'Enviar consulta' }).boundingBox(),
      ]);
      expect(buttonBox.width).toBeCloseTo(fieldsBox.width, 0);
      if (width === 1440) {
        expect(formBox.x + formBox.width).toBeLessThan(helpBox.x);
        expect(formBox.y + formBox.height / 2).toBeCloseTo(helpBox.y + helpBox.height / 2, 0);
      } else {
        expect(formBox.y + formBox.height).toBeLessThan(helpBox.y);
      }
      const expected = [];
      await section.evaluate(element => {
        window.contactTargets = [];
        element.addEventListener('click', event => {
          const link = event.target.closest('a');
          if (link && ['tel:', 'mailto:'].includes(link.protocol)) {
            event.preventDefault(); // Do not start an external phone or mail client in QA.
            window.contactTargets.push(link.getAttribute('href'));
          }
        });
      });
      for (const [label, value, href] of destinations) {
        await expect(section.getByText(label, { exact: true })).toHaveCount(value ? 1 : 0);
        if (!value) continue;
        const link = section.getByRole('link', { name: value, exact: true });
        await expect(link).toHaveAttribute('href', href);
        await link.click();
        expected.push(href);
      }
      await expect(section.locator('.channel-list svg[aria-hidden="true"]')).toHaveCount(expected.length);
      expect(await page.evaluate(() => window.contactTargets)).toEqual(expected);
      const blocks = section.locator('.channel-list > div');
      await expect(blocks).toHaveCount(expected.length);
      if (expected.length === 2) {
        const [phone, email] = await blocks.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
        await expect(blocks.first().locator('dt')).toHaveCSS('flex-direction', 'column');
        if (width === 1440) {
          expect(phone.right).toBeLessThan(email.left);
          expect(phone.top).toBeCloseTo(email.top, 0);
          expect(await blocks.last().evaluate(el => getComputedStyle(el).borderInlineStartWidth)).toBe('1px');
        } else {
          expect(phone.bottom).toBeLessThan(email.top);
          expect(phone.left).toBeCloseTo(email.left, 0);
          expect(await blocks.last().evaluate(el => getComputedStyle(el).borderBlockStartWidth)).toBe('1px');
        }
        await mkdir(output, { recursive: true });
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: `${output}/contacto-redisenado-${width === 1440 ? 'escritorio' : 'movil'}.png`, fullPage: true });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('contact without a configured destination clearly rejects the submission', async t => {
  if (!loopback(base) || process.env.CAMBA_CONTACT_EXPECT_UNCONFIGURED !== '1') {
    return t.skip('Requires a local environment with no internal contact form recipient.');
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(base + '/contacto');
    const message = 'Consulta de prueba que no se debe enviar.';
    await page.getByLabel('Nombre', { exact: true }).fill('Consulta QA');
    await page.getByLabel('Correo electrónico', { exact: true }).fill('sin-destinatario@camba.test');
    await page.getByLabel('Mensaje', { exact: true }).fill(message);
    const submission = page.waitForResponse(r => r.url().endsWith('/api/v1/contact') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar consulta' }).click();
    expect((await submission).status()).toBe(503);
    await expect(page.getByRole('alert')).toContainText('El formulario de contacto no está disponible');
    await expect(page.getByText('Enviamos tu consulta.', { exact: false })).toHaveCount(0);
    await expect(page.getByLabel('Mensaje', { exact: true })).toHaveValue(message);
  } finally {
    await browser.close();
  }
});

test('contact form delivers to the configured Mailpit recipient', { skip: !process.env.CAMBA_CONTACT_STORE }, async () => {
  const store = process.env.CAMBA_CONTACT_STORE;
  const mailpit = process.env.CAMBA_CONTACT_MAILPIT;
  const recipient = process.env.CAMBA_CONTACT_RECIPIENT;
  expect(mailpit).toBeTruthy();
  expect(recipient).toBeTruthy();
  expect(loopback(store) && loopback(mailpit)).toBe(true);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const hydrationErrors = [];
    page.on('console', message => {
      if (message.type() === 'error' && /NG05\d{2}/.test(message.text())) hydrationErrors.push(message.text().slice(0, 100));
    });
    const ref = randomUUID();
    const buyer = `consulta-${ref}@camba.test`;
    const { data } = await fetch(store + '/api/v1/store-info').then(r => r.json());
    expect(data.support_email).not.toBe(recipient);
    await page.goto(store + '/contacto');
    await expect(page.getByRole('link', { name: recipient, exact: true })).toHaveCount(0);
    await page.getByLabel('Nombre', { exact: true }).fill('Lucía Fernández');
    await page.getByLabel('Correo electrónico', { exact: true }).fill(buyer);
    await expect(page.getByLabel('Teléfono (opcional)')).toHaveValue('');
    await page.getByLabel('Mensaje', { exact: true }).fill('Consulta de prueba sobre un pedido. Referencia ' + ref);
    const submission = page.waitForResponse(r => r.url().endsWith('/api/v1/contact') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar consulta' }).click();
    expect((await submission).status()).toBe(204);
    await expect(page.getByRole('status')).toContainText('Enviamos tu consulta.');
    expect(hydrationErrors).toEqual([]);

    let deliveries = [];
    await expect.poll(async () => {
      deliveries = [];
      const { messages } = await fetch(mailpit + '/api/v1/messages').then(r => r.json());
      for (const mail of messages) {
        if (mail.Subject !== 'Consulta desde Camba' || mail.To.length !== 1 || mail.To[0].Address !== recipient) continue;
        const message = await fetch(mailpit + '/api/v1/message/' + encodeURIComponent(mail.ID)).then(r => r.json());
        if (message.Text?.includes(ref)) deliveries.push(message);
      }
      return deliveries.length;
    }).toBe(1);
    const [delivered] = deliveries;
    expect(delivered.From).toMatchObject({ Name: 'Camba', Address: 'notificaciones@camba.test' });
    expect(delivered.ReplyTo).toEqual([expect.objectContaining({ Address: buyer })]);
    expect(delivered.Text).toContain('Nombre: Lucía Fernández');
    expect(delivered.Text).not.toContain('Teléfono:');
    console.log(`Mailpit: un mensaje “${delivered.Subject}” al destinatario configurado; Reply-To y cuerpo verificados.`);

    await mkdir(output, { recursive: true });
    await page.goto(mailpit + '/view/' + encodeURIComponent(delivered.ID) + '.txt');
    await expect(page.getByText(ref, { exact: false })).toBeVisible();
    await page.screenshot({ path: `${output}/contacto-mailpit.png` });
  } finally {
    await browser.close();
  }
});
