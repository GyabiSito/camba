export { resolveProduct } from './data-access/product.resolver';
export const loadProductPage = () => import('./detail').then(module => module.StoreProduct);
