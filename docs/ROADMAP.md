# 4inOne — Roadmap V2

This roadmap reflects the current strategy: make the four domains reliable first, then add cross-domain intelligence.

Existing completed work should not be rebuilt just to match phase numbering.

## Phase 0 — Repository audit

- inspect Angular/Django structure;
- identify current auth, ownership, APIs and tests;
- identify already-finished features;
- record blockers and technical debt.

## Phase 1 — Foundation stabilization

Where not already stable:

- registration/login/logout;
- protected routes;
- app shell;
- responsive navigation;
- loading/error states;
- base profile identity;
- ownership/privacy basics.

## Phase 2 — Organisation

Finish and test:

- tasks;
- calendar events;
- Today aggregation;
- CRUD/error/empty states;
- responsive behavior.

## Phase 3 — Finanzen

Finish and test:

- income/expenses;
- categories;
- budgets;
- savings goals;
- Decimal/currency handling;
- privacy.

## Phase 4 — Haushalt

Finish and test:

- chores/routines;
- due dates/status;
- optional assignments;
- shopping list;
- solo and shared behavior.

## Phase 5 — Reisen

Finish and test:

- trips;
- dates;
- packing/tasks;
- participants where allowed;
- budget reference;
- calendar-related data where implemented.

## Phase 6 — Profile, settings and onboarding polish

- profile menu;
- account settings;
- people/groups;
- notification/privacy/app preferences;
- onboarding flow;
- demo-vs-real-data behavior;
- empty states.

## Phase 7 — End-to-end stabilization

Before Connections:

- fix known bugs;
- verify permissions;
- test mobile/desktop;
- verify forms and validation;
- run frontend/backend tests;
- reduce duplicate UI patterns;
- document remaining debt.

## Phase 8 — Connection Engine V1

Start small:

- supported typed relationships;
- create/list/delete;
- backend permission checks;
- connected-items UI;
- duplicate/self/invalid validation;
- security tests.

No automation yet.

## Phase 9 — Suggestions V1

Only after Connections are reliable.

Examples:

- missing packing list before a trip;
- household routine overlaps absence;
- savings goal needs attention;
- useful proposed connection.

Suggestions explain why and let the user decide.

## Phase 10 — Automations

- explicit rules;
- user enable/disable;
- auditability;
- safe confirmation for impactful actions;
- worker/queue only if scheduling/background requirements justify it.

## Phase 11 — PostgreSQL and deployment hardening

Can move earlier if deployment requires it.

- PostgreSQL rehearsal/migration;
- backup strategy;
- production config;
- monitoring;
- optional Docker.

## Phase 12 — Integrations, media and AI

Only after core product value is stable.

Possible:

- calendar sync;
- receipt/document capture;
- object storage;
- booking imports;
- natural-language task/action extraction;
- local/private AI classification and summaries.

AI is an enhancement, not the product identity.
