import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const password = 'Camba-account-test-2026';
const mailPort = process.env['CAMBA_E2E_MAILPIT_HTTP_PORT'];

async function register(page: Page, email: string) {
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre completo').fill('Cuenta de prueba');
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
  await expect.poll(async () => {
    const inbox = await request.get(`${mailpit}/api/v1/messages`, { maxRedirects: 0 });
    expect(inbox.ok()).toBe(true);
    const { messages } = await inbox.json() as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    id = messages.find((message) =>
      message.ID !== previousId && message.To.some(({ Address }) => Address === email),
    )?.ID;
    return id;
  }, { message: `Mailpit did not receive a new message for ${email}`, timeout: 12_000 }).toBeTruthy();
  if (!id) throw new Error('No delivered message ID');
  const message = await request.get(`${mailpit}/view/${encodeURIComponent(id)}.txt`, { maxRedirects: 0 });
  expect(message.ok()).toBe(true);
  const link = (await message.text()).match(/https?:\/\/[^\s<>]+/g)?.find((value) =>
    new URL(value).pathname.startsWith(path),
  );
  if (!link) throw new Error(`No delivered ${path} link`);
  expect(new URL(link).origin).toBe(storefront);
  return { id, link };
}

test('registration shows an unverified account and handles a bad reset link', async ({ page }) => {
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
  await page.getByLabel('Correo electrónico').fill(email);
  await expect(page).toHaveURL(/\/cuenta\/restablecer$/);
  await page.getByLabel('Nueva contraseña').fill('Camba-reset-test-2026');
  await page.getByLabel('Confirmá la contraseña').fill('Camba-reset-test-2026');
  const result = page.waitForResponse((response) =>
    response.url().endsWith('/auth/reset-password'),
  );
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  expect((await result).status()).toBe(422);
  await expect(page.getByRole('alert')).toBeVisible();
});

test('a resent Mailpit link verifies the buyer account', async ({ baseURL, context, page, request }) => {
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

  const messageTab = await context.newPage();
  const verification = messageTab.waitForResponse((response) => response.url() === link);
  // The 204 navigation does not commit a new document.
  await messageTab.evaluate((url) => window.location.assign(url), link);
  expect((await verification).status()).toBe(204);
  await messageTab.close();
  await page.getByRole('button', { name: 'Comprobar verificación' }).click();
  await expect(page.getByRole('status')).toHaveText('Correo verificado.');
  await expect(notice).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  await expect(notice).toBeHidden();
});

test('a delivered Mailpit reset link replaces the buyer password', async ({ baseURL, page, request }) => {
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

  await page.goto(link);
  await page.getByLabel('Correo electrónico').fill(email);
  await expect(page).toHaveURL(/\/cuenta\/restablecer$/);
  await page.getByLabel('Nueva contraseña').fill(newPassword);
  await page.getByLabel('Confirmá la contraseña').fill(newPassword);
  const reset = page.waitForResponse((response) => response.url().endsWith('/auth/reset-password'));
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  expect((await reset).status()).toBe(204);
  await expect(page.getByRole('status')).toContainText('Contraseña actualizada.');
  await page.getByRole('link', { name: 'Ir al ingreso' }).click();
  expect(await login(page, email, password)).toBe(422);
  expect(await login(page, email, newPassword)).toBe(204);
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
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
