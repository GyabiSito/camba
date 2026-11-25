export interface CartItem {
  product_id: number;
  quantity: number;
  available: boolean;
  product: { name: string; slug: string; price_cents: number; stock: number } | null;
}

export interface Cart { currency: 'UYU'; items: CartItem[]; }
