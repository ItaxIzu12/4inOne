// Full-Stack-Tests (playwright.fullstack.config.ts): eigenes Test-Backend auf Port 8010 mit frischer Datenbank —
// so laufen die Tests auch, während das eigene Lumiknot auf Port 8000 läuft, und berühren dessen Daten nie.
export const environment = {
  apiOrigin: 'http://localhost:8010',
  demoOnly: false,
};
