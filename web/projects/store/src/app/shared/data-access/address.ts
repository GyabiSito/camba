import { FormBuilder, Validators } from '@angular/forms';

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
  { name: 'details', label: 'Apartamento o indicaciones (opcional)', limit: 255, autocomplete: 'shipping address-line2' },
  { name: 'postal_code', label: 'Código postal (opcional)', limit: 12, autocomplete: 'shipping postal-code' },
] as const;

export function makeAddressForm(fb: FormBuilder) {
  const field = (limit: number, required = false) => fb.nonNullable.control('', [
    ...(required ? [Validators.required] : []), Validators.maxLength(limit),
  ]);
  return fb.nonNullable.group({
    recipient: field(120, true), department_id: fb.control<number | null>(null, Validators.required),
    locality_id: fb.control<number | null>(null, Validators.required), street: field(160, true),
    number: field(20, true), details: field(255), postal_code: field(12),
  });
}

export type AddressGeography = { department_id: number; locality_id: number };
export type AddressInput = ReturnType<ReturnType<typeof makeAddressForm>['getRawValue']> & AddressGeography;

export function addressGeography({ department_id, locality_id }: Pick<Address, keyof AddressGeography>): AddressGeography | null {
  return department_id && locality_id ? { department_id, locality_id } : null;
}

export function resetAddressForm(form: ReturnType<typeof makeAddressForm>, address?: Address) {
  form.reset(address ? { ...address, details: address.details ?? '', postal_code: address.postal_code ?? '' } : undefined);
}
