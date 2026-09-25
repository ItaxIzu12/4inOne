# 4inOne — Connection Engine

## Purpose

Connections are the core differentiator of 4inOne.

A Connection states that two objects from the same or different domains belong together.

Examples:

- Trip ↔ SavingsGoal
- Trip ↔ CalendarEvent
- Trip ↔ Task
- HouseholdTask ↔ CalendarEvent
- PurchaseGoal ↔ Budget
- Event ↔ Expense

## Product rule

Connections must never make a domain unusable on its own. They are optional relationships.

## Connection model concept

A connection should contain enough information to answer:

- What is the source object?
- What is the target object?
- Why are they connected?
- Who created the connection?
- Was it manual, suggested or automated?
- When was it created?
- Is the user allowed to see both sides?

Conceptual fields:

```text
Connection
- id
- source_domain
- source_type
- source_id
- target_domain
- target_type
- target_id
- relation_type
- origin
- created_by
- created_at
- metadata (only when truly needed)
```

Do not implement this structure blindly. First evaluate the existing Django models and choose the safest representation.

## Relation types

Possible relation types:

- belongs_to
- planned_for
- funded_by
- scheduled_as
- task_for
- expense_for
- reminder_for
- shared_with
- affects

Keep relation types explicit.

## Example: private purchase

```text
New washing machine
  ↕
Savings goal: 700 €
  ↕
Task: compare offers
  ↕
Calendar: delivery
  ↕
Household: dispose old machine
```

This proves Connections are not travel-specific.

## Example: birthday

```text
Birthday
  ↕
Calendar event
  ↕
Task: buy gift
  ↕
Optional gift budget
```

## Example: trip

```text
Japan 2027
  ↕
Budget
  ↕
Savings goal
  ↕
Calendar events
  ↕
Tasks
  ↕
Household changes
```

## Sync behavior

Connections do not automatically mean two records must always mirror each other.

Define sync behavior per relation.

Possible modes:

- reference only;
- notify on change;
- suggest update;
- auto-sync allowed by user setting.

Default to safer behavior:

> detect → explain → suggest → user accepts

Only later allow trusted automations.

## Change propagation example

User changes trip dates.

4inOne detects calendar events linked to the trip, household tasks inside the old travel window and a savings deadline linked to the trip.

The app should show:

> 3 verbundene Elemente könnten angepasst werden.

The user can review and apply changes.

## Authorization

A Connection must never grant access by itself.

A user must have permission to view each connected object.

If a connected object is not visible, the API must not leak its details.

## Implementation guidance

Avoid direct hard-coded foreign keys between every domain pair.

Prefer a dedicated connection layer when cross-domain relationships become real.

Do not over-generalize too early.

Start with 2–3 concrete supported connection types and expand based on usage.

## V1 implementation (25 Sep 2026)

Implemented as the Django app `connections` (`/api/v1/connections/`), without foreign keys into other domains.

Supported pairs (fixed direction, so `A→B` and `B→A` cannot both exist):

| Source | Target | Default relation |
|---|---|---|
| `SAVINGS_GOAL` | `TASK` | `TASK_FOR` |
| `TASK` | `CALENDAR_EVENT` | `SCHEDULED_AS` |
| `HOUSEHOLD_TASK` | `CALENDAR_EVENT` | `SCHEDULED_AS` |

`RELATED_TO` is allowed on each pair. `TRIP` and `BUDGET` exist as types but are not in any allowed pair yet.

Type mapping: `TASK` = `organisation.PersonalTask`, `CALENDAR_EVENT` = `organisation.PersonalEvent`, `SAVINGS_GOAL` = private `finanzen.SavingsGoal`, `HOUSEHOLD_TASK` = `haushalt.Task`. The household `CalendarEvent` is deliberately not connectable: it is synchronised automatically from household tasks and folder deadlines.

Authorization rules (`connections/services.py`):

- An object is visible only if it is in the user's own queryset (`registry.KINDS[...].visible`), the same rule as the domain APIs.
- Foreign and non-existent objects give the same `404`, so IDs cannot be probed.
- A connection is listed, read or deleted only if the user may see **both** sides. Otherwise it does not appear at all (no masked entry, no counter).
- `origin` and `created_by` are set by the server; the client cannot choose them.
- Deleting an object removes its connections (`connections/signals.py`), because there is no `ON DELETE CASCADE` without foreign keys.

Integrity and drift protection:

- `python manage.py prune_connections [--dry-run]` removes connections whose object no longer exists (only possible when a delete bypassed the signals, e.g. raw SQL). Readers ignore such rows anyway.
- `connections/tests/test_registry_contract.py` ties `registry.KINDS[...].visible` to the domain APIs: an object is visible in the registry exactly when the domain's own detail endpoint returns it, for owner, housemate, child account and stranger. A new connectable type without an entry there fails the test.

Deep links: each connected item links to the page that opens it (`/app/organisation?kind=task|event&id=`, `/app/haushalt?tab=aufgaben&task=`, `/app/finanzen?goal=`). The page opens the object and removes the parameter from the address.

Open point: `ADR-001` (ownership model) is still undecided. Visibility is defined per type in `registry.py`; when the model changes, only that file has to follow, and the contract test shows what breaks.
