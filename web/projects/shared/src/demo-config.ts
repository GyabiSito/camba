import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';

export const demoMode: boolean = false;
export const provideCambaHttp = (app: 'admin' | 'store') => app === 'admin'
  ? provideHttpClient(withXsrfConfiguration({ cookieName: 'CAMBA-ADMIN-XSRF-TOKEN' }))
  : provideHttpClient();
