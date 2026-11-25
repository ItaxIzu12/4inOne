# 4inOne — Project Rules for Coding Agents

Binding for every agent (Codex, Claude Code, others). Claude-specific additions: `CLAUDE.md`.
Last reviewed: 25.11.2026.

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

---

## 1. Working from a natural-language feature request

The user describes features in plain language and does **not** re-explain the architecture. Every request is a domain
requirement inside this architecture. Apply the ten principles in § 2 automatically.

### Interpreting the request

- **Area:** decide which area the feature belongs to (Finanzen, Haushalt, Organisation, Reisen), whether it is
  area-neutral (`core`), connects areas (`connections`) or talks to an outside service (`integrations`). Use
  `docs/ARCHITECTURE.md` § 9 for the decision.
- **Existing first:** look for the closest existing feature and extend it before building anything new (§ 2.2).
- **Defaults instead of questions:** when the request is clear, follow the existing pattern of the area (data model
  style, API style, UI components, wording, demo behaviour) and state the assumptions in the hand-over.
- **Ask only** when the answer changes what gets built and cannot be derived: a choice between materially different
  behaviours, a destructive data change, a new app/service/infrastructure, a new outside service, an AI capability, or
  something the user explicitly deferred (e.g. Smart Scan).

### Feature protocol (every substantial change)

1. Analyse the requirement.
2. Inspect the existing code and read the relevant docs (area doc `docs/*_V1.md`, `docs/ARCHITECTURE.md`).
3. Identify reusable modules, components, services, APIs and models; check whether the behaviour already exists.
4. Check dependencies and impact: permissions, Connection Engine, demo, offline, data export, cleanup, search.
5. Make a short plan; choose the smallest safe implementation.
6. Implement backend and frontend in small, reviewable steps, preserving working functionality.
7. Migrations only where needed and additive (§ 2.7).
8. Reuse existing API patterns and design components (`docs/DESIGN_SYSTEM.md`); no duplicate implementations.
9. AI only through `integrations/ai` and only for approved capabilities (§ 2.5).
10. Write and run the automated tests for the change (§ 2.8).
11. Fix failures and re-run until green.
12. Update the documentation (area doc; `docs/ARCHITECTURE.md` if structure changes; design docs for UI changes).
13. Check security, performance and resource use (§ 2.9, budget `docs/ARCHITECTURE.md` § 7).
14. Hand over for review: summary, files, commands run with their **real** results, assumptions, open points,
    migrations. Commit, push or deploy only when the user asks.

Architecture improvements (moving responsibilities, new apps, new infrastructure, refactors beyond the feature) are
**proposed, not done**: they need the user's approval and are implemented step by step, with the full test suite after
each step (`docs/ARCHITECTURE.md` § 4, `docs/DECISIONS.md` D19).

---

## 2. The ten binding principles

### 2.1 Modular monolith

- One Django project, one app per domain, one Angular app with area folders, one own PostgreSQL database.
- No microservices, no second backend, no database shared with other applications (including the Personal AI Core).
- Layers (`docs/ARCHITECTURE.md` § 3.1): **1** `core`, `integrations`, `monitoring`, `website` → **2** the four areas →
  **3** `connections`, `datenexport`. Higher layers may use lower ones, never the reverse.
- New apps only with approval. Do not split working apps to match a diagram.

### 2.2 Reuse existing components

Look here before writing something new:

| Need | Reuse |
|---|---|
| UI building blocks (fields, dialog, icons, toggles, notices) | `frontend/src/app/shared/ui/` |
| Cross-area UI features (connections, import, attachments, invitations) | `frontend/src/app/shared/features/` |
| Area-internal shared logic/styles | `features/<area>/shared/`, API in `features/<area>/data/` |
| Auth, households, members, notifications, currency, recurrence, idempotency, uploads | `backend/core/` (`files.py`, `recurrence.py`, `idempotency.py`, `fx.py`, `notifications.py`) |
| Area functions for other areas | `backend/<area>/public.py` (exists for `finanzen`) |
| Area knowledge needed by `core` | `backend/core/registry.py` hooks, registered in `<area>/core_hooks.py` |
| Cross-area links, derived entries, suggestions, Today, search | `backend/connections/` (`registry.py`, `auto_links.py`) |
| Outside services | `backend/integrations/` (AI: `integrations/ai`) |

Extend an existing model, endpoint or component when the concept is the same. Create new ones only for a genuinely
new concept. Reuse means real reuse: no premature abstractions for a single caller.

### 2.3 Separation of the four areas

