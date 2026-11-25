import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, type ParamMap, Router, RouterLink } from '@angular/router';
import { formatDate } from '@camba/shared';
import { BehaviorSubject, combineLatest, of, switchMap, tap } from 'rxjs';
import {
  choices, pageNumber, readState, validChoice,
} from '../../shared/operations-data';
import { issueLabels } from '../orders';
import { Notice, NoticesApi } from './data-access/notices-api';
import { noticeQueryKeys } from '../../shared/notice-query';
import { OperationLoading, OperationPager } from '../../shared/operation-ui';

const stateLabels = {
  active: 'Activo',
  resolved: 'Resuelto',
  failed: 'Falló el envío',
  uncertain: 'Envío sin confirmar',
} as const;

const stateOptions = { active: 'Activos', resolved: 'Resueltos', all: 'Todos' } as const;

function noticeFilters(params: ParamMap) {
  return {
    q: params.get('q')?.trim() ?? '',
    state: validChoice(params.get('state'), stateOptions) || 'active',
    kind: params.get('kind') ?? '',
    date_from: params.get('date_from') ?? '',
    date_to: params.get('date_to') ?? '',
  };
}

const invertedDates = ({ date_from, date_to }: ReturnType<typeof noticeFilters>) =>
  !!date_from && !!date_to && date_from > date_to;

@Component({
  selector: 'camba-notices',
  imports: [FormsModule, RouterLink, OperationLoading, OperationPager],
  templateUrl: './notices.html',
  styleUrls: ['../../shared/operations.css', '../../shared/order-filters.css', './notices.css'],
})
export class NoticesPage {
  private readonly api = inject(NoticesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload = new BehaviorSubject(0);
  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly states = stateLabels;
  readonly options = choices(stateOptions);
  readonly kinds = signal<Record<string, string>>({});
  readonly kindOptions = computed(() => choices(this.kinds()));
  readonly date = formatDate;
  readonly filters = computed(() => noticeFilters(this.params()));
  readonly dateError = computed(() => invertedDates(this.filters()));
  readonly hasFilters = computed(() => {
    const { q, state, kind, date_from, date_to } = this.filters();
    return !!(q || state !== 'active' || kind || date_from || date_to || this.params().has('page'));
  });
  readonly sourceQuery = computed(() => Object.fromEntries([
    ['from', 'avisos'],
    ...noticeQueryKeys.flatMap(key => {
      const value = this.params().get(key);
      return value === null ? [] : [['notice_' + key, value]];
    }),
  ]));
  searchText = '';

  private readonly actions: Readonly<Record<string, string>> = {
    order_created: 'Consultá el pedido para ver su estado de pago.',
    order_paid: 'Abrí el pedido para seguir con la preparación.',
    import_completed: 'Consultá el resultado de la carga.',
    import_completed_with_errors: 'Revisá las filas observadas en la carga.',
    import_stalled: 'Consultá el avance de la carga y las opciones disponibles.',
    low_stock: 'Revisá el stock del producto.',
    paid_overdue: 'El pedido está pagado y sigue pendiente de preparación o entrega.',
  };
  readonly notices = toSignal(
    combineLatest([this.route.queryParamMap, this.reload]).pipe(
      switchMap(([params]) => {
        const filter = noticeFilters(params);
        clearTimeout(this.searchTimer);
        this.searchText = filter.q;
        if (invertedDates(filter)) return of(null);

        return readState(
          this.api.list({
            ...filter,
            state: filter.state !== 'all' ? filter.state : null,
            page: pageNumber(params.get('page')),
          }).pipe(tap(page => this.kinds.set(page.kinds ?? {}))),
          'No pudimos cargar los avisos.',
        );
      }),
    ),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  search(value: string) {
    this.searchText = value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applySearch(), 250);
  }

  applySearch() {
    if (this.searchText.trim() !== this.filters().q) this.filter('q', this.searchText.trim());
  }

  filter(key: keyof ReturnType<typeof noticeFilters>, value: string) {
    clearTimeout(this.searchTimer);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchText.trim() || null,
        [key]: value && !(key === 'state' && value === 'active') ? value : null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearFilters() {
    clearTimeout(this.searchTimer);
    this.searchText = '';
    void this.router.navigate(['/pedidos/avisos']);
  }

  retry() {
    this.reload.next(0);
  }

  description(notice: Notice): string {
    if (notice.error_code === 'smtp_acceptance_unknown' || notice.error_code === 'worker_interrupted') {
      return 'No se pudo confirmar que el correo saliera. Verificá el estado antes de volver a contactar.';
    }
    if (notice.state === 'failed') return 'No se pudo enviar el correo. Revisá el caso desde su origen.';
    if (notice.issue && issueLabels[notice.issue]) return issueLabels[notice.issue];
    if (notice.state === 'resolved') return 'Esta incidencia ya no está activa.';
    return this.actions[notice.kind] || 'Consultá los datos relacionados con este aviso.';
  }
}
