# Rebranding 4inOne → Veyora — Migration

Stand 28.11.2026, Phase 1. Markenregeln: `docs/BRAND.md`.

## Grundsatz

Die **sichtbare Marke** heißt überall Veyora. **Technische Namen** bleiben, solange ihre Umbenennung Daten,
Sitzungen, Verschlüsselung, Verträge mit anderen Diensten oder laufende Server berühren würde. Kein globales Suchen
und Ersetzen; jede Gruppe unten ist bewusst entschieden.

## Phase 1 — umgestellt

| Bereich | Was | Risiko |
|---|---|---|
| Frontend | Seitentitel (`brandTitle()`), `index.html` (Titel, Open Graph), Manifest `name`/`short_name`, `robots.txt`, Schriftzug `<app-brand>`, alle Fließtexte, Aria-Beschriftungen, Copyright | keins; Manifest hat kein `id`, installierte Apps behalten ihre Identität (`start_url` unverändert) |
| Frontend | Download-Namen `veyora-backup-codes.txt`, Rückfall `veyora-daten.zip` | keins |
| Frontend | `public/og-image.png` neu erzeugt | Teilen-Vorschauen sind bei Diensten zwischengespeichert und aktualisieren sich verzögert |
| Backend | E-Mails (Passwort, Bestätigung, Einladung, Erinnerung), Export-README und Dateiname `veyora-daten-JJJJ-MM-TT.zip`, Finanzbericht (CSV/PDF), Hinweistexte der Verknüpfungen, Kommentare | keins |
| Backend | `OTP_TOTP_ISSUER = 'Veyora'` | nur die Beschriftung neuer Einträge in Authenticator-Apps; bestehende Einträge heißen weiter „4inOne“ und ihre Codes gelten unverändert |
| Backend | Standard-Absender `Veyora <no-reply@veyora.local>` (nur Entwicklung; im Betrieb kommt `DEFAULT_FROM_EMAIL` aus der Umgebung) | keins; in der Server-`.env` den Anzeigenamen selbst anpassen |
| Backend | `User-Agent` an Photon, EZB, Kalender-Abos: `Veyora/1 …` | keins |
| Backend | Auswahltext Beta-Feedback T5 → Migration `core/0022` | reine Zustandsänderung, `sqlmigrate` erzeugt kein SQL; der gespeicherte Wert `T5` bleibt |
| Doku | Titel von `AGENTS.md`, `CLAUDE.md`, `README.md`, `DESIGN.md`, `docs/DESIGN_SYSTEM.md`; neu `docs/BRAND.md`, diese Datei | — |
| CI | `npm run check:brand` in `.github/workflows/tests.yml` | — |

## Bewusst beibehalten

| Name | Wo | Warum |
|---|---|---|
| `4inone-bordkarte:` | `backend/reisen/boarding.py` (Schlüsselableitung) | Gespeicherte Bordkarten-Codes sind damit verschlüsselt. Umbenennen macht sie **unlesbar**. Nie ändern ohne Neuverschlüsselung. |
| `4inone-ai:` | `backend/integrations/ai/client.py` (HMAC) | Signatur, die der Personal AI Core prüft; gemeinsamer Standard |
| `AI_APPLICATION_ID` Standard `4inone` | `backend/config/settings.py` | Kennung gegenüber dem Personal AI Core; nur gemeinsam mit dem Core ändern (per Umgebung möglich) |
| `4inone.oauth.*` | `backend/core/social_views.py` (Signatur-Salz) | Wechsel bricht laufende Google/Apple-Anmeldungen; ohne Nutzen |
| `4inone.E001/W001/W002` | `backend/core/checks.py` | IDs der Systemprüfungen; könnten in `SILENCED_SYSTEM_CHECKS` stehen |
| Cookie `4io_signed_in` | Backend + nginx (`$fourinone_home`) | steuert, welche Startseite nginx ausliefert; Umbenennen meldet Startseiten-Logik ab, bis alle neu angemeldet sind |
| Django-Apps, Tabellen, Migrationen, API-Pfade | Backend | tragen den alten Namen ohnehin nicht (`finanzen`, `haushalt`, …) |
| `/srv/4inone`, Nutzer `4inone`, `4inone.service`, `4inone-docker@….service`/Timer, `4inone-*.conf` | `deploy/` | laufender Server; Umbenennen = Umzug mit Ausfallzeit (Phase 4) |
| Volume `4inone_postgres_data`, Compose-Projekt, `4inone-data` | `deploy/docker` | ein neuer Projektname legt **leere neue Volumes** an; nur mit Umzugsplan |
| Backups `4inone_*.tar.age`, Schlüssel `4inone-backup.key` | `deploy/docker/run-task.sh`, Anleitungen | das Aufräumen löscht alte Backups über dieses Muster; ein neuer Name ließe alte Dateien liegen und alte Anleitungen ins Leere laufen |
| Domain `4inone.de` | Doku, Testdaten | bis eine Veyora-Domain existiert |
| Repository `ItaxIzu12/4inOne`, Pages-Pfad `/4inOne/` | `demo-contact.ts`, `build-pages.mjs` | Repository wird nur mit Freigabe umbenannt; GitHub leitet alte URLs danach weiter |
| `scripts/4inone.sh`, `monitoring/` | Entwicklerwerkzeuge | kein sichtbarer Teil der Marke |
| Historische Einträge in `docs/` | Changelogs, Audits | dokumentieren den damaligen Stand |

## Später (je eigene Freigabe)

- **Logo:** Orbit-Logo nach Vorlage → `<app-brand>`, `favicon.svg/.ico`, `apple-touch-icon.png`, `icon-512.png`,
  Maskable-Icon im Manifest, Teilen-Bild, Landing-Screenshots.
- **Repository umbenennen:** auf GitHub umbenennen, `DEMO_FEEDBACK_URL`, `PAGES_BASE`-Standard und Remote-URL
  anpassen; `check-brand.mjs`-Ausnahmen entfernen.
- **Infrastruktur (Phase 4):** neue Domain, dann Server-Pfade, Units, nginx-Dateien, Compose-Projekt mit
  `name:`-Festlegung oder `external`-Volumes, damit die vorhandenen Daten weiter genutzt werden. Backups vorher
  sichern und das Aufräumen auf beide Muster erweitern. Vorher Testlauf in einem Container.

## Rollback

Phase 1 ändert nur Texte, eine Bilddatei, ein Prüfskript und eine SQL-freie Migration.

- Code: den Commit zurücknehmen (`git revert <commit>`).
- Migration `core/0022`: kann bleiben oder mit `manage.py migrate core 0021` zurückgenommen werden; beides berührt
  keine Daten.
- Keine Datenbank-, Volume-, Secret- oder Serveränderung zu bedenken.
