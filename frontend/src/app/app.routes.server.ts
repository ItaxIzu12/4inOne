import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Vorrendern beim Build: nur die öffentlichen Seiten ohne persönliche Daten. Alles andere (Demo, App, Login …) läuft
 * wie bisher nur im Browser (index.csr.html). Unter / liefert nginx angemeldeten Nutzern die App statt der
 * vorgerenderten Landingpage aus (Hinweis-Cookie, siehe core/auth/auth.service.ts › SIGNED_IN_HINT, deploy/nginx).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'impressum', renderMode: RenderMode.Prerender },
  { path: 'datenschutz', renderMode: RenderMode.Prerender },
  { path: 'nutzungsbedingungen', renderMode: RenderMode.Prerender },
  { path: 'barrierefreiheit', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
