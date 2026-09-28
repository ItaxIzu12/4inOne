# 4inOne — Product Vision V2

## Product statement

**4inOne — Dein Alltag. Alles verbunden.**

4inOne is a personal life-management app for four everyday areas:

1. Finanzen
2. Haushalt
3. Organisation
4. Reisen

Each area must be useful independently. The product becomes distinctive when it can represent and later act on meaningful relationships between objects from different areas.

## The problem

A single real-life situation often gets fragmented across several tools.

Example: a trip may require:

- a trip plan;
- savings/budgeting;
- calendar dates;
- tasks;
- a packing list;
- household preparation;
- coordination with another person.

The user repeatedly enters the same context, but the tools do not understand that the records belong together.

## Core promise

> **Eine Information. Einmal eingeben. Dort nutzen, wo sie relevant ist.**

The product should not compete by having the longest checklist of features. It should reduce duplicate work and make relationships between everyday responsibilities understandable.

## The simplest explanation

Use a concrete scenario before explaining the architecture.

### Example: a new washing machine

```text
Sparziel 700 €
↕
Aufgabe: Angebote vergleichen
↕
Liefertermin
↕
Altgerät entsorgen
```

These things belong to one real-world situation even though they live in different areas.

## Product principles

### Every area works alone

A user may use only Finanzen, only Organisation, only Haushalt or only Reisen.

No one must create a family/household to use the app.

### Private by default

Sharing is deliberate and scoped. Being connected to another person does not automatically reveal private finances, tasks, calendar events or trips.

### Connections are optional

Connections enhance domain objects; they do not replace them.

### Suggestions, not surprises

The system may detect useful relationships or consequences, but it should explain why and ask before consequential changes.

Recommended interaction model:

```text
detect → explain → suggest → user decides
```

### Simple surface, capable system

The interface should feel calm even when the underlying model is powerful.

## Intended audience

4inOne should work for:

- individuals;
- couples;
- families;
- shared flats;
- temporary groups such as travel companions.

Marketing should not frame the product as “a family app that singles can also use”. It is a personal everyday platform that can become collaborative where the user chooses.

## Product hierarchy

```text
Four useful domains
        ↓
Connections
        ↓
Suggestions
        ↓
Automations
```

Connections are the first differentiating layer. Suggestions and automations should be built only after the underlying domains and permissions are reliable.

## Long-term direction

Possible later capabilities:

- external calendar sync;
- financial integrations;
- receipt/document capture;
- travel imports;
- shared routines;
- smart suggestions;
- user-enabled automations;
- local/private AI assistance;
- natural-language action creation.

These are directions, not MVP promises.
