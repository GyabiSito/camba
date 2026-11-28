import { HttpErrorResponse } from '@angular/common/http';

export const api = '/api/v1';
export interface Data<T> { data: T; }
export interface Page<T> extends Data<T[]> { meta: { current_page: number; last_page: number }; }

export function httpStatus(error: unknown): number | undefined {
  return error instanceof HttpErrorResponse ? error.status : undefined;
}
