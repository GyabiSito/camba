import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Runs only against the already-running local stack; never seeds or clears shared data/inbox.
const store = 'http://127.0.0.1:4200';
const mailpitBinding = execFileSync('docker', ['port', 'camba-v2-demo-pg-mailpit-1', '8025/tcp'], { encoding: 'utf8' }).trim();
assert.match(mailpitBinding, /^127\.0\.0\.1:[1-9]\d{0,4}$/, 'Mailpit must publish its UI on IPv4 loopback.');
const mailpit = `http://${mailpitBinding}`;
const output = 'test-results/storefront-docker-account';
const run = randomUUID();
const password = `Qa-account-${randomUUID()}-2026`;
const replacement = `Qa-replacement-${randomUUID()}-2026`;
const accounts = ['qa-cuenta', 'qa-privacidad'].map((prefix) => `${prefix}-${run}@camba.test`);
const results = [];
const browser = await chromium.launch();
const contexts = await Promise.all(accounts.map(() => browser.newContext({ baseURL: store })));
const pages = await Promise.all(contexts.map((context) => context.newPage()));
const traffic = [];
const registrationQueue = [];
const external = [];
for (const page of pages) {
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (url.origin !== store) external.push(url.origin);
  });
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/api/v1/')) traffic.push({ method: response.request().method(), path, status: response.status() });
  });
}

