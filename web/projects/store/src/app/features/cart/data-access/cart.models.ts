export interface CartItem {
  product_id: number;
  quantity: number;
  available: boolean;
  reserved?: boolean;
  product: { name: string; slug: string; price_cents: number; stock: number } | null;
}

export interface CartCheckout { reference: string; state: 'ready' | 'checking' | 'paid'; }
export interface Cart { currency: 'UYU'; items: CartItem[]; checkout?: CartCheckout | null; }
