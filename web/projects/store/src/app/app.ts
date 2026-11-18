import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiClient, CART_CHANGED } from '@camba/shared';
import { catchError, fromEvent, of, startWith, switchMap } from 'rxjs';

type StoreInfo = { business_name: string; support_email?: string | null; support_phone?: string | null };

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);
  protected readonly router = inject(Router);
  private readonly scope = inject(DestroyRef);
  protected readonly info = signal<StoreInfo | null>(null);
  protected readonly count = signal(0);

  protected search(event: Event, query: string) {
    event.preventDefault();
    void this.router.navigate(['/tienda'], { queryParams: { q: query.trim() || null } });
  }

  constructor() {
    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!view) return;
      fromEvent(view, CART_CHANGED).pipe(
        startWith(null),
        switchMap(() => this.api.get<{ data: { items: { quantity: number }[] } }>('/api/v1/cart')
          .pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.scope),
      ).subscribe((result) => {
        if (result) this.count.set(result.data.items.reduce((total, line) => total + line.quantity, 0));
      });
      this.api.publicGet<{ data: StoreInfo }>('/api/v1/store-info')
        .pipe(catchError(() => of(null)), takeUntilDestroyed(this.scope))
        .subscribe((result) => this.info.set(result?.data ?? null));
    });
  }
}
