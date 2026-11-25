import { RenderMode, ServerRoute } from '@angular/ssr';
import { demoMode } from '@camba/shared';

export const serverRoutes: ServerRoute[] = [
  demoMode
    ? { path: 'cuenta', renderMode: RenderMode.Server, headers: { 'Cache-Control': 'private, no-store' } }
    : { path: 'cuenta', renderMode: RenderMode.Client },
  { path: 'cuenta/**', renderMode: RenderMode.Client },
  { path: 'carrito', renderMode: RenderMode.Client },
  { path: 'checkout', renderMode: RenderMode.Client },
  { path: 'pedidos', renderMode: RenderMode.Client },
  { path: 'pedidos/**', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
