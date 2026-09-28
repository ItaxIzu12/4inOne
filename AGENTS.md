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
9. `docs/SECURITY.md`
10. `docs/ROADMAP.md`
11. current code, where it does not conflict with the above

## Technology direction

- Frontend: Angular
- Backend: Python + Django
- Database now: SQLite
- Database later: PostgreSQL
- Infrastructure later: Docker
- Optional future worker/queue only when an actual background requirement exists

The versions already installed in the repository are authoritative. Do not upgrade major dependencies without a concrete reason.

## Required workflow before substantial changes

1. Inspect the existing codebase.
2. Read relevant project documentation.
3. Identify reusable components, services, APIs and models.
4. Check whether the requested behavior already exists.
5. Propose the smallest safe implementation.
6. Preserve working functionality unless the requirement explicitly changes it.
7. Implement in small, reviewable steps.
8. Add or update tests.
9. Run build/typecheck/tests relevant to the change.

Do not rewrite the project only to make it resemble a theoretical architecture diagram.

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
- implement Celery/Redis/Neo4j/event buses before a concrete need exists;
- build a huge generic permissions framework before the product requires it;
- copy demo data into real accounts by default;
- add broad cross-domain foreign keys that make future evolution difficult.
