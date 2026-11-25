import { ParamMap, Params } from '@angular/router';

export const productSorts = {
  newest: 'Más recientes',
  name: 'Nombre de A a Z',
  price_asc: 'Menor precio',
  price_desc: 'Mayor precio',
};

type Sort = keyof typeof productSorts;

export interface CatalogQuery {
  q: string;
  category: string;
  brand: string;
  sort: Sort;
  page: number;
}

export function readCatalogQuery(params: ParamMap): CatalogQuery {
  const slug = (key: string) => {
    const value = params.get(key) ?? '';
    return /^[a-z0-9-]{1,160}$/.test(value) ? value : '';
  };
  const sort = params.get('sort') ?? '';
  const rawPage = params.get('page') ?? '';
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    q: (params.get('q') ?? '').trim().slice(0, 120),
    category: slug('category'),
    brand: slug('brand'),
    sort: Object.hasOwn(productSorts, sort) ? (sort as Sort) : 'newest',
    page: page > 0 && page <= 2147483647 ? page : 1,
  };
}

export function catalogParams(query: CatalogQuery, page = query.page): Params {
  return {
    ...(query.q && { q: query.q }),
    ...(query.category && { category: query.category }),
    ...(query.brand && { brand: query.brand }),
    ...(query.sort !== 'newest' && { sort: query.sort }),
    ...(page > 1 && { page }),
  };
}
