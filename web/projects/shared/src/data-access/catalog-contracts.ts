export interface StoreClassification {
  id: number;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: number;
  url: string;
  thumbnail_url: string;
  alt: string;
}

export interface StoreProduct {
  id: number;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  stock: number;
  in_stock: boolean;
  category: StoreClassification;
  brand: StoreClassification | null;
  images: ProductImage[];
}

export type Page<T> = { data: T[] } & { meta: { current_page: number; last_page: number; total: number } };
export type AdminClassification = { id: number; slug: string; name: string; active: boolean };
export type AdminProductPhoto = { id: number; url: string; thumbnail_url: string; alt: string };
export type AdminProduct = {
  id: number;
  sku: string;
  slug: string;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  stock: number;
  category: AdminClassification | null;
  brand: AdminClassification | null;
  images: AdminProductPhoto[];
  status: 'draft' | 'published' | 'archived';
};
