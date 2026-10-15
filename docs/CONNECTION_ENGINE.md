# 4inOne — Connection Engine V1

## Purpose

A Connection expresses one idea:

> **These two existing things belong together.**

A connection is not the domain object itself, and it is not an automation.

## Why it exists

Without an explicit connection layer, cross-domain logic tends to become hard-coded foreign keys and hidden side effects.

The Connection Engine gives the product a controlled way to connect independently useful domain objects.

## V1 scope

Implement V1 only after the underlying domains involved are stable enough to trust.

V1 should support:

- create a supported connection;
- list connections for an object;
- show connected items in a simple UI;
- delete a connection;
- enforce permissions;
- prevent invalid/duplicate/self links.

Do not implement automations in V1.

## Recommended first connection types

Start small. Good candidates include:

- Task ↔ CalendarEvent
- SavingsGoal ↔ Task
- HouseholdTask ↔ CalendarEvent

If Reisen is stable:

- Trip ↔ Task
- Trip ↔ CalendarEvent
- Trip ↔ Budget/SavingsGoal where the existing finance model supports it safely

Do not create dozens of relation types at once.

## Data shape

Conceptual fields:

```text
id
source_domain
source_type
source_id
target_domain
target_type
target_id
relation_type
origin
created_by
created_at
```

`origin` may later support values such as:

- MANUAL
- SUGGESTED
- AUTOMATED

Use typed enums/choices rather than arbitrary strings.

The exact implementation must adapt to the current Django model structure.

## Validation

Reject:

- self-links;
- duplicates;
- nonexistent endpoints;
- unsupported type combinations;
- connections where the actor lacks required access.

Normalize direction if a relation is semantically symmetric, or explicitly document direction when it matters.

## Service layer

Prefer explicit cross-domain services/functions such as:

```text
create_connection(...)
delete_connection(...)
get_connections_for_object(...)
user_can_view_endpoint(...)
```

Do not spread permission and relation logic across random views/components.

## API direction

Conceptual endpoints:

```text
POST   /api/connections/
GET    /api/connections/?object_type=TASK&object_id=123
DELETE /api/connections/{id}/
```

Adapt to the existing API style instead of forcing these exact paths.

## UI

Use user language such as:

- “Verknüpft mit”
- “Verknüpfen”
- “Verbindung entfernen”

Avoid technical terms like source node/target node.

Do not build a huge graph visualization for V1. A compact connected-items list is usually better.

## Permission invariant

> **A connection never grants access.**

If the user cannot access the target object, the connection must not leak target details.

## Implementierter Stand (V1, 10.10.2026)

Code: `backend/connections/` (registry.py = einzige Stelle, die die Domains kennt; services.py = alle Regeln),
Frontend `shared/connections/` (`<app-connections>`).

- **Typen (Allowlist):** `TASK`, `CALENDAR_EVENT` (Organisation), `SAVINGS_GOAL` (Finanzen), `HOUSEHOLD_TASK`
  (Haushalt), `TRIP` (Reisen). `BUDGET` ist vorgesehen, aber in keinem Paar. Erlaubte Paare und Relationen nur in
  `registry.ALLOWED_PAIRS`; Standardrelation je Paar.
- **Ungerichtet:** Jedes Paar hat eine feste gespeicherte Richtung (`canonical_pair`), A↔B und B↔A sind dieselbe
  Zeile. Duplikate verhindert die Datenbank (`unique_connection_pair`), Selbstverbindungen ein Check-Constraint;
  gleichzeitige Anfragen enden als 409, nie als 500.
- **Sehen** = beide Seiten im Queryset `Kind.visible` (dieselbe Regel wie die Domain-API). Sonst taucht die
  Verbindung nirgends auf — kein Zähler, kein maskierter Eintrag. Fremd und nicht vorhanden sind identisch (404).
- **Verknüpfen** = beide Seiten im Queryset `Kind.editable` (Schreibrecht der Domain): Reise nur Ersteller:in und
  Teilnehmende mit Rolle OWNER/EDITOR, VIEWER nicht. Sichtbar, aber nur lesbar → 403.
- **Entfernen** = wer die Verbindung angelegt hat oder beide Seiten bearbeiten darf. Die Liste liefert dafür
  `can_delete`; das Frontend zeigt „Entfernen“ nur dann. Entfernen löst nur den Zusammenhang, beide Objekte bleiben.
