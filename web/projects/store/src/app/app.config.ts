import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { CAMBA_API_ORIGIN, provideCambaHttp } from '@camba/shared';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideCambaHttp('store'),
    { provide: CAMBA_API_ORIGIN, useValue: environment.apiOrigin },
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled',
    })),
    provideClientHydration(),
  ],
};
