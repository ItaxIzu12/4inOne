# 4inOne — Architecture Direction

## Current direction

```text
Angular
   ↓
Django Backend
   ↓
SQLite (development / early MVP)
```

Later:

```text
Angular
   ↓
Django API
   ↓
PostgreSQL
```

Later still:

```text
Docker Compose
├── frontend
├── backend
├── postgres
└── optional worker / queue
```

## Frontend feature direction

Suggested Angular structure:

```text
src/app/
├── core/
│   ├── auth/
│   ├── api/
│   ├── guards/
│   └── services/
├── shared/
│   ├── ui/
│   ├── models/
│   └── utils/
├── layout/
│   ├── app-shell/
│   ├── sidebar/
│   ├── topbar/
│   └── mobile-nav/
└── features/
    ├── dashboard/
    ├── finance/
    ├── household/
    ├── organization/
    ├── travel/
    ├── connections/
    └── settings/
```

This is a direction, not permission to rewrite a working structure. Codex must adapt to the existing repository.

## Angular guidance

- Prefer reusable domain components.
- Avoid one giant dashboard component.
- Avoid meaningless micro-components.
- Use the project's established Angular patterns.
- Prefer reactive forms for complex forms.
- Use Signals where they improve local reactive UI state.
- Keep server state and UI state conceptually separate.
- Lazy-load larger feature areas when appropriate.

## Django guidance

Suggested logical apps may include:

```text
accounts
households
finance
organization
travel
connections
```

Do not split an existing Django project merely to match this list. Choose boundaries based on current code and migration cost.

## Database migration strategy

### Phase 1 — SQLite

Use Django ORM and migrations.

Avoid SQLite-only SQL, assumptions about weak concurrency and storing money as float.

### Phase 2 — PostgreSQL test environment

Before production:

1. run all migrations against PostgreSQL;
2. load representative data;
3. execute tests;
4. verify datetime behavior;
5. verify constraints;
6. verify indexes;
7. verify unique constraints;
8. test concurrent workflows.

### Phase 3 — PostgreSQL production

Use backups and migration procedures.

## Docker strategy

Do not Dockerize merely for appearance.

Introduce Docker when frontend/backend setup becomes difficult to reproduce, PostgreSQL is introduced, deployment begins or a worker service is needed.

## Background work

Future automations may require a worker/queue for recurring tasks, reminders, scheduled connection checks and notification generation.

Do not introduce Celery/Redis or another queue until a concrete background requirement exists.

## API design

Keep endpoints domain-oriented.

Cross-domain operations should be explicit.

Example:

```text
POST /connections/
POST /suggestions/{id}/accept/
```

Avoid hidden side effects where creating one object silently creates many others without explanation.
