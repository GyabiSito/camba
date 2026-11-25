import { inject, RESPONSE_INIT } from '@angular/core';
import { ResolveFn } from '@angular/router';

export const resolveMissing: ResolveFn<null> = () => {
  const response = inject(RESPONSE_INIT, { optional: true });
  if (response) {
    response.status = 404;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    response.headers = headers;
  }
  return null;
};
