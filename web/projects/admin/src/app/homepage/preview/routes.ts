import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { ApiClient, HomeEditorState, HomePublication } from '@camba/shared';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { HomeData, homeSelection, PageResult, Product } from '../../../../../store/src/app/catalog/catalog-data';
import { publicationHome } from '../../../../../store/src/app/catalog/home-config';
import { HomeRenderOptions } from '../../../../../store/src/app/catalog/home-render-options';

export type PreviewResult = PageResult<HomeData> & { options?: HomeRenderOptions };

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
  const api = inject(ApiClient);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return { kind: 'unavailable' };
  const response = await firstValueFrom(forkJoin({
    publication: api.get<{ data: HomePublication<Product> }>('/api/v1/admin/homepage/preview'),
    state: api.get<{ data: HomeEditorState }>('/api/v1/admin/homepage'),
  }).pipe(catchError(() => of(null))));
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
