# Haushalt V1 — Analyse, Entscheidungen, Stand (eingefroren)

Stand: 06.10.2026. Grundlage: „4inOne – HAUSHALT V1 – FINALER MASTER PROMPT“.

## Analyse

**Bereits vorhanden**
- Aufgaben (`Task`) mit Fälligkeit, Uhrzeit, Priorität, Raum, Dauer, Zuweisung, Rotation, Pause,
  Wiederholung über `recurrence_days` / `recurrence_months`, Erledigungsprotokoll (`TaskCompletion`).
- Einkaufslisten (`ShoppingList`, mehrere pro Haushalt), Einträge (`ShoppingItem`), Schnellauswahl (`ItemMemory`),
  Einkaufsabschluss (`ShoppingTrip`).
- Haushaltsordner (`FolderEntry`) mit Art `vertrag` / `geraet`, Kündigungs-, Garantie- und Wartungsfristen.
- Übersicht `GET /api/haushalt/uebersicht/`, Haushaltsgrenze über `HouseholdScopedPermission`,
  Kind-Konten ohne Ordnerzugriff (`NoChildAccount`).

**Doppelt**
- „Routinen“ war ein eigener Reiter, fachlich aber nur wiederkehrende Aufgaben → jetzt Filter „Wiederkehrend“ im
  Reiter Aufgaben. Es gibt kein zweites Aufgabenmodell.
- Fristen wurden in Übersicht, Ordner und `connections/today.py` einzeln gefiltert → eine Definition
  `services.UPCOMING_DAYS = 30` und `services.upcoming_deadlines()`.

**Wiederverwendung**
- `Task` bleibt das einzige Aufgabenmodell; `FolderEntry` bleibt das Modell für Geräte und Verträge.
- Bestehende Komponenten (Aufgabenliste, Routinenansicht, Einkaufsliste, Ordner, Formulare, Zeilenmenü) werden in
  die neuen Reiter eingebettet, nicht neu geschrieben.

**Refactoring**
- Reiter: Heute · Aufgaben · Einkaufen · Zuhause (Geräte | Verträge). Alte Links (`?tab=uebersicht|einkauf|ordner|routinen`)
  werden auf die neuen Reiter abgebildet.
- Wiederkehrende Aufgaben rücken vom **bisherigen Fälligkeitstermin** weiter (Di 06.10 → Di 13.10), nicht mehr ab
  „heute“ — so bleibt der Wochentag erhalten. Liegt der nächste Termin noch in der Vergangenheit, wird so lange
  weitergerückt, bis er in der Zukunft liegt; es entstehen keine zusätzlichen Datensätze.

**Migration (`haushalt/0008_haushalt_v1`) — ohne Datenverlust**
- `FolderEntry`: Umbenennungen `monthly_cost → cost`, `contract_end → end_date`, `warranty_until → warranty_end_date`,
  `next_maintenance → maintenance_due_date` (RenameField, Daten bleiben).
- Neu: `billing_cycle` (Bestand = `MONTHLY`, weil die alten Kosten monatlich waren), `start_date`, `auto_renewal`,
  `status`, `contract_number`, `category`, `updated_at`, `notice_period_days`.
- `notice_period_months → notice_period_days`: exakt über das Vertragsende umgerechnet (31.12. − 1 Monat = 30 Tage);
  ohne Vertragsende 30 Tage je Monat. Danach entfällt die Monatsspalte.
- `Task.updated_at`, `ShoppingList.archived`, `ShoppingItem.notes`, `ShoppingItem.updated_at`.

## Entscheidungen

- **Privat als Standard:** Jedes Konto hat beim Registrieren einen eigenen Haushalt (nur es selbst). Alle Daten
  hängen am Haushalt; ein gemeinsamer Haushalt entsteht nur durch Einladung. Jeder Zugriff wird serverseitig über die
  Mitgliedschaft geprüft; fremde IDs liefern 404, Zählwerte enthalten nur den eigenen Haushalt.
- **Priorität:** gespeicherte Werte bleiben `niedrig` / `mittel` / `hoch` (wie alle API-Schlüssel auf Deutsch);
  angezeigt als Niedrig / Normal / Hoch. Status `open` / `done`.
- **Wiederholung:** täglich, wöchentlich, monatlich, jährlich, alle X Tage oder alle X Wochen. Der Wochentag ergibt
  sich aus dem Fälligkeitsdatum.