**Backend** (enforced by `backend/core/test_architecture.py`):

- `core` and other layer-1 apps never import an area. If `core` needs area knowledge, the area registers a hook in
  `core/registry.py`.
- Areas never import each other, except through the other area's `public.py`.
- Areas never import `connections`. If an area needs derived data from connections, `connections` registers a hook.
- No cross-area side effects in `save()` or signals; no broad cross-area foreign keys.

**Frontend** (both rules enforced by `npm run check:architecture`, also in CI):

- A tab folder imports only from `../shared/`, `../data/`, `app/shared`, `app/core` — never from another tab.
- An area uses another area only through that area's `data/` (API service) or `shared/` — never through its tab
  folders or files in the area root. Orchestrating pages (`dashboard`, `offline`, `landing`, …) follow the same rule.
  Logic needed outside a tab moves to `<area>/shared/`.

Prefer `domain object → explicit Connection → domain object` over hidden creation or cascades across areas.

### 2.4 Controlled Connection Engine

Rules for every new connection type, derived entry or suggestion (`docs/CONNECTION_ENGINE.md`):

- **Register it** in `connections/registry.py`. Types are enums, never free strings.
- **Derived, not copied:** entries shown in another area (planned expenses, calendar items, reminders) are computed on
  read from exactly one source. Booked transactions, real events and tasks are never touched.
- **No chains:** a derived entry never creates further entries. No automation triggers another automation.
- **No duplicates:** database constraints (one AutoLink per person/kind/source; no self-links or duplicate links) and
  idempotent creation.
- **Permissions on every read:** each source is checked against its own rule. Connections never grant access.
- **Confirmation:** anything that books money or creates objects in another area needs explicit user confirmation.
- **Explainable and reversible:** suggestions say why; dismissals are stored; unlinking leaves real objects intact and
  is logged (`AutoLinkEvent`).
- Tests: registry contract, permission matrix and the scenario tests in `connections/tests/`.

### 2.5 Compatibility with the future Personal AI Core

Shared Personal AI Integration Standard (`docs/AI_INTEGRATION.md` § 0):

- All AI goes through the **one adapter** `backend/integrations/ai` (versioned REST, capability discovery via
  `GET /v1/capabilities`, providers `core` or `mock`). The frontend never talks to the Core.
- No models, OCR engines, AI SDKs or provider-specific code inside 4inOne. Models are swappable without app changes.
- The area service checks permissions and selects the minimum data **before** calling the adapter; requests carry the
  application and area context and only a per-application pseudonym of the person.
- A newly needed capability goes into the catalogue `docs/AI_INTEGRATION.md` § 4.5 as an extension of the **shared**
  Core, with result schema, mock answer and tests — never as an isolated AI solution inside 4inOne.
- **Not now:** do not develop the Personal AI Core and do not integrate local AI models. Use `AI_PROVIDER=mock` for
  development of an approved capability.

### 2.6 Independence from AI services

- Business rules are deterministic. AI may add suggestions, never replace a rule.
- AI never changes data on its own: no bookings, transfers, deletions, sharing or permission changes; saving happens
  only through the existing APIs after the user confirms.
- `AI_ENABLED=False` is the default. Every feature must work fully without AI and when the Core fails (every AI error
  ends in "no suggestion"). Tests must pass with AI disabled.

### 2.7 Preserve existing features and data

- Do not remove or silently change existing features unless the user asks.
- Migrations are additive. Dropping/renaming columns or tables, data rewrites and anything that can lose data need the
  user's approval. Run `makemigrations --check` before hand-over.
- Keep the demo (`/demo`, in-memory providers) consistent with real behaviour; demo data never enters real accounts.
- New personal data must be covered by the data export (`datenexport/`, completeness test) and, where it expires, by
  `cleanup_expired` (with a systemd timer, `core/test_deploy_schedule.py`).
- Visual refactors never replace working business logic.

### 2.8 Automated tests

| Change | Tests to add/run |
|---|---|
| Model / API / permission | pytest for the workflow and for access by other users (404/403); entry in `core/test_permission_matrix.py` for new detail views |
| Business rule / calculation | unit tests incl. edge cases (backend pytest, frontend Vitest for shared logic) |
| UI change | Vitest where logic is involved; Playwright e2e for the user flow; axe accessibility check light/dark, 390 and 1440 px |
| Cross-area / connection | `connections/tests/` scenarios and permission tests |
| Deployment / scheduled command | `core/test_deploy_schedule.py` stays green; `deploy/ci/check-deploy.sh` (nginx -t, compose config, systemd-analyze, shellcheck) for changes in `deploy/` |

