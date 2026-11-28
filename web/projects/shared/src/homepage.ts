export const homepageBlocks = ['hero', 'categories', 'selection', 'look', 'story', 'mosaic'] as const;
export type HomeBlock = typeof homepageBlocks[number];

export interface HomeImage {
  key: string;
  alt: string;
  x?: number | null;
  y?: number | null;
}

export type HomeLink = { label: string } & (
  { type: 'catalog' } |
  { type: 'category' | 'product'; id: number } |
  { type: 'section'; section: HomeBlock }
);

export interface HomeDocument {
  order: HomeBlock[];
  hidden: HomeBlock[];
  hero: { desktop: HomeImage | null; mobile: HomeImage | null; title: string; text: string; primary: HomeLink | null; secondary: HomeLink | null };
  categories: { mode: 'automatic' | 'manual'; cards: { categoryId: number; image: HomeImage | null; label: string }[] };
  selection: { title: string; action: HomeLink | null; mode: 'automatic' | 'manual'; categoryId: number | null; productIds: number[] };
  look: { title: string; text: string; image: HomeImage | null; mode: 'automatic' | 'manual'; productIds: number[] };
  story: { title: string; text: string; image: HomeImage | null; details: (HomeImage | null)[]; action: HomeLink | null };
  mosaic: { image: HomeImage | null; action: HomeLink | null; tiles: { image: HomeImage; action: HomeLink | null }[] };
}

export interface HomeAsset {
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  small_width?: number;
}

export interface HomeCategory { id: number; slug: string; name: string; }
export interface HomePhotoRef { url: string; thumbnail_url: string; alt?: string | null; }
export interface HomeProduct {
  id: number;
  slug: string;
  name: string;
  price_cents: number;
  in_stock: boolean;
  category: HomeCategory;
  images: HomePhotoRef[];
}

export interface HomePublication<TProduct = HomeProduct> {
  document: HomeDocument;
  version: number;
  assets: Record<string, HomeAsset>;
  categories: HomeCategory[];
  products: TProduct[];
}

export interface HomeEditorState {
  revision: number;
  published_version: number;
  published: HomeDocument;
  draft: HomeDocument | null;
  assets: Record<string, HomeAsset>;
  store_url: string;
}
