# First Codex Prompt

Read the following files completely before changing code:

- AGENTS.md
- docs/DECISIONS.md
- docs/PRODUCT_VISION.md
- docs/PRODUCT_REQUIREMENTS.md
- docs/CONNECTION_ENGINE.md
- docs/DATA_MODEL.md
- docs/DESIGN_SYSTEM.md
- docs/ARCHITECTURE.md
- docs/AUTH_AND_PERMISSIONS.md
- docs/SECURITY.md
- docs/ROADMAP.md

Then inspect the complete existing repository.

Technology direction:
- Angular frontend
- Python / Django backend
- SQLite currently
- PostgreSQL later
- Docker later

Important:
- Do NOT create a new project.
- Do NOT replace working architecture without evidence.
- Reuse existing components, services, models and APIs when appropriate.
- Keep each domain independently usable.
- Cross-domain behavior must use explicit Connections / Automations.
- Personal data is private by default.
- The UI must be simple, calm, modern and responsive.
- The images in docs/references are visual references only.
- Do not embed the reference screenshots in the product.

Your first task is analysis only.

Produce:
1. Current repository architecture.
2. What already matches the target architecture.
3. Technical debt or blockers.
4. Missing authentication / permission pieces.
5. Missing domain boundaries.
6. Where a Connection Engine can be introduced safely.
7. A proposed migration/refactoring plan in small phases.
8. Files you expect to modify in Phase 1.

Do not modify code yet.
