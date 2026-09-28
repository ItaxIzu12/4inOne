# First Repository Audit Prompt

Read these files completely before modifying code:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/DECISIONS.md`
- `docs/PRODUCT_VISION.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/DEMO_AND_ONBOARDING.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/AUTH_AND_PERMISSIONS.md`
- `docs/CONNECTION_ENGINE.md`
- `docs/GLOBAL_SEARCH.md`
- `docs/PROFILE_AND_SETTINGS.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/ROADMAP.md`

Then inspect the complete existing repository.

Technology direction:

- Angular frontend
- Python/Django backend
- SQLite now
- PostgreSQL later
- Docker later

Important:

- Do not create a new project.
- Preserve stable functionality.
- Adapt the architecture to the repository rather than forcing theoretical folder structures.
- Every domain must remain useful independently.
- Cross-domain behavior must be explicit and permission-safe.
- Demo data and real user data must remain distinct.

First task: analysis only.

Produce:

1. Current frontend/backend architecture.
2. Existing auth and ownership model.
3. Current state of Organisation, Finanzen, Haushalt and Reisen.
4. Existing profile/settings capabilities.
5. Current test/build status.
6. Security or permission gaps.
7. Design-system inconsistencies, including icons/3D assets.
8. Whether the code is ready for Connection Engine V1.
9. A phased plan with the smallest safe next steps.
10. Files likely to change in Phase 1.

Do not modify code yet.
