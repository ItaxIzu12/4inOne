import { environment } from '../../environments/environment';

// Ein einziger Ort für Origin/Basis-Pfad, damit künftige API-Versionswechsel (siehe ARCHITEKTUR.md, /api/v1/) nicht
// an mehreren Stellen nachgezogen werden müssen. Welche Adresse gilt, legt src/environments/ fest: in der Entwicklung
// localhost:8000, im Produktions-Build standardmäßig die Adresse der Seite selbst (angular.json › fileReplacements).
export const API_ORIGIN = environment.apiOrigin || window.location.origin;
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
