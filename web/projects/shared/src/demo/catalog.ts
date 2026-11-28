import type { AdminClassification as Classification, AdminProduct as Product, Page, StoreProduct } from '../data-access/catalog-contracts';

const shirts: Classification = { id: 1, slug: 'remeras', name: 'Remeras', active: true };
const overshirts: Classification = { id: 2, slug: 'camisas', name: 'Camisas', active: true };
const trousers: Classification = { id: 3, slug: 'pantalones', name: 'Pantalones', active: true };
const workshop: Classification = { id: 1, slug: 'taller-sur', name: 'Taller Sur', active: true };
const coast: Classification = { id: 2, slug: 'costa-norte', name: 'Costa Norte', active: true };
type Seed = [slug: string, name: string, description: string | null, cents: number, stock: number,
  category: Classification, brand: Classification | null, ...photos: string[]];

const seeds: Seed[] = [
  ['remera-lisa-negra', 'Remera lisa negra', 'Corte recto, cuello redondo y terminación al tono.', 79000, 14, shirts, workshop, 'plain', 'detail-photo'],
  ['camisa-algodon-blanca', 'Camisa de algodón blanca', 'Cuello clásico y bolsillo al pecho.', 139000, 6, overshirts, coast, 'cotton'],
  ['remera-bolsillo-gris', 'Remera con bolsillo gris', 'Bolsillo al pecho y ruedo recto.', 96000, 3, shirts, workshop, 'pocket'],
  ['pantalon-pinzas-arena', 'Pantalón con pinzas arena', 'Cintura con pasadores y pierna recta.', 149000, 10, trousers, null, 'straight'],
  ['camisa-clasica-marino', 'Camisa clásica azul marino', 'Manga larga y botones al tono.', 147950, 0, overshirts, null, 'classic'],
  ['camisa-liviana-blanca', 'Camisa liviana blanca', null, 159000, 12, overshirts, coast, 'cotton'],
  ['remera-amplia-marfil', 'Remera amplia marfil', 'Hombros caídos y manga corta ancha.', 105000, 5, shirts, coast, 'over'],
  ['remera-gris-claro', 'Remera gris claro', 'Cuello redondo y bolsillo rectangular.', 102000, 9, shirts, null, 'pocket'],
  ['pantalon-sarga-negro', 'Pantalón de sarga negro', 'Sarga de cuerpo medio y pierna recta.', 174000, 2, trousers, workshop, 'twill'],
  ['remera-recta-carbon', 'Remera recta carbón', null, 84000, 17, shirts, workshop, 'plain', 'detail-photo'],
  ['camisa-manga-larga-marino', 'Camisa de manga larga azul marino', 'Cuello clásico y puños con botón.', 158000, 8, overshirts, coast, 'classic'],
  ['remera-amplia-crudo', 'Remera amplia crudo', 'Silueta holgada y terminación recta en el ruedo.', 112050, 0, shirts, null, 'over'],
  ['pantalon-recto-negro', 'Pantalón recto negro', 'Pierna recta y cintura con pasadores.', 179000, 4, trousers, workshop, 'twill'],
];

function imageUrl(photo: string): string {
  return `/demo/${photo === 'detail-photo' ? photo : `image-${photo}`}.webp`;
}

const published = seeds.map(([slug, name, description, price_cents, stock, category, brand, ...photos], i) => ({
  id: i + 1, sku: `DEMO-${String(i + 1).padStart(3, '0')}`, slug, name, description, price_cents, stock,
  category, brand, status: 'published' as const,
  images: photos.map((photo, j) => ({
    id: 10 * (i + 1) + j, url: imageUrl(photo), thumbnail_url: imageUrl(photo),
    alt: `${name} — ${j === 0 ? 'vista frontal' : 'vista frontal más cercana'}`,
  })),
}));

export const demoProduct = (id: number) => published.find(product => product.id === id);

const inventory: Product[] = [
  ...published,
  { ...published[0], id: 14, sku: 'DEMO-014', slug: 'borrador-muestra', name: null, description: null,
    price_cents: null, stock: 0, category: null, brand: null, images: [], status: 'draft' },
  { ...published[0], id: 15, sku: 'DEMO-015', slug: 'remera-muestra-archivada', name: 'Remera de muestra archivada',
    stock: 0, images: [], status: 'archived' },
];

function publicClassification({ id, slug, name }: Classification) {
  return { id, slug, name };
}

function publicProduct(product: typeof published[number], images = product.images): StoreProduct & { currency: 'UYU' } {
  const { id, sku, slug, name, description, price_cents, stock, category, brand } = product;
  return { id, sku, slug, name, description, price_cents, currency: 'UYU', stock, in_stock: stock > 0,
    category: publicClassification(category), brand: brand && publicClassification(brand), images };
}

function pageOf<T extends Product>(products: T[], query: URLSearchParams): Page<T> {
  const [page, perPage] = ['page', 'per_page'].map((key, i) => {
    const number = Number(query.get(key));
    return Number.isSafeInteger(number) && number > 0 ? number : i === 0 ? 1 : 24;
  });
  const value = (key: string) => query.get(key) ?? '';
  const match = value('q').toLocaleLowerCase('es-UY');
  const found = products.filter(product =>
    (!match || [product.name, product.sku].some(field => field?.toLocaleLowerCase('es-UY').includes(match))) &&
    (!value('category') || product.category?.slug === value('category')) &&
    (!value('brand') || product.brand?.slug === value('brand')) &&
    (!value('status') || product.status === value('status')));
  const price = (product: Product) => product.price_cents ?? 0;
  found.sort((a, b) => {
    switch (value('sort')) {
      case 'price_asc': return price(a) - price(b) || a.id - b.id;
      case 'price_desc': return price(b) - price(a) || a.id - b.id;
      case 'name': return (a.name ?? '').localeCompare(b.name ?? '', 'es-UY') || a.id - b.id;
      default: return b.id - a.id;
    }
  });
  const from = (page - 1) * perPage;
  return {
    data: found.slice(from, from + perPage),
    meta: { current_page: page, last_page: Math.max(1, Math.ceil(found.length / perPage)), total: found.length },
  };
}

export function demoCatalog(path: string, query: URLSearchParams, admin: boolean): object | undefined {
  const classifications = path === 'categories' ? [overshirts, trousers, shirts] : path === 'brands' ? [coast, workshop] : null;
  if (classifications) return { data: admin ? classifications : classifications.map(publicClassification) };

  if (admin) {
    if (path === 'products') {
      const page = pageOf(inventory, query);
      return { ...page, data: page.data.map(item => ({ ...item, currency: 'UYU', in_stock: item.stock > 0, images: item.images.slice(0, 1) })) };
    }
    const item = inventory.find(product => path === `products/${product.id}`);
    if (item) return { data: { ...item, currency: 'UYU', in_stock: item.stock > 0 } };
    if (inventory.some(product => path === `products/${product.id}/history`)) {
      return { data: [], current_page: 1, last_page: 1 };
    }
  } else {
    if (path === 'products') {
      const page = pageOf(published, query);
      return { ...page, data: page.data.map(item => publicProduct(item, item.images.slice(0, 1))) };
    }
    const item = published.find(product => path === `products/${product.slug}`);
    if (item) return { data: publicProduct(item) };
  }
  return undefined;
}
