# 4inOne — Architektur (Ist-Analyse, Zielbild, Refactoring-Plan)

**Stand:** 24.11.2026 · **Gilt für:** Backend (`backend/`), Frontend (`frontend/`), Betrieb (`deploy/`, `docker-compose.yml`).
**KI-Anbindung:** eigenes Dokument [`AI_INTEGRATION.md`](AI_INTEGRATION.md).
**Rangfolge:** wie in `AGENTS.md` (dieses Dokument steht an Stelle 8). Die historische `ARCHITEKTUR.md` im Wurzelordner
bleibt Hintergrund für Code-Kommentare; bei Widersprüchen gilt dieses Dokument.

**Freigabe:** Der Maßnahmenplan (§ 4) ist ein Vorschlag. Umgesetzt wird erst nach Freigabe durch den Nutzer, Phase für
Phase (`docs/DECISIONS.md` D19).

Leitsatz: **4inOne ist bereits ein modularer Monolith.** Das Ziel ist kein Umbau, sondern die Abhängigkeitsrichtungen
klarer machen, den Betrieb auf dem eigenen Mini-PC vorbereiten und eine schmale, abschaltbare KI-Schnittstelle schaffen.
Bestehende Funktionen und Daten bleiben unverändert erhalten.

---

## 0. Kurzfassung

| Thema | Befund | Konsequenz |
|---|---|---|
| Grundform | Ein Django-Projekt, je Bereich eine App, eine Angular-App mit Bereichsordnern, eine PostgreSQL-Datenbank | Beibehalten. Keine Microservices. |
| Fachliche Trennung | Die vier Bereiche importieren sich fast nicht gegenseitig; Querverbindungen laufen über `connections` | Beibehalten, zwei Ausnahmen sauber kapseln (S4) |
| Schwachstelle Nr. 1 | Wartungsjobs (`cleanup_expired`, `prune_connections`, Erinnerungen, Kalender-Abos) waren im Server-Betrieb nicht eingeplant | **Behoben 24.11.2026** (Phase 0) |
| Schwachstelle Nr. 2 | `core` war Kern **und** Orchestrator: es importierte alle Bereiche | **Behoben 24.11.2026** (Phase 2: `core/registry.py`, Architekturtest) |
| Betrieb | Entwicklung: Compose nur für Postgres/Redis; Server: systemd + nginx auf Ubuntu | **Seit 24.11.2026 zusätzlich** Produktions-Compose `deploy/docker/` für den GEEKOM (Phase 3); systemd-Weg bleibt gültig |
| KI | Regeln deterministisch; **seit 24.11.2026** Client-Gerüst `integrations/ai/`, standardmäßig aus, keine Fähigkeit aktiv | Erste Fähigkeit erst nach eigener Freigabe (`AI_INTEGRATION.md` § 10) |

---

## 1. Ist-Analyse

### 1.1 Gesamtbild

```text
Browser (Angular 22, PWA)            ──HTTPS──▶  nginx  ──▶  gunicorn (Django 6 / DRF)  ──▶  PostgreSQL 16
  • Standalone-Komponenten, Signals                  │                 │                       (eigene DB)
  • Bereichsordner + Demo-Provider                   │                 ├──▶ Redis (Cache)          
  • Service Worker (nur App-Dateien)                 │                 ├──▶ externe Dienste mit Timeout:
                                                     │                 │     EZB-Kurse, Photon-Orte, OAuth,
  statische Dateien ◀────────────────────────────────┘                 │     Kalender-Abos (iCal)
                                                                       └──▶ privates Dateiverzeichnis
                                                                             (PRIVATE_MEDIA_ROOT)
systemd-Timer: Backup (pg_dump + Dateien, age-verschlüsselt) · Aufräumen · (GlitchTip separat, optional)
```

- **Authentifizierung:** JWT (Access 15 min im Speicher, Refresh als HttpOnly-Cookie mit Rotation und Blacklist),
  TOTP-MFA, Google/Apple-Login, `django-axes`, Drosselung je Endpunkt (`RATE_LIMIT_*`).
- **Autorisierung:** im Backend je Objekt (Haushalt, Reise-Teilnehmer, geteilte Kalender, Ownership nach
  `docs/ADR-001-OWNERSHIP.md`); abgesichert durch `core/test_permission_matrix.py`, das jede Detail-View erfassen muss.
- **Querschnitt:** Idempotenz-Schlüssel (`core/idempotency.py`), Wiederholungen (`core/recurrence.py`), Benachrichtigungen
  und Erinnerungen, Wechselkurse (`core/fx.py`), Datenexport (`datenexport/`), Monitoring (`monitoring/`, GlitchTip).
- **Tests/CI:** GitHub Actions mit PostgreSQL 16: `check`, `makemigrations --check`, ~1300 pytest-Tests, `pip-audit`;
  Frontend: Build, ~560 Vitest-Tests, Playwright (Chromium, Mobile Safari, Fullstack gegen echtes Django).

### 1.2 Backend-Apps (gemessen 24.11.2026, ohne Migrationen)

