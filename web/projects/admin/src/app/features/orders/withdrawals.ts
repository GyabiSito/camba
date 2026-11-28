import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiClient, apiMessage, formatDate } from '@camba/shared';
import { BehaviorSubject, combineLatest, distinctUntilChanged, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { choices, pageNumber, readState, validChoice, type Page } from '../../shared/operations-data';
import { OperationLoading, OperationPager } from '../../shared/operation-ui';
import { OrdersApi } from './data-access/orders-api';

type Action = 'review' | 'close' | 'confirm_refund' | 'request_confirmation';
const statusLabels = {
  received: 'Recibida', reviewing: 'En revisión', closed: 'Cerrada', refunded: 'Reintegro confirmado',
};
type Withdrawal = {
  reference: string;
  order_reference: string;
  order_matched: boolean;
  email: string;
  status: keyof typeof statusLabels;
  received_at: string;
  refund_reference: string | null;
  refund_confirmed_at: string | null;
  can_request_confirmation: boolean;
  confirmation_pending: boolean;
  confirmation_requested_by: number | null;
  confirmation_requested_by_admin_id?: number | null;
  confirmation_requested_at: string | null;
  confirmation_confirmed_at: string | null;
};

const actionResult: Record<Action, string> = {
  review: 'Revisión abierta.',
  close: 'Solicitud cerrada sin reintegro.',
  confirm_refund: 'Reintegro confirmado registrado.',
  request_confirmation: 'Confirmación solicitada al titular del pedido.',
};
const query = (params: ParamMap) => ({
  q: (params.get('q') ?? '').trim().slice(0, 120),
  status: validChoice(params.get('status'), statusLabels),
  page: pageNumber(params.get('page')),
  reference: (params.get('solicitud') ?? '').toLowerCase(),
});
type Query = ReturnType<typeof query>;

@Component({
  imports: [RouterLink, FormsModule, OperationLoading, OperationPager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../../shared/operations.css', './withdrawals.css'],
  templateUrl: './withdrawals.html',
})
export class WithdrawalsPage {
  private readonly api = inject(ApiClient);
  private readonly orders = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly endpoint = '/api/v1/admin/withdrawals';
  private readonly reload = new BehaviorSubject(0);

  protected readonly statusLabels = statusLabels;
  protected readonly date = formatDate;
  protected readonly statuses = choices(statusLabels);
  protected readonly busy = signal<Action | null>(null);
  protected readonly closeReference = signal('');
  protected readonly feedback = signal<{ error: boolean; text: string; reference: string } | null>(null);
  private readonly rejectedRefund = signal('');
  private readonly queries = this.route.queryParamMap.pipe(map(query), distinctUntilChanged(
    (a, b) => a.q === b.q && a.status === b.status && a.page === b.page && a.reference === b.reference,
  ));
  protected readonly filters = toSignal(this.queries, { requireSync: true });
  protected readonly filtering = computed(() => !!(this.filters().q || this.filters().status));
  protected readonly reference = computed(() => this.filters().reference);
  protected readonly listParams = computed(() => {
    const { status, q, page } = this.filters();
    return { status: status || null, q: q || null, page: page > 1 ? page : null };
  });
  protected readonly orderParams = computed(() => ({ ...this.listParams(), solicitud: this.reference(), from: 'arrepentimientos' }));
  private readonly response = toSignal(combineLatest([this.queries, this.reload]).pipe(
    switchMap(([filters]) => readState(this.load(filters), 'No pudimos cargar las solicitudes.')),
  ));
  protected readonly result = linkedSignal(() => this.response());
  protected readonly selected = computed(() => {
    const result = this.result();
    return result?.status === 'loaded' ? result.value.data.find(item => item.reference === this.reference()) : undefined;
  });
  protected readonly matches = computed(() => {
    const result = this.result();
    if (result?.status !== 'loaded') return [];
    const term = this.filters().q.toLowerCase();
    return term ? result.value.data.filter(item =>
      item.reference.toLowerCase().includes(term) || item.order_reference.toLowerCase().includes(term),
    ) : result.value.data;
  });

  private readonly refundTarget = computed(() => {
    const item = this.selected();
    return item?.order_matched && (item.status === 'reviewing' || item.status === 'closed') ? item.order_reference : null;
  });
  private readonly refundCheck = toSignal(toObservable(this.refundTarget).pipe(switchMap(reference =>
    reference ? readState(this.orders.detail(reference).pipe(map(({ data: order, payment }) =>
      order.reference === reference && order.status === 'refunded' && !!payment.paid_at &&
      !payment.issues.includes('multiple_approved_payments') &&
      payment.observations.some(item => item.status === 'refunded' && item.amount_cents === order.total_cents),
    )), 'No pudimos consultar la verificación del pago.').pipe(map(state => ({ reference, state }))) : of(null),
  )));
  protected readonly refund = computed(() => {
    const check = this.refundCheck();
    return check?.reference === this.refundTarget() ? check?.state : undefined;
  });
  protected readonly refundVerified = computed(() => {
    const state = this.refund();
    return state?.status === 'loaded' && state.value && this.rejectedRefund() !== this.reference();
  });

  protected filter(q: string, status: string) {
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { q: q.trim() || null, status: status || null },
    });
  }

  protected retry() { this.reload.next(this.reload.value + 1); }

  private load({ q, status, page, reference }: Query) {
    // A case can leave its original status filter while it is open.
    if (reference) return this.api.get<Page<Withdrawal>>(this.endpoint, { page: 1, reference });
    const read = (page: number) => this.api.get<Page<Withdrawal>>(this.endpoint, status ? { page, status } : { page });
    if (!q) return read(page);

    // ponytail: free-text search scans at most three pages; move it to the API if it needs a global result.
    const window = 3;
    const first = (page - 1) * window + 1;
    return read(first).pipe(switchMap(head => {
      const extra = Math.max(0, Math.min(window - 1, head.meta.last_page - first));
      return forkJoin([of(head), ...Array.from({ length: extra }, (_, index) => read(first + index + 1))]).pipe(map(pages => ({
        data: [...new Map(pages.flatMap(response => response.data).map(item => [item.reference, item])).values()],
        meta: { ...head.meta, current_page: page, last_page: Math.ceil(head.meta.last_page / window) },
      })));
    }));
  }

  protected async copy(item: Withdrawal) {
    try {
      await navigator.clipboard.writeText(item.reference);
      this.feedback.set({ error: false, text: 'Constancia copiada.', reference: item.reference });
    } catch {
      this.feedback.set({ error: true, text: 'No pudimos copiarla. Seleccioná el número de constancia para copiarlo.', reference: item.reference });
    }
  }

  protected async act(item: Withdrawal, action: Action, focus: HTMLElement) {
    if (this.busy() || this.selected()?.reference !== item.reference ||
      (action === 'close' && this.closeReference() !== item.reference) ||
      (action === 'confirm_refund' && !this.refundVerified())) return;
    this.busy.set(action);
    this.feedback.set(null);
    try {
      // The API rechecks the originally paid payment under lock before recording anything.
      const { data } = await firstValueFrom(this.api.patch<{ data: Withdrawal }>(
        this.endpoint + '/' + encodeURIComponent(item.reference), { action },
      ));
      this.result.update(result => result?.status === 'loaded' ? {
        ...result, value: { ...result.value, data: result.value.data.map(row => row.reference === item.reference ? data : row) },
      } : result);
      this.closeReference.set('');
      this.feedback.set({ error: false, text: actionResult[action], reference: item.reference });
      if (this.reference() === item.reference) focus.focus({ preventScroll: true });
    } catch (error) {
      if (action === 'confirm_refund' && error instanceof HttpErrorResponse && error.status === 409) {
        this.rejectedRefund.set(item.reference);
      }
      this.feedback.set({ error: true, text: apiMessage(error, 'No pudimos actualizar la solicitud.'), reference: item.reference });
    } finally {
      this.busy.set(null);
    }
  }
}
