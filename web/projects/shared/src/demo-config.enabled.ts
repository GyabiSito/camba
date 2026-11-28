import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { demoHttp } from './demo/http';

export const demoMode: boolean = true;
export const provideCambaHttp = (app: 'admin' | 'store') =>
  provideHttpClient(withInterceptors([demoHttp(app)]));
