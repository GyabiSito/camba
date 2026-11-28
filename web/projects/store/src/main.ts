import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { StoreShell } from './app/app';

bootstrapApplication(StoreShell, appConfig).catch((err) => console.error(err));