| App | Rolle | Python-Dateien | Zeilen | Testdateien | Migrationen |
|---|---|---:|---:|---:|---:|
| `core` | Konten, Anmeldung, Haushalt/Mitglieder, Kontakte, Einladungen, Benachrichtigungen, Querschnitt | 68 | 9 123 | 23 | 21 |
| `finanzen` | Buchungen, Kategorien, Budgets, Sparziele, Abzüge, Import | 43 | 6 811 | 25 | 23 |
| `haushalt` | Aufgaben/Routinen, Einkauf, Zuhause (Verträge, Geräte, Ordner) | 18 | 3 907 | 7 | 11 |
| `organisation` | Kalender, Aufgaben, Notizen, geteilte Kalender, Abos, Dateien | 24 | 3 316 | 7 | 9 |
| `reisen` | Reisen, Ablauf, Planung, Packliste, Budget/Aufteilung, Bordkarten | 20 | 3 534 | 8 | 15 |
| `connections` | Connection Engine: Verbindungen, Vorschläge, abgeleitete Verbindungen (AutoLink), Suche, „Heute“ | 37 | 7 285 | 16 | 6 |
| `datenexport` | DSGVO-Export aller eigenen Daten | 5 | 491 | 1 | 0 |
| `monitoring` | Admin-Panel, Anmelde-Ereignisse | 14 | 841 | 1 | 1 |
| `website` | öffentliche Seitenzählung | 10 | 187 | 1 | 2 |
| `integrations` | seit 24.11.2026: abschaltbarer KI-Client `integrations/ai/` (keine Modelle, keine URLs) | – | – | – | 0 |

### 1.3 Abhängigkeiten zwischen den Apps

Gezählt: `import`/`from`-Zeilen außerhalb von Tests und Migrationen (Zeile = abhängige App, Spalte = genutzte App).

| ↓ nutzt → | core | finanzen | haushalt | organisation | reisen | connections |
|---|---:|---:|---:|---:|---:|---:|
| **core** | – | 3 | 4 | 11 | 7 | 2 |
| **finanzen** | 12 | – | 0 | 0 | 0 | 1 |
| **haushalt** | 10 | 3 | – | 2 | 0 | 0 |
| **organisation** | 7 | 0 | 0 | – | 0 | 0 |
| **reisen** | 7 | 0 | 0 | 0 | – | 0 |
| **connections** | 3 | 9 | 20 | 6 | 10 | – |

Lesart:

- **Gut:** Die vier Bereiche sind fast unabhängig voneinander. `organisation` und `reisen` hängen nur an `core`.
  `connections` ist die eine Stelle, die alle Bereiche kennt, und das ist gewollt (Registry `connections/registry.py`).
- **Ausnahme 1:** `haushalt → finanzen` (`book_shopping_expense`, `Category`): Ein Einkauf wird nach Bestätigung als
  Ausgabe gebucht. Das ist ein bewusster, sichtbarer Aufruf, läuft aber an der Connection Engine vorbei.
- **Ausnahme 2:** `haushalt → organisation` (`private_storage`, Datei-Regeln): technische Wiederverwendung der
  Dateiablage. Sie gehört eigentlich in `core`.
- **Umkehrung:** `core` importiert alle Bereiche (verzögert, innerhalb von Funktionen): Onboarding-Status,
  Einladungen (Reise/Kalender), Kontakte, Erinnerungen, Ortsvorschläge, Signale, `cleanup_expired`, Beta-Berichte.
  Damit ist `core` gleichzeitig Basis und Orchestrator. Das funktioniert, verschleiert aber Zyklen (S3).

**Stand nach Phase 1/2 (24.11.2026):** Die Tabelle oben zeigt den Ausgangszustand. Heute gilt:

- `core` importiert keinen Bereich mehr. Onboarding, Startleitfaden, Ortsvorschläge, Kontakt-Übersicht, Einladungen
  (Reise, Kalender), Signale, Haushalts-Austritt und Aufräumregeln melden die Bereiche über `core/registry.py` an
  (`<bereich>/core_hooks.py`, aufgerufen in `apps.py › ready()`). Erinnerungs-Mails und Beta-Nutzungsbericht liegen in
  `connections` (Orchestrierung).
- Dateiablage und Upload-Prüfung liegen in `core/files.py`.
- `haushalt → finanzen` läuft über `finanzen/public.py`; `finanzen` holt die abgeleiteten „Geplant“-Posten über
  den Anmeldepunkt `PLANNED_EXPENSES` statt `connections` zu importieren.
- `backend/core/test_architecture.py` prüft die Regeln aus § 3.1 bei jedem Testlauf; die Erlaubt-Liste ist leer.

### 1.4 Connection Engine (Stand)

Die Engine erfüllt die geforderten Regeln bereits heute deterministisch und ohne KI:

| Anforderung | Umsetzung |
|---|---|
| Keine doppelten Datensätze | Manuelle Verbindungen: Unique-/Check-Constraints (kein Selbst-Link, keine Duplikate). Abgeleitete Verbindungen (`AutoLink`): höchstens eine Zeile je Person, Art und Quelle; die abgeleiteten Einträge (geplante Ausgabe, Kalendereintrag) werden **beim Lesen berechnet, nicht gespeichert** und können sich deshalb nicht verdoppeln. |
| Keine unkontrollierten Änderungen | Abgeleitetes ändert nur die Zukunft („Geplant“), gebuchte Ausgaben, Termine und Aufgaben werden nie angefasst. Ein Einkauf wird erst nach Bestätigung zur Ausgabe. |
| Keine zirkulären Automatisierungen | Es gibt genau **eine** Quelle je Ableitung (Vertrag, Gerät, Reise, Sparziel); Abgeleitetes erzeugt nichts weiter. Keine Signal-Ketten zwischen Bereichen; `connections/signals.py` räumt nur beim Löschen auf. |
| Rechte | Jede Quelle wird bei jedem Lesen gegen ihre eigene Regel geprüft; Verbindungen geben nie Zugang (`AGENTS.md`). |
| Nachvollziehbarkeit | `AutoLinkEvent` protokolliert Anlegen/Pausieren/Lösen; Vorschläge erklären sich selbst, Ablehnungen bleiben gespeichert (`SuggestionDismissal`). |

