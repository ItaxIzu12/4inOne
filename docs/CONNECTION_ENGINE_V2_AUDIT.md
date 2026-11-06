# Connection Engine V2 — Audit, Architektur und Änderungen

**Stand:** 01.11.2026 · **Grundlage:** `4inOne_Entwicklungsplan_Connections_V2_Testing_SmartScan.md`, Phasen 1–4
**Begleitdokumente:** `CONNECTION_ENGINE_V2_TEST_REPORT.md`, `REGRESSION_TEST_REPORT.md`, `RELEASE_READINESS.md`

## 1. Ausgangszustand (V1)

V1 (`docs/CONNECTION_ENGINE.md`, `backend/connections/`) verbindet **zwei bestehende Objekte** („gehören zusammen“) — ohne
Automatik. Vorhanden und unverändert übernommen:

- Typen TASK, CALENDAR_EVENT, SAVINGS_GOAL, HOUSEHOLD_TASK, TRIP, DEVICE, CONTRACT; Paare nur über `registry.ALLOWED_PAIRS`.
- Anlegen/Auflisten/Entfernen, Duplikat- und Selbstverbindungsschutz (DB-Constraints), Gleichzeitigkeit → 409.
- Rechte: beide Seiten werden beim Lesen einzeln geprüft („Eine Verbindung gewährt nie Zugriff“), Löschen nur mit Recht.
- Verknüpfungs-Vorschläge (`link_suggestions.py`), Reise-Hinweise (`suggestions.py`), Sammelendpunkt, „Verknüpft mit“.
- Architektur-Entscheidung **ADR-001**: Geld ist privat; Haushalt hängt nicht an Finanzen; Fristen werden nicht in
  Kalender kopiert, „Heute“ liest sie direkt.

Bestand der zehn Verbindungen aus dem Plan vor dieser Arbeit:

| ID | Verbindung | Vorher | Jetzt |
|---|---|---|---|
| CON-01 | Vertrag → Finanzen (geplant) | fehlte | **neu**, abgeleitet |
| CON-02 | Vertrag → Kündigungserinnerung | nur Haushalt/Startseite | **neu** in Organisation, abgeleitet |
| CON-03 | Haushaltsaufgaben in Organisation | nur Startseite | **neu**, derselbe Datensatz |
| CON-04 | Gerät → Wartungserinnerung | nur Haushalt/Startseite | **neu** in Organisation, abgeleitet |
| CON-05 | Einkauf → Finanzen | vorhanden (Abschließen mit Betrag bucht privat) | unverändert, **Regeln jetzt ausdrücklich getestet** |
| CON-06 | Reisen ↔ Finanzen | bewusst getrennt + Sparziel-Vorschlag | unverändert, **„nie doppelt“ getestet** |
| CON-07 | Reise → Kalender | nur manuelles Verknüpfen | **neu**: Reisezeitraum als ganztägiger Eintrag, abgeleitet |
| CON-08 | Reisevorbereitung | vorhanden (Vorschläge nach Auswahl) | unverändert (bestehende Tests) |
| CON-09 | Reisen ↔ Haushalt | vorhanden (Hinweise) | unverändert (bestehende Tests) |
| CON-10 | Sparziel → Erinnerung | fehlte | **neu**, abgeleitet |

## 2. Architektur-Entscheidung: abgeleitet statt kopiert (01.11.2026, vom Nutzer gewählt)

Jede neue Verbindung hat **genau eine Quelle** (Vertrag, Gerät, Reise, Sparziel, Haushalt). Was in Finanzen („Geplant“)
oder Organisation (Kalender, Aufgaben) erscheint, wird **bei jedem Lesen aus der Quelle berechnet** — es entsteht keine
Kopie. Gespeichert wird nur, *dass* eine Person eine Verbindung eingeschaltet hat.

Warum: Damit erfüllen sich die Engine-Pflichten ohne Abgleich-Code, und ADR-001 bleibt gültig (keine Kopien).

