import type { Data } from '../../../shared/operations-data';

export type OrderStatus = 'pending_payment' | 'paid' | 'payment_expired' | 'payment_review' | 'refunded' | 'charged_back';
export type FulfilmentStatus = 'unstarted' | 'preparing' | 'ready_for_pickup' | 'shipped' | 'completed';
export type FulfilmentStage = Exclude<FulfilmentStatus, 'unstarted'>;

export type Order = {
  reference: string; status: OrderStatus; created_at: string; reservation_expires_at: string;
  shipping_method: 'pickup' | 'delivery'; fulfilment_status: FulfilmentStatus;
  subtotal_cents: number; shipping_cents: number; total_cents: number;
};
export type OrderDetail = Order & {
  tracking: string | null; pickup_address: string | null;
  contact: { name: string; email: string; phone?: string | null };
  address: { recipient: string; department: string; locality: string; street: string; number: string; details?: string | null; postal_code?: string | null } | null;
  items: { product_id: number; sku: string; name: string; quantity: number; unit_price_cents: number; line_total_cents: number }[];
};
export type PaymentEvidence = {
  can_request_refresh: boolean; paid_at: string | null; last_checked_at: string | null; next_check_at: string | null;
  last_result: string | null; attempt: { status: string; expires_at: string } | null; issues: string[];
  observations: { id: number; status: string; amount_cents: number; updated_at: string }[];
};
export type OrderResponse = Data<OrderDetail> & {
  events: { actor_id: number; to_status: FulfilmentStatus; note: string | null; created_at: string }[];
  payment: PaymentEvidence;
};
