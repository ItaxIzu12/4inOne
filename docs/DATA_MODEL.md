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