| Pflicht (Plan 2.3) | Umsetzung |
|---|---|
| CREATE | `POST /connections/auto/` — idempotent (zweimal = einmal; 201 neu, 200 vorhanden) |
| UPDATE | Quelle ändern genügt: Abgeleitetes folgt beim nächsten Lesen; Finanzen plant nur laufenden und künftige Monate |
| PAUSE / RESUME | `PATCH …/{id}/ {status: PAUSED|ACTIVE}` — pausiert erscheint nichts, die Einstellung bleibt |
| UNLINK | `DELETE …/{id}/` — nur die Verbindung; Quelle, Buchungen, Termine, Aufgaben bleiben |
| DELETE / ARCHIVE | Quelle gelöscht → Verbindung entfällt (Signal), Protokoll „Quelle gelöscht“; nichts anderes wird gelöscht |
| STATUS | `GET …?source_type=&source_id=` liefert je Art Status, Vorschau, Problem |
| AUDIT | `AutoLinkEvent`: Person, Art, Quell-ID, Aktion, Zeit — **ohne Inhalte** (keine Titel/Beträge/Daten) |
| IDEMPOTENCY | DB-Constraint `unique_auto_link (owner, kind, source_id)`; abgeleitete Einträge sind nie gespeichert |
| PERMISSIONS | Quelle wird bei jedem Lesen gegen ihre eigene Regel geprüft (`registry.KINDS[…].visible`); Vertragsbetrag nur für die eintragende Person (`can_see_cost`) |
| ERROR HANDLING | verständliche Meldungen (`problem`, Fehlertexte), Fehler beim Anlegen → nichts halb angelegt (Transaktion) |
| CONFLICTS | entfallen: es gibt keine Kopie, die jemand von Hand ändern könnte — geändert wird an der Quelle |
| CONCURRENCY | parallele Anlage → IntegrityError → vorhandene Zeile zurück; Statuswechsel mit `select_for_update` |

**Keine erfundenen Daten:** Kündigungserinnerung nur mit Vertragsende **und** Kündigungsfrist (Tage oder, seit 02.11.2026,
Monate — kalendarisch: 31.12. − 1 Monat = 30.11.; zusätzlich ein Hinweis 0/7/14/30 Tage vorher, Standard 14);
Vertragskosten je Zahlungstag zum dann gültigen Preis (angekündigte Preisänderung „ab Datum“); Wartung nur mit
eingetragenem Termin; Sparziel nur mit Zieldatum oder Endmonat; vierteljährliche/jährliche Kosten nur mit Startdatum
(Zahlungsmonat). Fehlt etwas, erklärt `problem`, was — die Verbindung kann trotzdem eingeschaltet werden und wirkt, sobald
die Angabe da ist.

**Doppelzählung (CON-01 ↔ wiederkehrende Buchungen):** Wird im Monat eine Ausgabe mit dem Vertragsnamen gebucht, ersetzt
sie den Planwert. Ein verbundener Vertrag ersetzt außerdem eine gleichnamige wiederkehrende Planung (Fehler beim Testen
gefunden, siehe Testbericht F-01). Vertragskosten aus Finanzen „als bezahlt buchen“ legt eine **einmalige** Buchung an.

## 3. Datenmodell (Migration `connections/0004_auto_links`)

- `AutoLink(owner, kind, source_id, status ACTIVE|PAUSED, created_at, updated_at)` — Arten `CONTRACT_FINANCE`,
  `CONTRACT_REMINDER`, `HOUSEHOLD_TASKS`, `DEVICE_MAINTENANCE`, `TRIP_CALENDAR`, `SAVINGS_REMINDER`.
- `AutoLinkEvent(owner, kind, source_id, action CREATE|PAUSE|RESUME|UNLINK|SOURCE_GONE, at)`.
- Keine Fremdschlüssel in die Domains (wie V1); Aufräumen per `post_delete`-Signal (`connections/signals.py`).

