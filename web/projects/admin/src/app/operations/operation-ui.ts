import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageInfo } from './operation-data';

@Component({
  selector: 'camba-operation-loading',
  template: `
    <div class="skeleton-list" role="status">
      <span class="sr-only">{{ label() }}</span>
      @for (row of placeholders(); track row) {
        <span class="skeleton-row" aria-hidden="true"></span>
      }
    </div>
  `,
  styleUrl: './operations.css',
})
export class OperationLoading {
  readonly rows = input(3);
  readonly label = input('Cargando…');
  readonly placeholders = computed(() => Array.from({ length: this.rows() }, (_, index) => index));
}

@Component({
  selector: 'camba-operation-pager',
  imports: [RouterLink],
  template: `
    <div class="pager">
      @if (showTotal()) {
        <p role="status">{{ info().total }} {{ info().total === 1 ? singular() : plural() }}</p>
      }
      @if (info().last_page > 1 || info().current_page > 1) {
        <nav aria-label="Paginación">
          @if (info().current_page > 1) {
            <a
              class="button button--quiet"
              [routerLink]="[]"
              [queryParams]="{ page: info().current_page - 1 }"
              queryParamsHandling="merge"
              >Anterior</a
            >
          }
          <span>Página {{ info().current_page }} de {{ info().last_page }}</span>
          @if (info().current_page < info().last_page) {
            <a
              class="button button--quiet"
              [routerLink]="[]"
              [queryParams]="{ page: info().current_page + 1 }"
              queryParamsHandling="merge"
              >Siguiente</a
            >
          }
        </nav>
      }
    </div>
  `,
  styleUrl: './operations.css',
})
export class OperationPager {
  readonly info = input.required<PageInfo>();
  readonly singular = input.required<string>();
  readonly plural = input.required<string>();
  readonly showTotal = input(true);
}
