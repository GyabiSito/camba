import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';

export const api = '/api/v1';
export interface Data<T> {
  data: T;
}
export interface Page<T> extends Data<T[]> {
  meta: { current_page: number; last_page: number };
}

export interface Buyer {
  id: number;
  name: string;
  email: string;
  role: string;
  email_verified: boolean;
}

export interface Address {
  id: number;
  recipient: string;
  department: string;
  locality: string;
  department_id: number | null;
  locality_id: number | null;
  street: string;
  number: string;
  details: string | null;
  phone: string | null;
  postal_code: string | null;
}

export const addressFields = [
  { name: 'recipient', label: 'Nombre de quien recibe', limit: 120, autocomplete: 'shipping name' },
  { name: 'street', label: 'Calle', limit: 160, autocomplete: 'shipping address-line1' },
  { name: 'number', label: 'Número de puerta', limit: 20, autocomplete: 'off' },
  {
    name: 'details',
    label: 'Apartamento o indicaciones (opcional)',
    limit: 255,
    autocomplete: 'shipping address-line2',
  },
  {
    name: 'postal_code',
    label: 'Código postal (opcional)',
    limit: 12,
    autocomplete: 'shipping postal-code',
  },
] as const;

export function makeAddressForm(fb: FormBuilder) {
  const field = (limit: number, required = false) =>
    fb.nonNullable.control('', [
      ...(required ? [Validators.required] : []),
      Validators.maxLength(limit),
    ]);
  return fb.nonNullable.group({
    recipient: field(120, true),
    department_id: fb.control<number | null>(null, Validators.required),
    locality_id: fb.control<number | null>(null, Validators.required),
    street: field(160, true),
    number: field(20, true),
    details: field(255),
    postal_code: field(12),
  });
}

export type AddressGeography = { department_id: number; locality_id: number };
export type AddressInput = ReturnType<ReturnType<typeof makeAddressForm>['getRawValue']> &
  AddressGeography;

export function addressGeography({
  department_id,
  locality_id,
}: Pick<Address, keyof AddressGeography>): AddressGeography | null {
  return department_id && locality_id ? { department_id, locality_id } : null;
}

export function resetAddressForm(form: ReturnType<typeof makeAddressForm>, address?: Address) {
  form.reset(
    address
      ? { ...address, details: address.details ?? '', postal_code: address.postal_code ?? '' }
      : undefined,
  );
}

export interface CartItem {
  product_id: number;
  quantity: number;
  available: boolean;
  product: { name: string; slug: string; price_cents: number; stock: number } | null;
}

export interface Cart {
  currency: 'UYU';
  items: CartItem[];
}
export interface Line {
  product_id: number;
  sku: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface Shipping {
  method: 'pickup' | 'delivery';
  shipping_cents: number;
  total_cents: number;
  pickup_address: string | null;
  quote_token: string;
}

export interface Quote {
  items: Line[];
  subtotal_cents: number;
  shipping_options: Shipping[];
}

export interface Order {
  reference: string;
  status: string;
  fulfilment_status: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_method: Shipping['method'];
  reservation_expires_at: string;
  created_at: string;
  guest_access_expires_at?: string | null;
  items?: Line[];
  pickup_address?: string | null;
  // Historical order snapshots contain names but may predate normalized geography.
  address?:
    | (Omit<Address, 'id' | 'phone' | keyof AddressGeography> &
        Partial<Pick<Address, keyof AddressGeography>>)
    | null;
  tracking?: string | null;
}

export const orderStatus: Record<string, string> = {
  pending_payment: 'Pendiente de pago',
  paid: 'Pago confirmado',
  payment_expired: 'Reserva vencida',
  payment_review: 'Pago en revisión',
  refunded: 'Pago reembolsado',
  charged_back: 'Pago contracargado',
};

export const fulfilmentStatus: Record<string, string> = {
  preparing: 'En preparación',
  ready_for_pickup: 'Listo para retirar',
  shipped: 'En camino',
  completed: 'Completado',
};

export function httpStatus(error: unknown): number | undefined {
  return error instanceof HttpErrorResponse ? error.status : undefined;
}
