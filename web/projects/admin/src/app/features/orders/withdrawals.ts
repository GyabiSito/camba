import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, apiMessage } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import type { Page } from '../../shared/operations-data';

type Action = 'review' | 'close' | 'confirm_refund';
type Status = 'received' | 'reviewing' | 'closed' | 'refunded';
type Withdrawal = {
  reference: string;
  order_reference: string;
  order_matched: boolean;
  email: string;
  status: Status;
  received_at: string;
  refund_reference: string | null;
  refund_confirmed_at: string | null;
};

@Component({
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../shared/operations.css',
  styles: '.ops-card p { overflow-wrap: anywhere; }',
  template: `
    <header class="ops-heading">
      <div><h1>Arrepentimientos</h1><p>Revisá las solicitudes y registrá los reintegros que Mercado Pago ya confirmó.</p></div>
      <a class="button button--quiet" routerLink="/pedidos">Volver a Pedidos</a>
    </header>
    <p>Para hacer el reintegro, usá Mercado Pago. Después consultá el pago en el pedido y volvé acá para registrar la confirmación. Esta pantalla no mueve dinero.</p>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (feedback()) { <p role="status">{{ feedback() }}</p> }
    @if (loading()) { <p role="status">Cargando solicitudes…</p> }
    @if (result(); as page) {
      @if (!page.data.length) { <p>No hay solicitudes registradas.</p> }
      <ul class="ops-list">
        @for (item of page.data; track item.reference) {
          <li class="ops-card">
            <h2>{{ statusLabels[item.status] }}</h2>
            <p>Constancia: {{ item.reference }} · {{ item.received_at | date:'dd/MM/yyyy HH:mm':'-0300' }} (Uruguay)</p>
            <p>Correo: {{ item.email }}</p>
            @if (item.order_matched) {
              <a [routerLink]="['/pedidos', item.order_reference]">Ver pedido</a>
            } @else {
              <p>Pedido no identificado · {{ item.order_reference }}</p>
            }
            @if (item.refund_reference) {
              <p>Reintegro confirmado: {{ item.refund_reference }} · {{ item.refund_confirmed_at | date:'dd/MM/yyyy HH:mm':'-0300' }} (Uruguay)</p>
            } @else {
              <div class="actions">
                @if (item.status === 'received') { <button class="button button--quiet" type="button" [disabled]="busy()" (click)="act(item, 'review')">Abrir revisión</button> }
                @if (item.status !== 'closed') { <button class="button button--quiet" type="button" [disabled]="busy()" (click)="act(item, 'close')">Cerrar sin registrar reintegro</button> }
                @if (item.order_matched) { <button class="button" type="button" [disabled]="busy()" (click)="act(item, 'confirm_refund')">Registrar reintegro confirmado</button> }
              </div>
            }
          </li>
        }
      </ul>
      @if (page.meta.last_page > 1) {
        <nav aria-label="Páginas de solicitudes">
          <button type="button" [disabled]="loading() || page.meta.current_page <= 1" (click)="load(page.meta.current_page - 1)">Anterior</button>
          <span> Página {{ page.meta.current_page }} de {{ page.meta.last_page }} </span>
          <button type="button" [disabled]="loading() || page.meta.current_page >= page.meta.last_page" (click)="load(page.meta.current_page + 1)">Siguiente</button>
        </nav>
      }
    }
  `,
})
export class WithdrawalsPage {
  private readonly api = inject(ApiClient);
  private readonly endpoint = '/api/v1/admin/withdrawals';
  protected readonly statusLabels: Record<Status, string> = {
    received: 'Recibida', reviewing: 'En revisión', closed: 'Cerrada', refunded: 'Reintegro confirmado',
  };
  protected readonly result = signal<Page<Withdrawal> | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly feedback = signal('');

  constructor() {
    void this.load(1);
  }

  protected async load(page: number): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      this.result.set(await firstValueFrom(this.api.get<Page<Withdrawal>>(this.endpoint, { page })));
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos cargar las solicitudes.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async act(item: Withdrawal, action: Action): Promise<void> {
    if (this.busy() || this.loading()) return;
    this.busy.set(true);
    this.error.set('');
    this.feedback.set('');
    try {
      const { data } = await firstValueFrom(this.api.patch<{ data: Withdrawal }>(this.endpoint + '/' + item.reference, { action }));
      this.result.update(page => page && { ...page, data: page.data.map(row => row.reference === data.reference ? data : row) });
      this.feedback.set('Solicitud actualizada.');
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos actualizar la solicitud.'));
    } finally {
      this.busy.set(false);
    }
  }
}
