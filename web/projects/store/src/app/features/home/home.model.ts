import type { HomePublication, StoreProduct } from '@camba/shared';

export interface HomeData {
  publication?: HomePublication<StoreProduct>;
  categories: StoreProduct[];
  selection: StoreProduct[];
  look: StoreProduct[];
  editorial?: StoreProduct;
}
