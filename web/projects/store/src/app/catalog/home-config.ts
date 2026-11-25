import type { HomeAsset, HomeBlock, HomeDocument, HomeImage, HomeLink, HomePublication } from '@camba/shared';
import type { HomeData, Product } from './catalog-data';

const builtinSizes: Record<string, [number, number, number?]> = {
  'hero-wide': [1800, 782, 1100], 'hero-mobile': [800, 1000, 480],
  remeras: [720, 480, 420], camisas: [720, 480, 420], pantalones: [720, 480, 420],
  look: [1200, 858, 720], story: [768, 512, 480], weave: [290, 290, 180], finish: [246, 246, 160],
  'cierre-tela': [1200, 1000, 600], 'cierre-silueta': [720, 480], 'cierre-trama': [1320, 880],
};

export function homeImage(image: HomeImage | null | undefined, assets: Record<string, HomeAsset>, editorial: boolean, assetOrigin?: string): HomeAsset | undefined {
  if (!image) return;
  const name = image.key;
  const size = Object.hasOwn(builtinSizes, name) ? builtinSizes[name] : undefined;
  if (size) {
    if (!editorial) return;
    const [width, height, small_width] = size;
    const relative = '/demo-home/atelier-' + name;
    const path = assetOrigin ? new URL(relative, assetOrigin).href : relative;
    return { url: path + '.webp', thumbnail_url: small_width ? path + '-small.webp' : path + '.webp', width, height, small_width };
  }
  return Object.hasOwn(assets, image.key) ? assets[image.key] : undefined;
}

export function homeSrcset(asset: HomeAsset): string | null {
  return asset.small_width && asset.thumbnail_url !== asset.url
    ? `${asset.thumbnail_url} ${asset.small_width}w, ${asset.url} ${asset.width}w` : null;
}

export function homeCrop(image: HomeImage | null | undefined): string | null {
  return image && (image.x != null || image.y != null) ? `${image.x ?? 50}% ${image.y ?? 50}%` : null;
}

export const homeAnchors: Record<HomeBlock, string> = {
  hero: 'home-title', categories: 'categorias', selection: 'selection-title', look: 'look-title', story: 'story-title', mosaic: 'home-mosaic',
};

export function homeHref(link: HomeLink | null | undefined, publication: Pick<HomePublication<Product>, 'categories' | 'products'> | undefined, document: HomeDocument,
  sectionExists?: (block: HomeBlock) => boolean): string | undefined {
  if (!link) return;
  switch (link.type) {
    case 'catalog': return '/tienda';
    case 'category': {
      const category = publication?.categories.find(item => item.id === link.id);
      return category ? '/tienda?category=' + encodeURIComponent(category.slug) : undefined;
    }
    case 'product': {
      const product = publication?.products.find(item => item.id === link.id);
      return product ? '/producto/' + encodeURIComponent(product.slug) : undefined;
    }
    case 'section': return !document.hidden.includes(link.section) && document.order.includes(link.section) && (sectionExists?.(link.section) ?? true)
      ? '#' + homeAnchors[link.section] : undefined;
  }
}