- **Server bestimmt** `origin` (MANUAL; SUGGESTED nur über angenommene Vorschläge), `created_by` (request.user),
  `created_at`. IDs 1 … 2⁶³−1, sonst 400 (Body) bzw. 404 (Pfad).
- **Limit** 50 je Objekt zählt nur die eigenen Verbindungen (sonst verriete die Meldung versteckte fremde).
- **Gelöschte Objekte:** `post_delete`-Signale entfernen die Verbindungen sofort; `prune_connections` räumt
  Waisen auf, die an Signalen vorbei entstanden sind. Nicht auflösbare Seiten werden nie angezeigt.
- **Ausgabe:** `id`, `can_delete`, `relation_type`/`relation_label`, `origin`, `created_at`, `source`/`target`/`other`
  als `{type, id, title, subtitle, domain}` — nur für sichtbare Objekte, keine verschachtelten Domain-Objekte.
- **Schreib-Drosselung:** `connections_write` (Standard 60/min pro Person). Antworten `Cache-Control: no-store`.
- **UI:** „Verknüpft mit“ in den Bearbeiten-Dialogen von Sparziel, Reise, Haushaltsaufgabe, Aufgabe und Termin;
  „+ Verknüpfen“ öffnet den Assistenten (Art → Objekt aus serverseitig gefilterten Kandidaten → bestätigen).
  Fehler (403/404/409/429/Netzwerk) als verständlicher Text, nie die Serverantwort.
- **Bereits vorhanden, nicht V1-Kern:** Reise-Vorschläge (`suggestions.py`) und „Heute“/Reise-Übersicht lesen nur
  eigene bzw. sichtbare Daten; angenommene Vorschläge verknüpfen nur, wenn die Person beide Seiten bearbeiten darf.

## Tests

At minimum test:

- user can connect two accessible own objects;
- user cannot connect to another user's inaccessible object;
- user cannot read a connection that would leak inaccessible data;
- user cannot delete unauthorized connections;
- duplicate rejected;
- self-link rejected;
- invalid relation type rejected;
- nonexistent target rejected.

## Suggestions V1 — Verknüpfungs-Vorschläge (11.10.2026)

Code: `backend/connections/link_suggestions.py`, API `/api/v1/connections/link-suggestions/` (`GET ?object_type=&object_id=`,
`POST accept/ {key}`, `POST dismiss/ {key}`), Frontend im Abschnitt „Verknüpft mit“ und eine Karte in „Für dich“.

- **Ablauf:** erkennen → erklären → vorschlagen → die Person entscheidet. Nichts wird automatisch verknüpft;
  „Verknüpfen“ ruft `services.create_connection(origin=SUGGESTED)` mit allen Prüfungen der Engine. Sonst ändert
  Annehmen nichts (kein Datum, Status, Betrag).
- **Nicht gespeichert:** Vorschläge werden bei jedem Aufruf aus den aktuellen Daten berechnet. Damit gibt es keine
  doppelten oder veralteten Einträge; gelöschte Objekte, entzogene Rechte, inzwischen bestehende Verbindungen
  und vorbei- oder abgesagte Reisen fallen automatisch weg. Gespeichert wird nur „Nicht relevant“
  (`SuggestionDismissal`, Schlüssel `link:<Quelle>:<id>:<Ziel>:<id>` in kanonischer Richtung) — dauerhaft für
  dieses Paar und diese Person. Status-Entsprechung: PENDING = berechnet, ACCEPTED = Verbindung existiert,
  DISMISSED = Ablehnung gespeichert, EXPIRED = Regel greift nicht mehr.
- **Nur Bearbeitbares:** Kandidaten kommen aus `Kind.editable` beider Seiten — was die Person nicht sehen oder nicht
  verknüpfen darf, kommt in keiner Rechnung vor (kein Titel, keine ID, kein Zähler).
