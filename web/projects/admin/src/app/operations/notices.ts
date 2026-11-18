import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient, formatDate } from '@camba/shared';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
import {
  adminApi,
  choices,
  issueLabels,
  Page,
  pageNumber,
  readState,
  validChoice,
} from './operation-data';
import { OperationLoading, OperationPager } from './operation-ui';

const stateLabels = {
  active: 'Activo',
  resolved: 'Resuelto',
  failed: 'Falló el envío',
  uncertain: 'Envío sin confirmar',
} as const;

type Notice = {
  id: number;
  state: keyof typeof stateLabels;
  channel: 'panel' | 'mail';
  kind: string;
  issue: string | null;
  error_code: string | null;
  subject_type: 'order' | 'product' | 'import' | 'cart';
  subject_id: number | null;
  order_reference: string | null;
  updated_at: string;
  attempts: number;
};

@Component({
  selector: 'camba-notices',
  imports: [RouterLink, OperationLoading, OperationPager],
  template: `
    <a class="ops-back ops-link" routerLink="/pedidos">Volver a pedidos</a>
    <header class="ops-heading">
      <div>
        <h1>Avisos operativos</h1>
        <p>Revisá las incidencias y abrí el pedido, producto o carga correspondiente.</p>
      </div>
    </header>
    <div class="ops-filters">
      <label class="field" for="notice-state"
        >Estado del aviso
        <select id="notice-state" [value]="filterValue()" (change)="filter($event)">
          <option value="">Todos los avisos</option>
          @for (item of options; track item.value) {
            <option [value]="item.value">{{ item.label }}</option>
          }
        </select>
      </label>
    </div>

    @let result = notices();
    @if (result?.status === 'loading') {
      <camba-operation-loading label="Cargando avisos" [rows]="4" />
    } @else if (result?.status === 'error') {
      <div class="callout ops-error" role="alert">
        <p>{{ result.message }}</p>
        <button class="button button--quiet" type="button" (click)="retry()">Reintentar</button>
      </div>
    } @else if (result?.status === 'loaded') {
      @if (result.value.data.length) {
        <ul class="ops-list notice-list" role="list" aria-label="Avisos operativos">
          @for (notice of result.value.data; track notice.id) {
            <li class="notice-row">
              <div>
                <h2>{{ names[notice.kind] || 'Aviso operativo' }}</h2>
                <p>{{ description(notice) }}</p>
                <span class="muted notice-date"
                  >{{ date(notice.updated_at) }} ·
                  {{ notice.channel === 'mail' ? 'Correo' : 'Panel' }}</span
                >
                @if (notice.channel === 'mail') {
                  <span class="muted notice-date"> · Intentos: {{ notice.attempts }}</span>
                }
              </div>
              <div class="notice-actions">
                <span
                  class="ops-state"
                  [class.ops-state--good]="notice.state === 'resolved'"
                  [class.ops-state--attention]="
                    notice.state === 'failed' || notice.state === 'uncertain'
                  "
                >
                  {{ states[notice.state] }}
                </span>
                @switch (notice.subject_type) {
                  @case ('order') {
                    @if (notice.order_reference) {
                      <a class="ops-link" [routerLink]="['/pedidos', notice.order_reference]"
                        >Ver pedido {{ notice.order_reference.slice(0, 8).toUpperCase() }}</a
                      >
                    } @else {
                      <span class="muted">Pedido no disponible</span>
                    }
                  }
                  @case ('product') {
                    @if (notice.subject_id) {
                      <a class="ops-link" [routerLink]="['/productos', notice.subject_id]"
                        >Ver producto {{ notice.subject_id }}</a
                      >
                    }
                  }
                  @case ('import') {
                    @if (notice.subject_id) {
                      <a class="ops-link" [routerLink]="['/productos/importar', notice.subject_id]"
                        >Ver carga {{ notice.subject_id }}</a
                      >
                    }
                  }
                  @case ('cart') {
                    <a class="ops-link" routerLink="/configuracion">Revisar configuración</a>
                  }
                }
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="ops-empty" role="status">
          <h2>No hay avisos para mostrar</h2>
          <p>
            {{
              filterValue()
                ? 'Probá con otro estado para ver más avisos.'
                : 'Los próximos avisos sobre pedidos, stock y cargas aparecerán acá.'
            }}
          </p>
        </div>
      }
      <camba-operation-pager [info]="result.value.meta" singular="aviso" plural="avisos" />
    }
  `,
  styleUrl: './operations.css',
})
export class NoticesPage {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload = new BehaviorSubject(0);
  private readonly params = toSignal(this.route.queryParamMap);

  readonly states = stateLabels;
  readonly options = choices(stateLabels);
  readonly date = formatDate;
  readonly names: Readonly<Record<string, string>> = {
    order_created: 'Pedido recibido',
    order_paid: 'Pago aprobado',
    payment_issue: 'Incidencia de pago',
    import_completed: 'Carga finalizada',
    import_completed_with_errors: 'Carga finalizada con errores',
    import_stalled: 'Carga demorada',
    low_stock: 'Stock bajo',
    paid_overdue: 'Pedido demorado',
    order_shipped: 'Aviso de envío',
    order_ready_for_pickup: 'Aviso de retiro',
    payment_reminder: 'Recordatorio de pago',
    cart_reminder: 'Recordatorio de carrito',
  };
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
        const state = validChoice(params.get('state'), stateLabels);
        return readState(
          this.api.get<Page<Notice>>(`${adminApi}/notices`, {
            page: pageNumber(params.get('page')),
            ...(state ? { state } : {}),
          }),
          'No pudimos cargar los avisos.',
        );
      }),
    ),
  );

  filterValue() {
    return validChoice(this.params()?.get('state') ?? null, stateLabels);
  }

  filter(event: Event) {
    const state = (event.target as HTMLSelectElement).value;
    void this.router.navigate([], { relativeTo: this.route, queryParams: state ? { state } : {} });
  }

  retry() {
    this.reload.next(0);
  }

  description(notice: Notice): string {
    if (
      notice.error_code === 'smtp_acceptance_unknown' ||
      notice.error_code === 'worker_interrupted'
    ) {
      return 'No se pudo confirmar que el correo saliera. Verificá el estado antes de volver a contactar.';
    }
    if (notice.state === 'failed')
      return 'No se pudo enviar el correo. Revisá el caso desde su origen.';
    if (notice.issue && issueLabels[notice.issue]) return issueLabels[notice.issue];
    if (notice.state === 'resolved') return 'Esta incidencia ya no está activa.';
    return this.actions[notice.kind] || 'Consultá los datos relacionados con este aviso.';
  }
}