- **Vertragsstatus:** gespeichert `ACTIVE` / `CANCELLED` / `ENDED`; `EXPIRING` wird berechnet (Kündigungsfrist in
  den nächsten 30 Tagen). Ohne automatische Verlängerung gilt ein Vertrag nach dem Vertragsende als `ENDED`.
- **Kündigungsfrist:** `cancellation_deadline = end_date − notice_period_days` (31.12.2026 − 30 Tage = 01.12.2026).
- **Vertragsnummer** ist sensibel: nur in der Detailantwort (`GET /ordner/<id>/`), nie in Listen, Übersicht oder
  „Heute“.
- **Gerätehersteller** steht im bestehenden Feld `provider` (UI: „Hersteller“), kein zweites Feld.
- **Gerätestatus** `ACTIVE` / `REPAIR` / `RETIRED`; außer Betrieb gesetzte Geräte erzeugen keine Fristen.
- **Kosten** von Verträgen werden **nicht** in Finanzen übertragen.
- **Archivierte Einkaufslisten** sind ausgeblendet (`?archiviert=1` zeigt sie) und nie Standardliste.

## APIs (`/api/v1/haushalt/`)

| Endpunkt | Zweck |
| --- | --- |
| `GET uebersicht/` | „Heute“: `summary` (Zählwerte), `today` (fällig/überfällig, max. 5), `deadlines` (30 Tage), `shopping` (Anzahl, Vorschau, Standardliste) |
| `aufgaben/` (+ `erledigt/`, `wieder-oeffnen/`) | Aufgaben; `recurrence` daily/weekly/monthly/yearly oder `recurrence_days` (alle X Tage/Wochen) |
| `einkauf/listen/` (`?archiviert=1`) | Listen; `PATCH {archived}` archiviert/stellt wieder her (letzte aktive Liste bleibt) |
| `einkauf/eintraege/` | Artikel, jetzt mit `notes`, `updated_at` |
| `ordner/` (+ `<id>/`, `wartung-erledigt/`) | Geräte und Verträge; `contract_number` nur in der Detailantwort |

## Tests

- Backend: `haushalt/test_haushalt_v1.py` (Wiederholung, Kündigungstag, Status, Validierung, Vertragsnummer,
  30-Tage-Fenster, Zusammenfassung nur eigener Haushalt, Archiv, Migration); bestehende Tests angepasst.
- Frontend: `vertraege-logic.spec.ts` (inkl. Geräte), `haushalt.spec.ts` (Reiter, Ansichten, Archiv, Zuhause, Demo-Provider).
- E2E: `haushalt-reiter.spec.ts` (alle Reiter bei 360/390/430/820/1280/1440 px mit axe, alte Links, leerer Zustand,
  Archiv, Löschen mit Bestätigung), `haushalt-aufgaben.spec.ts`.

## Manuell testen

1. `/haushalt` → Reiter Heute · Aufgaben · Einkaufen · Zuhause; alte Links `?tab=routinen|ordner|einkauf` landen richtig.
2. Wöchentliche Aufgabe mit Fälligkeit Di 06.10 abhaken → nächste Fälligkeit Di 13.10.
3. Vertrag mit Ende 31.12.2026 und 30 Tagen Frist → „Kündbar bis 01.12.2026“.
4. Vertragsnummer erscheint nur in der Detailkarte, nicht in Liste oder „Heute“.
5. Gerät „Außer Betrieb setzen“ → verschwindet aus „Demnächst“; Löschen fragt nach.
6. Liste archivieren → ausgeblendet, unter „Archiv“ wiederherstellbar.
7. Handy 360/390/430 px: kein seitliches Scrollen.

## Bewusst nicht in V1

Verknüpfungen zu anderen Bereichen (über das Bestehende hinaus), Vorschläge, Automationen, externe APIs, Dokumente,
OCR und KI.

## Eingefroren

Haushalt V1 ist mit diesem Stand eingefroren. Änderungen nur noch als Fehlerbehebung oder als neue, eigene Version.

## Design System V3 (10.10.2026)

Haushalt nutzt das globale Design System (docs/DESIGN_SYSTEM.md). Untertitel „Alles rund um dein Zuhause.“ Einzelperson
zuerst: Hinweise auf gemeinsames Arbeiten erscheinen nur bei mehr als einer Person im Haushalt. Reiter und
Hauptaktionen unverändert (Heute · Aufgaben · Einkaufen · Zuhause; Zuhause mit Geräte/Verträge).
