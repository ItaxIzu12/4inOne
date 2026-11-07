# Testversion auf GitHub Pages (nur Demo)

**Zweck:** Freunden einen Link schicken, damit sie 4inOne mit Beispieldaten ausprobieren — ohne Konto, ohne Server.
**Nur zum Testen.** Vor dem Livegang entfernen (siehe unten). Stand: 06.11.2026.

## Was die Testversion ist

- Landingpage, die **Demo** (`/demo`, alle vier Bereiche, Personen & Gruppen) und die Rechtsseiten.
- Alles läuft im Browser der Testperson; gespeichert wird nichts, nichts geht an einen Server.
- **Nicht enthalten:** Anmelden, Registrieren, eigene Konten, „Feedback geben“. Diese Links sind ausgeblendet; wer eine
  solche Adresse direkt aufruft (z. B. `/login`, `/finanzen`), landet in der Demo.
- Keine Besucherzählung, kein Tracking. Alle Seiten tragen `noindex`, `robots.txt` sperrt Suchmaschinen.
- Feedback holst du dir direkt (Gespräch, Nachricht) — z. B. mit den Fragen aus `docs/beta/INTERVIEWLEITFADEN.md`.

## Einmalig einrichten

1. Änderungen committen und auf GitHub pushen (Branch `main`).
2. Auf GitHub im Repository: **Settings › Pages › Build and deployment › Source: „GitHub Actions“**.

## Veröffentlichen (jedes Mal, wenn du eine neue Version zeigen willst)

1. GitHub › Reiter **Actions** › links **„Demo auf GitHub Pages“** › **Run workflow** (Branch `main`).
2. Nach ca. 2–3 Minuten ist sie online unter:
   **https://itaxizu12.github.io/4inOne/demo/** ← diesen Link schicken
   (Startseite mit Erklärung: https://itaxizu12.github.io/4inOne/)

Der Workflow startet bewusst **nur von Hand** — ein normaler Push veröffentlicht nichts.

Lokal ansehen, bevor du veröffentlichst:

```bash
cd frontend && npm run build:pages
```

Das Ergebnis liegt in `frontend/dist/frontend/browser` (Basis `/4inOne/`).

## Gut zu wissen

- Die Seite ist **öffentlich**: Wer den Link hat, kann sie öffnen. Das ist unkritisch, weil nur Beispieldaten drin sind.
- Dein Repository ist bereits öffentlich. Zugangsdaten (`.env`), Datenbank und hochgeladene Dateien sind über
  `.gitignore` ausgeschlossen und waren nie in der Git-Historie — so muss es bleiben.
- GitHub Pages erlaubt keine eigenen Sicherheits-Header (CSP, HSTS …) wie in `deploy/nginx/`. Für eine reine Demo
  ohne Konten ist das vertretbar, für die echte App nicht.
- Direkte Tiefenlinks (z. B. `…/demo/haushalt`) funktionieren; GitHub liefert sie technisch über `404.html` aus, die App
  zeigt trotzdem die richtige Seite. Zum Teilen den Link `…/demo/` nehmen (der liefert eine normale Seite, gut für
  Link-Vorschauen in Messengern).

## Vor dem Livegang entfernen

- `.github/workflows/pages.yml` löschen und unter Settings › Pages die Seite abschalten („Unpublish site“).
- `frontend/scripts/build-pages.mjs`, `frontend/src/environments/environment.pages.ts`, Build-Konfiguration `pages`
  in `frontend/angular.json` und `"build:pages"` in `frontend/package.json` entfernen.
- `DEMO_ONLY` (`frontend/src/app/core/demo-only.ts`) und seine Verwendungen entfernen: `app.routes.ts`,
  `app.config.ts`, Landingpage, `public-shell`, `header`, `tile-footer`, `app-shell` (jeweils `@if (!demoOnly)`).