async function scenario(name, action) {
  try {
    await action();
    results.push({ name, status: 'passed' });
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    // No credentials, reset tokens, signed links, cookies, mail bodies, or raw responses in evidence.
    const message = String(error.message).split('\n').slice(0, 3).join(' ')
      .replaceAll(password, '[secret]').replaceAll(replacement, '[secret]')
      .replace(/https?:\/\/[^\s"')]+/g, '[URL]').replace(/[^\s]+@camba\.test/g, '[QA account]');
    results.push({ name, status: 'failed', message });
    console.error(`FAIL ${name}: ${message}`);
    return false;
  }
}

async function submit(page, button, path, status, method = 'POST') {
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1' + path && r.request().method() === method);
  await page.getByRole('button', { name: button, exact: true }).click();
  const received = await response;
  assert.equal(received.status(), status, `${method} ${path}`);
  return received;
}

async function login(page, email, secret = password, status = 204) {
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(secret);
  await submit(page, 'Ingresar', '/auth/login', status);
  if (status === 204) await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
}

async function api(page, path, method = 'GET', data) {
  return page.evaluate(async ({ path, method, data }) => {
    const token = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='))?.split('=').slice(1).join('=');
    const response = await fetch('/api/v1' + path, {
      method, credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { path, method, data });
}

async function deliveredLink(context, email, path, previousId) {
  let id;
  let link;
  await expect.poll(async () => {
    const inbox = await context.request.get(mailpit + '/api/v1/messages', { maxRedirects: 0 });
    assert(inbox.ok(), 'Mailpit inbox request');
    const { messages } = await inbox.json();
    for (const candidate of messages.filter((message) => message.ID !== previousId && message.To.some(({ Address }) => Address === email))) {
      const message = await context.request.get(`${mailpit}/view/${encodeURIComponent(candidate.ID)}.txt`, { maxRedirects: 0 });
      assert(message.ok());
      link = (await message.text()).match(/https?:\/\/[^\s<>]+/g)?.find((value) => new URL(value).pathname.startsWith(path));
      if (link) { id = candidate.ID; return true; }
    }
    return false;
  }, { timeout: 20_000, message: 'Mailpit delivery to this synthetic account' }).toBe(true);
  assert(link, `Delivered ${path} link`);
  // Follow the delivered origin verbatim, never repair a broken URL in the test.
  assert.equal(new URL(link).origin, store, `Delivered ${path} origin must be canonical Store`);
  return { id, link };
}

const registered = [];
try {
  await mkdir(output, { recursive: true });
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    registered[i] = await scenario(`account ${i + 1}: UI registration, login, unverified before email`, async () => {
      await page.goto('/cuenta');
      await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
      await page.getByLabel('Nombre completo').fill(`QA account ${i + 1}`);
      await page.getByLabel('Correo electrónico').fill(accounts[i]);
      await page.getByLabel('Contraseña', { exact: true }).fill(password);
      await page.getByLabel('Confirmá la contraseña').fill(password);
      const registered = await submit(page, 'Registrarme', '/auth/register', 201);
      registrationQueue.push((await registered.json()).meta?.verification_queued);
      await expect(page.getByRole('status')).toContainText('Cuenta creada.');
      await login(page, accounts[i]);
      await expect(page.getByRole('heading', { name: 'Verificá tu correo' })).toBeVisible();
      assert.equal((await api(page, '/auth/me')).body.data.email_verified, false);
      await page.getByRole('button', { name: 'Comprobar verificación' }).click();
      await expect(page.getByText('Todavía no figura verificado.', { exact: false })).toBeVisible();
    });
    if (!registered[i]) continue;
    await scenario(`account ${i + 1}: delivered Mailpit verification and reload`, async () => {
      let delivery = await deliveredLink(contexts[i], accounts[i], '/email/verify/');
      if (i === 0) {
        await submit(page, 'Pedir otro enlace', '/auth/email/verification-notification', 204);
        delivery = await deliveredLink(contexts[i], accounts[i], '/email/verify/', delivery.id);
      }
      const tab = await contexts[i].newPage();
      try {
        const response = tab.waitForResponse((r) => r.url() === delivery.link);
        await tab.evaluate((link) => window.location.assign(link), delivery.link);
        assert.equal((await response).status(), 204, 'Delivered verification request');
      } finally { await tab.close(); }
      await page.getByRole('button', { name: 'Comprobar verificación' }).click();
      await expect(page.getByText('Correo verificado.', { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Verificá tu correo' })).toBeHidden();
      assert.equal((await api(page, '/auth/me')).body.data.email_verified, true);
    });
  }

  const page = pages[0];
  let address;
  if (registered[0]) {
    await scenario('profile UI update survives reload', async () => {
      await page.getByLabel('Nombre completo').fill('QA account updated');
      await submit(page, 'Guardar nombre', '/account/profile', 200, 'PATCH');
      await page.reload();
      await expect(page.getByLabel('Nombre completo')).toHaveValue('QA account updated');
      const me = (await api(page, '/account/profile')).body.data;
      assert.equal(me.email, accounts[0]);
      assert.equal(me.name, 'QA account updated');
    });
    await scenario('address UI create/read/update persists after reload', async () => {
      await page.getByRole('button', { name: 'Agregar dirección' }).click();
      for (const [label, value] of Object.entries({ 'Nombre de quien recibe': 'QA recipient', Departamento: 'Montevideo', Localidad: 'Montevideo', Calle: 'QA privacy street', 'Número de puerta': '101' })) {
        await page.getByLabel(label, { exact: true }).fill(value);
      }
      const created = await submit(page, 'Guardar dirección', '/account/addresses', 201);
      address = (await created.json()).data;
      await page.getByRole('button', { name: 'Editar QA privacy street 101' }).click();
      await page.getByLabel('Número de puerta').fill('102');
      await submit(page, 'Guardar dirección', `/account/addresses/${address.id}`, 200, 'PATCH');
      await page.reload();
      await expect(page.getByText('QA privacy street 102', { exact: true })).toBeVisible();
      const own = await api(page, `/account/addresses/${address.id}`);
      assert.equal(own.status, 200);
      assert.equal(own.body.data.number, '102');
    });
    if (registered[1] && address) await scenario('second isolated account cannot read/update/delete first address or access Admin', async () => {
      const other = pages[1];
      const me = await api(other, '/account/profile');
      assert.equal(me.status, 200);
      assert.equal(me.body.data.email, accounts[1]);
      assert.equal(me.body.data.name, 'QA account 2');
      const list = await api(other, '/account/addresses');
      assert.equal(list.status, 200);
      assert.deepEqual(list.body.data, []);
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        const denied = await api(other, `/account/addresses/${address.id}`, method, method === 'PATCH' ? { ...address, number: '999' } : undefined);
        assert([403, 404].includes(denied.status), `${method} other account address must be denied, received ${denied.status}`);
      }
      assert.equal((await api(other, '/admin/session')).status, 403);
      assert.equal((await api(page, `/account/addresses/${address.id}`)).body.data.number, '102');
      await expect(other.getByText('QA privacy street 102', { exact: true })).toBeHidden();
    });
    if (address) await scenario('address UI delete persists after reload', async () => {
      await page.getByRole('button', { name: 'Eliminar QA privacy street 102' }).click();
      await submit(page, 'Eliminar dirección', `/account/addresses/${address.id}`, 204, 'DELETE');
      await page.reload();
      await expect(page.getByText('QA privacy street 102', { exact: true })).toBeHidden();
      assert.deepEqual((await api(page, '/account/addresses')).body.data, []);
    });
    await scenario('logout and reload restrict private account data', async () => {
      await submit(page, 'Cerrar sesión', '/auth/logout', 204);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
      for (const path of ['/auth/me', '/account/profile', '/account/addresses', ...(address ? [`/account/addresses/${address.id}`] : [])]) {
        assert.equal((await api(page, path)).status, 401, `Guest ${path}`);
      }
      await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeHidden();
    });
    await scenario('delivered Mailpit password reset rejects old password and accepts replacement', async () => {
      await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click();
      await page.getByLabel('Correo electrónico').fill(accounts[0]);
      await submit(page, 'Solicitar enlace', '/auth/forgot-password', 202);
      const { link } = await deliveredLink(contexts[0], accounts[0], '/cuenta/restablecer');
      await page.goto(link);
      await expect(page.getByLabel('Correo electrónico')).toHaveCount(0);
      await expect(page).toHaveURL(store + '/cuenta/restablecer');
      await page.getByLabel('Nueva contraseña').fill(replacement);
      await page.getByLabel('Confirmá la contraseña').fill(replacement);
      await submit(page, 'Guardar contraseña', '/auth/reset-password', 204);
      await page.getByRole('link', { name: 'Ir al ingreso' }).click();
      await login(page, accounts[0], password, 422);
      await login(page, accounts[0], replacement);
      await page.reload();
      await expect(page.getByLabel('Nombre completo')).toHaveValue('QA account updated');
      assert.equal((await api(page, '/auth/me')).body.data.email, accounts[0]);
    });
  }
  assert.deepEqual(external, [], 'Store journeys must not issue external requests');
} finally {
  await writeFile(output + '/results.json', JSON.stringify({ store, mailpit, results, registrationQueue, traffic, external }, null, 2));
  await browser.close();
}
if (results.some(({ status }) => status === 'failed')) process.exitCode = 1;
console.log(`Customer journey: ${results.filter(({ status }) => status === 'passed').length}/${results.length} passed`);
