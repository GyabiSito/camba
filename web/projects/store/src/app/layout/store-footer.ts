import { Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiClient } from '@camba/shared';
import { catchError, map, of } from 'rxjs';
import type { StoreClassification as Classification } from '@camba/shared';
import { environment } from '../../environments/environment';

@Component({
  imports: [RouterLink],
  selector: 'store-footer',
  styleUrl: './store-footer.css',
  templateUrl: './store-footer.html',
})
export class StoreFooter {
  protected readonly business = environment.business;
  readonly topHref = input.required<string>();
  protected readonly directory = toSignal(
    inject(ApiClient).publicGet<{ data: Classification[] }>('/api/v1/categories').pipe(
      map(({ data }) => data),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );
}
