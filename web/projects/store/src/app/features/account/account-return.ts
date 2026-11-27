import { inject } from '@angular/core';
import { CanActivateFn, ParamMap, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AccountApi } from './data-access/account.api';

export type AccountReturn = { commands: string[]; label: string };

export function accountReturn(params: ParamMap): AccountReturn | null {
  switch (params.get('volver')) {
    case 'checkout':
      return { commands: ['/checkout'], label: 'Volver a la compra' };
    case 'carrito':
      return { commands: ['/carrito'], label: 'Volver al carrito' };
    case 'producto': {
      const slug = params.get('producto');
      return slug && /^[a-z0-9-]{1,240}$/.test(slug)
        ? { commands: ['/producto', slug], label: 'Volver al producto' }
        : null;
    }
    default:
      return null;
  }
}

export function requireBuyer(destination: 'carrito' | 'checkout'): CanActivateFn {
  return () => {
    const signIn = inject(Router).createUrlTree(['/cuenta'], { queryParams: { volver: destination } });
    return inject(AccountApi).me().pipe(
      map(({ data }) => data.role === 'buyer' ? true : signIn),
      catchError(() => of(signIn)),
    );
  };
}