Abgeleitete Arten heute: `CONTRACT_FINANCE`, `CONTRACT_REMINDER`, `DEVICE_MAINTENANCE`, `TRIP_CALENDAR`, `TRIP_ITINERARY`,
`TRIP_FINANCE` u. a. (`connections/models.py › AutoKind`). Details: `docs/CONNECTION_ENGINE.md`.

### 1.5 Frontend

- Angular 22, Standalone-Komponenten, Signals, verzögert geladene Bereiche (`/finanzen`, `/haushalt`, …) und `/demo`.
- Struktur nach den verbindlichen Regeln unten (§ 8): `core/`, `layout/`, `shared/{ui,features,utils,styles}`,
  `features/<bereich>/{<reiter>/,data/,shared/}`.
- Größte Bereiche (Zeilen inkl. HTML/SCSS): Haushalt 11 900, Reisen 10 000, Finanzen 9 600, Organisation 7 600,
  `shared/` 12 000. Größte Einzeldateien: `travel/travel.ts` (1 641), `dashboard/dashboard.ts` (968),
  `organization/organization.ts` (859).
- **Demo:** je Bereich ein In-Memory-Provider statt HTTP (≈ 3 300 Zeilen). Er hält Teile der Fachlogik ein zweites Mal
  (z. B. Aufteilen, Planwerte) und ist durch E2E-Tests abgesichert.
- **PWA/local-first:** Service Worker für App-Dateien; offline nutzbar sind Einkaufsliste (mit Warteschlange) und
  Bordkarten. API-Antworten werden bewusst nicht vom Service Worker zwischengespeichert; Geräte-Daten werden beim
  Abmelden gelöscht (`core/offline/offline-keys.ts`).

### 1.6 Betrieb

| Ebene | Heute |
|---|---|
| Entwicklung | `docker-compose.yml`: PostgreSQL 16 + Redis, nur `127.0.0.1`; Django/Angular laufen auf dem Rechner. `scripts/dev-db.sh` (init/up/dump/migrate). |
| Server | `deploy/ANLEITUNG.md`: Ubuntu, PostgreSQL und Redis nativ, gunicorn (3 Worker) per systemd, nginx mit strikter CSP, Let's Encrypt. |
| Backup | `deploy/scripts/backup.sh`: `pg_dump` + Dateien, verschlüsselt mit `age` (öffentlicher Schlüssel auf dem Server), 14 Tage lokal, optional `rsync` an einen zweiten Ort; Rücksicherung beschrieben und testbar. |
| Zeitpläne | systemd-Timer (seit 24.11.2026 vollständig): Backup 02:45, Aufräumen 03:15 (`cleanup_expired`, `prune_connections`), 03:30 (`prune_website`, `prune_auth_events`), Erinnerungen 07:00, Kalender-Abos stündlich. |
| Geheimnisse | `backend/.env` (nicht im Repository), `.env.example` dokumentiert jede Variable. |
| Monitoring | GlitchTip als eigene Compose (`monitoring/compose.yml`, PostgreSQL 18 + GlitchTip), optional. |

---

## 2. Technische Schwachstellen

Bewertung: **Risiko** (was passiert, wenn es bleibt) und **Aufwand** (S ≤ ½ Tag, M ≤ 2 Tage, L > 2 Tage).

