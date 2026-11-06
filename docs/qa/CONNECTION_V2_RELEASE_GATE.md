# Connection Engine V2 — Release-Gate

**Stand:** 02.11.2026 · Grundlage: `CONNECTION_V2_RESULTS.md`, `CONNECTION_V2_BUGS.md`

## Entscheidung: **NO-GO** für die Freigabe · **GO** für den weiteren internen Test

## 1. Warum NO-GO

| # | Grund | Belegt durch |
|---|---|---|
| 1 | ~~BUG-QA2-02 (hoch)~~ **behoben 02.11.2026:** Frist in Monaten, kalendarisch gerechnet. | `test_qa2_04_…` |
| 2 | Der 122-ID-Katalog fehlt. Die Abdeckung des Testplans ist **nicht belegbar**. | RESULTS §3 |
| 3 | Der 6-Tage-Handtest mit drei Personen ist **nicht durchgeführt**. | RESULTS QA2-25 |
| 4 | Fünf E2E-Tests in Finanzen sind rot (Datum, Monatsanfang). Die Korrektur läuft separat; die Suite ist nicht vollständig grün. | RESULTS §1 |
| 5 | PostgreSQL-Gleichzeitigkeit sowie Backup und Restore sind nicht geprüft (lokal nur SQLite). | RESULTS QA2-24, `docs/RELEASE_READINESS.md` |

## 2. Was für GO im internen Test spricht

- Keine Datenverluste, keine Doppelbuchungen, keine automatischen Buchungen (QA2-02, 06, 11, 12, 22).
- Rechte halten auch bei direkten API-Aufrufen: B und C kommen weder an Daten noch an Verbindungen von A
  (QA2-16 … 19). Eine Verbindung gewährt nie Zugriff.
- Ungültige Eingaben werden überall abgewiesen (QA2-20, 21).
- Die vier Module funktionieren ohne Verbindungen unverändert (QA2-23).
- Backend 1098/1099, Unit 476/476, E2E 348/353. Alle roten Tests sind erklärt.

## 3. Bedingungen für GO (Freigabe)

1. ~~BUG-QA2-02 beheben~~ erledigt (02.11.2026); `python manage.py migrate` ausführen.
2. ~~BUG-QA2-01, 03, 04, 05~~ gebaut (02.11.2026); Migrationen `haushalt/0010` und `0011` ausführen.
3. Den Katalog nachreichen und die 122 IDs zuordnen.
4. Den 6-Tage-Handtest (§4) durchführen und protokollieren.
5. Die Finanzen-Datumstests korrigieren; danach die E2E-Suite ohne parallele Last vollständig grün.
6. Auf PostgreSQL Gleichzeitigkeit, Backup und Restore inklusive `PRIVATE_MEDIA_ROOT` proben.

## 4. Manueller 6-Tage-Test (nicht durchgeführt, Vorschlag)

Drei lokale Testkonten: A legt den Haushalt an und lädt B unter „Personen & Gruppen“ ein. C bleibt außen vor.

| Tag | A | B | C |
|---|---|---|---|
| 1 | Haushalt › Ordner: Telekom und Strom anlegen, „Verbindungen“ einschalten | Einladung annehmen | eigenes Konto |
| 2 | Finanzen › Geplant prüfen; Zahlung „Telekom Internet“ buchen | Vertrag sehen, keinen Betrag; Fristerinnerung einschalten | — |
| 3 | Gerät TEST-WM-100 mit Wartung; Organisation › Kalender | Haushalt: „Wohnung reinigen“ in Organisation › Aufgaben abhaken | Kalender leer |
| 4 | Einkaufsliste abschließen mit 24,50 € | Buchung von A nicht sichtbar | — |
| 5 | Reise Japan mit Budget, Flug und Hotel; Ende verschieben; zweite Reise | — | Reisen leer |
| 6 | Verbindung pausieren und aufheben; Vertrag löschen | Haushalt verlassen → Einträge weg | Direkt-URLs von A → nichts |
