import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatDate, formatMoney } from '@camba/shared';
import { BehaviorSubject, Observable, combineLatest, switchMap } from 'rxjs';
import {
  fulfilmentLabels, issueLabels, nextAction, nextStage, Order,
  orderLabels, paymentLabels,
} from './order-data';
import { operationError, readState } from '../../shared/operations-data';
import { OperationLoading } from '../../shared/operation-ui';
import { OrdersApi } from './data-access/orders-api';

@Component({
  selector: 'camba-order-detail',
  imports: [RouterLink, OperationLoading],
  templateUrl: './order-detail.html',
  styleUrls: ['../../shared/operations.css', './orders.css'],
})
export class OrderDetailPage {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new BehaviorSubject(0);
  private reference?: string;

  readonly orderStatus = orderLabels;
  readonly fulfilmentStatus = fulfilmentLabels;
  readonly providerStatus = paymentLabels;
  readonly issues = issueLabels;
  readonly stage = nextStage;
  readonly attemptStatus: Readonly<Record<string, string>> = {
    initiating: 'En preparación',
    ready: 'Iniciado',
    uncertain: 'No confirmado',
  };
  readonly checkResult: Readonly<Record<string, string>> = {
    verified: 'Consulta completada',
    conflicting_evidence: 'Datos inconsistentes',
    provider_incomplete: 'Respuesta incompleta; se volverá a consultar',
    provider_candidate_limit: 'Demasiados pagos asociados; requiere revisión',
  };
  readonly date = formatDate;
  readonly money = formatMoney;
  readonly params = toSignal(this.route.queryParams, { initialValue: {} });
  readonly note = signal('');
  readonly tracking = signal('');
  readonly working = signal<'fulfilment' | 'payment' | null>(null);
  readonly feedback = signal<{ error: boolean; text: string } | null>(null);
  readonly response = toSignal(
    combineLatest([this.route.paramMap, this.reload]).pipe(
      switchMap(([params]) => {
        const reference = params.get('reference') ?? '';
        if (this.reference !== reference) {
          this.reference = reference;
          this.note.set('');
          this.tracking.set('');
          this.feedback.set(null);
        }
        return readState(
          this.api.detail(reference),
          'No pudimos encontrar o cargar el pedido.',
        );
      }),
    ),
  );

  emailLink(address: string) {
    return `mailto:${encodeURIComponent(address).replace('%40', '@')}`;
  }

  actionLabel(order: Order, stage: keyof typeof nextAction) {
    return stage === 'completed' && order.shipping_method === 'pickup'
      ? 'Confirmar retiro'
      : nextAction[stage];
  }

  refresh() {
    this.reload.next(0);
  }

  fulfil(event: Event, order: Order, stage: keyof typeof nextAction) {
    event.preventDefault();
    if (this.working()) return;
    const tracking = this.tracking().trim();
    this.send(
      order,
      'fulfilment',
      this.api.updateFulfilment(order.reference, stage, this.note().trim() || null, tracking || null),
      'Guardamos el cambio de entrega.',
    );
  }

  requestPayment(order: Order) {
    if (this.working()) return;
    this.send(
      order,
      'payment',
      this.api.refreshPayment(order.reference),
      'Solicitamos la verificación a Mercado Pago. El resultado no es inmediato; usá «Actualizar datos» para volver a consultar el pedido.',
    );
  }

  private send(
    order: Order,
    action: 'fulfilment' | 'payment',
    request: Observable<unknown>,
    success: string,
  ) {
    this.working.set(action);
    this.feedback.set(null);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.working.set(null);
        if (this.route.snapshot.paramMap.get('reference') !== order.reference) return;
        if (action === 'fulfilment') {
          this.note.set('');
          this.tracking.set('');
        }
        this.feedback.set({ error: false, text: success });
        this.refresh();
      },
      error: (error: unknown) => {
        this.working.set(null);
        if (this.route.snapshot.paramMap.get('reference') !== order.reference) return;
        if (action === 'fulfilment' && error instanceof HttpErrorResponse && error.status === 409) {
          this.feedback.set({
            error: true,
            text: 'El estado del pedido cambió. Actualizamos los datos; revisá el próximo paso antes de intentarlo de nuevo.',
          });
          this.refresh();
          return;
        }
        this.feedback.set({
          error: true,
          text: operationError(
            error,
            action === 'fulfilment'
              ? 'No pudimos guardar el cambio de entrega. Tu nota sigue disponible.'
              : 'No pudimos solicitar la verificación del pago. Probá de nuevo.',
          ),
        });
      },
    });
  }
}
