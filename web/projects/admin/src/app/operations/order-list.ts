import { Component, DestroyRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiClient, formatDate, formatMoney } from '@camba/shared';
import { BehaviorSubject, combineLatest, of, switchMap } from 'rxjs';
import {
  adminApi,
  choices,
  fulfilmentLabels,
  fulfilmentFilterLabels,
  Order,
  orderLabels,
  Page,
  pageNumber,
  readState,
  validChoice,
} from './operation-data';
import { OperationLoading, OperationPager } from './operation-ui';

const shippingMethods = { delivery: 'Envío', pickup: 'Retiro' };
const orderFilters = (params: ParamMap) => ({
  q: (params.get('q') ?? '').trim().slice(0, 120),
  status: validChoice(params.get('status'), orderLabels),
  fulfilment_status: validChoice(params.get('fulfilment_status'), fulfilmentFilterLabels),
  shipping_method: validChoice(params.get('shipping_method'), shippingMethods),
  date_from: params.get('date_from') ?? '',
  date_to: params.get('date_to') ?? '',
});
type OrderFilters = ReturnType<typeof orderFilters>;
const invertedDates = ({ date_from, date_to }: OrderFilters) =>
  !!date_from && !!date_to && date_from > date_to;

@Component({
  selector: 'camba-order-list',
  imports: [FormsModule, RouterLink, OperationLoading, OperationPager],
  template: `
    <header class="ops-heading">
      <div>
        <h1>Pedidos</h1>
        <p>Consultá los pagos y organizá la preparación, el envío y el retiro.</p>
      </div>
      <a class="button button--quiet" routerLink="/pedidos/avisos">Avisos operativos</a>
    </header>

    @let result = orders();
    <div class="order-filters" role="search" aria-label="Filtros de pedidos">
      <label class="field order-search">
        Buscar pedido
        <span class="order-search-control">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" />
          </svg>
          <input
            type="search" maxlength="120" placeholder="Referencia, nombre o correo"
            [ngModel]="searchText" (ngModelChange)="search($event)"
            (keydown.enter)="applySearch()"
          />
        </span>
      </label>
      <label class="field" for="order-status"
        >Estado del pago
        <select id="order-status" [ngModel]="filters().status" (ngModelChange)="filter('status', $event)">
          <option value="">Todos los pagos</option>
          @for (item of paymentOptions; track item.value) {
            <option [value]="item.value">{{ item.label }}</option>
          }
        </select>
      </label>
      <label class="field" for="fulfilment-status"
        >Preparación y entrega
        <select
          id="fulfilment-status"
          [ngModel]="filters().fulfilment_status"
          (ngModelChange)="filter('fulfilment_status', $event)"
        >
          <option value="">Todos los estados</option>
          @for (item of fulfilmentOptions; track item.value) {
            <option [value]="item.value">{{ item.label }}</option>
          }
        </select>
      </label>
      <label class="field order-modality">
        Modalidad
        <select [ngModel]="filters().shipping_method" (ngModelChange)="filter('shipping_method', $event)">
          <option value="">Todas</option>
          @for (item of shippingOptions; track item.value) {
            <option [value]="item.value">{{ item.label }}</option>
          }
        </select>
      </label>
      <fieldset class="order-dates">
        <legend>Fecha del pedido</legend>
        <label class="field">
          Desde
          <input type="date" [ngModel]="filters().date_from"
            (ngModelChange)="filter('date_from', $event)"
            [attr.aria-invalid]="dateError() || null"
            [attr.aria-describedby]="dateError() ? 'order-date-error' : null" />
        </label>
        <label class="field">
          Hasta
          <input type="date" [ngModel]="filters().date_to"
            (ngModelChange)="filter('date_to', $event)"
            [attr.aria-invalid]="dateError() || null"
            [attr.aria-describedby]="dateError() ? 'order-date-error' : null" />
        </label>
        @if (dateError()) {
          <p id="order-date-error" role="alert">Hasta tiene que ser igual o posterior a Desde.</p>
        }
      </fieldset>
      <div class="order-filter-actions">
        @if (result?.status === 'loaded') {
          <p [attr.role]="result.value.meta.last_page === 1 && result.value.meta.current_page === 1 ? 'status' : null">
            {{ result.value.meta.total }} {{ result.value.meta.total === 1 ? 'pedido' : 'pedidos' }}
          </p>
        }
        @if (hasFilters() || searchText) {
          <button class="link-button" type="button" (click)="clearFilters()">Limpiar filtros</button>
        }
      </div>
    </div>

    @if (result?.status === 'loading') {
      <camba-operation-loading label="Cargando pedidos" [rows]="5" />
    } @else if (result?.status === 'error') {
      <div class="callout ops-error" role="alert">
        <p>{{ result.message }}</p>
        <button class="button button--quiet" type="button" (click)="retry()">Reintentar</button>
      </div>
    } @else if (result?.status === 'loaded') {
      @if (result.value.data.length) {
        <div class="order-row order-labels" aria-hidden="true">
          <span>Pedido</span><span>Pago</span><span>Entrega</span
          ><span>Modalidad</span><span>Total</span>
        </div>
        <ul class="ops-list" role="list" aria-label="Pedidos">
          @for (order of result.value.data; track order.reference) {
            <li class="order-row">
              <div class="order-reference">
                <a
                  class="ops-link"
                  [routerLink]="['/pedidos', order.reference]"
                  [queryParams]="params()"
                  [attr.aria-label]="'Ver pedido ' + order.reference"
                >
                  {{ order.reference }}
                </a>
                <span>{{ date(order.created_at) }}</span>
              </div>
              <div class="order-cell" role="group" aria-label="Pago del pedido">
                <span class="mobile-label">Pago</span>
                <span
                  class="ops-state"
                  [class.ops-state--good]="order.status === 'paid'"
                  [class.ops-state--attention]="
                    order.status === 'payment_expired' || order.status === 'payment_review' || order.status === 'charged_back'
                  "
                >
                  {{ orderStatus[order.status] }}
                </span>
              </div>
              <div class="order-cell" role="group" aria-label="Entrega del pedido">
                <span class="mobile-label">Entrega</span>
                <span class="ops-state" [class.ops-state--good]="order.fulfilment_status === 'completed'">
                  {{ order.fulfilment_status === 'completed' && order.shipping_method === 'delivery'
                    ? 'Entregado' : fulfilmentStatus[order.fulfilment_status] }}
                </span>
              </div>
              <div class="order-cell">
                <span class="mobile-label">Modalidad</span
                >{{ order.shipping_method === 'pickup' ? 'Retiro' : 'Envío' }}
              </div>
              <div class="order-cell numeric">
                <span class="mobile-label">Total</span>{{ money(order.total_cents) }}
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="ops-empty" role="status">
          <h2>No hay pedidos para mostrar</h2>
          <p>
            {{
                  hasFilters()
                ? 'Probá con otros filtros.'
                : 'Los próximos pedidos de tu tienda aparecerán acá.'
            }}
          </p>
        </div>
      }
      @if (result.value.meta.last_page > 1 || result.value.meta.current_page > 1) {
        <camba-operation-pager [info]="result.value.meta" singular="pedido" plural="pedidos" />
      }
    }
  `,
  styleUrls: ['./operations.css', './orders.css', './order-filters.css'],
})
export class OrderListPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiClient);
  private readonly reload = new BehaviorSubject(0);
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly params = toSignal(this.route.queryParams, { initialValue: {} });
  private readonly filterParams = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly filters = computed(() => orderFilters(this.filterParams()));
  readonly hasFilters = computed(() => Object.values(this.filters()).some(Boolean));
  readonly dateError = computed(() => invertedDates(this.filters()));
  readonly orderStatus = orderLabels;
  readonly fulfilmentStatus = fulfilmentLabels;
  readonly paymentOptions = choices(orderLabels);
  readonly fulfilmentOptions = choices(fulfilmentFilterLabels);
  readonly shippingOptions = choices(shippingMethods);
  readonly date = formatDate;
  readonly money = formatMoney;
  searchText = '';
  readonly orders = toSignal(
    combineLatest([this.route.queryParamMap, this.reload]).pipe(
      switchMap(([params]) => {
        const filters = orderFilters(params);
        clearTimeout(this.searchTimer);
        this.searchText = filters.q;
        if (invertedDates(filters)) return of(null);
        return readState(
          this.api.get<Page<Order>>(`${adminApi}/orders`, {
            page: pageNumber(params.get('page')),
            ...filters,
          }),
          'No pudimos cargar los pedidos.',
        );
      }),
    ),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  retry() {
    this.reload.next(0);
  }

  search(value: string) {
    this.searchText = value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applySearch(), 250);
  }

  applySearch() {
    if (this.searchText.trim() !== this.filters().q) this.filter('q', this.searchText.trim());
  }

  filter(key: keyof OrderFilters, value: string) {
    clearTimeout(this.searchTimer);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.searchText.trim() || null, [key]: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  clearFilters() {
    clearTimeout(this.searchTimer);
    this.searchText = '';
    void this.router.navigate(['/pedidos']);
  }
}
