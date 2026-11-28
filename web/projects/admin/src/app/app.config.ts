import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CAMBA_API_ORIGIN, CAMBA_CSRF_PATH, provideCambaHttp } from '@camba/shared';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideCambaHttp('admin'),
    { provide: CAMBA_API_ORIGIN, useValue: environment.apiOrigin },
    { provide: CAMBA_CSRF_PATH, useValue: '/api/v1/admin/auth/csrf-cookie' },
    provideRouter(routes),
  ],
};
