# 4inOne — Current Product Decisions

This file records current decisions that supersede older ideas.

## D-001 — Product structure

4inOne contains Finanzen, Haushalt, Organisation and Reisen.

**Status:** Accepted

## D-002 — Domains are independently usable

Finanzen, Haushalt and Organisation are fully usable privately. Reisen is also a standalone domain. Connections are optional enhancements.

**Status:** Accepted

## D-003 — Connections are the differentiator

4inOne is not positioned as "four apps in one."

Preferred message:

> **Dein Alltag. Alles verbunden.**

**Status:** Accepted

## D-004 — Private by default

The user decides what to share. Household or family membership must not automatically expose private finance or personal organization data.

**Status:** Accepted

## D-005 — UI should be simpler

Previous visually dense concepts were considered too overloaded / AI-looking.

Current direction:

- less information;
- more whitespace;
- smaller use of avatars;
- minimal illustration;
- pastel accents;
- real product feel.

**Status:** Accepted

## D-006 — Web and mobile use the same system, different layouts

Mobile and web must share typography, colors, components and product language, but they should not be pixel-identical layouts.

**Status:** Accepted

## D-007 — Technical stack

- Angular
- Python
- Django
- SQLite initially
- PostgreSQL later
- Docker later

**Status:** Accepted

## D-008 — Existing project should be refactored

Do not restart 4inOne from scratch unless a future technical audit proves the repository is unsalvageable.

**Status:** Accepted

## D-009 — Automation should begin as suggestions

Start with:

> detect → explain → suggest → user confirms

Later, users may enable trusted automations.

**Status:** Accepted

## D-010 — Travel is an example, not the center of the product

Connections must also work for everyday finance, organization and household use.

Examples include a washing-machine purchase, birthday, household routine, financial goal and appointment.

**Status:** Accepted

## D-011 — Eigentümerschaft über „Bereiche“ (persönlich, Haushalt, später Reise)

Jeder Datensatz gehört genau einem Bereich. Persönliche Bereiche sind nicht teilbar; geteilt wird nur über ausdrücklich angelegte gemeinsame Bereiche. Details, Alternativen und Migrationsschritte: `ADR-001-OWNERSHIP.md`.

**Status:** Proposed — wartet auf Entscheidung (offene Fragen in ADR-001 §7)
