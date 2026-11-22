# 4inOne — Global Search

## Purpose

The top-level search should eventually let a user find relevant accessible information across domains without navigating each section separately.

This is a product feature, not decorative UI.

## Example searches

### “Waschmaschine”

Possible accessible results:

- household task;
- savings goal;
- delivery calendar event;
- connected-items context.

### “Berlin”

Possible accessible results:

- trip;
- tasks;
- calendar events;
- related expenses/budget records where supported.

## Requirements

- permission-aware;
- grouped or clearly labelled by domain/type;
- fast enough for normal use;
- keyboard-friendly on desktop;
- sensible empty/loading/error states;
- no metadata leaks.

## Result presentation

Show enough context to distinguish results, but not excessive detail.

Possible fields:

- icon/domain;
- title;
- short secondary context;
- date/status where relevant.

## Permissions

Search must reuse backend authorization logic. Do not fetch all records client-side and filter them in Angular.

## Command palette later

A later `Cmd/Ctrl + K` experience may combine:

- search;
- navigation;
- quick creation.

Do not build a command platform before basic global search is useful and stable.

## Umsetzung (22.11.2026, O4 aus dem UX-Audit)

- **Backend:** `GET /api/v1/search/?q=…` (`backend/connections/search.py`, `SearchView`, Limit `search` 120/min je
  Person). Ab 2 Zeichen, höchstens 80. Je Art höchstens 5 Treffer: Termine, Aufgaben, Notizen (Titel und Text),
  Haushaltsaufgaben, Geräte, Verträge (keine Kind-Konten), Reisen (inkl. Teilnahme), Sparziele, eigene Buchungen
  (Verwendungszweck). Sichtbarkeit exakt wie in den Domains (`connections.registry.KINDS`, Owner-Regel der privaten
  APIs); gelöschte Buchungen nie. Antwort: Gruppen mit `type`, `label`, `domain` und Treffern (`title`, `subtitle`,
  `link: {path, query}`) – keine Beträge fremder Verträge, keine Vertrags- oder Seriennummern.
- **Frontend:** `shared/features/global-search` (`app-global-search`) in der Kopfzeile (`layout/app-shell`,
  `searchEnabled = true`). Combobox-Muster: Tippen (250 ms entprellt) zeigt die Gruppen; ↑/↓, Enter, Esc; ⌘K/Strg+K
  springt hinein. Ein Treffer öffnet den Eintrag über Deep-Links der Bereiche (`?kind=task|event|note&id=`,
  `?goal=`, `?buchung=`, `?task=`, `?entry=`, `?trip=`). In der Demo durchsucht die Komponente die Demo-Schnittstellen
  im Browser (kein Server, keine fremden Daten).
- **Tests:** `backend/connections/tests/test_search.py` (Bereiche, Links, Rechte, Kind-Konto, gelöschte Buchungen,
  Anmeldung).
