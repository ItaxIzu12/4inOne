# 4inOne — Codex Workflow

## Goal

Use Codex as an implementation partner for the existing repository.

Do not hand it the entire historical chat as the primary source. These files are the curated source of truth.

## Recommended workflow

### Step 1 — Audit

Use `CODEX_START_PROMPT.md`.

No code changes.

### Step 2 — Choose one phase

Example:

> Implement Phase 1 authentication layout only.

### Step 3 — Ask for scope

Before code changes, Codex should list:

- files to modify;
- files to add;
- APIs affected;
- migrations required;
- test impact.

### Step 4 — Implement

Keep each change reviewable.

### Step 5 — Verify

Run:

- frontend tests;
- backend tests;
- lint/type checks;
- migrations check;
- responsive review.

### Step 6 — Screenshot comparison

For UI changes:

- use `references/mockup-mobile.png`;
- use `references/mockup-web.png`;
- compare hierarchy/spacing;
- do not blindly chase pixel equality.

## Prompt template for a feature

```text
Read AGENTS.md and the relevant docs first.

Feature:
<describe one feature>

Before editing:
1. inspect current implementation;
2. identify reusable code;
3. propose the smallest safe change.

Requirements:
- preserve private-by-default behavior;
- use existing project conventions;
- keep mobile and desktop responsive;
- include loading, empty and error states;
- update tests.

After implementation:
- summarize changed files;
- explain migrations/API changes;
- list tests run;
- mention any remaining risks.
```

## Prompt template for UI refactor

```text
Use docs/DESIGN_SYSTEM.md and docs/references as visual direction.

Do not embed the screenshot.

Rebuild the UI with Angular components.

Keep:
- business logic;
- routing;
- API contracts;
- accessibility.

Improve:
- hierarchy;
- whitespace;
- responsive layout;
- reusable components.

Do not refactor unrelated features.
```

## Prompt template for Connection Engine

```text
Read:
- docs/CONNECTION_ENGINE.md
- docs/DATA_MODEL.md
- docs/AUTH_AND_PERMISSIONS.md
- docs/SECURITY.md

Inspect existing Django models first.

Implement only the agreed V1 connection type(s).

Do not create a universal generic system unless the current requirements need it.

Every API path must enforce permissions on both connected objects.
```
