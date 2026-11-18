import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'cuenta', renderMode: RenderMode.Client },
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