| ID | Befund | Beleg | Risiko | Aufwand |
|---|---|---|---|---|
| **S1** | Wartungsbefehle laufen im Server-Betrieb nicht: `cleanup_expired` (abgelaufene Tokens, Sitzungen, Idempotenz-Schlüssel, Bordkarten nach der Reise), `prune_connections` sowie die in `docs/GO_LIVE.md` beschriebenen `send_reminder_emails` und `refresh_calendar_subscriptions` haben keinen systemd-Timer. | `deploy/systemd/4inone-prune.service` startet nur `prune_website`, `prune_auth_events` | **Behoben 24.11.2026:** Timer `4inone-cleanup`, `-reminders`, `-calendars`; Test `core/test_deploy_schedule.py` | – |
| **S2** | Dokumentation widerspricht der Wirklichkeit: `AGENTS.md` und die alte Fassung dieses Dokuments nennen „SQLite jetzt“, tatsächlich laufen Entwicklung, CI und Server auf PostgreSQL 16. | `AGENTS.md` › Technology direction | **Behoben 24.11.2026** (`AGENTS.md` korrigiert) | – |
| **S3** | `core` ist Basis und Orchestrator zugleich: es importiert alle vier Bereiche (Onboarding, Einladungen, Kontakte, Erinnerungen, Orte, Signale, Aufräumen). | § 1.3 | **Behoben 24.11.2026** (`core/registry.py`, `<bereich>/core_hooks.py`) | – |
| **S4** | Zwei direkte Bereichskopplungen am Connection-Modell vorbei: `haushalt → finanzen` (Einkauf bucht Ausgabe) und `haushalt → organisation` (Dateiablage). | `haushalt/services.py`, `haushalt/models.py` | **Behoben 24.11.2026** (`finanzen/public.py`, `core/files.py`) | – |
| **S5** | Keine stabile „öffentliche Schnittstelle“ je Bereich: andere Apps greifen direkt auf Modelle und interne Funktionen zu (`connections` z. B. 20× auf `haushalt`). | § 1.3 | **Entschieden 24.11.2026:** Bereiche untereinander nur über `public.py` (Test). Weitere `public.py` entstehen, sobald ein anderer Bereich sie braucht; `connections` (Ebene 3) darf Modelle direkt nutzen | – |
| **S6** | Zwei Betriebswege, keiner passt genau zum Ziel: Compose nur für die Entwicklung, Produktion nativ per systemd. Für den GEEKOM (Docker-basiert) fehlen Produktions-Compose, Dockerfiles und ein Ressourcenbudget. | `docker-compose.yml`, `deploy/` | **Behoben 24.11.2026** (`deploy/docker/`, Probelauf mit Messung) | – |
| **S7** | Externe Aufrufe laufen synchron im Request (Kalender-Abo bis 8 s, OAuth 8 s, Orte 3 s, EZB 5 s) mit gunicorn-Timeout 30 s und ohne Worker. Für heutige Aufrufe ausreichend, für KI (Sekunden bis Minuten) nicht. | `core/social.py`, `organisation/subscriptions.py` | Mittel für KI; heute niedrig | M (siehe `AI_INTEGRATION.md`) |
| **S8** | Leere App `integrations` (Gerüst seit Projektbeginn). | `backend/integrations/` | **Behoben 24.11.2026:** Heimat des KI-Clients (Phase 4) | – |
| **S9** | Sehr große Dateien: `travel.ts` (1 641 Z.), `dashboard.ts`, `organization.ts`, `haushalt/services.py` (707), `core/auth_views.py` (652). | § 1.5 | Niedrig–mittel: Änderungen werden riskanter | M je Datei |
| **S10** | Demo-Provider wiederholen Fachlogik im Frontend. | `features/*/data/demo-*` | Niedrig: Abweichungen zwischen Demo und echter App, durch E2E teilweise abgefangen | L (nicht empfohlen, s. u.) |
| **S11** | Ressourcenbedarf auf dem Mini-PC ungeklärt: gunicorn 3 Worker, Redis, GlitchTip (eigene PostgreSQL 18) **und** künftig ein lokales Sprachmodell im Personal AI Core teilen sich 16 GB RAM. | `deploy/systemd/4inone.service`, `monitoring/compose.yml` | **Behoben 24.11.2026** (Grenzen in `deploy/docker/compose.yml`, gemessen ~230 MB im Leerlauf) | – |

Bewusst **keine** Schwachstellen (geprüft):

- Drosselung über mehrere Worker: `RATE_LIMIT_CACHE=database` ist in der Server-Anleitung gesetzt.
- Versehentlich SQLite in Produktion: `manage.py check --deploy` meldet das als Fehler (`core/checks.py`).
- Secrets im Repository: keine. `.env`-Dateien sind ignoriert, Compose liest Zugangsdaten aus `.env`.
- Doppelte oder zirkuläre Automatisierungen: durch „abgeleitet statt kopiert“ ausgeschlossen (§ 1.4).

---

## 3. Empfohlene modulare Zielstruktur

Die Zielstruktur ist eine **Schärfung der heutigen**, kein neues Gerüst. App-Namen und Datenbanktabellen bleiben.

### 3.1 Schichten und Abhängigkeitsregel (Backend)

```text
                ┌──────────────────────────────────────────────┐
  Ebene 3       │ Orchestrierung: connections · onboarding/     │  darf alles darunter nutzen
                │ heute · datenexport · (künftig) assistenz     │
                └──────────────────────────────────────────────┘
                ┌────────────┬────────────┬──────────────┬───────┐
  Ebene 2       │ finanzen   │ haushalt   │ organisation │ reisen│  nutzen nur Ebene 1,
                └────────────┴────────────┴──────────────┴───────┘  nie einander direkt
                ┌──────────────────────────────────────────────┐
  Ebene 1       │ core (Konten, Haushalt, Rechte, Dateien,     │  nutzt keine Bereiche
                │ Benachrichtigungen, Währung, Wiederholung)   │
                │ integrations (externe Dienste, KI-Client)    │
                └──────────────────────────────────────────────┘
```

Regeln:

1. **Ebene 1 importiert keine Bereiche.** Braucht `core` Wissen aus Bereichen (z. B. „hat die Person schon Daten?“),
   melden die Bereiche das über eine kleine Registry an (`core/registry.py`, Muster wie `connections/registry.py`).
2. **Bereiche importieren einander nicht.** Was über Bereichsgrenzen geht, läuft über `connections` (Verbindung oder
   abgeleitete Ansicht) oder über die öffentliche Schnittstelle eines Bereichs.
3. **Jeder Bereich hat eine öffentliche Schnittstelle** `<app>/public.py`: Funktionen und Lesemodelle, die andere
   nutzen dürfen (z. B. `finanzen.public.book_expense(...)`, `haushalt.public.contracts_for(user)`). Modelle und
   interne Funktionen bleiben privat. Prüfbar mit einem Architekturtest (Import-Regeln, s. Phase 2).
4. **Schreiblogik in `services.py`**, Views bleiben dünn (wie heute weitgehend in `haushalt`, `finanzen`, `connections`).
   Keine bereichsübergreifenden Seiteneffekte in `save()` oder Signalen.
5. **Externe Dienste nur über `integrations/`** mit Timeout, Feature-Schalter und definiertem Verhalten bei Ausfall
   (Vorbild `core/fx.py`). Die KI-Schnittstelle folgt genau diesem Muster.

