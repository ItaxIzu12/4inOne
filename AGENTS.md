# 4inOne — Codex Project Rules

## Purpose

This repository contains **4inOne**, a personal life-management platform that connects:

- Finanzen
- Haushalt
- Organisation
- Reisen

4inOne is **not** four unrelated applications inside one shell.

The core product idea is:

> **Jeder Bereich funktioniert eigenständig. Connections und Automatisierungen verbinden nur das, was sinnvoll zusammengehört.**

## Source of truth

When instructions conflict, use this priority:

1. `AGENTS.md`
2. `docs/DECISIONS.md`
3. `docs/PRODUCT_REQUIREMENTS.md`
4. `docs/CONNECTION_ENGINE.md`
5. `docs/DATA_MODEL.md`
6. `docs/DESIGN_SYSTEM.md`
7. `docs/ARCHITECTURE.md`
8. `docs/SECURITY.md`
9. `docs/ROADMAP.md`
10. historical chat notes or old implementation details

Do not treat old code as product truth when it conflicts with the documents above. Do not delete working code merely because it looks different from the target design.

## Existing technology direction

- Frontend: Angular
- Backend: Python + Django
- Database now: SQLite
- Database later: PostgreSQL
- Infrastructure later: Docker
- The currently installed project versions are authoritative.
- Do not upgrade Angular, Django, Python or other major dependencies unless explicitly required.

## Required workflow before changing code

Before every substantial implementation:

1. Inspect the existing repository.
2. Identify reusable components, services, models and APIs.
3. Check whether an equivalent feature already exists.
4. Explain the smallest safe change.
5. Preserve working behavior unless the requirement explicitly changes it.
6. Implement in small, reviewable steps.
7. Add or update tests for behavior that changes.

For large requests, first provide a short implementation plan before editing.

## Architecture principles

- Prefer feature boundaries over one giant application layer.
- Avoid circular dependencies between Finanzen, Haushalt, Organisation and Reisen.
- Cross-domain behavior must go through explicit Connections / Automations instead of hidden coupling.
- Keep domain models understandable.
- Do not create generic abstractions before there is a real need.
- Use Django ORM rather than database-specific SQL unless there is a documented reason.
- Keep SQLite compatibility during the early phase, but avoid SQLite-specific design choices.
- Design all persistent models with a future PostgreSQL migration in mind.

## Privacy principles

- Personal data is private by default.
- Sharing must be explicit.
- A user must never gain access to another user's finance, household, calendar or travel data merely because both belong to the same application.
- Shared households, groups and trips require explicit membership and permissions.
- Sensitive permissions must be enforced in the backend, not only hidden in the UI.

## UX principles

- Complex underneath, simple on top.
- Show the user what matters now.
- Avoid overloaded dashboards.
- Mobile-first, but provide a strong desktop/web experience.
- Use whitespace, concise copy and clear hierarchy.
- Color is an orientation aid, not decoration.
- Accessibility is a product requirement, not a later enhancement.

## Design references

The images in `docs/references/` are **visual references**, not assets to be placed as screenshots/backgrounds in the application.

Rebuild the UI using real Angular components.

## Product check for every new feature

Before adding a feature, ask:

1. Does it solve a real user problem?
2. Is it useful on its own?
3. Can it connect meaningfully with another domain?
4. Does the connection reduce duplicate work for the user?
5. Can the UI remain simple?
6. Is privacy preserved?

If the feature adds complexity without clear value, do not add it.

## Important non-goals

Do not:

- build four separate mini-apps that happen to share navigation;
- expose every possible metric on the dashboard;
- create an AI chatbot merely to claim the product has AI;
- automatically mutate user data without transparency;
- share private data by default;
- store authentication secrets in insecure browser storage;
- add speculative infrastructure before it is needed.
