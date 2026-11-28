import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { CONTACT_SENDER, type ContactSender } from '../application/contact-sender';

export const contactSenderProvider = {
  provide: CONTACT_SENDER,
  useFactory: (): ContactSender => {
    const api = inject(ApiClient);
    return {
      async send(submission) {
        try {
          await firstValueFrom(api.post('/api/v1/contact', submission));
          return 'sent';
        } catch (error) {
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          return status === 429 ? 'throttled'
            : status === 422 ? 'invalid'
            : status === 503 ? 'unavailable' : 'failed';
        }
      },
    };
  },
};