## 4. API (`/api/v1/connections/auto/…`, nur angemeldet, `no-store`, Schreiben gedrosselt wie V1)

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `auto/?source_type=CONTRACT&source_id=5` | Status, Vorschau, Problem je angebotener Art |
| POST | `auto/` `{kind, source_id}` | einschalten (idempotent) |
| PATCH | `auto/{id}/` `{status}` | pausieren/fortsetzen |
| DELETE | `auto/{id}/` | aufheben |
| GET | `auto/calendar/?start=&end=` (≤ 400 Tage) | abgeleitete Kalendereinträge |
| GET | `auto/household-tasks/` | Haushaltsaufgaben für Organisation (≤ 100) |
| — | `finanzen/private/summary/` | `planned_items` enthält `kind: CONTRACT` |

Fremd und nicht vorhanden sind gleich (404); Betrag eines anderen planen → 403; ungültige Eingaben → 400.

## 5. Oberfläche (bestehende Formulare, keine neuen Seiten)

- **Baustein `app-auto-links`** (`shared/connections/auto-links.*`) in den Dialogen Vertrag, Gerät, Reise, Sparziel:
  Schalter in Alltagssprache, darunter **was genau wo erscheint** (aus den Formularwerten, also schon vor dem ersten
  Speichern) oder was fehlt; Status „Aktiv/Pausiert“ mit Pausieren/Fortsetzen und Link „In Finanzen/Im Kalender
  ansehen“; Aufheben mit Hinweis, dass Quelle und echte Einträge bleiben. Alles gilt erst beim **Speichern**.
- **Finanzen › Geplant:** Vertragskosten mit Marke „aus Haushalt › Vertrag“.
- **Organisation › Kalender:** abgeleitete, nur lesbare Einträge mit Marke („Aus Haushalt › Vertrag/Gerät“, „Aus
  Reisen“, „Aus Finanzen › Sparziel“); Klick öffnet die Quelle.
- **Organisation › Aufgaben › „Aus dem Haushalt“:** Schalter + Liste; Abhaken erledigt die Haushaltsaufgabe selbst.
- **Demo** (`/demo`): `DemoAutoLinksApi` mit denselben Regeln (`auto-link-rules.ts`), Quellen live aus den anderen
  Demo-Bereichen; vorab verbunden: Internet & Telefon (Finanzen + Kündigung), Heizung (Wartung), Berlin (Kalender).

## 6. Geänderte Dateien

Backend: `connections/models.py`, `auto_links.py` (neu), `views.py`, `urls.py`, `signals.py`, `migrations/0004_auto_links.py`
(neu), `tests/test_auto_links.py` (neu), `tests/test_existing_connections.py` (neu); `finanzen/private_api.py`
(`planned_expenses`); `core/test_permission_matrix.py`.

Frontend: `shared/connections/auto-links-api.service.ts`, `auto-link-rules.ts`, `demo-auto-links-api.ts`, `auto-links.*`,
`auto-links.spec.ts` (alle neu); `features/haushalt/ordner-tab.*`; `features/reisen/reisen.*`;
`features/finanzen/private-finance.*`, `private-finance-api.service.ts`, `demo-private-finance-api.ts`;
`features/organisation/organisation.*`, `organisation-api.service.ts`, `org-calendar.html`, `org-day-sheet.html`,
`org-household-tasks.*` (neu); `demo.routes.ts`; `e2e/connections-v2.spec.ts` (neu).

## 7. Bewusst nicht geändert

- V1-Verbindungen, Vorschläge und ihre Regeln; CON-05/06/08/09 (nur Tests ergänzt).
- Keine Kopien in Organisation/Finanzen, keine automatischen Buchungen, keine Zahlungen durch Erinnerungen.
- ADR-001 gilt weiter; Haushaltsfinanzen bleiben eingefroren.
- Kein Smart Scan, keine KI (Plan: erst nach dem Qualitäts-Gate).
