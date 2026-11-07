// Entwicklung (ng serve, Tests): Django läuft getrennt auf Port 8000.
export const environment = {
  apiOrigin: 'http://localhost:8000',
  /** Nur die Demo (GitHub Pages, environment.pages.ts): keine Anmeldung, kein Backend. */
  demoOnly: false,
};
