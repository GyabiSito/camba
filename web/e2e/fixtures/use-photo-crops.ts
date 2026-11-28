import { expect, type Page } from '@playwright/test';

export async function usePhotoCrops(page: Page, count = 1) {
  const cropper = page.getByRole('dialog', { name: 'Recortar foto' });
  for (let photo = 1; photo <= count; photo++) {
    await expect(cropper.getByText(`Foto ${photo} de ${count}`, { exact: true })).toBeVisible();
    await cropper.getByRole('button', { name: 'Usar recorte' }).click();
  }
  await expect(cropper).toBeHidden();
}
