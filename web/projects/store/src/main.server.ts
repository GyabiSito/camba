import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { StoreShell } from './app/app';
import { config } from './app/app.config.server';

const bootstrap = (context: BootstrapContext) => bootstrapApplication(StoreShell, config, context);

export default bootstrap;
