# Datei-Importe (Kontoauszug, Kalender)

Stand: 10.10.2026. Ziel: Jeder Bereich soll ohne Connections und ohne laufende Bank- oder Kalender-Synchronisation
schnell mit echten Daten starten können. Beide Importe folgen demselben Ablauf.

## Ablauf

1. **Datei wählen** – die Datei wird **im Browser** gelesen und verlässt ihn nicht. Nur die erkannten Zeilen gehen
   an das Backend.
2. **Vorschau** (`dry_run: true`) – das Backend prüft jede Zeile wie eine Eingabe von Hand und meldet je Zeile
   `new`, `duplicate` oder `invalid` (mit Grund). Es wird nichts gespeichert.
3. **Übernehmen** – alles Gültige und Neue wird in **einer Transaktion** angelegt; Dubletten und fehlerhafte Zeilen
   werden übersprungen. Dieselbe Datei zweimal zu importieren erzeugt keine Doppelten.

Oberfläche: gemeinsame Komponente `shared/import-dialog` (Darstellung), Lesen und Prüfen je Bereich.

## Finanzen – Kontoauszug (CSV)

- Einstieg: Transaktionen → „Kontoauszug importieren“ (leise Nebenaktion neben Alle/Ausgaben/Einnahmen).
- Leser `features/finanzen/finance-import.ts`: Trenner `;` `,` Tab; Werte in Anführungszeichen; Vorspann-Zeilen
  vor der Kopfzeile; Spalten Buchungstag/Datum/Valuta, Betrag/Umsatz oder Soll/Haben, Empfänger + Verwendungszweck
  (zusammengefasst zum Text), optional Kategorie; Beträge „-1.234,56“, „12.50“, „(45,00)“, „45,00-“; Daten
  „09.10.2026“, „9.10.26“, „2026-10-09“; UTF-8 oder Windows-1252. Höchstens 1.000 Buchungen, 2 MB.
- Endpunkt `POST /api/v1/finanzen/private/transactions/import/` (`rows`, `dry_run`): gleiche Grenzen wie beim
  Buchen von Hand (0,01 bis 999.999,99 €, höchstens 10 Jahre zurück, 1 Jahr voraus), Decimal.
- Kategorie: nur Namen der **eigenen** Kategorien; unbekannt oder leer → „Sonstiges“. Aus einer Datei entstehen nie
  neue Kategorien.
- Dublette: gleiches Datum, gleicher Betrag, gleiche Art, gleicher Text (ohne Groß/Klein) — nur gegen die eigenen
  Buchungen geprüft (verrät nichts über andere Konten).
- Tests: `finanzen/tests/test_private_import.py`, `finance-import.spec.ts`, `e2e/finance-import.spec.ts`.

## Organisation – Kalender (ICS)

- Einstieg: Kalender → Zeile „Termine aus Google, Apple oder Outlook übernehmen? Kalender importieren“.
- Leser `features/organisation/org-import.ts` (RFC 5545): nur VEVENT; Fortsetzungszeilen; Escapes; UTC (`Z`),
  `TZID` (auch Outlook-Namen wie „W. Europe Standard Time“), sonst Wanduhrzeit der Person; ganztägig (`VALUE=DATE`,
  DTEND exklusiv → letzter Tag, über das Kalenderdatum gerechnet); `DURATION`. Höchstens 1.000 Termine, 5 MB.
- Wiederholung: `FREQ=DAILY|WEEKLY|MONTHLY|YEARLY` (optional `INTERVAL=1`, `WKST`) wird übernommen. Alles darüber
  hinaus (Ende, Anzahl, Intervall > 1, bestimmte Tage) wird **nicht** still verändert: der Termin kommt einmalig, die
  Vorschau sagt es. Abgesagte Termine (`STATUS:CANCELLED`) und Einzeländerungen (`RECURRENCE-ID`) werden übergangen.
- Endpunkt `POST /api/v1/organisation/events/import/` (`rows`, `dry_run`): jede Zeile durchläuft
  `PersonalEventSerializer`. Dublette: gleicher Titel (ohne Groß/Klein) und gleicher Beginn, nur eigene Termine.
- Tests: `organisation/test_event_import.py`, `org-import.spec.ts`, `e2e/organisation-import.spec.ts`.

## Datenschutz

- Keine Bank-Zugangsdaten, keine Bank-API. Der Nutzer exportiert selbst und wählt die Datei.
- Die Datei wird **nicht hochgeladen und nicht gespeichert** — nur im Browser gelesen. An den Server gehen je
  Buchung nur Datum, Betrag, Art, Text und Kategorie (Termine: Titel, Zeit, Ort, Beschreibung, Wiederholung).
- Spalten mit IBAN/Kontonummer werden nicht gelesen; IBANs und „Kto 1234567890“ im Verwendungszweck werden vor dem
  Senden entfernt (`withoutAccountNumbers`). Der Server protokolliert keine Inhalte (Django loggt bei Fehlern nur
  Pfad und Status).
- Dubletten- und Kategorieprüfung nur gegen die eigenen Daten; Antworten mit `Cache-Control: no-store`.
- PDF-Kontoauszüge (OCR) bewusst nicht in V1: bankabhängig, fehleranfällig und mit mehr sensiblen Daten.

## Bewusst nicht

Keine Bank-API, kein laufender Kalender-Sync, kein Hochladen der Datei auf den Server, keine automatische
Kategorisierung, keine Haushalts-/Reise-Importe.
