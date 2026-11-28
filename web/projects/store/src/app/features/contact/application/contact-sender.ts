import { InjectionToken } from '@angular/core';

export type ContactSubmission = { name: string; email: string; phone: string; message: string };
export type ContactSubmissionResult = 'sent' | 'throttled' | 'invalid' | 'unavailable' | 'failed';

export interface ContactSender {
  send(submission: ContactSubmission): Promise<ContactSubmissionResult>;
}

export const CONTACT_SENDER = new InjectionToken<ContactSender>('Contact sender');
