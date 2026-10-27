import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

// Nur für das Vorrendern der öffentlichen Seiten beim Build (app.routes.server.ts) — kein Node-Server im Betrieb.
registerLocaleData(localeDe);

const bootstrap = (context: BootstrapContext) => bootstrapApplication(App, config, context);

export default bootstrap;
