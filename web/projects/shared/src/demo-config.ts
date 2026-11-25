import { provideHttpClient } from '@angular/common/http';

export const demoMode: boolean = false;
export const provideCambaHttp = (_app: 'admin' | 'store') => provideHttpClient();