### 3.2 Zielbild je App

| App | bleibt | ändert sich |
|---|---|---|
| `core` | Konten, Anmeldung, Haushalt, Kontakte, Benachrichtigungen, Querschnitt | Bereichswissen raus: Onboarding-Status, Einladungs-Ziele, Erinnerungs-Inhalte und Aufräum-Regeln melden sich über `core/registry.py` an; Dateiablage (`private_storage`, Upload-Prüfung) zieht von `organisation` nach `core/files.py` |
| `finanzen`, `haushalt`, `organisation`, `reisen` | Modelle, Views, Serializer, Services | je ein `public.py`; `haushalt` bucht über `finanzen.public` statt über interne Services |
| `connections` | Engine, Registry, Vorschläge, „Heute“, Suche | greift nur über `public.py` der Bereiche zu (schrittweise) |
| `integrations` | KI-Client `integrations/ai/` (seit 24.11.2026, abschaltbar) | später ggf. weitere externe Clients (Kalender, Orte) |
| `datenexport`, `monitoring`, `website` | unverändert | – |

### 3.3 Frontend

Die verbindlichen Regeln in § 8 bleiben. Ergänzungen:

- Große Container-Komponenten (`travel.ts`, `dashboard.ts`, `organization.ts`) entlang der Reiter in Zustands-Services
  (`<bereich>/data/<bereich>-store.ts`) und Reiter-Komponenten zerlegen, **nur wenn** an ihnen ohnehin gearbeitet wird.
- KI-Vorschläge erscheinen im Frontend nie als eigener „KI-Tab“, sondern in den bestehenden Dialogen als vorausgefüllte,
  markierte Felder (siehe `AI_INTEGRATION.md`). Ein gemeinsamer Baustein `shared/ui/suggestion-hint` genügt.
- Demo-Provider bleiben (S10). Eine gemeinsame Fachlogik zwischen Demo und Backend würde den Monolithen nicht
  vereinfachen. Abweichungen fangen die E2E-Tests ab.

### 3.4 Datenhaltung

- **Eine eigene PostgreSQL-Datenbank** nur für 4inOne. Kein gemeinsamer Datenbankzugriff mit dem Personal AI Core oder
  anderen Anwendungen. Austausch nur über authentifizierte APIs.
- Geld als `Decimal`, Zeitzone `Europe/Berlin`, Constraints in der Datenbank (wie heute).
- Local-first bleibt gezielt: Offline-Lesen/Abhaken dort, wo es im Alltag zählt (Einkauf, Bordkarte). Eine allgemeine
  Offline-Synchronisation aller Bereiche ist **nicht** geplant (hoher Aufwand, Konfliktauflösung, wenig Nutzen für eine
  selbst gehostete Instanz im eigenen Netz).

---

## 4. Schrittweiser Refactoring-Plan

Jede Phase ist einzeln lieferbar, ändert keine Daten (keine destruktiven Migrationen) und wird durch die bestehenden
Tests plus neue Architekturtests abgesichert.

### Phase 0 — Betriebslücken schließen (sofort, ~½ Tag)

1. ~~systemd-Timer für `cleanup_expired`/`prune_connections` (03:15), `send_reminder_emails` (07:00) und
   `refresh_calendar_subscriptions` (stündlich), Anleitung ergänzt. (S1)~~ erledigt 24.11.2026; jeder neue
   Wartungsbefehl braucht einen Timer (Test `core/test_deploy_schedule.py`).
2. ~~`AGENTS.md` › Technology direction auf PostgreSQL korrigieren. (S2)~~ erledigt 24.11.2026.
3. ~~Entscheidung zu `integrations`~~: bleibt als Heimat für externe Dienste und den KI-Client (Phase 4); bis dahin
   unverändert leer. (S8, entschieden 24.11.2026)

### Phase 1 — Abhängigkeiten sichtbar machen ✅ (24.11.2026)

1. `backend/core/test_architecture.py`: liest alle Imports (AST, auch verzögerte) und prüft § 3.1; Erlaubt-Liste mit
   Begründung (leer), veraltete Ausnahmen lassen den Test ebenfalls scheitern; Gegenprobe im Test.
2. Frontend: `npm run check:architecture` (`frontend/scripts/check-architecture.mjs`) prüft die Reiter-Regel aus § 8,
   läuft in CI vor den Unit-Tests. Dabei `travel/boarding/` nach `travel/shared/boarding/` verschoben.

### Phase 2 — `core` entflechten, öffentliche Schnittstellen ✅ (24.11.2026)

1. `core/registry.py` mit den Anmeldepunkten `HAS_USER_DATA`, `GUIDE_STEPS`, `PLACE_SOURCES`, `CONTACT_SHARING`,
   `CLEANUP_RULES`, `MEMBER_REMOVED`, `PLANNED_EXPENSES` und den Einladungsarten; Bereiche melden sich in
   `<bereich>/core_hooks.py` an. Code unverändert verschoben, Reihenfolge der Ausgaben über `order` stabil. (S3)
2. Dateiablage und Upload-Prüfung nach `core/files.py`; `organisation.models.private_storage` bleibt als
   Weiterleitung, weil eine Migration auf den Namen zeigt. (S4)
3. `finanzen/public.py` (`book_shopping_expense`, `Category`, `month_bounds`, `PRIVATE_SHOPPING_CATEGORY`);
   `haushalt` nutzt nur noch diese Schnittstelle. Weitere `public.py` erst bei Bedarf. (S4, S5)
