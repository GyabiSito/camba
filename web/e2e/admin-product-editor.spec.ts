import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const image = (name: string) => resolve(__dirname, `../projects/admin/public/demo/${name}.webp`);
const uploadPath = /\/api\/v1\/admin\/products\/\d+\/images\/uploads$/;

for (const mobile of [false, true]) {
  test.describe(mobile ? 'Editor a 320 px' : 'Editor en escritorio', () => {
    test.use({ viewport: mobile ? { width: 320, height: 800 } : { width: 1440, height: 990 }, hasTouch: mobile });

    test('crea el borrador, recorta cinco fotos y conserva la guardada al cancelar', async ({ page, browserName }, info) => {
      test.setTimeout(135_000);
      const width = mobile ? 320 : 1440;
      await page.goto('/productos/nuevo');
      await page.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
      await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
      await page.getByRole('button', { name: 'Ingresar' }).click();
      await expect(page.getByRole('heading', { name: 'Nuevo producto', exact: true })).toBeVisible();
      await expect(page.getByText('Guardá el borrador para agregar fotos.')).toBeVisible();
      await page.screenshot({ path: info.outputPath(`nuevo-${width}.png`) });
      const name = mobile ? 'Remera de algodón con bolsillo' : 'Remera de algodón · colección de invierno';
      await page.getByLabel('Nombre', { exact: true }).fill(name);
      await page.getByLabel('Precio (UYU)').fill('1350');
      await page.getByLabel('Stock', { exact: true }).fill('4');
      await page.getByRole('button', { name: 'Crear borrador' }).click();
      await expect(page).toHaveURL(/\/productos\/\d+$/);
      await expect(page.getByRole('heading', { name: 'Editar producto', exact: true })).toBeVisible();
      await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(name);

      const gallery = page.getByRole('region', { name: 'Galería' });
      const cropper = page.getByRole('dialog', { name: 'Recortar foto' });
      await gallery.getByLabel('Agregar fotos').setInputFiles(image('image-pocket'));
      await expect(cropper).toBeVisible();
      const zoom = cropper.getByRole('slider', { name: 'Zoom' });
      await expect(zoom).toBeEnabled();
      await zoom.press('ArrowRight');
      await expect(zoom).not.toHaveValue('100');
      const horizontal = cropper.getByRole('slider', { name: 'Desplazamiento horizontal' });
      await horizontal.press('ArrowRight');
      await expect(horizontal).not.toHaveValue('50');
      const confirmCrop = cropper.getByRole('button', { name: 'Usar recorte' });
      if (mobile) await confirmCrop.tap();
      else await confirmCrop.press('Enter');
      await expect(cropper).toBeHidden();

      const coverSaved = page.waitForResponse(response => uploadPath.test(response.url()) && response.request().method() === 'POST');
      await gallery.getByRole('button', { name: 'Subir fotos' }).click();
      expect((await coverSaved).status()).toBe(201);
      const cover = gallery.getByRole('group', { name: 'Portada', exact: true }).getByRole('img');
      await expect.poll(() => cover.evaluate(node => {
        const img = node as HTMLImageElement;
        return img.naturalHeight > 0 && img.naturalWidth * 5 === img.naturalHeight * 4;
      })).toBe(true);

      await gallery.getByLabel('Agregar fotos').setInputFiles(['image-plain', 'image-cotton', 'image-over', 'detail-photo'].map(image));
      for (let i = 1; i <= 4; i++) {
        await expect(cropper.getByText(`Foto ${i} de 4`, { exact: true })).toBeVisible();
        await cropper.getByRole('button', { name: 'Usar recorte' }).click();
      }
      await gallery.getByRole('button', { name: 'Subir fotos' }).click();
      await expect(gallery.getByText('5 de 5 fotos', { exact: true })).toBeVisible();
      await expect(gallery.getByLabel('Agregar fotos')).toBeDisabled();

      const url = new URL(page.url());
      const csrf = (await page.context().cookies(url.origin)).find(cookie => cookie.name === 'XSRF-TOKEN');
      const sixth = await page.request.post(`/api/v1/admin${url.pathname.replace('/productos', '/products')}/images`, {
        headers: { Origin: url.origin, 'X-XSRF-TOKEN': decodeURIComponent(csrf!.value) },
        multipart: { 'photos[]': { name: 'sixth.webp', mimeType: 'image/webp', buffer: readFileSync(image('image-twill')) } },
      });
      expect(sixth.status()).toBe(422);
      await gallery.getByRole('button', { name: 'Usar foto 2 como portada' }).click();
      await gallery.getByRole('button', { name: 'Guardar orden' }).click();
      await expect(gallery.getByText('Orden y portada guardados.')).toBeVisible();
      const savedSource = await cover.getAttribute('src');
      const chooser = page.waitForEvent('filechooser');
      await gallery.getByRole('button', { name: 'Reemplazar portada' }).click();
      await (await chooser).setFiles(image('image-twill'));
      await expect(cropper).toBeVisible();
      await expect(zoom).toBeEnabled();
      await page.screenshot({ path: info.outputPath(`recorte-${width}.png`) });
      const cancel = cropper.getByRole('button', { name: 'Cancelar', exact: true });
      if (mobile && browserName === 'chromium') {
        await zoom.press('ArrowRight');
        const surface = await cropper.getByRole('img', { name: 'Vista previa del recorte' }).boundingBox();
        expect(surface).not.toBeNull();
        const session = await page.context().newCDPSession(page);
        const x = surface!.x + surface!.width / 2;
        const y = surface!.y + surface!.height / 2;
        const beforeDrag = await horizontal.inputValue();
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 24, y }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(horizontal).not.toHaveValue(beforeDrag);
        await cancel.press('Escape');
        await session.detach();
      } else {
        await cancel.click();
      }
      await expect(cropper).toBeHidden();
      await expect(cover).toHaveAttribute('src', savedSource!);
      await expect(gallery.getByText('5 de 5 fotos', { exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      if (mobile) {
        await gallery.evaluate(region => region.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: info.outputPath('galeria-320.png') });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`editor-${width}.png`) });
      if (!mobile) {
        const replacement = page.waitForEvent('filechooser');
        await gallery.getByRole('button', { name: 'Reemplazar portada' }).click();
        await (await replacement).setFiles(image('image-twill'));
        await cropper.getByRole('button', { name: 'Usar recorte' }).click();
        const uploaded = page.waitForResponse(response => response.url().endsWith('/images/uploads/replace'));
        await gallery.getByRole('button', { name: 'Guardar reemplazo' }).click();
        expect((await uploaded).status()).toBe(201);
        await expect(cover).not.toHaveAttribute('src', savedSource!);
        await expect(gallery.getByText('5 de 5 fotos', { exact: true })).toBeVisible();
      }
    });
  });
}
