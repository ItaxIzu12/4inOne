# Lokale Datenbank: PostgreSQL in Docker (seit 15.11.2026)

Lokal läuft 4inOne mit **PostgreSQL 16** in Docker — derselben Datenbank wie auf dem Server (Ubuntu 24.04,
`deploy/ANLEITUNG.md`) und in der CI. SQLite wird nur noch für die Wegwerf-Datenbank der Full-Stack-Tests benutzt
(`frontend/playwright.fullstack.config.ts`) und als Rückfall, wenn `DATABASE_URL` fehlt.

Django und Angular laufen weiterhin direkt auf dem Rechner (venv bzw. `ng serve`), nur PostgreSQL und Redis im
Container.

## Erste Einrichtung

Voraussetzung: Docker Desktop läuft, `backend/.venv` ist eingerichtet, `backend/.env` existiert (Vorlage `.env.example`).

```bash
./scripts/dev-db.sh init           # ergänzt POSTGRES_* und DATABASE_URL in backend/.env (Zufallspasswort)
./scripts/dev-db.sh up             # startet PostgreSQL + Redis
./scripts/dev-db.sh migrate        # Tabellen anlegen
# nur wer noch Daten in backend/db.sqlite3 hat — einmalig:
./scripts/dev-db.sh import-sqlite
```

`import-sqlite` sichert vorher `db.sqlite3` nach `backups/`, übernimmt alle Zeilen (auch weich gelöschte, `dumpdata
--all`), zieht die ID-Zähler nach und vergleicht am Ende die Zeilenzahl jeder Tabelle. Es läuft nur in eine leere
Datenbank. `db.sqlite3` bleibt unverändert liegen und wird danach nicht mehr benutzt.

## Alltag

**Am einfachsten — alles mit einem Befehl:** `./scripts/4inone.sh` startet Docker Desktop (falls nötig), Datenbank,
Backend und Frontend und öffnet den Browser; fehlen Migrationen, fragt es nach. `./scripts/4inone.sh stop` hält alles
wieder an, `./scripts/4inone.sh status` zeigt den Stand. Protokolle in `.run/`. Mit `start --mit-monitoring` auch
GlitchTip.

Einzeln:

| Befehl | Wirkung |
| --- | --- |
| `./scripts/dev-db.sh up` / `down` | starten / anhalten (Daten bleiben im Docker-Volume `4inone_postgres_data`) |
| `docker compose stop` / `start` / `logs postgres` | geht auch direkt, sobald `init` einmal lief |
| `./scripts/dev-db.sh status` | Container, Größe, und welche Datenbank Django gerade nutzt |
| `./scripts/dev-db.sh psql` | SQL-Konsole |
| `./scripts/dev-db.sh dump` | Sicherung nach `backups/` (Format wie auf dem Server, `pg_restore` geht in beide Richtungen) |
| `./scripts/dev-db.sh reset` | Datenbank löschen und leer neu anlegen (fragt nach) |

Tests (`pytest`) laufen automatisch gegen PostgreSQL: pytest-django legt eine eigene Datenbank `test_fourinone`
an und löscht sie wieder — die Entwicklungsdaten bleiben unberührt.

## Was ins Repository gehört

- **Ja:** `docker-compose.yml`, `scripts/dev-db.sh`, `.env.example` — keine Geheimnisse, jede:r braucht sie.
- **Nein (in `.gitignore`):** `backend/.env` (Passwort, `SECRET_KEY`), `./.env` (nur Postgres-Werte, erzeugt), `backups/`,
  `*.sqlite3`, `*.dump`.

## Stolpersteine

- Port 5432 belegt (anderes Projekt oder lokal installiertes PostgreSQL): `POSTGRES_PORT=5433` in `backend/.env`
  setzen und den Port in `DATABASE_URL` anpassen.
- Docker liest **nicht** die ganze `backend/.env` (ein `$` im `SECRET_KEY` würde Compose als Variable deuten).
  `init` und `up` schreiben deshalb `./.env` im Projektordner mit **nur** den `POSTGRES_*`-Werten (in `.gitignore`,
  Rechte 600). Die liest Compose von selbst — so funktionieren auch direkte Befehle wie `docker compose stop`,
  `docker compose logs postgres` oder `docker compose ps`. Quelle bleibt `backend/.env`; eine fremde `./.env` wird nie
  überschrieben.
- `finanzen/signals.py` legt beim Import (`raw=True`) keine Standardkategorien an — sonst gäbe es sie doppelt.
