# 4inOne — Project Rules for Coding Agents

## Mission

4inOne is a personal life-management app for **Finanzen, Haushalt, Organisation and Reisen**.

Every area must work well on its own. The product becomes distinctive when it can represent that two or more things from different areas belong to the same real-life context.

Example:

```text
Neue Waschmaschine
├── Sparziel 700 €
├── Aufgabe: Angebote vergleichen
├── Liefertermin
└── Aufgabe: Altgerät entsorgen
```

These objects remain real domain objects. A Connection only expresses that they belong together.

## Source-of-truth order

If implementation, old mockups or historical notes conflict, use this priority:

1. `AGENTS.md`
2. `docs/DECISIONS.md`
3. `docs/PRODUCT_REQUIREMENTS.md`
4. `docs/AUTH_AND_PERMISSIONS.md`
5. `docs/CONNECTION_ENGINE.md`
6. `docs/DATA_MODEL.md`
7. `docs/DESIGN_SYSTEM.md`
8. `docs/ARCHITECTURE.md`
9. `docs/AI_INTEGRATION.md`
10. `docs/SECURITY.md`
11. `docs/ROADMAP.md`
12. current code, where it does not conflict with the above

## Technology direction

- Frontend: Angular + TypeScript (standalone components, Signals), responsive web app and PWA
- Backend: Python + Django + Django REST Framework (REST API)
- Database: PostgreSQL 16 in development (`docker-compose.yml`), CI and production; SQLite only as a fallback without
  `DATABASE_URL` (`manage.py check --deploy` forbids it in production)
- Infrastructure: Docker Compose for local services; production today via systemd + nginx (`deploy/`); a production
  Compose for the self-hosted GEEKOM GT1 Mega is planned (`docs/ARCHITECTURE.md` › Phase 3)
- Optional future worker/queue only when an actual background requirement exists

## Architecture rules (target architecture: `docs/ARCHITECTURE.md` § 3)

- 4inOne is a **modular monolith**: one Django project, one app per domain, one Angular app with domain folders, one
  own PostgreSQL database. No microservices, no database shared with other applications.
- Dependency direction: domain apps (`finanzen`, `haushalt`, `organisation`, `reisen`) use `core`/`integrations`, never
  each other; cross-domain behaviour goes through `connections` or a domain's public interface. New code must not add
  new violations; existing exceptions are listed in `docs/ARCHITECTURE.md` § 1.3 and are reduced step by step.
- Business rules are deterministic. AI may add suggestions, never replace a rule or change data on its own.
- External services (including the future **Personal AI Core**) only via the backend (`integrations/`), with timeout,
  switch and defined failure behaviour. The Personal AI Core is a separate system: every basic feature must work
  without it (`docs/AI_INTEGRATION.md`).
- **Shared Personal AI Integration Standard** (`docs/AI_INTEGRATION.md` § 0): all AI goes through the one adapter
  `integrations/ai` (versioned REST, capability discovery via `/v1/capabilities`, provider `core` or `mock`); no models,
  OCR engines or AI SDKs embedded in 4inOne; models are swappable without app changes; permissions and data selection
  stay in the domain service; development uses the mock provider while the Core is unavailable. A newly needed
  capability is added to the catalogue (`docs/AI_INTEGRATION.md` § 4.5) as an extension of the shared Core — never as
  an isolated AI solution inside 4inOne.
- Architecture changes (new apps, moved responsibilities, new infrastructure) need the user's approval and are
  documented in `docs/ARCHITECTURE.md` in the same step.

The versions already installed in the repository are authoritative. Do not upgrade major dependencies without a concrete reason.

## Required workflow before substantial changes (Feature-Protokoll, seit 24.11.2026)

Every new feature description from the user is a domain requirement inside the existing architecture
(`docs/ARCHITECTURE.md`). Work through it end to end without unnecessary questions when it is clearly described:

