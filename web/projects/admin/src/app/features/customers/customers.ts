import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type ParamMap } from '@angular/router';
import { ApiClient, formatDate, formatMoney } from '@camba/shared';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, switchMap } from 'rxjs';
import { adminApi, pageNumber, readState, type Data, type Page } from '../../shared/operations-data';
import { OperationLoading, OperationPager } from '../../shared/operation-ui';
import { orderLabels, type Order } from '../orders';

type Account = { name: string; email: string; email_verified: boolean; created_at: string | null };
type CustomerRow = Account & { id: number; orders_count: number; last_order_at: string | null };
type Address = {
  id: number; recipient: string; street: string; number: string; department: string; locality: string;
  details: string | null; postal_code: string | null;
};
type Customer = Account & { addresses: Address[] };
type CustomerOrder = Pick<Order, 'reference' | 'created_at' | 'total_cents' | 'shipping_method' | 'status'>;

const endpoint = `${adminApi}/users`;
const searchText = (params: ParamMap) => (params.get('q') ?? '').trim().slice(0, 120);

@Component({
  imports: [RouterLink, OperationLoading, OperationPager],
  templateUrl: './customer-list.html',
  styleUrls: ['../../shared/operations.css', './customers.css'],
})
export class CustomerListPage {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload = new BehaviorSubject(0);
  private readonly query = this.route.queryParamMap.pipe(
    map(params => ({ q: searchText(params), page: pageNumber(params.get('page')) })),
  );
  protected readonly params = toSignal(this.query, { requireSync: true });
  protected readonly detailParams = computed(() => ({
    q: this.params().q || null, list_page: this.params().page > 1 ? this.params().page : null,
  }));
  protected readonly result = toSignal(combineLatest([this.query, this.reload]).pipe(
    switchMap(([params]) => readState(this.api.get<Page<CustomerRow>>(endpoint, params), 'No pudimos cargar los usuarios.')),
  ));
  protected readonly date = formatDate;

  protected search(event: Event, value: string) {
    event.preventDefault();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: value.trim() || null } });
  }

  protected retry() { this.reload.next(0); }
}

@Component({
  imports: [RouterLink, OperationLoading, OperationPager],
  templateUrl: './customer-detail.html',
  styleUrls: ['../../shared/operations.css', './customers.css'],
})
export class CustomerDetailPage {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly reloadAccount = new BehaviorSubject(0);
  private readonly reloadHistory = new BehaviorSubject(0);
  private readonly customer = this.route.paramMap.pipe(
    map(params => encodeURIComponent(params.get('customer') ?? '')), distinctUntilChanged(),
  );
  private readonly historyPage = this.route.queryParamMap.pipe(
    map(params => pageNumber(params.get('page'))), distinctUntilChanged(),
  );
  protected readonly backParams = toSignal(this.route.queryParamMap.pipe(map(params => {
    const page = pageNumber(params.get('list_page'));
    return { q: searchText(params) || null, page: page > 1 ? page : null };
  })), { requireSync: true });
  protected readonly account = toSignal(combineLatest([this.customer, this.reloadAccount]).pipe(
    switchMap(([id]) => readState(this.api.get<Data<Customer>>(`${endpoint}/${id}`), 'No pudimos cargar la ficha de este cliente.')),
  ));
  protected readonly history = toSignal(combineLatest([this.customer, this.historyPage, this.reloadHistory]).pipe(
    switchMap(([id, page]) => readState(this.api.get<Page<CustomerOrder>>(`${endpoint}/${id}/orders`, { page }),
      'No pudimos cargar el historial de pedidos.')),
  ));
  protected readonly date = formatDate;
  protected readonly money = formatMoney;
  protected readonly orderStatus = orderLabels;

  protected retryAccount() { this.reloadAccount.next(0); }
  protected retryHistory() { this.reloadHistory.next(0); }
}
