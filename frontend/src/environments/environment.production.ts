// Produktions-Build (ng build). Leer = dieselbe Adresse wie die Seite: der Server leitet /api/ an Django weiter.
// Läuft die API unter einer eigenen Adresse, hier vollständig eintragen (z. B. 'https://api.example.org') und
// dieselbe Adresse der Seite im Backend in CORS_ALLOWED_ORIGINS/CSRF_TRUSTED_ORIGINS erlauben.
export const environment = {
  apiOrigin: '',
};