Before hand-over at least: backend `pytest`, `manage.py check`, `makemigrations --check`, frontend
`npm run check:architecture`, `ng test --watch=false`, `ng build`, and the e2e specs of the touched area. Report only
results that actually ran. Tests never run against the user's real development database.

### 2.9 Privacy and security

A user must never gain access to another user's object simply because both users belong to the same app, household,
group or trip. Backend authorization is mandatory for reads, writes, search results, connection creation and listing,
suggestions, sharing and file/media access. Never rely on hidden UI elements as authorization.

Also:

- Validate and limit input (sizes, counts, rate limits via `RATE_LIMIT_*`); uploads through `core/files.py`.
- Sensitive values encrypted at rest where misuse is possible (example: boarding-pass codes); shown masked.
- No secrets in the repository, images, logs or browser storage; configuration via environment (`.env.example`).
- Logs contain no personal content (IDs, durations and outcomes only).
- Outside services only via the backend, with timeout, switch and defined failure behaviour.
- Private by default; sharing explicit and granular; retention limited and enforced.

### 2.10 Avoid overengineering

- Build only what the current request needs; prepare extension points only where a second use is concrete.
- No queues/workers, message brokers, event buses, graph databases, microservices or plugin systems before a concrete
  need (`docs/DECISIONS.md` D14). Scheduled work runs as management commands with systemd timers.
- No generic frameworks (permissions, settings, rules engines) for one or two cases.
- No new dependency when the standard library or an existing dependency does the job; new dependencies need a reason,
  a pinned version and a licence check.
- Prefer deleting and simplifying over adding layers. Keep files focused; split large components when working in them.

---

## 3. Technology

- Frontend: Angular + TypeScript (standalone components, Signals), responsive web app and PWA
- Backend: Python + Django + Django REST Framework (REST API)
- Database: PostgreSQL 16 in development (`docker-compose.yml`), CI and production; SQLite only as a fallback without
  `DATABASE_URL` (`manage.py check --deploy` forbids it in production)
- Operation: systemd + nginx (`deploy/ANLEITUNG.md`) or Docker Compose on the self-hosted GEEKOM GT1 Mega
  (`deploy/docker/`)
- The versions already installed in the repository are authoritative. Do not upgrade major dependencies without a
  concrete reason.

## 4. Product principles

- Every domain is useful alone.
- Private by default.
- Sharing is explicit and granular.
- Connections do not grant permissions.
- Suggestions explain themselves.
- High-impact changes require user confirmation.
- “Today” shows what matters now, not a wall of statistics.
- Complex underneath, simple on top.
- Do not add a feature merely because competitors have it.

## 5. Demo rules

Demo data and real user data must be clearly separated.

- Do not silently seed fake transactions, trips or tasks into a real account.
- A demo environment must be visibly labelled.
- Users may deliberately adopt templates, but templates are not disguised demo records.

## 6. Design rules

The production UI should be calm, modern, adult and friendly.

- Use one consistent icon family.
- Prefer regular UI icons over 3D icons in daily-use screens.
- Use 3D/illustration mainly for onboarding, marketing, empty states and occasional hero moments.
- Domain colors are orientation aids, not full-screen decoration.
- Finances should be the most restrained visual area.

### Design-Dokumentation (immer aktuell halten)

Jede Änderung an Design-Tokens (`frontend/src/styles.css`), gemeinsamen UI-Komponenten (`frontend/src/app/shared`,
`app-shell`), Layout-Regeln, Bereichsfarben oder am Referenz-Screen wird **im selben Schritt** in
`docs/DESIGN_SYSTEM.md` (ausführlich) und `DESIGN.md` (Kurzfassung) nachgetragen. Bereichsspezifische Design-Entscheidungen
zusätzlich im jeweiligen `docs/*_V1.md`. Der Abschnitt „Referenz und Migrationsstand“ zeigt, welche Bereiche das System
schon vollständig nutzen.

## 7. Important non-goals

Do not:

- create four unrelated mini-apps inside one navigation shell;
- introduce AI as a novelty tab;
- silently modify user data;
- store long-lived secrets in insecure browser storage;
- implement Celery, a message broker, Neo4j or event buses before a concrete need exists (Redis is used only as a cache);
- build a huge generic permissions framework before the product requires it;
- copy demo data into real accounts by default;
- add broad cross-domain foreign keys that make future evolution difficult;
- rewrite the project only to make it resemble a theoretical architecture diagram.
