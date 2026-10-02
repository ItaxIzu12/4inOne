# 4inOne — Product Decisions V2

This file records decisions that should not be repeatedly reopened without new evidence.

## D1 — Four domains, one product

Finanzen, Haushalt, Organisation and Reisen are independently useful domains inside one product.

The product is not marketed as “four apps in one”.

## D2 — Connections are the key differentiating layer

A Connection expresses that two real domain objects belong together.

Connections remain optional and do not replace the domain models.

## D3 — Build domains before intelligence

Current build order prioritizes finishing/testing all four areas and settings before Connection Engine V1.

Suggestions come after Connections. Automations come after Suggestions.

## D4 — Private by default

Personal objects remain private unless the user explicitly shares the relevant scope/object.

Membership does not equal universal visibility.

## D5 — Connections do not grant access

Connection visibility follows endpoint permissions. No metadata leaks.

## D6 — Demo data is not real user data

Demo/example content must be isolated and labelled.

Real accounts should not be silently seeded with fake finances, tasks, trips or appointments.

## D7 — Short onboarding

Registration stays minimal. Onboarding personalizes the first experience but does not force detailed life data before value is shown.

## D8 — Today is focused

The start screen shows a few things that matter now. It is not a KPI dashboard for every domain.

## D9 — Search is global and permission-aware

A future global search should search accessible data across domains. It must not be a decorative field.

## D10 — Product UI uses normal icons by default

Daily-use UI should use one consistent standard icon family.

3D/illustration is used selectively for onboarding, marketing, empty states and occasional hero content.

## D11 — Finances are visually restrained

Finances prioritizes trust, readability and clarity over playful decoration.

## D12 — Travel is not the center of 4inOne

Travel is a useful domain and a strong cross-domain demonstration, but ordinary household/planning/purchase scenarios are equally important.

## D13 — Existing functionality is preserved during design refactors

Visual modernization should not trigger needless rewrites of stable Angular/Django logic.

## D14 — No speculative infrastructure

Do not add queues, event buses, graph databases or AI services before a concrete product requirement justifies them.

## D15 — AI remains optional and subordinate

If AI is added later, it supports workflows such as classification, extraction, summaries or suggestions. Django remains authoritative for permissions and actions.

## D16 — Ownership: private owner, shared household, trip participants

Decided 2 October 2026 (ADR-001 §0). Money belongs to a person (`owner`). Household lists, tasks and the folder belong to household membership. Trips belong to their owner and participants.

The legacy shared household finances are frozen: readable, never written, nothing deleted. A shared household budget, if it ever comes, is a new explicit object.


## D17 — Monatsbudget und Sparziele (korrigiert durch Nutzerentscheidung)

Das Monatsbudget ist der festgelegte Gesamtbetrag für Ausgaben und Sparziele. **Restbudget = Monatsbudget − Ausgaben − Sparreservierungen.** Einnahmen erhöhen das festgelegte Monatsbudget nicht automatisch. Die vorherige Interpretation als reines Ausgabenlimit ohne Sparabzug ist ausdrücklich verworfen.

Der vom Nutzer bei einem Sparziel eingetragene Betrag „bereits gespart“ wird im Zeitraum des Ziels vom Restbudget abgezogen. Ohne Sparrate bleibt dieser Betrag in jedem gültigen Monat reserviert, nicht als wiederholte Buchung. Mit Sparrate gelten die bestehenden Reservierungsregeln: geplante und tatsächliche Beträge werden nicht doppelt gezählt. Pausierte Ziele reservieren nichts. Änderungen und Löschen berechnen die Reservierung neu; es werden keine Transaktionen automatisch erstellt.

`summary.total` entspricht dem Monatsbudget; `summary.available` ist das Restbudget. Dashboard, Demo, Fortschritt und Warnungen berücksichtigen Sparreservierungen. Ohne Monatsbudget bleibt das Restbudget unbekannt; Sparziele können trotzdem gespeichert werden. Bestehende Beträge bleiben unverändert. Keine Datenmigration erforderlich.
