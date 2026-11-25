import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isActive, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CART_CHANGED } from '@camba/shared';
import { catchError, fromEvent, of, startWith, switchMap } from 'rxjs';
import { CartApi } from '../features/cart';

@Component({
  selector: 'store-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './store-header.html',
  styleUrl: './store-header.css',
})
export class StoreHeader {
  private readonly api = inject(CartApi);
  private readonly document = inject(DOCUMENT);
  private readonly scope = inject(DestroyRef);
  protected readonly home = isActive('/', inject(Router), { paths: 'exact', queryParams: 'ignored',
    matrixParams: 'ignored', fragment: 'ignored' });
  protected readonly count = signal(0);

  constructor() {
    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!view) return;
      fromEvent(view, CART_CHANGED).pipe(
        startWith(null),
        switchMap(() => this.api.getCart()
          .pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.scope),
      ).subscribe((result) => {
        if (result) this.count.set(result.data.items.reduce((total, line) => total + line.quantity, 0));
      });
    });
  }
}
