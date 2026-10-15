# 4inOne — Data Model Direction V2

This document describes conceptual entities. The existing repository remains the implementation starting point.

## General rules

- Use Django ORM and migrations.
- Avoid SQLite-specific assumptions.
- Prepare for PostgreSQL.
- Use Decimal for money.
- Store explicit currencies.
- Use timezone-aware datetime handling.
- Give every object a clear owner/scope.
- Do not create cross-domain foreign keys for every possible relationship.

## Accounts

Conceptual entities:

- User
- UserProfile
- optional user preferences
- optional memberships/groups/households

## Finanzen

Possible entities:

- Transaction
- Category
- MonthlyBudget
- SavingsGoal
- RecurringCost, if needed by current requirements

Key questions for each record:

- who owns it?
- is it personal or shared?
- what currency applies?

## Haushalt

Possible entities:

- Household or shared-home scope
- HouseholdMembership
- HouseholdTask
- Routine/recurrence representation
- ShoppingList
- ShoppingItem
- Room/Device only if the current feature set needs them

A user should still be able to use household functionality personally without creating a shared family structure.

## Organisation

Possible entities:

- Task
- CalendarEvent
- Reminder, if not represented as attributes/services
- Note/Project only if needed

## Reisen

Possible entities:

- Trip
- TripParticipant / membership
- PackingItem
- TripTask or relation to normal Task
- travel notes/documents later

Avoid duplicating task/calendar logic unless a real domain distinction requires it.

## Connections

Prefer a dedicated connection representation rather than many hard-coded cross-domain foreign keys.

Conceptual:

```text
Connection
- id
- source_domain/type/id
- target_domain/type/id
- relation_type
- origin
- created_by
- created_at
```

Exact field choices depend on the current codebase and performance/validation needs.

## Suggestions

Later conceptual model:

```text
Suggestion
- id
- user/scope
- suggestion_type
- reason/context
- proposed_action payload/reference
- status
- created_at
- expires_at optional
```

Do not store opaque, unvalidated arbitrary actions that the backend later executes blindly.

## Automations

Later conceptual entities may include:

- AutomationRule
- AutomationRun / audit entry
- trigger/configuration
- enabled state

High-impact actions require safe confirmation semantics.

## Demo data

Do not mix demo records with a normal user's personal data by default.

Use an isolated demo workspace/account/session or another clearly separated mechanism.

## Media/files later

Do not store large image/document blobs directly in SQLite/PostgreSQL as the default architecture.

Prefer object storage later, with DB metadata and private access rules.

## Persistence & integrity (beta audit, 13.10.2026)

- **Source of truth:** the database. Aggregations (budgets, category budgets, dashboard, household „Heute“, trip
  budget) are computed live per request; there is no server-side data cache. All `/api/` responses carry
  `Cache-Control: no-store` (`core.middleware.ApiNoStoreMiddleware`), so neither browsers nor proxies keep personal
  data. Frontend state services clear themselves when the signed-in account changes.
- **Money:** `DecimalField` everywhere, two decimals, no floats in business logic (one display percentage only);
  more than two decimals is rejected, not rounded.
- **Dates:** date-only values are `DateField`s, serialized as `YYYY-MM-DD`; the frontend parses them at local noon
  (`T12:00`) and never converts them via UTC. `TIME_ZONE = Europe/Berlin`, `USE_TZ = True`, server code uses
  `timezone.localdate()`.
- **Duplicates:** unique constraints for memberships, trip participants, contacts, connections, suggestion
  dismissals, one open invitation per person and scope. Completing a recurring household task is idempotent
  (`complete_task(..., expected_due)` with a row lock): a double click or retry does not skip a date or log twice.
  Save buttons are blocked while a request runs. Creating transactions, savings goals, trip expenses and the CSV
  import is idempotent on the server too: the client sends an `Idempotency-Key` (stable per form submission and
  content, `shared/idempotency.ts`); a repeated request gets the stored answer instead of a second object
  (`core/idempotency.py`, `core.IdempotencyRecord`, 24 h, per user and endpoint; same key with other content → 422).
- **Parents and references:** deleting an object removes its connections (post_delete per registered kind, plus
  `manage.py prune_connections`). Leaving a household clears that person's task assignments and rotation places;
  leaving a trip clears their trip-task assignments. Deleting a trip or household revokes open invitations to it.
- **Atomic multi-step operations:** invitation accept (status + membership), task completion, household member
  removal, trip participant removal, password reset, shopping completion.
- **Migrations:** complete (`makemigrations --check` clean), build from an empty database, the latest ones roll back;
  every migration that drops a column copies the data first. Verified on SQLite only — run once against
  PostgreSQL before launch. Tests never depend on the calendar date (relative dates for rules like „trip starts
  today or later“).
- Tests: `backend/core/test_persistence_audit.py`, `frontend/e2e/persistence-audit.spec.ts`.