- **Regeln** (Allowlist, je Paar eine Funktion, Schwelle 0,7):

  | Paar | Signale | reason_code |
  |---|---|---|
  | Reise ↔ Aufgabe | nennt das Reiseziel als ganzes Wort **und** (fällig 30 Tage vor bis Reiseende **oder** Reisewort wie Hotel, Zug, Visum); nur Wortanfang („Berliner …“) braucht beides. Ohne Ortsnennung: Reisewort **und** fällig in den 14 Tagen vor Reisebeginn **und** genau eine Reise kommt in Frage | DATE_AND_CONTEXT_MATCH / MATCHING_DESTINATION / TRAVEL_PREPARATION |
  | Reise ↔ Termin | im Reisezeitraum ±1 Tag **und** nennt das Ziel; nur ein Reisewort reicht nur am An-/Abreisetag | DATE_AND_CONTEXT_MATCH |
  | Reise ↔ Sparziel | nennt das Reiseziel als ganzes Wort **und** (Reisebezug wie Urlaub, Reisekasse **oder** Zieldatum bis 180 Tage vor der Reise) | MATCHING_TITLE |
  | Gerät ↔ Sparziel | Sparziel nennt den Gerätenamen | DEVICE_SAVINGS_GOAL_MATCH |
  | Vertrag ↔ Aufgabe | Vertragswort (kündigen, Tarif, Rechnung, Hotline …) **und** Anbieter oder Vertragsname — oder Anbieter **und** Vertragsname. Anbieter oder Name allein reichen nicht | CONTRACT_TASK_MATCH |

  Qualitätskatalog mit realistischen Fällen (hilfreich / möglich / falsch): `connections/tests/test_suggestion_quality.py`.
  Jede Regeländerung muss ihn bestehen.

  Textvergleich: Kleinschreibung, Umlaute gefaltet, Satzzeichen weg, Füllwörter und zu allgemeine Wörter
  (Reise, Urlaub, neu, prüfen …) gestrichen, Wörter ab 4 Buchstaben (Reiseziele ab 3, z. B. „Rom“); gleich oder
  gemeinsamer Wortanfang ab 5 Buchstaben (zählt schwächer). Gleiche Zeit allein reicht nie.
- **Reihenfolge:** Punktzahl, dann was zuerst ansteht (Reisebeginn, Fälligkeit), dann Schlüssel. Höchstens drei je
  Objekt; „Für dich“ zeigt höchstens einen mit Punktzahl ≥ 0,8 und nur, wenn sonst nichts ansteht.
- **Erklärung:** jeder Vorschlag hat `reason` in Alltagssprache („Die Aufgabe erwähnt „Berlin“ und ist kurz vor
  deiner Reise fällig.“). Keine Prozentzahlen; Regel und Punktzahl nur mit `DEBUG` im Feld `debug`.
- **Annehmen/Ablehnen** nimmt nur den Schlüssel an und berechnet den Vorschlag für die anfragende Person neu —
  gefälschte, fremde, abgelaufene oder schon abgelehnte Schlüssel → 404 ohne Details.
- **Neue Typen dafür:** `DEVICE` und `CONTRACT` (Haushaltsordner; sichtbar wie in der Haushalt-API: Mitglieder,
  keine Kind-Konten). Neue Paare: Reise↔Aufgabe, Reise↔Termin, Gerät↔Sparziel, Vertrag↔Aufgabe.
- **Getrennt davon** bleiben die älteren Reise-Hinweise (`suggestions.py`: Sparziel anlegen, Aufgabe verschieben/
  übergeben) — bewusst ausgelöste Aktionen, keine Verknüpfungs-Vorschläge.

## Later: Automations

Automations may act on connected objects only when the behavior is transparent, permission-safe and user-controlled.

## Beta gate — final hardening (15.10.2026)

Re-validated without code changes to the engine; four tests added to `backend/core/test_permission_matrix.py`:
`test_shared_trip_never_reveals_a_participants_private_organisation_task` (trip ↔ participant's private task and
trip ↔ owner's private task stay invisible to the other side in connections, reminders, today, suggestions, link
suggestions and every list endpoint with `?q=`), `test_revoked_trip_access_hides_the_connection_immediately`
(own connection disappears with the trip access — no title, no "hidden" counter; both objects stay),
`test_reverse_concurrent_create_ends_in_one_connection_without_500` (A→B racing B→A → one row, 409), and
`test_connections_are_only_ever_created_through_the_engine` (static check: outside `connections/services.py` no
product code creates a `Connection`, so suggestions cannot bypass the checks).

Listing performance (15.10.2026): `GET /connections/?object_type=&object_id=` runs exactly 1 query for the
connections plus 1 per involved object type (`services._resolve_with_rights`). The focus object's visibility, both
sides' visibility and the delete right (edit right via an `EXISTS` subquery for kinds with their own write rule,
e.g. trips) come from the same query — before: separate focus lookup and a second editable round (10 → 5 queries in
the test case). Regression: `test_connection_listing_needs_one_query_per_object_type_regardless_of_count`.
