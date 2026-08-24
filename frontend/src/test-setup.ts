import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';

// Sonst NG0701 "Missing locale data" für jede Pipe mit explizitem 'de'-Locale
// (z. B. DecimalPipe im Dashboard) — main.ts registriert das für die echte
// App, Tests laufen aber nie durch main.ts.
registerLocaleData(localeDe);

// Globales Setup für Vitest/jsdom (siehe angular.json -> architect.test.options.setupFiles).
// jsdom implementiert window.matchMedia nicht — ThemeService (prefers-color-scheme)
// und RevealDirective (prefers-reduced-motion) rufen es aber auf. Ohne diesen Stub
// schlägt jeder Test fehl, der eine Komponente rendert, die eine dieser beiden nutzt.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
