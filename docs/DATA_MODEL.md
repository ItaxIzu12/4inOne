# 4inOne — Data Model Direction

This document describes product concepts, not final Django model code.

Codex must first inspect existing models.

## Core identities

### User

Represents an authenticated person.

Potential fields:

- id
- email
- first_name
- last_name optional
- is_active
- created_at
- updated_at

Use the project's existing Django user model strategy. Do not replace the authentication model without a migration plan.

## Workspace / ownership concept

Data needs an explicit ownership scope.

Possible scopes:

- personal
- household
- trip/group

A record must not rely on UI state to determine ownership.

## Household

Potential fields:

- id
- name
- created_by
- created_at

## HouseholdMembership

Potential fields:

- id
- household
- user
- role
- status
- joined_at

Roles should be intentionally limited. Avoid dozens of roles early.

## Finance

### Budget

- id
- owner_scope
- title
- period
- amount
- currency
- created_by

### Transaction

- id
- owner_scope
- amount
- type
- category
- date
- note
- created_by

### SavingsGoal

- id
- owner_scope
- title
- target_amount
- current_amount
- target_date optional
- status

## Household

### HouseholdTask

- id
- owner_scope
- title
- description optional
- due_at optional
- assignee optional
- recurrence optional
- status
- created_by

### ShoppingList / ShoppingItem

Can be added when household MVP requires it.

## Organisation

### Task

- id
- owner_scope
- title
- description optional
- due_at optional
- status
- priority optional
- assignee optional

### CalendarEvent

- id
- owner_scope
- title
- starts_at
- ends_at
- location optional
- description optional
- created_by

### Note

Optional after task/calendar MVP.

## Travel

### Trip

- id
- owner_scope
- title
- destination
- starts_on
- ends_on
- status
- created_by

### TripParticipant

- trip
- user or invited participant
- role/status

### PackingItem

- trip
- title
- status
- assignee optional

## Connections

See `CONNECTION_ENGINE.md`.

## Suggestions / automations

### Suggestion

Potential fields:

- id
- owner_scope
- suggestion_type
- title
- message
- action_payload
- status
- generated_at
- expires_at optional

### AutomationRule

Future concept:

- id
- owner_scope
- trigger_type
- conditions
- action_type
- enabled
- created_by

Avoid storing opaque arbitrary JSON for everything. Prefer typed fields or validated schemas for important behavior.

## General model rules

- timestamps where useful;
- server-side ownership checks;
- explicit indexes for common queries once real usage exists;
- avoid database-specific behavior while SQLite is active;
- use migrations for every schema change;
- test migrations before PostgreSQL switch;
- avoid storing derived values when they can be calculated reliably;
- use Decimal for money, never float;
- define currency explicitly even if MVP starts with EUR.