export function legacyHomeDocument(shop?: HomeData): HomeDocument {
  const image = (key: string, alt = ''): HomeImage => ({ key, alt });
  const category = (slug: string) => shop?.categories.find(item => item.category.slug === slug)?.category;
  const link = (slug: string): HomeLink | null => {
    const found = category(slug);
    return found ? { type: 'category', id: found.id, label: found.name } : null;
  };
  return {
    order: ['hero', 'categories', 'selection', 'look', 'story', 'mosaic'], hidden: [],
    hero: { desktop: image('hero-wide'), mobile: image('hero-mobile'), title: 'Vestite distinto.', text: 'Ropa para combinar a tu manera.',
      primary: { type: 'catalog', label: 'Ver tienda' }, secondary: shop?.categories.length ? { type: 'section', section: 'categories', label: 'Explorá por categoría' } : null },
    categories: { mode: 'automatic', cards: [] },
    selection: { title: 'Selección de Camba', action: { type: 'catalog', label: 'Ver todo el catálogo' }, mode: 'automatic', categoryId: null, productIds: [] },
    look: { title: 'Armá el look', text: 'Una camisa blanca y un pantalón arena: dos prendas para combinar juntas o por separado.',
      image: image('look', 'Una camisa blanca y un pantalón arena en movimiento, en un taller iluminado por el sol.'), mode: 'automatic', productIds: [] },
    story: { title: 'Texturas y detalles', text: 'La luz marca los pliegues de la camisa y el corte de un pantalón con pinzas.',
      image: image('story', 'Una persona sentada junto al ventanal; la luz dibuja los pliegues de la ropa.'),
      details: [image('weave', 'Detalle del paño blanco y de cómo cae la manga.'), image('finish', 'Detalle de las pinzas y las costuras en la cintura arena.')],
      action: category('camisas') ? { type: 'category', id: category('camisas')!.id, label: 'Ver ' + category('camisas')!.name.toLowerCase() } : null },
    mosaic: { image: image('cierre-tela'), action: { type: 'catalog', label: 'Ver catálogo' }, tiles: [
      { image: image('remeras', 'Remera oscura puesta junto a un ventanal.'), action: link('remeras') },
      { image: image('cierre-silueta', 'Silueta sentada contra una pared ladrillo.'), action: null },
      { image: image('cierre-trama', 'Detalle de una sobrecamisa oliva sobre algodón oscuro.'), action: null },
      { image: image('camisas', 'Puño arremangado de una camisa clara.'), action: link('camisas') },
      { image: image('pantalones', 'Pantalón arena al caminar sobre madera.'), action: link('pantalones') },
      { image: image('look', 'Camisa y pantalón en un look de cuerpo entero.'), action: category('camisas') || category('pantalones') ? { type: 'section', section: 'look', label: 'Armá el look' } : null },
    ] },
  };
}

export function homeCategoryCards(shop: HomeData, document: HomeDocument) {
  if (shop.publication && document.categories.mode === 'manual') {
    return document.categories.cards.flatMap(card => {
      const category = shop.publication!.categories.find(item => item.id === card.categoryId);
      return category ? [{ category, image: card.image, label: card.label || category.name }] : [];
    });
  }
  return shop.categories.map(item => ({ category: item.category,
    image: ['remeras', 'camisas', 'pantalones'].includes(item.category.slug) ? { key: item.category.slug, alt: '' } as HomeImage : null, label: item.category.name }));
}

export function homeSectionExists(block: HomeBlock, document: HomeDocument, shop: HomeData | undefined, editorial: boolean): boolean {
  if (block === 'hero') return true;
  if (!shop) return false;
  const photo = (image: HomeImage | null) => homeImage(image, shop.publication?.assets ?? {}, editorial);
  switch (block) {
    case 'categories': return homeCategoryCards(shop, document).length > 0;
    case 'selection': return true;
    case 'look': return !!(photo(document.look.image) || (shop.publication && !document.look.image) ||
      shop.look.length || (editorial && document.look.mode === 'automatic' &&
        shop.categories.some(item => ['camisas', 'pantalones'].includes(item.category.slug))));
    case 'story': return !!(photo(document.story.image) || (shop.publication && !document.story.image) || shop.editorial);
    case 'mosaic': return !!(editorial || photo(document.mosaic.image) || document.mosaic.tiles.some(tile => photo(tile.image)));
  }
}

export function publicationHome(publication: HomePublication<Product>, fallback: HomeData): HomeData {
  const { document, products } = publication;
  const selected = (ids: number[]) => ids.flatMap(id => {
    const product = products.find(item => item.id === id);
    return product ? [product] : [];
  });
  const candidate = fallback.categories[0];
  const editorial = candidate?.in_stock && candidate.images[1]?.url && candidate.images[1].url !== candidate.images[0]?.url ? candidate : fallback.editorial;
  return { ...fallback, publication, editorial,
    selection: document.selection.mode === 'manual' ? selected(document.selection.productIds)
      : document.selection.categoryId !== null ? products.filter(item => item.category.id === document.selection.categoryId).slice(0, 8) : fallback.selection,
    look: document.look.mode === 'manual' ? selected(document.look.productIds) : fallback.look,
  };
}

export function homeCatalog(shop: HomeData) {
  return shop.publication ?? { categories: shop.categories.map(item => item.category), products: [...shop.selection, ...shop.look] };
}
