import { Component, input, output } from '@angular/core';
import type { Page } from './catalog-api';

@Component({
  selector: 'admin-catalog-pagination',
  template: `
    <footer class="pagination">
      <p role="status">{{ meta().total }} {{ meta().total === 1 ? 'resultado' : 'resultados' }}</p>
      @if (meta().last_page > 1) {
        <nav [attr.aria-label]="label()">
          <button class="button button--quiet" type="button" [disabled]="meta().current_page <= 1"
            (click)="pageChange.emit(meta().current_page - 1)" aria-label="Página anterior">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
          </button>
          <span aria-current="page">{{ meta().current_page }} de {{ meta().last_page }}</span>
          <button class="button button--quiet" type="button" [disabled]="meta().current_page >= meta().last_page"
            (click)="pageChange.emit(meta().current_page + 1)" aria-label="Página siguiente">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
          </button>
        </nav>
      }
    </footer>
  `,
  styles: `
    :host { display: block; }
    .pagination { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: .6rem 1rem; border-top: 1px solid var(--line); margin-top: 1.1rem; padding: .8rem 0 0; }
    .pagination p { margin: 0; }
    .pagination nav { display: flex; align-items: center; gap: .55rem; }
    .pagination nav span { padding: .55rem .72rem; background: var(--forest); color: var(--surface); border-radius: 8px; font-variant-numeric: tabular-nums; }
    .pagination svg { display: block; width: 16px; height: 16px; }
  `,
})
export class CatalogPagination {
  readonly meta = input.required<Page<unknown>['meta']>();
  readonly label = input.required<string>();
  readonly pageChange = output<number>();
}
