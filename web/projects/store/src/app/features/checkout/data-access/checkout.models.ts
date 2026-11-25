import type { AddressInput } from '../../../shared/data-access/address';
import type { Shipping } from '../../orders';

export type OrderInput = {
  items: { product_id: number; quantity: number }[];
  shipping_method: Shipping['method'];
  quote_token: string;
  contact: { name: string; email: string; phone: string };
  address?: AddressInput;
};
