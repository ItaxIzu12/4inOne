# Lumiknot — Demo, Landing and Onboarding

## Goal

A new visitor should understand the product before being asked to trust it with personal data.

The recommended sequence is:

```text
Landing / product explanation
        ↓
[Demo ausprobieren]   [Konto erstellen]
        ↓                    ↓
Demo sandbox           Registration
                            ↓
                     Short onboarding
                            ↓
                 Real personal workspace
```

## Landing page

Do not lead with architecture terms such as “Connection Engine”. Lead with a real-world benefit.

Recommended short explanation:

> Lumiknot verbindet Finanzen, Haushalt, Organisation und Reisen. Jeder Bereich funktioniert auch alleine. Wenn Dinge zusammengehören, kann Lumiknot sie miteinander verbinden.

Use one concrete example, preferably not travel-only.

### Preferred first example

**Neue Waschmaschine**

- Sparziel 700 €
- Aufgabe: Angebote vergleichen
- Liefertermin
- Altgerät entsorgen

This demonstrates that Lumiknot is about everyday connections rather than being primarily a travel planner.

## Demo mode

Demo mode should let a visitor experience the product without contaminating a real account.

Recommended characteristics:

- clear “Demo-Modus · Beispieldaten” label;
- isolated demo workspace/account/session;
- reset capability where useful;
- safe editing/deleting of example content;
- CTA to register/start with own data;
- no sensitive-looking fake content presented as real user history.

## Real account

After registration, the real account starts with real user-owned data only.

Do not silently create fake:

- transactions;
- income;
- bills;
- trips;
- appointments;
- household responsibilities.

Use high-quality empty states and guided first actions instead.

## Templates vs demo data

Templates may be offered deliberately.

Example:

> “Typische Haushaltsroutine hinzufügen”

The user consciously creates real tasks from a template.

This is different from silently inserting demo records.

## Onboarding flow

Keep onboarding to roughly 3–5 lightweight steps.

Recommended:

1. Willkommen.
2. “Nur für mich” / “Gemeinsam”.
3. Select one or more starting areas.
4. Optional profile basics.
5. “Demo kurz entdecken” or “Mit meinen Daten starten”.

Do not ask for income, detailed household structure or travel plans during signup.

## Start guides in every area (since 2026-11-21)

After onboarding, an empty account sees in each area a guide „So startest du mit …“ with three steps that lead
straight to the right form and tick off from real data (`GET /api/v1/onboarding/guide/`):

| Area | 1 | 2 | 3 (optional) |
| --- | --- | --- | --- |
| Finanzen | Monatsbudget festlegen | Erste Ausgabe erfassen (or CSV import) | Sparziel anlegen |
| Haushalt | Erste Aufgabe anlegen | Einkauf planen | Gerät oder Vertrag ablegen |
| Organisation | Ersten Termin eintragen | Eine Aufgabe festhalten | Eine Notiz anlegen |
| Reisen | Erste Reise anlegen | Packliste beginnen | Reisebudget festlegen |

An area counts as set up once steps 1 and 2 are done; then its guide disappears. The start page shows
„Dein Start mit Lumiknot“ with all four areas. Every guide can be hidden with ✕ — stored in the account
(`OnboardingProfile.dismissed_guides`, `PUT /api/v1/onboarding/guide/ {area, hidden}`), so it stays hidden on all
devices; Einstellungen › „Startleitfäden“ shows them again. While the start overview is shown and there is neither a
budget nor an expense, the start page leaves out its finance card. Only the person's own visible data counts (own household, own/participated trips). Never shown in the demo.

## Demo tour

A very short tour may explain:

1. Today — what matters now.
2. Four areas — useful independently.
3. Connections — what makes Lumiknot different.

Avoid long multi-page feature tutorials.

## Success criterion

After 30–60 seconds, a new user should be able to explain:

> “Lumiknot organizes several parts of everyday life, and it can connect things that belong together so I don't have to manage the same context in different apps.”