4. `send_reminder_emails` samt `reminders.py` und `beta_usage_report` nach `connections` (Befehlsnamen gleich).
   Keine Migration, keine Datenänderung.

### Phase 3 — Betrieb auf dem GEEKOM GT1 Mega ✅ (24.11.2026)

`deploy/docker/` (Anleitung: `deploy/docker/ANLEITUNG.md`), zusätzlich zum systemd-Weg:

1. `compose.yml` mit `postgres` (16, eigene DB), `redis` (nur Cache, ohne Platte), `backend` (gunicorn, 2 Worker,
   nicht-root, schreibgeschützt, ohne Capabilities), `web` (nginx mit Angular-Build, HTTPS, gleiche Regeln wie
   `deploy/nginx/4inone.conf`); nur `web` hat Ports; Daten in festen Verzeichnissen unter `DATA_DIR`; Speicher-/CPU-
   Grenzen je Dienst; Logs begrenzt. `backend.Dockerfile`, `web.Dockerfile`, `.dockerignore` (keine Geheimnisse,
   keine Daten im Image).
2. Zeitpläne und Backup: `run-task.sh` + `systemd/4inone-docker@.service` und fünf Timer (gleiche Zeiten);
   Backup per `pg_dump` im Postgres-Container + `private_media`, `age`-verschlüsselt, Kopie an `BACKUP_REMOTE`.
3. Probelauf (lokal, Testdaten): Build, Migrationen, `check --deploy`, HTTPS-Start/Login/API/Admin, Registrieren,
   Reise, Bordkarten-Screenshot (zxing im Linux-Container), `pg_dump` → Wiederherstellung in eine neue Datenbank.
   Dabei behoben: nginx-Regex mit `{8}` musste in Anführungszeichen (galt auch für `deploy/nginx/4inone.conf`).

### Phase 4 — KI-Bereitschaft ✅ Gerüst (24.11.2026)

`integrations/ai/` (Schritt A aus `AI_INTEGRATION.md` § 10): Konfiguration, Client, Fehlerarten, Antwort-Schema,
Fähigkeiten-Register (leer), Fake-Core für Tests, `check --deploy`-Regeln. `AI_ENABLED=False` ist Standard; keine
Fähigkeit und keine Oberfläche aktiv. Erste nutzende Funktion erst nach eigener Freigabe (vgl. Smart Scan,
`docs/SMART_SCAN_V1_PLAN.md`).

### Phase 5 — bei Bedarf

- Große Frontend-Container zerlegen, wenn dort Arbeit ansteht (S9).
- Hintergrundjobs: erst wenn KI-Aufgaben länger als wenige Sekunden laufen. Dann zuerst eine schlanke
  Datenbank-Warteschlange (Tabelle + Management-Befehl per systemd/Compose), kein Celery (siehe `AI_INTEGRATION.md` § 6).

---

## 5. Personal-AI-Core-Anbindung (Kurzfassung)

```text
Angular ──▶ Django (Rechte, Regeln, Validierung) ──▶ integrations/ai (Client) ──HTTPS + Token──▶ Personal AI Core
                     ▲                                                                              │
                     └──────────── strukturierte Antwort (JSON-Schema), nur Vorschlag ◀─────────────┘
```

- Nur das Backend spricht mit dem AI Core, und zwar nur über den einen Adapter `integrations/ai` (gemeinsamer
  Standard, `AI_INTEGRATION.md` § 0): versionierte REST-API, Fähigkeiten-Abfrage über `/v1/capabilities`, Provider
  `core` oder `mock` (Entwicklung). Das Frontend kennt weder Adresse noch Token; 4inOne bindet kein Modell ein.
- Abschaltbar (`AI_ENABLED=False` als Standard). Ohne KI-Dienst funktioniert jede Funktion wie heute.
- KI liefert **Vorschläge**. Gespeichert wird erst nach Bestätigung über die bestehenden APIs. Finanzbuchungen und
  sensible Daten verändert die KI nie selbst.

Vollständiges Konzept: [`AI_INTEGRATION.md`](AI_INTEGRATION.md).

---

## 6. Priorisierung

| Rang | Maßnahme | Notwendigkeit | Aufwand | Wann |
|---:|---|---|---|---|
| 1 | ~~Wartungs-Timer ergänzen (S1)~~ | erledigt 24.11.2026 | – | – |
| 2 | ~~Doku korrigieren: PostgreSQL (S2)~~ | erledigt 24.11.2026 | – | – |
| 3 | ~~Architekturtest mit Erlaubt-Liste (Phase 1)~~ | erledigt 24.11.2026 | – | – |
| 4 | ~~Dateiablage nach `core`, `finanzen.public` für Einkauf (S4)~~ | erledigt 24.11.2026 | – | – |
| 5 | ~~`core/registry.py`, Bereichs-Imports aus `core` entfernen (S3)~~ | erledigt 24.11.2026 | – | – |
| 6 | ~~Produktions-Compose + Ressourcenbudget für den GEEKOM (S6, S11)~~ | erledigt 24.11.2026 | – | – |
| 7 | ~~KI-Client-Schnittstelle, abgeschaltet (Phase 4)~~ | erledigt 24.11.2026 | – | – |
| 8 | weitere `public.py` (S5) | niedrig | S je Bereich | wenn ein anderer Bereich sie braucht |
| 9 | Große Frontend-Dateien zerlegen (S9) | niedrig | M je Datei | bei Gelegenheit |
| – | Demo-Logik vereinheitlichen (S10) | niedrig | L | nicht empfohlen |
| – | Microservices, Event-Bus, Celery, allgemeine Offline-Synchronisation | – | L | bewusst nicht (`docs/DECISIONS.md` D14/D15) |

