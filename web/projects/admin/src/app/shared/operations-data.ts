import { HttpErrorResponse } from '@angular/common/http';
import { apiMessage } from '@camba/shared';
import { Observable, catchError, map, of, startWith } from 'rxjs';

export const adminApi = '/api/v1/admin';
export type Choice = { value: string; label: string };
export function choices(labels: Readonly<Record<string, string>>): Choice[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}
export function validChoice(value: string | null, labels: Readonly<Record<string, string>>): string {
  return value && Object.hasOwn(labels, value) ? value : '';
}

export type PageInfo = { current_page: number; last_page: number; total: number };
export type Page<T> = { data: T[]; meta: PageInfo };
export type Data<T> = { data: T };
export type ReadState<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded'; value: T };

export function pageNumber(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 2147483647 ? page : 1;
}

export function operationError(error: unknown, fallback: string) {
  if (error instanceof HttpErrorResponse) {
    if ([401, 419].includes(error.status))
      return 'Tu sesión venció. Volvé a ingresar y probá de nuevo.';
    if ([0, 403, 429].includes(error.status)) return apiMessage(error, fallback);
  }
  return fallback;
}

export function readState<T>(request: Observable<T>, fallback: string): Observable<ReadState<T>> {
  return request.pipe(
    map((value): ReadState<T> => ({ status: 'loaded', value })),
    catchError((error: unknown) =>
      of<ReadState<T>>({ status: 'error', message: operationError(error, fallback) }),
    ),
    startWith<ReadState<T>>({ status: 'loading' }),
  );
}
