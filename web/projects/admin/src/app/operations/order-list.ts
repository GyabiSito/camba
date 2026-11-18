import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient, formatDate, formatMoney } from '@camba/shared';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
import {
  adminApi,
  choices,
  fulfilmentLabels,
  Order,
  orderLabels,
  Page,
  pageNumber,
  readState,
  validChoice,
} from './operation-data';
import { OperationLoading, OperationPager } from './operation-ui';

@Component({
  selector: 'camba-order-list',
  imports: [RouterLink, OperationLoading, OperationPager],
  template: `
    <header class="ops-heading">
      <div>
        <h1>Pedidos</h1>
        <p>Consultá los pagos y organizá la preparación, el envío y el retiro.</p>
      </div>
      <a class="button button--quiet" routerLink="/pedidos/avisos">Avisos operativos</a>
    </header>

    <div class="ops-filters" aria-label="Filtros de pedidos" role="group">
      <label class="field" for="order-status"
        >Estado del pago
        <select id="order-status" [value]="paymentFilter()" (change)="filter('status', $event)">
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
          [value]="fulfilmentFilter()"
          (change)="filter('fulfilment_status', $event)"
        >
          <option value="">Todos los estados</option>
          @for (item of fulfilmentOptions; track item.value) {
            <option [value]="item.value">{{ item.label }}</option>
          }
        </select>
      </label>
      @if (paymentFilter() || fulfilmentFilter()) {
        <a class="ops-link" routerLink="/pedidos">Quitar filtros</a>
      }
    </div>

    @let result = orders();
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
          <span>Pedido</span><span>Pago</span><span>Preparación y entrega</span
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
                  {{ order.reference.slice(0, 8).toUpperCase() }}
                </a>
                <span>{{ date(order.created_at) }}</span>
              </div>
              <div class="order-cell">
                <span class="mobile-label">Pago</span>
                <span
                  class="ops-state"
                  [class.ops-state--good]="order.status === 'paid'"
                  [class.ops-state--attention]="
                    order.status === 'payment_review' || order.status === 'charged_back'
                  "
                >
                  {{ orderStatus[order.status] }}
                </span>
              </div>
              <div class="order-cell">
                <span class="mobile-label">Preparación y entrega</span
                >{{ fulfilmentStatus[order.fulfilment_status] }}
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
              paymentFilter() || fulfilmentFilter()
                ? 'Probá con otros filtros.'
                : 'Los próximos pedidos de tu tienda aparecerán acá.'
            }}
          </p>
        </div>
      }
      <camba-operation-pager [info]="result.value.meta" singular="pedido" plural="pedidos" />
    }
  `,
  styleUrls: ['./operations.css', './orders.css'],
})
export class OrderListPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiClient);
  private readonly reload = new BehaviorSubject(0);

  readonly params = toSignal(this.route.queryParams, { initialValue: {} });
  private readonly filterParams = toSignal(this.route.queryParamMap);
  readonly paymentFilter = () =>
    validChoice(this.filterParams()?.get('status') ?? null, orderLabels);
  readonly fulfilmentFilter = () =>
    validChoice(this.filterParams()?.get('fulfilment_status') ?? null, fulfilmentLabels);
  readonly orderStatus = orderLabels;
  readonly fulfilmentStatus = fulfilmentLabels;
  readonly paymentOptions = choices(orderLabels);
  readonly fulfilmentOptions = choices(fulfilmentLabels);
  readonly date = formatDate;
  readonly money = formatMoney;
  readonly orders = toSignal(
    combineLatest([this.route.queryParamMap, this.reload]).pipe(
      switchMap(([params]) => {
        const status = validChoice(params.get('status'), orderLabels);
        const fulfilment = validChoice(params.get('fulfilment_status'), fulfilmentLabels);
        return readState(
          this.api.get<Page<Order>>(`${adminApi}/orders`, {
            page: pageNumber(params.get('page')),
            ...(status ? { status } : {}),
            ...(fulfilment ? { fulfilment_status: fulfilment } : {}),
          }),
          'No pudimos cargar los pedidos.',
        );
      }),
    ),
  );

  retry() {
    this.reload.next(0);
  }

  filter(key: 'status' | 'fulfilment_status', event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }
}