---

## 7. Infrastruktur: GEEKOM GT1 Mega (Intel Core Ultra 9 185H, 16 GB RAM, 1 TB SSD)

Richtwerte für den gemeinsamen Betrieb mit dem Personal AI Core (vor dem Umzug messen und anpassen):

| Dienst | RAM-Budget | Hinweis |
|---|---:|---|
| PostgreSQL 16 (4inOne) | 512 MB | `shared_buffers` 128–256 MB reichen für eine Person bzw. Familie |
| Redis | 64 MB | `maxmemory 64mb`, `allkeys-lru`; nur Cache |
| gunicorn (Django) | 2 × ~150 MB | **2 Worker** statt 3 genügen; Timeout 30 s bleibt |
| nginx | 32 MB | |
| GlitchTip (optional) | ~1 GB | nur bei Bedarf starten; Alternative: Fehler-Mails/Logs |
| **Summe 4inOne** | **≈ 1 GB** (+ 1 GB mit GlitchTip) | |
| Personal AI Core (lokales Modell) | Rest (8–12 GB) | eigener Stack, eigene Datenbank, **nicht** Teil von 4inOne |

- **Speicher:** Datenbank und Dateien im Bereich weniger GB; Backups 14 Tage lokal + Kopie außerhalb des Geräts
  (externer Datenträger oder zweiter Ort). Ein Backup auf derselben SSD schützt nicht vor deren Ausfall.
- **Netz:** 4inOne nur hinter nginx mit HTTPS; der AI Core lauscht im internen Docker-Netz oder auf `127.0.0.1`,
  nie öffentlich.
- **Konfiguration:** alles über Umgebungsvariablen (`.env.example` ist die vollständige Liste).

---

## 8. Verbindliche Strukturregeln (unverändert übernommen)

### Angular-Richtlinien

Guidance:

- avoid one giant dashboard component;
- avoid meaningless micro-components;
- preserve the project's current Angular best practices;
- reactive forms for nontrivial forms;
- Signals where they simplify local reactive UI state;
- separate server state concerns from presentational state;
- lazy-load larger areas where useful.

### Globale Ordner (verbindlich seit 21.11.2026)

```text
src/app/
├── core/              Dienste und Zustand ohne Oberfläche (Anmeldung, API, Haushalt, Währung, Monitoring …)
├── layout/            Seitenrahmen: App-Hülle, Kopfzeile, Fußzeile, Seitenleiste, untere Navigation, Glocke,
│                      öffentlicher Rahmen, Rechtsseiten-Gerüst, „nach oben“, Neu-laden-Hinweis
├── shared/
│   ├── ui/            wiederverwendbare Bausteine ohne Fachlogik: Formularfelder (form/ inkl. globaler
│   │                  form-controls.css und choice-controls.css), Dialog, Symbole, Marke, Abhak-Knopf
│   │                  (done-toggle), Fehler-/Speicher-Hinweise, Begriffserklärung, Beträge/Währung …
│   ├── features/      bereichsübergreifende Funktionen mit eigener Logik: Verbindungen, Startleitfaden,
│   │                  Ausgabenkurve, Import, Anhänge, Einladungen, Beta-Feedback
│   ├── utils/         reine Hilfsfunktionen: Datum/Kalenderwoche, Geräte-Namen, Idempotenz, Link-Token,
│   │                  Passwort-Richtlinie, „vor x Minuten“, Scroll-Sperre
│   └── styles/        globale SCSS-Partials (Editorial, Bereichslayout)
└── features/          die Bereiche und Seiten (siehe Bereichsordner)
```

Einordnung: Hat es Oberfläche ohne Fachwissen → `shared/ui`. Kennt es Fachbegriffe mehrerer Bereiche →
`shared/features`. Ist es reine Logik ohne Oberfläche → `shared/utils` (bzw. `core/`, wenn es Zustand hält oder das
Backend anspricht). Gehört es zum Rahmen jeder Seite → `layout/`. Design-Tokens stehen ausschließlich in
`src/styles.css`.

### Bereichsordner (verbindlich seit 21.11.2026)

Jeder Bereich folgt demselben Muster wie Finanzen — ein Unterordner je Reiter, dazu `data/` und `shared/`:

```text
features/<area>/
├── <bereich>.ts|html|scss     Container: Reiterleiste, Routing-Parameter, Dialoge des Bereichs
├── <reiter>/                  je Reiter ein Ordner (Komponenten, Logik und Tests nur dieses Reiters)
├── data/                      API-Service, Daten-Provider (echt/Demo)
└── shared/                    was mehrere Reiter des Bereichs nutzen (Logik, gemeinsame Stile, kleine Bausteine)
```

| Bereich (Ordner) | Reiter-Ordner |
| --- | --- |
| Finanzen (`finance/`) | `overview/`, `transactions/`, `budgets/`, `goals/`, `editor/` |
| Haushalt (`household/`) | `today/`, `tasks/` (inkl. Routinen), `shopping/`, `home/` |
| Organisation (`organization/`) | `today/`, `calendar/`, `tasks/`, `notes/` |
| Reisen (`travel/`) | `list/`, `overview/`, `itinerary/`, `planning/`, `packing/`, `budget/` |

