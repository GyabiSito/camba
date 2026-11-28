import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { HomeData, homeSelection, PageResult, Product, publicationHome, HomeRenderOptions } from '../../../../../../store/src/app/home-preview';
import { HomepageApi } from '../data-access/homepage-api';
import type { PreviewResult } from './preview-result';

// The editorial build alone serves these assets. An image probe also works across
// the configured Store origin without a CORS-dependent fetch or a private API call.
function editorialAvailable(storeUrl: string): Promise<boolean> {
  return new Promise(resolve => {
    const photo = new Image();
    const timer = setTimeout(() => finish(false), 3000);
    const finish = (available: boolean) => {
      clearTimeout(timer); photo.onload = null; photo.onerror = null; resolve(available);
    };
    photo.onload = () => finish(photo.naturalWidth > 0);
    photo.onerror = () => finish(false);
    photo.referrerPolicy = 'no-referrer';
    photo.src = new URL('/demo-home/atelier-hero-wide-small.webp', storeUrl).href;
  });
}

const resolvePreview: ResolveFn<PreviewResult> = async () => {
  const api = inject(HomepageApi);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return { kind: 'unavailable' };
  const response = await firstValueFrom(api.preview().pipe(catchError(() => of(null))));
  if (!response) return { kind: 'unavailable' };
  const origin = URL.parse(response.state.data.store_url);
  if (!origin || !/^https?:$/.test(origin.protocol)) return { kind: 'unavailable' };
  const editorial = await editorialAvailable(origin.origin);
  const publication = response.publication.data;
  return { kind: 'ready', data: publicationHome(publication, homeSelection(publication.products.slice(0, 12), editorial)),
    options: { editorial, assetOrigin: origin.origin, preview: true } };
};

export const adminHomePreviewCanvasRoutes: Routes = [{
  path: '', pathMatch: 'full', title: 'Vista previa de portada | Camba Admin',
  loadComponent: () => import('./homepage-preview-canvas').then(module => module.HomepagePreviewCanvas),
  resolve: { result: resolvePreview },
}];
