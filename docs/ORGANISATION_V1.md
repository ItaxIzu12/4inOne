# Organisation V1 — Umsetzung

Organisation unter `/app/organisation` ist ein privater Kalender- und Aufgabenbereich.
Die bestehende Anwendung, Authentifizierung, AppShell, Icons und Modal-Komponente
werden wiederverwendet. Die Referenz wird durch echte Angular-Elemente umgesetzt.

## Verhalten

- **Heute:** chronologisch sortierte Termine (auch mehrtägige Überschneidungen),
  heute fällige und an früheren Tagen fällige, unerledigte Aufgaben; Empty State.
- **Kalender:** Monatsraster mit Auswahl eines Tages, Tagesliste, nächste Termine,
  Termin erstellen/bearbeiten/löschen mit Bestätigung.
- **Aufgaben:** erstellen, bearbeiten, löschen, erledigen und wieder öffnen;
  Filter für alle, offene und erledigte Aufgaben. Optionale Fälligkeit/Uhrzeit,
  Priorität LOW/MEDIUM/HIGH, Status OPEN/IN_PROGRESS/DONE.
- **Dashboard:** im eingeloggten Bereich maximal vier echte Organisationseinträge
  und echte Terminanzahl; Einträge öffnen die passende Bearbeitung in Organisation.
  Öffentliche Vorschau bleibt ohne private API-Abfragen. Andere Dashboard-Karten
  bleiben ausdrücklich als Beispieldaten gekennzeichnet.
- Lade-, Fehler- und Leerzustände; Formulare bleiben bei Speicherfehlern erhalten.
- Lokale Browserzeitzone für Today-Abfrage; Eventzeitpunkte werden als ISO-Datumszeiten
  übertragen. Aufgaben ohne Uhrzeit werden am Fälligkeitstag vor zeitgebundenen
  Einträgen eingeordnet. Überfällig bedeutet hier: Fälligkeitsdatum vor heute.

## Modelle und Migration

`organisation.PersonalEvent`: owner, title, starts_at, ends_at, location,
description, created_at, updated_at.

`organisation.PersonalTask`: owner, title, description, due_date, due_time,
priority, status, created_at, updated_at.

Migration: `organisation/0003_personalevent_personaltask.py`, lokal angewendet.
Indizes nach Eigentümer und Fälligkeit/Zeitpunkt; Datenbankbedingungen verhindern
Ende vor Beginn sowie Aufgaben-Uhrzeiten ohne Datum.

Der vorhandene, haushaltsgebundene `CalendarEvent` und seine Daten bleiben unverändert.
Die neue API veröffentlicht keine gemeinsamen Haushaltstermine. D-011/ADR-001 ist
weiterhin ein Vorschlag; die domänenübergreifende Bereichsmigration gehört nicht
zu diesem Auftrag. V1 verwendet einen direkten Besitzer-Fremdschlüssel.

## API

Alle Endpunkte erfordern Anmeldung und geben `Cache-Control: no-store` zurück.

| Pfad unter `/api/v1/organisation/` | Methoden |
| --- | --- |
| `events/` | GET, POST |
| `events/{id}/` | GET, PUT, PATCH, DELETE |
| `tasks/` | GET, POST |
| `tasks/{id}/` | GET, PUT, PATCH, DELETE |
| `today/?timezone=Europe/Berlin` | GET |

Der Server setzt owner ausschließlich anhand von request.user. Listen und
Detailzugriffe werden nach owner gefiltert. Fremde IDs liefern 404, auch bei
PUT/PATCH/DELETE. Household-Mitgliedschaft erweitert die Rechte nicht.
Besitzerdaten sind kein beschreibbares Serializer-Feld.

Listen liefern in V1 alle persönlichen Einträge; Pagination und serverseitige
Monatsfilter sind keine Bestandteile dieser Version.

## Angular

- `Organisation`: drei Ansichten, Monatsnavigation, Tagesauswahl, Aufgabenfilter,
  reaktive Bearbeitungsformulare, Löschbestätigung, Lade-/Fehlerzustände.
- `OrganisationApi`: typisierte HTTP-Aufrufe, keine globale Speicherung privater Daten.
- `Dashboard`: getrennte öffentliche Beispielansicht und private Heute-Abfrage.
- `AppShell`, `AppIcon`, `Modal` werden unverändert wiederverwendet.

## Geänderte/neue Dateien dieses Auftrags

Backend:
- `backend/config/urls.py`
- `backend/core/onboarding_views.py`
- `backend/organisation/models.py`
- `backend/organisation/migrations/0003_personalevent_personaltask.py`
- `backend/organisation/serializers.py`
- `backend/organisation/views.py`
- `backend/organisation/urls.py`
- `backend/organisation/test_private_api.py`

Frontend:
- `frontend/src/app/app.routes.ts`
- `frontend/src/app/features/organisation/organisation.ts`
- `frontend/src/app/features/organisation/organisation.html`
- `frontend/src/app/features/organisation/organisation.scss`
- `frontend/src/app/features/organisation/organisation-api.service.ts`
- `frontend/src/app/features/dashboard/dashboard.ts`
- `frontend/src/app/features/dashboard/dashboard.html`
- `frontend/e2e/organisation.spec.ts`

Dokumentation:
- `docs/ORGANISATION_V1.md`

Andere bereits parallel geänderte Architektur-/Roadmap-Dokumente wurden nicht
als Bestandteil dieser Implementierung bearbeitet.

## Validierung

- Angular-Produktionsbuild mit Typprüfung erfolgreich.
- 124 Frontend-Tests erfolgreich.
- 222 Django-Tests erfolgreich, darunter Eigentümerisolation, fremde CRUD-Zugriffe,
  Owner-Manipulation, Datumsvalidierung, Erledigen/Wiederöffnen, lokale Tagesgrenzen,
  mehrtägige Termine und Ausschluss des geteilten Haushaltskalenders.
- Django-Systemprüfung ohne Probleme; keine fehlenden Migrationen.
- 22 Browserprüfungen erfolgreich; nach der letzten mobilen Layoutkorrektur die
  drei Organisationstests erneut erfolgreich (390/1440 Pixel, CRUD,
  Monatsnavigation, Dashboard-Verknüpfung, nicht angemeldeter Zugriff).
- Screenshots der mobilen und Desktop-Ansicht visuell geprüft.
- Keine automatisiert erkannten WCAG-A/AA-Verstöße in den geprüften Ansichten.
- Bestehende Build-Warnung: `finanzen.scss` überschreitet sein CSS-Größenbudget.

Keine Kalenderanbieter, Push-Benachrichtigungen, KI oder Connection Engine ergänzt.