Ordnernamen im Code sind englisch (seit 21.11.2026); die Adressen in der App bleiben deutsch (`/finanzen`,
`/haushalt`, …), ebenso die Backend-Apps (eine Umbenennung beträfe Datenbanktabellen und Migrationen). Weitere
Seitenordner: `settings/`, `profile/`, `sessions/`, `people/` (Personen & Gruppen), `privacy/`, `imprint/`, `terms/`,
`accessibility/`, `forgot-password/`, `reset-password/`, `verify-email/`, `invitation/`.

Regeln: Ein Reiter importiert nie aus einem anderen Reiter — nur aus `../shared/`, `../data/` oder dem globalen
`app/shared` bzw. `app/core`. Was zwei Reiter brauchen, wandert nach `shared/` des Bereichs; was zwei Bereiche
brauchen, nach `app/shared/` (UI-Bausteine) bzw. `app/core/` (Dienste, Zustand). Prüfbar mit
`grep -rE "from '\.\./[a-z]+/" features/<area>/<reiter>` (erlaubt sind nur `shared` und `data`).

### Django

- Fachliche Apps sind deutsch benannt und bleiben es (`finanzen`, `haushalt`, `organisation`, `reisen`); eine
  Umbenennung beträfe Tabellen und Migrationen. Funktionierende Apps werden nicht aufgeteilt, nur um einer Liste zu
  entsprechen.
- Bereichsübergreifendes Verhalten ist explizit: Domain-Objekt → Connection (Service/Registry) → Domain-Objekt, keine
  versteckten Seiteneffekte in `save()` oder Signalen zwischen Bereichen.
- API: bereichsorientierte Endpunkte und ausdrückliche bereichsübergreifende Aktionen. Keine API, die beim Anlegen
  eines Objekts stillschweigend andere Objekte anlegt.

### Datenbank

- PostgreSQL 16 in Entwicklung (`docker-compose.yml`), CI und Betrieb. SQLite nur als Notbehelf ohne `DATABASE_URL`;
  `manage.py check --deploy` verbietet es in Produktion.
- Django-ORM, normale Migrationen, keine datenbankspezifischen SQL-Annahmen ohne Not, `Decimal` für Geld, Constraints
  in der Datenbank und in Tests.

### Hintergrundarbeit

Keine Warteschlange, nur weil Automatisierungen denkbar sind. Wiederkehrende Aufgaben laufen als Management-Befehle per
systemd-Timer (künftig Compose). Ein Worker ist erst gerechtfertigt, wenn Aufgaben nicht zuverlässig im
Request/Response laufen können (z. B. längere KI-Auswertungen, siehe `AI_INTEGRATION.md`).

## Public entry and canonical frontend URLs

The session initializer finishes its cookie refresh before Angular matches routes.

- `/`: public product landing page when signed out; existing personal dashboard when signed in.
- `/demo` and `/demo/{finanzen,haushalt,organisation,reisen}`: explicitly selected preview, with route-scoped in-memory providers. `DEMO_MODE` identifies this context even with an authenticated session.
- `/finanzen`, `/haushalt`, `/organisation`, `/reisen`, `/familie`, `/haushaltsfinanzen`: authenticated personal/shared areas with the existing server permissions.
- `/login`, `/registrieren`: existing authentication forms. Success navigates to `/`; the existing onboarding guard redirects eligible new/empty accounts to `/onboarding`.
- `/app` and known `/app/...` paths: compatibility redirects to canonical URLs, retaining query parameters and fragments.

Logout navigates to `/` with same-URL reprocessing: this is required to replace the dashboard with the landing page when the address is already `/`. The demo does not select its providers based on authentication. Dashboard changes in this migration are limited to navigation/context; its layout is preserved.

Hosting still needs the existing SPA fallback to `index.html` for direct navigation and refresh on client routes. These URL changes do not change Django API URLs or require migrations.

## 9. Kompatibilitäts-Checkliste für neue Funktionen

Vor dem Plan jeder neuen Funktion (Feature-Protokoll in `AGENTS.md`) kurz prüfen:

1. **Ort:** Gehört die Funktion in einen bestehenden Bereich, in `core` (bereichsneutral), in `connections`
   (bereichsübergreifend) oder in `integrations` (externer Dienst)? Neue Apps nur mit Freigabe.
2. **Abhängigkeiten:** Kein neuer Import zwischen den vier Bereichen und keiner von `core` in einen Bereich (§ 3.1).
3. **Wiederverwendung:** Gibt es schon Modell, Service, Endpunkt oder UI-Baustein dafür (`shared/ui`, `shared/features`,
   Bereichs-`shared/`)? Dann erweitern statt neu bauen.
4. **Querverbindungen:** Über eine Verbindung oder eine abgeleitete Ansicht (`connections/registry.py`), nie als
   versteckte Kopie oder Signal-Kette; nichts wird ohne Bestätigung gebucht oder angelegt.
5. **Rechte:** Backend prüft Lesen, Schreiben, Suche, Vorschläge; Eintrag in `core/test_permission_matrix.py`.
6. **Daten:** Migration additiv; Export (`datenexport/`) und Aufräumen (`cleanup_expired`) bedacht; Demo und Offline,
   wo betroffen.
7. **KI:** Funktioniert alles ohne Personal AI Core? KI nur als abschaltbarer Vorschlag über `integrations/ai`.
8. **Ressourcen:** Keine neuen Dauerdienste ohne Bedarf; externe Aufrufe mit Timeout; Budget § 7 im Blick.
