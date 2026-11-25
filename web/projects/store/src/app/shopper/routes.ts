import { Routes } from '@angular/router';

export const shopperRoutes: Routes = [
  {
    path: 'cuenta/restablecer',
    title: 'Restablecer contraseña · Camba',
    loadComponent: () => import('./auth').then((m) => m.ResetPage),
  },
  {
    path: 'cuenta/recuperar',
    title: 'Recuperar contraseña · Camba',
    data: { requestPasswordReset: true },
    loadComponent: () => import('./auth').then((m) => m.ShopperAuth),
  },
  {
    path: 'cuenta',
    title: 'Tu cuenta · Camba',
    loadComponent: () => import('./account').then((m) => m.AccountPage),
  },
  {
    path: 'carrito',
    title: 'Tu carrito · Camba',
    loadComponent: () => import('./cart').then((m) => m.CartPage),
  },
  {
    path: 'checkout',
    title: 'Confirmar compra · Camba',
    loadComponent: () => import('./checkout').then((m) => m.CheckoutPage),
  },
  {
    path: 'pedidos/:reference',
    title: 'Tu pedido · Camba',
    loadComponent: () => import('./order').then((m) => m.OrderPage),
  },
  {
    path: 'pedidos',
    title: 'Tus compras · Camba',
    loadComponent: () => import('./orders-history').then((m) => m.OrderHistoryPage),
  },
];
