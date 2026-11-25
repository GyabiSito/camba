import { inject } from '@angular/core';
import { type ResolveFn, type Routes } from '@angular/router';
import { ApiClient } from '@camba/shared';
import { catchError, map, of } from 'rxjs';

export interface StoreInfo {
  business_name: string;
  support_email: string | null;
  support_phone: string | null;
  pickup_address: string | null;
  delivery_cents: number | null;
}

const storeInfo: ResolveFn<StoreInfo | null> = () => inject(ApiClient)
  .publicGet<{ data: StoreInfo }>('/api/v1/store-info')
  .pipe(map(({ data }) => data), catchError(() => of(null)));

export const supportPages = {
  envios: ['Envíos', 'Cómo recibir o retirar tu pedido y dónde ver el costo antes de confirmar.'],
  'preguntas-frecuentes': ['Preguntas frecuentes', 'Compras, envíos, cambios y tu cuenta en Camba.'],
  contacto: ['Contactanos', 'Escribinos si tenés una consulta sobre un producto, un pedido o tu cuenta.'],
  'politica-de-privacidad': ['Política de privacidad', 'Qué datos usa Camba y para qué los necesita.'],
  'terminos-y-condiciones': ['Términos y condiciones', 'Condiciones de compra, entrega y atención de Camba.'],
} as const;

export const supportRoutes: Routes = Object.keys(supportPages).map(path => ({
  path,
  data: { page: path },
  resolve: path === 'preguntas-frecuentes' ? undefined : { info: storeInfo },
  loadComponent: () => import('./support-page').then(m => m.SupportPage),
}));
