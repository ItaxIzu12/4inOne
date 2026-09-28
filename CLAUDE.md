# 4inOne — Claude Code Instructions

Read `AGENTS.md` first. The same product and security rules apply to Claude Code.

## Before editing

Read the documentation relevant to the requested area and inspect the existing repository before changing code.

For visual work, inspect existing Angular components, CSS/SCSS/tokens and the currently installed icon system before introducing anything new.

For backend work, inspect existing Django apps, serializers/forms/views/services and permission checks before creating new patterns.

## Do not

- create a replacement project;
- replace working business logic during a visual refactor;
- invent APIs without inspecting the current backend;
- introduce a second icon library if the existing one is sufficient;
- bypass backend permissions for convenience;
- use screenshots as application backgrounds to imitate a reference design.

## Preferred implementation style

- small changes;
- explicit types/enums;
- reusable components where there is real reuse;
- service layer for cross-domain behavior where helpful;
- tests for permissions and important workflows;
- explain what changed and what remains intentionally unchanged.

## Completion report

After substantial work, report:

1. files changed;
2. behavior added/changed;
3. tests/build commands run;
4. unresolved issues or assumptions;
5. whether any migration is required.
