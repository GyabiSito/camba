import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('opening the owner link does not confirm; a deliberate click displays the original receipt', async ({ page }) => {
  const reference = randomUUID();
  const token = 'a'.repeat(64);
  const landing = '/arrepentimiento/confirmar/' + reference;
  let requests = 0;
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/withdrawals/' + reference + '/confirmation', route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ token });
    requests++;
    return route.fulfill(requests === 1 ? { json: { data: { reference, received_at: '2026-11-27T15:00:00Z' } } } : { status: 410 });
  });

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Botón de arrepentimiento', exact: true })).toHaveCount(1);
  await page.goto(landing + '#' + token);
  const confirm = page.getByRole('button', { name: 'Sí, hice esta solicitud', exact: true });
  await expect(confirm).toBeEnabled();
  expect(requests).toBe(0);
  await confirm.click();
  await expect(page.getByRole('status')).toContainText(reference);
  await expect(page.getByRole('status')).toContainText('Recepción original');
  expect(new URL(page.url()).hash).toEqual('');

  await page.goto('/tienda');
  await page.goto(landing + '#' + token);
  await expect(confirm).toBeEnabled();
  expect(requests).toBe(1);
  await confirm.click();
  await expect(page.getByRole('alert')).toContainText('El enlace venció, ya se usó o no es válido');
  expect(requests).toBe(2);
});
