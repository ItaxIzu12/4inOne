# 4inOne Product Specification V2

**4inOne — Dein Alltag. Alles verbunden.**

This package is the current product and implementation source of truth for the existing 4inOne project.

4inOne is a personal life-management product for four independently useful areas:

- Finanzen
- Haushalt
- Organisation
- Reisen

The differentiator is not “four apps in one”. The differentiator is that real-life things can be connected across areas, so users do not have to maintain the same context in several disconnected places.

> **Eine Information. Einmal eingeben. Dort nutzen, wo sie relevant ist.**

## Recommended reading order

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/DECISIONS.md`
4. `docs/PRODUCT_VISION.md`
5. `docs/PRODUCT_REQUIREMENTS.md`
6. `docs/DEMO_AND_ONBOARDING.md`
7. `docs/DESIGN_SYSTEM.md`
8. `docs/AUTH_AND_PERMISSIONS.md`
9. `docs/CONNECTION_ENGINE.md`
10. `docs/GLOBAL_SEARCH.md`
11. `docs/PROFILE_AND_SETTINGS.md`
12. `docs/DATA_MODEL.md`
13. `docs/ARCHITECTURE.md`
14. `docs/SECURITY.md`
15. `docs/ROADMAP.md`
16. `docs/COMPETITIVE_POSITIONING.md`
17. `docs/AI_FUTURE.md`
18. `CHANGELOG_V2.md`

## Existing project rule

Do not create a new Angular or Django project. Inspect and evolve the existing repository. Stable functionality has priority over visual rewrites.

## Current implementation strategy

The practical sequence is:

**Finish and stabilize the four areas first → profile/settings → end-to-end testing → Connection Engine V1 → Suggestions → Automations → optional integrations/AI.**

Design can be refined after stable functionality, provided component boundaries remain clean enough to swap the visual layer without rewriting business logic.
