import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { Injectable, InjectionToken, PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { Observable, catchError, defer, finalize, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { demoMode } from './demo-config';

export { demoMode, provideCambaHttp } from './demo-config';
export * from './homepage';

export const CAMBA_API_ORIGIN = new InjectionToken<string>('Internal Camba API origin', {
  factory: () => '',
});

export const CART_CHANGED = 'camba:cart-changed';

type Query = Record<string, string | number | boolean | null | undefined>;
type RequestHeaders = Record<string, string> | HttpHeaders;

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly state = inject(TransferState);
  private readonly origin = inject(CAMBA_API_ORIGIN);
  private readonly server = isPlatformServer(inject(PLATFORM_ID));
  private csrfReady = false;
  private csrfRequest?: Observable<unknown>;

  get<T>(path: string, query?: Query): Observable<T> {
    if (this.server && !(demoMode && path === '/api/v1/auth/me')) {
      return throwError(() => new Error('Private data must be requested by the browser.'));
    }
    return this.http.get<T>(path, {
      params: this.params(query),
      headers: this.headers(),
      transferCache: false,
    });
  }

  publicGet<T>(path: string, query?: Query): Observable<T> {
    if (!/^\/api\/v1\/(?:products(?:\/[^/?#\\]+)?|categories|brands|store-info|homepage)$/.test(path)) {
      return throwError(() => new Error('Only the public catalog can be transferred.'));
    }
    const params = this.params(query);
    const key = makeStateKey<T>(`camba:catalog:${path}?${new URLSearchParams(params)}`);

    return defer(() => {
      if (!this.server && this.state.hasKey(key)) {
        const result = this.state.get(key, null as T);
        this.state.remove(key);
        return of(result);
      }
      return this.http
        .get<T>((this.server ? this.origin : '') + path, {
          params,
          headers: this.headers(),
          credentials: 'omit',
          transferCache: false,
        })
        .pipe(tap((result) => {
          if (this.server) this.state.set(key, result);
        }));
    });
  }

  post<T = unknown>(path: string, body?: unknown, headers?: RequestHeaders): Observable<T> {
    return this.mutate<T>('POST', path, body, headers);
  }

  patch<T = unknown>(path: string, body: unknown, headers?: RequestHeaders): Observable<T> {
    return this.mutate<T>('PATCH', path, body, headers);
  }

  put<T = unknown>(path: string, body: unknown, headers?: RequestHeaders): Observable<T> {
    return this.mutate<T>('PUT', path, body, headers);
  }

  delete<T = unknown>(path: string, headers?: RequestHeaders): Observable<T> {
    return this.mutate<T>('DELETE', path, null, headers);
  }

  download(path: string): Observable<Blob> {
    return this.http.get(path, { headers: this.headers(), responseType: 'blob', transferCache: false });
  }

  private mutate<T>(method: string, path: string, body: unknown, headers?: RequestHeaders) {
    if (this.server || !path.startsWith('/api/') || path.includes('\\')) {
      return throwError(() => new Error('Writes require a local browser session.'));
    }
    const send = () =>
      this.http.request<T>(method, path, {
        body: body ?? null,
        headers: this.headers(headers),
        transferCache: false,
      });
    return defer(() => this.csrf()).pipe(
      switchMap(send),
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 419) {
          return throwError(() => error);
        }
        // Laravel rejects CSRF failures before executing the action; do not replay network errors.
        this.csrfReady = false;
        return this.csrf().pipe(switchMap(send));
      }),
    );
  }

  private csrf(): Observable<unknown> {
    if (this.csrfReady) return of(null);
    this.csrfRequest ??= this.http.get('/sanctum/csrf-cookie', {
      headers: this.headers(),
      transferCache: false,
      responseType: 'text',
    }).pipe(
      tap(() => { this.csrfReady = true; }),
      finalize(() => { this.csrfRequest = undefined; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.csrfRequest;
  }

  private headers(value?: RequestHeaders) {
    return (value instanceof HttpHeaders ? value : new HttpHeaders(value)).set('Accept', 'application/json');
  }

  private params(query?: Query): Record<string, string> {
    return Object.fromEntries(Object.entries(query ?? {})
      .filter(([, value]) => value != null && value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)]));
  }
}

const amount = (digits: number) => new Intl.NumberFormat('es-UY', {
  style: 'currency', currency: 'UYU', currencyDisplay: 'code',
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const whole = amount(0);
const decimal = amount(2);
const date = new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Montevideo' });

export function formatMoney(cents: number | null | undefined): string {
  return cents == null ? '—' : (cents % 100 ? decimal : whole).format(cents / 100);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  const parsed = new Date(utc);
  return Number.isNaN(parsed.valueOf()) ? '—' : date.format(parsed);
}

export function apiMessage(error: unknown, fallback = 'No se pudo completar la solicitud. Intentá de nuevo.'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'No hay conexión con Camba. Volvé a intentarlo.';
  if (error.status === 401) return 'Iniciá sesión para continuar.';
  if (error.status === 403) return 'No tenés permiso para hacer esto.';
  if (error.status === 419) return 'La sesión se actualizó. Volvé a intentarlo.';
  if (error.status === 429) return 'Hiciste muchas solicitudes. Esperá un momento y volvé a intentar.';
  if (error.status < 500) {
    const fields = error.error?.errors;
    const first = fields && typeof fields === 'object' ? Object.values(fields).flat().find((value) => typeof value === 'string') : null;
    return first ?? (typeof error.error?.message === 'string' ? error.error.message : fallback);
  }
  return fallback;
}

export type { AdminClassification, AdminProduct, AdminProductPhoto, Page, ProductImage, StoreClassification, StoreProduct } from './data-access/catalog-contracts';
export type { Buyer } from './data-access/buyer-contract';
