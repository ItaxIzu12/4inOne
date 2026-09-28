# 4inOne — Connection Engine V1

## Purpose

A Connection expresses one idea:

> **These two existing things belong together.**

A connection is not the domain object itself, and it is not an automation.

## Why it exists

Without an explicit connection layer, cross-domain logic tends to become hard-coded foreign keys and hidden side effects.

The Connection Engine gives the product a controlled way to connect independently useful domain objects.

## V1 scope

Implement V1 only after the underlying domains involved are stable enough to trust.

V1 should support:

- create a supported connection;
- list connections for an object;
- show connected items in a simple UI;
- delete a connection;
- enforce permissions;
- prevent invalid/duplicate/self links.

Do not implement automations in V1.

## Recommended first connection types

Start small. Good candidates include:

- Task ↔ CalendarEvent
- SavingsGoal ↔ Task
- HouseholdTask ↔ CalendarEvent

If Reisen is stable:

- Trip ↔ Task
- Trip ↔ CalendarEvent
- Trip ↔ Budget/SavingsGoal where the existing finance model supports it safely

Do not create dozens of relation types at once.

## Data shape

Conceptual fields:

```text
id
source_domain
source_type
source_id
target_domain
target_type
target_id
relation_type
origin
created_by
created_at
```

`origin` may later support values such as:

- MANUAL
- SUGGESTED
- AUTOMATED

Use typed enums/choices rather than arbitrary strings.

The exact implementation must adapt to the current Django model structure.

## Validation

Reject:

- self-links;
- duplicates;
- nonexistent endpoints;
- unsupported type combinations;
- connections where the actor lacks required access.

Normalize direction if a relation is semantically symmetric, or explicitly document direction when it matters.

## Service layer

Prefer explicit cross-domain services/functions such as:

```text
create_connection(...)
delete_connection(...)
get_connections_for_object(...)
user_can_view_endpoint(...)
```

Do not spread permission and relation logic across random views/components.

## API direction

Conceptual endpoints:

```text
POST   /api/connections/
GET    /api/connections/?object_type=TASK&object_id=123
DELETE /api/connections/{id}/
```

Adapt to the existing API style instead of forcing these exact paths.

## UI

Use user language such as:

- “Verknüpft”
- “Verbundene Elemente”
- “Verbindung hinzufügen”

Avoid technical terms like source node/target node.

Do not build a huge graph visualization for V1. A compact connected-items list is usually better.

## Permission invariant

> **A connection never grants access.**

If the user cannot access the target object, the connection must not leak target details.

## Tests

At minimum test:

- user can connect two accessible own objects;
- user cannot connect to another user's inaccessible object;
- user cannot read a connection that would leak inaccessible data;
- user cannot delete unauthorized connections;
- duplicate rejected;
- self-link rejected;
- invalid relation type rejected;
- nonexistent target rejected.

## Later: Suggestions

Suggestions may propose connections or consequences after V1 is stable.

## Later: Automations

Automations may act on connected objects only when the behavior is transparent, permission-safe and user-controlled.
