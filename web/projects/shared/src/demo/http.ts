import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST } from '@angular/core';
import { of, throwError } from 'rxjs';
import type { Buyer } from '../data-access/buyer-contract';
import { demoBuyer } from './buyer';
import { demoCatalog } from './catalog';

const users = {
  admin: {
    id: 1,
    name: 'Administración Demo',
    email: 'admin.diseno@camba.test',
    role: 'admin',
    email_verified: true,
  },
  store: demoBuyer,
} satisfies Record<'admin' | 'store', Buyer>;
const password = 'CambaDemo2026!';

export function demoHttp(app: keyof typeof users): HttpInterceptorFn {
  // These public demo cookies select a fixture only. Never share names with Sanctum or across apps.
  const cookie = `camba_demo_${app}`;
  return (request, next) => {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    const document = inject(DOCUMENT);
    const serverRequest = inject(REQUEST, { optional: true });
    const session = (browser ? document.cookie : (serverRequest?.headers.get('cookie') ?? ''))
      .split(';')
      .some((value) => value.trim() === `${cookie}=1`);
    const url = new URL(request.urlWithParams, 'http://demo.invalid');
    const path = url.pathname;
    const is = (method: string, endpoint: string) => request.method === method && path === endpoint;
    const response = (body: unknown = null, status = 200) => of(new HttpResponse({ body, status }));
    const fail = (status: number, message: string) =>
      throwError(() => new HttpErrorResponse({ status, url: request.url, error: { message } }));

    if (is('GET', '/sanctum/csrf-cookie')) return response(null, 204);
    if (is('POST', '/api/v1/auth/login') && browser) {
      const { email, password: submitted } = (request.body ?? {}) as {
        email?: string;
        password?: string;
      };
      const user = Object.values(users).find(
        (candidate) => candidate.email === email?.trim().toLowerCase(),
      );
      if (submitted !== password || !user)
        return fail(422, 'El correo o la contraseña no son correctos.');
      if (user !== users[app]) return fail(403, 'Esta cuenta no tiene acceso a esta aplicación.');
      document.cookie = `${cookie}=1; Path=/; SameSite=Strict`;
      return response(null, 204);
    }
    if (is('POST', '/api/v1/auth/logout') && browser) {
      document.cookie = `${cookie}=; Max-Age=0; Path=/; SameSite=Strict`;
      return response(null, 204);
    }
    // Only the shopper allowlist reaches the same-origin demo server, never the real API.
    if (
      app === 'store' &&
      browser &&
      /^\/api\/v1\/(?:auth\/me|geography\/departments(?:\/\d+\/localities)?|account\/(?:profile|addresses(?:\/\d+)?|reminder-preferences)|cart(?:\/items\/\d+)?|checkout\/quote|orders(?:\/[0-9a-f-]{36}(?:\/payments(?:\/refresh)?)?)?)$/i.test(
        path,
      )
    ) {
      return next(
        request.clone({
          url: '/__camba_demo' + path.slice('/api/v1'.length),
          setHeaders: { 'X-Camba-Demo': '1' },
        }),
      );
    }
    if (is('GET', app === 'admin' ? '/api/v1/admin/session' : '/api/v1/auth/me')) {
      return session ? response({ data: users[app] }) : fail(401, 'Iniciá sesión para continuar.');
    }
    if (is('GET', '/api/v1/store-info')) {
      return response({
        data: {
          business_name: 'Camba',
          support_email: null,
          support_phone: null,
          pickup_address: null,
          delivery_cents: null,
        },
      });
    }

    const prefix = app === 'admin' ? '/api/v1/admin/' : '/api/v1/';
    if (request.method === 'GET' && path.startsWith(prefix)) {
      if (app === 'admin' && !session) return fail(401, 'Iniciá sesión para continuar.');
      const result = demoCatalog(path.slice(prefix.length), url.searchParams, app === 'admin');
      if (result) return response(result);
    }
    // Anything not simulated stays terminal.
    return fail(404, 'Esta operación no está disponible por ahora.');
  };
}
