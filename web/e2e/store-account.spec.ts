import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const password = 'Camba-account-test-2026';
const mailPort = process.env['CAMBA_E2E_MAILPIT_HTTP_PORT'];
if (process.env['CAMBA_E2E_MAIL_RUN']) test.use({ trace: 'off', screenshot: 'off' });

async function register(page: Page, email: string, name = 'Cuenta de prueba') {
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre completo').fill(name);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmá la contraseña').fill(password);
  const result = page.waitForResponse((response) => response.url().endsWith('/auth/register'));
  await page.getByRole('button', { name: 'Registrarme' }).click();
  expect((await result).status()).toBe(201);
  await expect(page.getByRole('status')).toContainText('Cuenta creada.');
}

async function login(page: Page, email: string, secret: string) {
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(secret);
  const result = page.waitForResponse((response) => response.url().endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  return (await result).status();
}

async function deliveredLink(
  request: APIRequestContext,
  storefront: string,
  email: string,
  path: string,
  previousId?: string,
) {
  const mailpit = `http://127.0.0.1:${mailPort}`;
  let id: string | undefined;
  let link: string | undefined;
  await expect.poll(async () => {
    const inbox = await request.get(`${mailpit}/api/v1/messages`, { maxRedirects: 0 });
    expect(inbox.ok()).toBe(true);
    const { messages } = await inbox.json() as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    for (const candidate of messages.filter((message) =>
      message.ID !== previousId && message.To.some(({ Address }) => Address === email),
    )) {
      const message = await request.get(`${mailpit}/view/${encodeURIComponent(candidate.ID)}.txt`, { maxRedirects: 0 });
      expect(message.ok()).toBe(true);
      link = (await message.text()).match(/https?:\/\/[^\s<>]+/g)?.find((value) => new URL(value).pathname.startsWith(path));
      if (link) { id = candidate.ID; return true; }
    }
    return false;
  }, { message: `Mailpit did not deliver a ${path} link`, timeout: 15_000 }).toBe(true);
  if (!id || !link) throw new Error(`No delivered ${path} link`);
  expect(new URL(link).origin).toBe(storefront);
  return { id, link };
}

test('registration shows an unverified account and a legacy reset link offers recovery', async ({ page }) => {
  const email = 'registro@camba.test';
  await register(page, email);

  expect(await login(page, email, password)).toBe(204);
  await expect(page.getByRole('heading', { name: 'Verificá tu correo' })).toBeVisible();
  await page.getByRole('button', { name: 'Pedir otro enlace' }).click();
  await expect(page.getByText('Solicitamos otro enlace.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Comprobar verificación' }).click();
  await expect(page.getByText('Todavía no figura verificado.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByRole('button', { name: 'Solicitar enlace' }).click();
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta');
  await page.goto('/cuenta/restablecer#token=invalid-test-token');
  await expect(page).toHaveURL(/\/cuenta\/restablecer$/);
  await expect(page.getByRole('button', { name: 'Guardar contraseña' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('link', { name: 'Solicitar un nuevo enlace' }).click();
  await expect(page.getByRole('heading', { name: 'Recuperá tu contraseña' })).toBeVisible();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});

test('a resent Mailpit link verifies the buyer account', async ({ baseURL, browser, page, request }) => {
  test.skip(!mailPort, 'Requires disposable Mailpit SMTP and HTTP ports.');
  const email = `verify-${randomUUID()}@camba.test`;
  await register(page, email);
  const first = await deliveredLink(request, baseURL!, email, '/email/verify/');
  expect(await login(page, email, password)).toBe(204);
  const notice = page.getByRole('heading', { name: 'Verificá tu correo' });
  await expect(notice).toBeVisible();
  const resend = page.waitForResponse((response) =>
    response.url().endsWith('/auth/email/verification-notification'),
  );
  await page.getByRole('button', { name: 'Pedir otro enlace' }).click();
  expect((await resend).status()).toBe(204);
  const { link } = await deliveredLink(request, baseURL!, email, '/email/verify/', first.id);

  const account = baseURL + '/cuenta?verificacion=';
  const confirmation = 'Tu cuenta ha sido verificada';
  const guest = await browser.newContext({ baseURL });
  try {
    const messageTab = await guest.newPage();
    await messageTab.goto(link + '&invalid=1');
    await expect(messageTab).toHaveURL(account + 'invalida');
    await expect(messageTab.getByRole('alert')).toHaveText('El enlace de verificación es inválido o venció.');
    await messageTab.goto(link);
    await expect(messageTab).toHaveURL(account + 'confirmada');
    await expect(messageTab.getByText(confirmation, { exact: true })).toBeVisible();
    expect(await login(messageTab, email, password)).toBe(204);
    await expect(messageTab.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
    await expect(messageTab.getByText(confirmation, { exact: true })).toBeVisible();
  } finally {
    await guest.close();
  }
  await page.goto(link);
  await expect(page).toHaveURL(account + 'confirmada');
  await expect(page.getByText(confirmation, { exact: true })).toBeVisible();
  await expect(notice).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  await expect(notice).toBeHidden();
});

test('a delivered Mailpit reset link replaces the buyer password in a new session', async ({ baseURL, browser, page, request }) => {
  test.skip(!mailPort, 'Requires disposable Mailpit SMTP and HTTP ports.');
  const email = `reset-${randomUUID()}@camba.test`;
  const newPassword = 'Camba-new-account-test-2026';
  await register(page, email);
  const registration = await deliveredLink(request, baseURL!, email, '/email/verify/');
  await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click();
  await page.getByLabel('Correo electrónico').fill(email);
  const forgot = page.waitForResponse((response) => response.url().endsWith('/auth/forgot-password'));
  await page.getByRole('button', { name: 'Solicitar enlace' }).click();
  expect((await forgot).status()).toBe(202);
  const { link } = await deliveredLink(request, baseURL!, email, '/cuenta/restablecer', registration.id);

  const changed = new URL(link);
  const fragment = new URLSearchParams(changed.hash.slice(1));
  const token = fragment.get('reset');
  if (!token) throw new Error('Mailpit did not deliver a protected reset link');
  expect(changed.search).toBe('');
  fragment.set('reset', (token[0] === 'A' ? 'B' : 'A') + token.slice(1));
  changed.hash = fragment.toString();

  const guest = await browser.newContext({ baseURL });
  try {
    expect(await guest.cookies()).toHaveLength(0);
    const resetPage = await guest.newPage();
    async function resetFrom(url: string, secret: string) {
      await resetPage.goto('about:blank');
      await resetPage.goto(url);
      await expect(resetPage).toHaveURL(/\/cuenta\/restablecer$/);
      await expect(resetPage.getByLabel('Correo electrónico')).toHaveCount(0);
      await resetPage.getByLabel('Nueva contraseña').fill(secret);
      await resetPage.getByLabel('Confirmá la contraseña').fill(secret);
      const reset = resetPage.waitForResponse((response) => response.url().endsWith('/auth/reset-password'));
      await resetPage.getByRole('button', { name: 'Guardar contraseña' }).click();
      const response = await reset;
      expect(Object.keys(response.request().postDataJSON()).sort()).toEqual(['password', 'password_confirmation', 'token']);
      return response.status();
    }

    expect(await resetFrom(changed.href, password)).toBe(422);
    await expect(resetPage.getByRole('link', { name: 'Solicitar un nuevo enlace' })).toBeVisible();
    expect(await resetFrom(link, newPassword)).toBe(204);
    await expect(resetPage.getByRole('status')).toContainText('Contraseña actualizada.');
    expect(await resetFrom(link, password)).toBe(422);
    await expect(resetPage.getByRole('link', { name: 'Solicitar un nuevo enlace' })).toBeVisible();

    await resetPage.goto('/cuenta');
    expect(await login(resetPage, email, password)).toBe(422);
    expect(await login(resetPage, email, newPassword)).toBe(204);
    await expect(resetPage.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
    await expect(resetPage.getByText(email, { exact: true })).toBeVisible();
  } finally {
    await guest.close();
  }
});

test.describe('Camba transactional mail', () => {
  test('delivers and captures real transactional mail', async ({ baseURL, browser, page, request }) => {
    const run = process.env['CAMBA_E2E_MAIL_RUN'];
    test.skip(!mailPort || !run || !/^[a-f0-9]{32}$/.test(run), 'Requires isolated Mailpit and CAMBA_E2E_MAIL_RUN.');
    test.setTimeout(100_000);
    const inbox = `http://127.0.0.1:${mailPort}`;
    const email = `mail-${run}@camba.test`;
    const welcomeSubject = 'Te damos la bienvenida a Camba';
    const output = `test-results/transactional-mail/${run}`;
    await mkdir(output, { recursive: true });

    async function welcomeCount() {
      const result = await request.get(inbox + '/api/v1/messages', { maxRedirects: 0 });
      expect(result.ok()).toBe(true);
      const { messages } = await result.json() as { messages: { Subject: string; To: { Address: string }[] }[] };
      return messages.filter(m => m.Subject === welcomeSubject && m.To.some(t => t.Address === email)).length;
    }

    async function received(to: string, subject: string, action: string) {
      let id: string | undefined;
      await expect.poll(async () => {
        const result = await request.get(inbox + '/api/v1/messages', { maxRedirects: 0 });
        expect(result.ok()).toBe(true);
        const { messages } = await result.json() as {
          messages: { ID: string; To: { Address: string }[]; From: { Address: string; Name: string }; Subject: string }[];
        };
        const item = messages.find(m => m.Subject === subject && m.To.some(t => t.Address === to));
        if (!item) return false;
        expect(item.From).toMatchObject({ Name: 'Camba', Address: 'notificaciones@camba.test' });
        id = item.ID;
        return true;
      }, { timeout: 35_000, message: `Mailpit received: ${subject}` }).toBe(true);
      const view = `${inbox}/view/${encodeURIComponent(id!)}`;
      const [htmlResponse, textResponse] = await Promise.all([
        request.get(view + '.html', { maxRedirects: 0 }), request.get(view + '.txt', { maxRedirects: 0 }),
      ]);
      expect(htmlResponse.ok() && textResponse.ok()).toBe(true);
      const [html, plain] = await Promise.all([htmlResponse.text(), textResponse.text()]);
      expect(html.includes(action) && plain.includes(action) && !html.includes('Laravel')).toBe(true);
      expect(html.includes('mailto:hola@camba.test') && plain.includes('Ayuda: hola@camba.test')).toBe(true);
      const link = plain.match(/https?:\/\/[^\s<>]+/)?.[0] ?? '';
      expect(link.startsWith(baseURL!) && !link.includes('&amp;')).toBe(true);
      expect(html.includes(`href="${link.replaceAll('&', '&amp;')}"`)).toBe(true);
      return { html, plain, link, view };
    }

    async function captures(name: string, html: string, action: string, visibleBrand = 'Camba') {
      const src = html.match(/<img[^>]+src="([^"]+)"/i)?.[1];
      if (!src) throw new Error('Missing embedded bow');
      const asset = new URL(src, inbox);
      expect(asset.origin === inbox && asset.pathname.startsWith('/api/v1/message/')).toBe(true);
      const response = await request.get(asset.href, { maxRedirects: 0 });
      expect(response.ok()).toBe(true);
      const data = 'data:image/png;base64,' + (await response.body()).toString('base64');
      // Do not write message source, token, signed parameters, or real action URLs to artifacts.
      const safe = html.replace(src, data).replace(/https?:\/\/[^\s<>"']+/gi, '[enlace oculto]');
      const ctx = await browser.newContext({ javaScriptEnabled: false });
      try {
        await ctx.route('**/*', route => route.abort());
        const preview = await ctx.newPage();
        for (const [width, blocked] of [[600, false], [390, false], [390, true]] as const) {
          await preview.setViewportSize({ width, height: 560 });
          await preview.setContent(blocked ? safe.replace(data, 'about:blank') : safe);
          await expect(preview.getByText(visibleBrand, { exact: true }).first()).toBeVisible();
          await expect(preview.getByRole('link', { name: action })).toBeVisible();
          expect(await preview.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
          const imageWidth = await preview.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth);
          if (blocked) expect(imageWidth).toBe(0);
          else expect(imageWidth).toBeGreaterThan(0);
          await preview.screenshot({ path: `${output}/${name}-${width}${blocked ? '-sin-imagenes' : ''}.png`, fullPage: true });
        }
      } finally {
        await ctx.close();
      }
    }

    await register(page, email, 'Lucía Fernández');
    const [verification, welcome] = await Promise.all([
      received(email, 'Verificá tu correo', 'Verificar mi correo'),
      received(email, welcomeSubject, 'Explorá la tienda'),
    ]);
    expect(await welcomeCount()).toBe(1);
    expect(new URL(verification.link).pathname.startsWith('/email/verify/')).toBe(true);
    await captures('verificacion', verification.html, 'Verificar mi correo');
    expect(welcome.plain).toContain('Hola, Lucía Fernández. Gracias por sumarte a Camba.');
    expect(welcome.plain).toContain('Te enviamos por separado un enlace para verificar tu correo.');
    expect(welcome.html).not.toContain('Si el botón no funciona');
    expect(welcome.html).not.toContain('Ir a Mi cuenta');
    await captures('bienvenida', welcome.html, 'Explorá la tienda', welcomeSubject);
    const mailPage = await page.context().newPage();
    try {
      const destination = baseURL + '/tienda';
      expect(welcome.plain).toContain(`Explorá la tienda: ${destination}`);
      await mailPage.goto(welcome.view + '.html');
      const link = mailPage.getByRole('link', { name: 'Explorá la tienda', exact: true });
      await expect(link).toHaveAttribute('href', destination);
      const navigation = mailPage.waitForResponse(r => r.url() === destination && r.request().isNavigationRequest());
      await link.click();
      expect((await navigation).status()).toBe(200);
      await expect(mailPage).toHaveURL(destination);
    } finally {
      await mailPage.close();
    }
    expect((await request.get(verification.link, { maxRedirects: 0 })).status()).toBe(204);
    expect((await request.get(verification.link, { maxRedirects: 0 })).status()).toBe(204);

    await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByRole('button', { name: 'Solicitar enlace' }).click();
    const reset = await received(email, 'Restablecé tu contraseña', 'Restablecer contraseña');
    expect(new URL(reset.link).pathname).toBe('/cuenta/restablecer');
    expect(reset.plain.includes('60 minutos') && reset.html.includes('copiá y pegá')).toBe(true);
    await captures('recuperacion', reset.html, 'Restablecer contraseña');
    await page.goto(reset.link);
    await page.getByLabel('Correo electrónico').fill(email);
    const replacement = 'Camba-new-account-test-2026';
    await page.getByLabel('Nueva contraseña').fill(replacement);
    await page.getByLabel('Confirmá la contraseña').fill(replacement);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByRole('status')).toContainText('Contraseña actualizada.');
    await page.getByRole('link', { name: 'Ir al ingreso' }).click();
    expect(await login(page, email, replacement)).toBe(204);
    await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();

    await page.goto('/producto/remera-lisa');
    await page.getByRole('button', { name: /agregar al carrito/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Seguir comprando' }).click();
    await page.goto('/carrito');
    await page.getByRole('link', { name: 'Continuar la compra' }).click();
    await page.getByRole('radio', { name: /Retiro/ }).check();
    const orderResponse = page.waitForResponse(r => r.url().endsWith('/api/v1/orders') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    const placed = await orderResponse;
    expect(placed.status()).toBe(201);
    const { reference } = (await placed.json()).data;
    const order = await received(email, 'Camba: recibimos tu pedido', 'Ver pedido');
    expect(order.plain.includes(reference) && order.plain.includes('Pendiente de pago') && order.plain.includes('UYU')).toBe(true);
    expect(new URL(order.link).pathname).toBe(`/pedidos/${reference}`);
    await captures('pedido', order.html, 'Ver pedido');

    for (const subject of ['pago confirmado', 'tu pago sigue pendiente', 'tu pedido está listo para retirar', 'enviamos tu pedido']) {
      const mail = await received(`orders-${run}@camba.test`, 'Camba: ' + subject, 'Ver pedido');
      expect(mail.plain.includes('Referencia:') && mail.plain.includes('Estado:') && mail.plain.includes('UYU 890,00')).toBe(true);
    }
    const cart = await received(`cart-${run}@camba.test`, 'Camba: tenés productos en el carrito', 'Ver carrito');
    expect(new URL(cart.link).pathname).toBe('/carrito');
    // Checkout mail proves the scheduler and worker ran again after replaying the verification link.
    expect(await welcomeCount()).toBe(1);
  });
});

test('a naturally expired session requires the buyer to sign in again', async ({ baseURL, context, page, request }) => {
  test.skip(process.env['CAMBA_E2E_SHORT_SESSION'] !== '1', 'Requires a one-minute isolated session lifetime.');
  test.setTimeout(110_000);
  const email = 'buyer@camba.test';
  const secret = 'Camba-test-only-2026';
  const me = '/api/v1/auth/me';
  const profile = page.getByRole('heading', { name: 'Datos personales' });
  await page.goto('/cuenta');
  expect(await login(page, email, secret)).toBe(204);
  await expect(profile).toBeVisible();
  await page.reload();
  await expect(profile).toBeVisible();
  const cookie = (await context.cookies()).find(({ name }) => name === 'camba_browser_e2e');
  if (!cookie) throw new Error('No authenticated session cookie');

  // Laravel uses whole minutes and whole-second timestamps. Do not poll a live session: that renews it.
  await setTimeout(62_000);
  expect((await context.cookies()).some(({ name }) => name === cookie.name)).toBe(false);
  const expired = await request.get(me, {
    headers: { Origin: baseURL!, Cookie: `${cookie.name}=${cookie.value}` },
  });
  expect(expired.status()).toBe(401);
  const reload = page.waitForResponse((response) => response.url().endsWith(me));
  await page.reload();
  expect((await reload).status()).toBe(401);
  await expect(profile).toBeHidden();
  expect(await login(page, email, secret)).toBe(204);
  await expect(profile).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});
