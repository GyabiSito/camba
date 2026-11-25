import { HttpErrorResponse } from '@angular/common/http';
import { apiMessage } from '@camba/shared';
import { Observable, catchError, map, of, startWith } from 'rxjs';

export const adminApi = '/api/v1/admin';

export const noticeQueryKeys = ['q', 'state', 'kind', 'date_from', 'date_to', 'page'] as const;

export const orderLabels = {
  pending_payment: 'Pago pendiente',
  paid: 'Pagado',
  payment_expired: 'Pago vencido',
  payment_review: 'Pago en revisión',
  refunded: 'Reembolsado',
  charged_back: 'Contracargo',
} as const;

export const fulfilmentLabels = {
  unstarted: 'Sin preparar',
  preparing: 'En preparación',
  ready_for_pickup: 'Listo para retirar',
  shipped: 'Enviado',
  completed: 'Completado',
} as const;

export const fulfilmentFilterLabels = {
  needs_preparation: 'Necesita preparación',
  ...fulfilmentLabels,
} as const;

export const nextAction = {
  preparing: 'Empezar preparación',
  ready_for_pickup: 'Marcar listo para retirar',
  shipped: 'Marcar como enviado',
  completed: 'Marcar como entregado',
} as const;

export const issueLabels: Readonly<Record<string, string>> = {
  stock_release_conflict: 'No se pudo liberar el stock de la reserva.',
  provider_evidence_mismatch: 'Los datos recibidos no coinciden con el pedido.',
  conflicting_provider_timestamp: 'Mercado Pago informó dos estados para la misma fecha.',
  payment_reversed: 'Mercado Pago informó una reversión del pago.',
  multiple_approved_payments: 'Hay más de un pago aprobado para este pedido.',
  approval_after_order_closed: 'El pago se aprobó después del cierre del pedido.',
  late_approval_without_stock: 'El pago se aprobó tarde y ya no había stock suficiente.',
};

export const paymentLabels: Readonly<Record<string, string>> = {
  approved: 'Aprobado',
  authorized: 'Autorizado',
  pending: 'Pendiente',
  in_process: 'En proceso',
  in_mediation: 'En mediación',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  charged_back: 'Contracargo',
};

export type Choice = { value: string; label: string };

export function choices(labels: Readonly<Record<string, string>>): Choice[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

export function validChoice(
  value: string | null,
  labels: Readonly<Record<string, string>>,
): string {
  return value && Object.hasOwn(labels, value) ? value : '';
}

export type PageInfo = { current_page: number; last_page: number; total: number };
export type Page<T> = { data: T[]; meta: PageInfo };
export type Data<T> = { data: T };
export type ReadState<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded'; value: T };

export function pageNumber(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 2147483647 ? page : 1;
}

export function operationError(error: unknown, fallback: string) {
  if (error instanceof HttpErrorResponse) {
    if ([401, 419].includes(error.status))
      return 'Tu sesión venció. Volvé a ingresar y probá de nuevo.';
    if ([0, 403, 429].includes(error.status)) return apiMessage(error, fallback);
  }
  return fallback;
}

export function readState<T>(request: Observable<T>, fallback: string): Observable<ReadState<T>> {
  return request.pipe(
    map((value): ReadState<T> => ({ status: 'loaded', value })),
    catchError((error: unknown) =>
      of<ReadState<T>>({ status: 'error', message: operationError(error, fallback) }),
    ),
    startWith<ReadState<T>>({ status: 'loading' }),
  );
}

export type Order = {
  reference: string;
  status: keyof typeof orderLabels;
  created_at: string;
  reservation_expires_at: string;
  shipping_method: 'pickup' | 'delivery';
  fulfilment_status: keyof typeof fulfilmentLabels;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
};

export type OrderDetail = Order & {
  tracking: string | null;
  pickup_address: string | null;
  contact: { name: string; email: string; phone?: string | null };
  address: {
    recipient: string;
    department: string;
    locality: string;
    street: string;
    number: string;
    details?: string | null;
    postal_code?: string | null;
  } | null;
  items: {
    product_id: number;
    sku: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }[];
};

export type PaymentEvidence = {
  can_request_refresh: boolean;
  paid_at: string | null;
  last_checked_at: string | null;
  next_check_at: string | null;
  last_result: string | null;
  attempt: { status: string; expires_at: string } | null;
  issues: string[];
  observations: { id: number; status: string; amount_cents: number; updated_at: string }[];
};

export type OrderResponse = Data<OrderDetail> & {
  events: {
    actor_id: number;
    to_status: keyof typeof fulfilmentLabels;
    note: string | null;
    created_at: string;
  }[];
  payment: PaymentEvidence;
};

export function nextStage(order: Order): keyof typeof nextAction | null {
  if (order.status !== 'paid') return null;
  switch (order.fulfilment_status) {
    case 'unstarted':
      return 'preparing';
    case 'preparing':
      return order.shipping_method === 'pickup' ? 'ready_for_pickup' : 'shipped';
    case 'ready_for_pickup':
    case 'shipped':
      return 'completed';
    default:
      return null;
  }
}
