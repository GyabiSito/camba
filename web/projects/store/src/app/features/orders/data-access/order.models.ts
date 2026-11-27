import type { Address, AddressGeography } from '../../../shared/data-access/address';

export interface Line {
  product_id: number; sku: string; name: string; quantity: number;
  unit_price_cents: number; line_total_cents: number;
}
export interface Shipping {
  method: 'pickup' | 'delivery'; shipping_cents: number; total_cents: number;
  pickup_address: string | null; quote_token: string;
}
export interface Quote { items: Line[]; subtotal_cents: number; shipping_options: Shipping[]; terms_version?: string; withdrawal_period?: string; }
export interface Order {
  reference: string; status: string; fulfilment_status: string; subtotal_cents: number;
  shipping_cents: number; total_cents: number; shipping_method: Shipping['method'];
  reservation_expires_at: string; created_at: string; guest_access_expires_at?: string | null;
  payment_state?: 'pending' | 'rejected' | null;
  payment_rejection?: string;
  checkout_retryable?: boolean;
  checkout_cancelable?: boolean;
  items?: Line[]; pickup_address?: string | null;
  address?: (Omit<Address, 'id' | 'phone' | keyof AddressGeography> & Partial<Pick<Address, keyof AddressGeography>>) | null;
  tracking?: string | null;
}
export const orderStatus: Record<string, string> = {
  pending_payment: 'Pendiente de pago', paid: 'Pago confirmado', payment_expired: 'Reserva vencida',
  payment_review: 'Pago en revisión', refunded: 'Pago reembolsado', charged_back: 'Pago contracargado',
};
export const fulfilmentStatus: Record<string, string> = {
  preparing: 'En preparación', ready_for_pickup: 'Listo para retirar', shipped: 'En camino', completed: 'Completado',
};
