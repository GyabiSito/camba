import { mergeApplicationConfig, ApplicationConfig, inject, provideAppInitializer, TransferState } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { CAMBA_API_ORIGIN, CAMBA_DEV_NGROK_ORIGIN } from '@camba/shared';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { STORE_CANONICAL_ORIGIN } from './core/seo/store-meta';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideAppInitializer(() => {
      const origin = URL.parse(process.env['CAMBA_DEV_NGROK_ORIGIN'] ?? '');
      if (origin?.protocol === 'https:' && /\.ngrok-free\.(?:app|dev)$/.test(origin.hostname)) {
        inject(TransferState).set(CAMBA_DEV_NGROK_ORIGIN, origin.origin);
      }
    }),
    {
      provide: STORE_CANONICAL_ORIGIN,
      useFactory: () => process.env['CAMBA_PUBLIC_STORE_ORIGIN'] ?? '',
    },
    {
      provide: CAMBA_API_ORIGIN,
      useFactory: () =>
        new URL(
          process.env['CAMBA_SSR_API_ORIGIN'] ??
            process.env['CAMBA_DEV_API_ORIGIN'] ??
            'http://127.0.0.1:8000',
        ).origin,
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
