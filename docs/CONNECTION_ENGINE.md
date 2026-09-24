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
