import type { Order, FulfilmentStage } from './data-access/order.models';
export type { Order, OrderResponse } from './data-access/order.models';

export const orderLabels = {
  pending_payment: 'Pago pendiente', paid: 'Pagado', payment_expired: 'Pago vencido',
  payment_review: 'Pago en revisión', refunded: 'Reembolsado', charged_back: 'Contracargo',
} as const;
export const fulfilmentLabels = {
  unstarted: 'Sin preparar', preparing: 'En preparación', ready_for_pickup: 'Listo para retirar',
  shipped: 'Enviado', completed: 'Completado',
} as const;
export const fulfilmentFilterLabels = { needs_preparation: 'Necesita preparación', ...fulfilmentLabels } as const;
export const nextAction = {
  preparing: 'Empezar preparación', ready_for_pickup: 'Marcar listo para retirar',
  shipped: 'Marcar como enviado', completed: 'Marcar como entregado',
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
  approved: 'Aprobado', authorized: 'Autorizado', pending: 'Pendiente', in_process: 'En proceso',
  in_mediation: 'En mediación', rejected: 'Rechazado', cancelled: 'Cancelado',
  refunded: 'Reembolsado', charged_back: 'Contracargo',
};
export function nextStage(order: Order): FulfilmentStage | null {
  if (order.status !== 'paid') return null;
  switch (order.fulfilment_status) {
    case 'unstarted': return 'preparing';
    case 'preparing': return order.shipping_method === 'pickup' ? 'ready_for_pickup' : 'shipped';
    case 'ready_for_pickup':
    case 'shipped': return 'completed';
    default: return null;
  }
}
