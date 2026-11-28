# Lumiknot (vormals 4inOne) — Claude Code Instructions

Read `AGENTS.md` first. Its feature protocol (§ 1) and the ten binding principles (§ 2) apply to every task; this file
only adds what is specific to Claude Code. Do not duplicate rules here — change them in `AGENTS.md`.

## Natural-language feature requests

The user describes features in plain language and expects the architecture to be applied without re-explaining it.

- Treat the request as a domain requirement; work through `AGENTS.md` § 1 end to end.
- Decide area and placement with `docs/ARCHITECTURE.md` § 9, reuse with `AGENTS.md` § 2.2.
- Proceed without questions when the request is clear; state assumptions in the hand-over. Ask only for the cases
  listed in `AGENTS.md` § 1 (materially different behaviours, destructive data changes, new apps/infrastructure/outside
  services, AI capabilities, deferred features).
- Check `git status` before starting: Codex or the user may work in parallel; never overwrite their changes.

## Before editing

- Read the documentation for the area (`docs/*_V1.md`) and inspect the existing code before changing it.
- Visual work: read `DESIGN.md`; inspect existing Angular components, CSS/SCSS tokens and the installed icon system.
- Brand: the product is **Lumiknot** (`docs/BRAND_IDENTITY.md` for purpose, promise and tone; `docs/BRAND_CONFIGURATION.md` for the central config and section registry; `docs/BRAND_GUIDELINES.md`, `docs/LOGO_USAGE.md`, `docs/NAMING_CONVENTIONS.md`);
  logo only via `<app-brand>`, page titles via `brandTitle()`, colors via tokens. Old technical `4inone` names stay
  unless `docs/REBRANDING_MIGRATION.md` says otherwise. After logo/color changes run `npm run brand:assets`.
- Backend work: inspect existing apps, serializers, views, services and permission checks before creating patterns.

## Do not

- create a replacement project;
- replace working business logic during a visual refactor;
- invent APIs without inspecting the current backend;
- introduce a second icon library if the existing one is sufficient;
- bypass backend permissions for convenience;
- use screenshots as application backgrounds to imitate a reference design;
- develop the Personal AI Core or integrate local AI models (`AGENTS.md` § 2.5);
- start architecture improvements without the user's approval; after each approved step run the full test suite
  and confirm the existing application still works (`AGENTS.md` § 1).

## Preferred implementation style

- small changes; explicit types/enums;
- reusable components where there is real reuse;
- service layer for cross-domain behaviour, hooks/public interfaces instead of cross-area imports;
- tests for permissions and important workflows;
- explain what changed and what remains intentionally unchanged.

## Verification

- Backend: `backend/.venv/bin/python -m pytest -q`, `manage.py check`, `manage.py makemigrations --check --dry-run`
  (test databases only, never the user's development database).
- Frontend: `npm run check:architecture`, `npm run check:brand`, `npx ng test --watch=false`, `npx ng build`, Playwright specs of the touched
  area (`npx playwright test e2e/<spec> --project=chromium`), full-stack specs with
  `-c playwright.fullstack.config.ts` when backend and frontend interact.
- UI changes: check in the browser preview (desktop and 390 px, light and dark) and run the axe checks.
- Changes in `deploy/`: `deploy/ci/check-deploy.sh nginx compose` locally (Docker); `shell systemd` need Linux (run
  them in an `ubuntu:24.04` container or rely on the CI job `deploy`).
- Never report a test as passed that did not run; say what could not be verified and why.

## Design documentation

After any visual or design-system change, update `docs/DESIGN_SYSTEM.md` and `DESIGN.md` in the same step
(`AGENTS.md` § 6).

## Completion report

After substantial work, report:

1. files changed;
2. behaviour added/changed;
3. tests/build commands run, with real results;
4. unresolved issues or assumptions;
5. whether any migration is required;
6. security, performance or resource effects worth knowing (or “none”).

Commit and push only when the user asks; check for secrets and excluded files (`skills-lock.json`, stageshow skill
folders) before committing.