1. Analyse the requirement.
2. Inspect the existing code and read the relevant project/architecture documentation.
3. Identify reusable modules, components, services, APIs and models; check whether the behaviour already exists.
4. Check dependencies and the impact on existing features (permissions, Connection Engine, demo, offline, export).
5. Make a short implementation plan; choose the smallest safe implementation.
6. Implement the required backend and frontend parts in small, reviewable steps, preserving working functionality.
7. Create database migrations where needed — additive only; destructive changes (drop/rename/data loss) need approval.
8. Use existing API patterns and design components (`docs/DESIGN_SYSTEM.md`); no duplicate implementations.
9. Use the Personal AI Core only through `integrations/ai` as described in `docs/AI_INTEGRATION.md` (switchable,
   suggestions only, no hard-coded provider) and only for capabilities the user has approved.
10. Write and run automated tests (backend pytest, frontend unit, build, relevant e2e incl. accessibility).
11. Fix the failures found and re-run.
12. Update the documentation (domain doc, `docs/ARCHITECTURE.md` if structure changes, design docs for UI changes).
13. Check security (authorization, input limits, secrets), performance and resource use (target: GEEKOM GT1 Mega,
    `docs/ARCHITECTURE.md` § 7).
14. Hand the changes over for review: summary, files, commands run with their real results, open points, migrations.
    Commit, push or deploy only when the user asks.

Binding rules: no unnecessary architecture changes; no duplicated features; no hard-coded AI providers; no unrequested
removal of existing features; no destructive database changes and no production deployment without approval; never
report tests that were not run or results that did not happen; every extension fits the modular structure
(`docs/ARCHITECTURE.md` § 3). Features the user has explicitly deferred stay deferred until they approve them.

Do not rewrite the project only to make it resemble a theoretical architecture diagram.

## Design-Dokumentation (immer aktuell halten)

Jede Änderung an Design-Tokens (`frontend/src/styles.css`), gemeinsamen UI-Komponenten (`frontend/src/app/shared`,
`app-shell`), Layout-Regeln, Bereichsfarben oder am Referenz-Screen wird **im selben Schritt** in
`docs/DESIGN_SYSTEM.md` (ausführlich) und `DESIGN.md` (Kurzfassung) nachgetragen. Bereichsspezifische Design-Entscheidungen
zusätzlich im jeweiligen `docs/*_V1.md`. Der Abschnitt „Referenz und Migrationsstand“ zeigt, welche Bereiche das System
schon vollständig nutzen.

## Product principles

- Every domain is useful alone.
- Private by default.
- Sharing is explicit and granular.
- Connections do not grant permissions.
- Suggestions explain themselves.
- High-impact changes require user confirmation.
- “Today” shows what matters now, not a wall of statistics.
- Complex underneath, simple on top.
- Do not add a feature merely because competitors have it.

## Domain independence

Avoid direct cross-domain coupling such as hard-wiring finance models to travel models for every use case.

Prefer:

```text
domain object → explicit Connection → domain object
```

rather than hidden creation or cascades across apps.

## Privacy rules

A user must never gain access to another user's object simply because both users belong to the same app, household, group or trip.

Backend authorization is mandatory for:

- reads
- writes
- search results
- connection creation
- connection listing
- suggestions
- sharing
- file/media access

Never rely on hidden UI elements as authorization.

## Demo rules

Demo data and real user data must be clearly separated.

- Do not silently seed fake transactions, trips or tasks into a real account.
- A demo environment must be visibly labelled.
- Users may deliberately adopt templates, but templates are not disguised demo records.

## Design rules

The production UI should be calm, modern, adult and friendly.

- Use one consistent icon family.
- Prefer regular UI icons over 3D icons in daily-use screens.
- Use 3D/illustration mainly for onboarding, marketing, empty states and occasional hero moments.
- Domain colors are orientation aids, not full-screen decoration.
- Finances should be the most restrained visual area.

## Important non-goals

Do not:

- create four unrelated mini-apps inside one navigation shell;
- introduce AI as a novelty tab;
- silently modify user data;
- store long-lived secrets in insecure browser storage;
- implement Celery, a message broker, Neo4j or event buses before a concrete need exists (Redis is used only as a cache);
- build a huge generic permissions framework before the product requires it;
- copy demo data into real accounts by default;
- add broad cross-domain foreign keys that make future evolution difficult.
