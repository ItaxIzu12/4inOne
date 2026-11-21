# 4inOne — Architecture Direction V2

## Current direction

```text
Angular frontend
      ↓
Django backend/API
      ↓
SQLite (early development)
```

Later:

```text
Angular
  ↓
Django API
  ↓
PostgreSQL
```

Later when deployment/reproducibility/background work justifies it:

```text
Docker / Compose
├── frontend (if useful)
├── backend
├── postgres
└── optional worker/queue
```

## Do not rewrite for diagrams

Folder/app structures below are guidance only. Preserve good existing architecture and migrate gradually.

## Angular direction

A possible feature-oriented structure:

```text
src/app/
├── core/
│   ├── auth/
│   ├── api/
│   ├── guards/
│   └── services/
├── shared/
│   ├── ui/
│   ├── models/
│   └── utils/
├── layout/
│   ├── app-shell/
│   ├── sidebar/
│   ├── topbar/
│   └── mobile-nav/
└── features/
    ├── dashboard/
    ├── finance/
    ├── household/
    ├── organization/
    ├── travel/
    ├── connections/
    └── settings/
```

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
features/<bereich>/
├── <bereich>.ts|html|scss     Container: Reiterleiste, Routing-Parameter, Dialoge des Bereichs
├── <reiter>/                  je Reiter ein Ordner (Komponenten, Logik und Tests nur dieses Reiters)
├── data/                      API-Service, Daten-Provider (echt/Demo)
└── shared/                    was mehrere Reiter des Bereichs nutzen (Logik, gemeinsame Stile, kleine Bausteine)
```

| Bereich | Reiter-Ordner |
| --- | --- |
| finanzen | `overview/`, `transactions/`, `budgets/`, `goals/`, `editor/` |
| haushalt | `heute/`, `aufgaben/` (inkl. Routinen), `einkaufen/`, `zuhause/` |
| organisation | `heute/`, `kalender/`, `aufgaben/`, `notizen/` |
| reisen | `liste/`, `uebersicht/`, `ablauf/`, `planung/`, `packliste/`, `budget/` |

Regeln: Ein Reiter importiert nie aus einem anderen Reiter — nur aus `../shared/`, `../data/` oder dem globalen
`app/shared` bzw. `app/core`. Was zwei Reiter brauchen, wandert nach `shared/` des Bereichs; was zwei Bereiche
brauchen, nach `app/shared/` (UI-Bausteine) bzw. `app/core/` (Dienste, Zustand). Prüfbar mit
`grep -rE "from '\.\./[a-z]+/" features/<bereich>/<reiter>` (erlaubt sind nur `shared` und `data`).

## Django direction

Logical apps may include:

```text
accounts
finance
household/households
organization
travel
connections
```

Do not split working apps just to match this list.

## Cross-domain architecture

Cross-domain behavior must be explicit.

Prefer:

```text
Domain A object
      ↓
Connection service/domain
      ↓
Domain B object
```

rather than hidden side effects between unrelated model save methods/signals.

## API direction

Use domain-oriented endpoints and explicit cross-domain actions.

Avoid APIs where creating one object silently creates unrelated objects without explanation.

## Database migration

### SQLite phase

- Django ORM;
- normal migrations;
- no SQLite-specific SQL assumptions;
- Decimal for money;
- test uniqueness/constraints.

### PostgreSQL rehearsal

Before production:

- run all migrations on PostgreSQL;
- load representative data;
- run tests;
- verify timezone behavior;
- verify indexes/constraints;
- test critical concurrent workflows.

## Background work

Do not introduce a queue merely because automations may exist later.

A worker becomes justified when the product has concrete recurring/scheduled tasks that cannot reliably run in request/response flows.

## AI architecture later

If local/private AI is introduced, keep permissions and authoritative actions in Django.

Possible shape:

```text
Angular → Django → AI service/local model
```

The model should not directly bypass backend authorization or mutate databases independently.

## Public entry and canonical frontend URLs

The session initializer finishes its cookie refresh before Angular matches routes.

- `/`: public product landing page when signed out; existing personal dashboard when signed in.
- `/demo` and `/demo/{finanzen,haushalt,organisation,reisen}`: explicitly selected preview, with route-scoped in-memory providers. `DEMO_MODE` identifies this context even with an authenticated session.
- `/finanzen`, `/haushalt`, `/organisation`, `/reisen`, `/familie`, `/haushaltsfinanzen`: authenticated personal/shared areas with the existing server permissions.
- `/login`, `/registrieren`: existing authentication forms. Success navigates to `/`; the existing onboarding guard redirects eligible new/empty accounts to `/onboarding`.
- `/app` and known `/app/...` paths: compatibility redirects to canonical URLs, retaining query parameters and fragments.

Logout navigates to `/` with same-URL reprocessing: this is required to replace the dashboard with the landing page when the address is already `/`. The demo does not select its providers based on authentication. Dashboard changes in this migration are limited to navigation/context; its layout is preserved.

Hosting still needs the existing SPA fallback to `index.html` for direct navigation and refresh on client routes. These URL changes do not change Django API URLs or require migrations.
