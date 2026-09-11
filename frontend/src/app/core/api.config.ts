// Kein Environments-Setup im Projekt bisher — für den Produktivbau muss
// diese Adresse noch konfigurierbar gemacht werden (z. B. via
// fileReplacements). Ein einziger Ort für Origin/Basis-Pfad, damit
// künftige API-Versionswechsel (siehe ARCHITEKTUR.md, /api/v1/) nicht an
// mehreren Stellen im Code nachvollzogen werden müssen.
export const API_ORIGIN = 'http://localhost:8000';
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
