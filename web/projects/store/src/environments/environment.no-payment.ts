import { environment as development } from './environment.development';

export const environment = { ...development, checkoutPro: false } as const;
