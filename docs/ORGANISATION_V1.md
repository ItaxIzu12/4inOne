# Organisation V1 — Stand (eingefroren)

Stand: 08.10.2026. Grundlage: „4inOne – ORGANISATION V1 – FINALER MASTER PROMPT“.
Organisation hilft, Termine, Aufgaben und Notizen schnell im Griff zu behalten — ohne zweite Produktivitätsplattform.

## Analyse

**Bereits vorhanden:** private Modelle `PersonalEvent`, `PersonalTask`, `PersonalNote` (je `owner`, fremde IDs → 404,
`Cache-Control: no-store`), Today-Aggregation für das Dashboard (`today/`), private Dateien (`PersonalFile`).

**Doppelt:** Reiter „Übersicht“ (das globale Dashboard beantwortet „Was ist heute wichtig?“) und „Dateien“ (Dateien
gehören später zu ihrem Kontext). Haushalt hatte eine eigene Wiederholungslogik — jetzt gemeinsam in `core/recurrence.py`.

**Wiederverwendung:** dieselben Modelle, APIs, Formulare (`ModalForm`, `app-field`, Datums-/Zeitauswahl),
Today-Aggregation, Verknüpfungsbereich (`app-connections`).

**Bewusst erhalten (ohne Reiter):** Dateien-Backend (`organisation/files/`) und der alte haushaltsgebundene
`CalendarEvent` (Onboarding-Zählung). Erinnerungen haben keinen eigenen Reiter.

## Navigation

Genau drei Reiter: **Kalender** (Heute · Woche · Monat) · **Aufgaben** (Alle · Heute · Überfällig · Wiederkehrend ·
Erledigt) · **Notizen** (Angeheftet, danach zuletzt bearbeitet). Alte Links `?tab=overview|files` führen zum Kalender.

## Models und Migration (`organisation/0005_organisation_v1`, nur additiv)

- `PersonalEvent`: + `all_day`, + `recurrence` (`''`/daily/weekly/monthly/yearly). Beginn/Ende bleiben `starts_at`/`ends_at`
  (Datum + Uhrzeit in einem Feld); ganztägig = Mitternacht in der Zeitzone der Person.
- `PersonalTask`: + `recurrence_days`, + `recurrence_months`, + `last_done_at`. Status bleibt OPEN/IN_PROGRESS/DONE
  (DONE = erledigt), Priorität LOW/MEDIUM/HIGH (MEDIUM heißt jetzt „Normal“).
- `PersonalNote`: `title` optional; Inhalt oder Titel ist Pflicht.

Kein gemeinsames Task-Modell über Haushalt/Organisation/Reisen in V1: Haushalt-Aufgaben hängen am Haushalt
(gemeinsam), Organisation-Aufgaben an der Person (privat). Gemeinsam ist die Wiederholungslogik. Eine Konsolidierung
wäre eine riskante Datenmigration und ist als spätere Aufgabe dokumentiert.

## APIs (`/api/v1/organisation/`)

| Endpunkt | Zweck |
| --- | --- |
| `events/?start=JJJJ-MM-TT&end=JJJJ-MM-TT&timezone=` | Termine des Zeitraums (max. 400 Tage), Wiederholungen je Vorkommen mit `series_starts_at` |
| `events/`, `events/<id>/` | CRUD; vergangene Termine erlaubt; Ende vor Beginn → 400 |
| `tasks/?status=&due_date=&overdue=1&recurring=1` | Aufgaben; `recurrence` setzt die Wiederholung; DONE auf wiederkehrender Aufgabe rückt sie weiter |
| `notes/` | Notizen (angeheftete zuerst, dann zuletzt bearbeitet) |
| `today/` | Tagesübersicht fürs Dashboard (berücksichtigt Wiederholungen) |
| `summary/` | `events_today`, `tasks_today`, `overdue_tasks` in einer Antwort |

## Permissions

Privat als Standard: jede Abfrage filtert nach `owner`; fremde IDs liefern 404 ohne Inhalt; Listen, Zeitraum,
Today und Summary enthalten nur eigene Objekte. Teilen gibt es in V1 nicht — eine Gruppenmitgliedschaft gibt keinen
Zugriff auf persönliche Organisation-Daten.

## Tests

- Backend `organisation/test_private_api.py`: Event-CRUD, vergangene Termine, Ende vor Beginn (gleicher Tag/anderer
  Tag), ganztägig, Zeitraumfilter, wöchentliche/jährliche Wiederholung (auch über die Zeitumstellung), Aufgabenfilter,
  vergangene Fälligkeit, Erledigen einmalig/wiederkehrend, Notizen (Inhalt ohne Titel, anheften, lösen, Reihenfolge),
  kein Zugriff und keine Metadaten für andere Personen, Summary.
- Frontend `organisation-logic.spec.ts`: Monatsraster, Woche ab Montag, Zeiten, Wiederholungen im Zeitraum,
  Aufgabenansichten, Notiztitel und Datum.
- E2E `organisation.spec.ts`: leeres Konto (Empty States, keine Demo-Daten), Kalender lädt nur den Zeitraum,
  Termin mit Fehler am Feld + Wiederholung, Schnelleingabe, Erledigen/Wieder öffnen, Notiz, Löschen mit Bestätigung,
  Demo-Ansichten, axe bei 360/390/430/820/1440 px, Tagesstreifen am Handy.

## Manuell testen

1. Neues Konto → Organisation: drei Reiter, leere Zustände, keine Demo-Daten.
2. Termin „Teammeeting“, heute 09:30–10:30 → in Heute/Woche/Monat.
3. Termin im September → erlaubt. Gleicher Tag 10:00 → 09:00 → Fehler am Feld „Ende“.
4. Aufgabe „Präsentation vorbereiten“ heute → unter „Heute“; mit vergangenem Datum → unter „Überfällig“.
5. „Wochenplanung“ wöchentlich → erledigen → nächste Fälligkeit +7 Tage, bleibt offen.
6. Notiz nur mit Inhalt anlegen, bearbeiten, anheften.
7. Zweite Person: kein Zugriff auf Termine, Aufgaben, Notizen der ersten.
8. 360 px: Kalender (Tagesstreifen), Aufgaben, Notizen, Formulare ohne seitliches Scrollen.

## Bewusst nicht implementiert

Connections, Suggestions, Automationen, externe Kalender (Google/Outlook/Apple/CalDAV), Dateien-Reiter, AI,
Teilen von Objekten, Projektmanagement.

## Technische Schulden

- Wiederkehrende Termine werden als Serie bearbeitet (keine Ausnahme für ein einzelnes Vorkommen).
- Kein gemeinsames Task-Modell (siehe oben).
- Dateien-Backend ohne Oberfläche, bis es kontextbezogen eingebunden wird.

## Eingefroren

Organisation V1 ist eingefroren. Danach nur Bugfixes, Security, Accessibility, Performance und echte UX-Probleme
aus Tests — keine neuen Reiter oder Funktionen, bis alle vier Kernbereiche getestet sind.
