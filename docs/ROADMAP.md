# 4inOne — Roadmap

The roadmap is ordered to reduce architectural rework.

## Phase 0 — Repository audit

- inspect Angular structure;
- inspect Django structure;
- inspect existing authentication;
- inspect existing models;
- inspect existing APIs;
- inspect current design system;
- identify reusable code.

No large rewrite.

## Phase 1 — Authentication & app foundation

- registration
- login
- logout
- password reset flow
- app shell
- routing
- protected routes
- loading/error states
- responsive auth layout

## Phase 2 — User & ownership model

- personal scope
- optional household
- membership
- simple permissions
- onboarding

This phase is critical before shared features.

## Phase 3 — Organisation MVP

- tasks
- calendar events
- Today aggregation
- reminders model if needed

Organisation provides useful cross-domain anchors.

## Phase 4 — Finanzen MVP

- income
- expenses
- categories
- monthly budget
- savings goals

Keep it private by default.

## Phase 5 — Haushalt MVP

- household/personal tasks
- recurring tasks
- assignee
- due dates
- basic shopping list if needed

## Phase 6 — Connection Engine V1

Implement only concrete useful relations first.

Suggested V1:

- task ↔ calendar event
- savings goal ↔ planned purchase/project
- household task ↔ calendar event

Create connection UI and backend permission checks.

## Phase 7 — Suggestions V1

Examples:

- upcoming due task;
- conflicting household task;
- linked goal needs attention.

Suggestion first; automatic mutation later.

## Phase 8 — Reisen MVP

- trip
- dates
- participants
- packing/tasks
- trip budget reference
- calendar connection

Travel is where multiple connections become highly visible, but it is not the only connected domain.

## Phase 9 — PostgreSQL

- set up PostgreSQL dev/test;
- migration rehearsal;
- tests;
- data transfer plan;
- switch primary DB.

## Phase 10 — Docker

- backend container
- frontend container if useful
- PostgreSQL container for local/dev
- environment configuration

## Phase 11 — Automation Engine

- rule definitions
- safe triggers
- audit trail
- user enable/disable
- background processing where required

## Phase 12 — Integrations / AI

Only after product fundamentals are stable.

Possible:

- external calendars
- email/booking import
- financial providers
- AI natural-language planning
- intelligent classification

AI should improve workflows, not become a separate novelty tab.
