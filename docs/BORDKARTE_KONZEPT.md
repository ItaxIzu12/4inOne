# Bordkarte und Flugdaten in 4inOne — Konzept

Stand: 22.11.2026 · Bereich: Reisen · Skizze: [Artifact „Bordkarte in 4inOne“](https://claude.ai/artifact/CWrc8fAD1rHbGfhQykmN5A) (privat)

**Status:** Schritt 1 (Bordkarte importieren und anzeigen) ist **gebaut und zum Testen bereit** (22.11.2026). Schritt 2
und 3 sind Ideen und werden erst nach ausdrücklicher Freigabe gebaut.

## Stand Schritt 1 (zum Testen)

- **Wo:** Reise öffnen › Übersicht › Karte „Bordkarten“ › „Bordkarte hinzufügen“. Demo: Reise „Italien Sommerurlaub“.
- **Wallet-Datei (.pkpass):** der Server liest Code, Strecke, Gate, Boarding, Gruppe. Funktioniert in jedem Browser.
- **Screenshot:** zuerst liest der Browser den Code selbst (Chrome am Mac, Android – das Bild bleibt auf dem Gerät).
  Kann er das nicht (iPhone/Safari, Firefox) oder findet er nichts, liest der Server den Code (zxing-cpp); das Bild
  wird nur im Speicher gelesen und nicht gespeichert. Aus einem Screenshot kommen nur die Angaben im Code (Strecke,
  Flug, Datum, Sitz, Name), kein Gate und keine Boardingzeit.
- **PDF-Bordkarte:** der Server rastert die ersten drei Seiten (pypdfium2) und liest den Code wie beim Screenshot;
  auch hier wird das PDF nicht gespeichert. Grenzen: 10 MB, keine passwortgeschützten PDFs.
- **Anzeige:** Vollbild, echter Code schwarz auf Weiß, Bildschirm bleibt an (wo der Browser es kann).
- **Offline:** die eigenen Karten liegen auf dem Gerät und stehen auch auf `/offline`; beim Abmelden gelöscht.
- **Sicherheit:** nur die eigene Person (auch bei geteilten Reisen), Code verschlüsselt, Buchungscode gekürzt,
  höchstens 20 Karten je Reise, `cleanup_expired` löscht zwei Tage nach Flug bzw. Reiseende.
- **Schlüssel:** `BOARDING_PASS_KEYS` (eigener Schlüssel, der erste verschlüsselt, weitere entschlüsseln noch), sonst
  vom `SECRET_KEY` abgeleitet. Beim Wechsel des `SECRET_KEY` den alten in `SECRET_KEY_FALLBACKS` eintragen – dann
  bleiben gespeicherte Karten lesbar (und niemand wird abgemeldet). Siehe `.env.example`.
- **Technik:** `backend/reisen/boarding.py`, `boarding_views.py`, Modell `BoardingPass` (Migration `reisen 0015`),
  Python-Pakete `zxing-cpp` 3.1.1 (Apache-2.0) und `pypdfium2` 5.14.0 (BSD/Apache); Frontend
  `features/travel/shared/boarding/*`, `shared/boarding-logic.ts`, `shared/boarding-offline.ts`, `bwip-js` (MIT).
- **Tests:** `backend/reisen/test_boarding.py`, `frontend/e2e/boarding-pass.spec.ts` (Demo),
  `frontend/e2e-fullstack/bordkarte.spec.ts` (echtes Backend, Browser ohne BarcodeDetector, Screenshot und PDF).

Ziel: Buchung einmal übernehmen statt abtippen, Flugzeiten und Check-in im Blick behalten und nach dem
Online-Check-in die **echte** Bordkarte der Airline in 4inOne zeigen — auch ohne Netz am Gate.

## So läuft es ab

1. **Buchen, wo du willst** — trip.com, Airline, Booking: wie bisher. Die Bestätigung kommt per Mail.
2. **Einmal übernehmen** — Mail weiterleiten oder PDF/Screenshot hochladen. 4inOne legt Reise, Flüge, Hotel und
   Stornofrist als Vorschlag an; gespeichert wird erst nach deinem Okay. *(Schritt 2)*
3. **Einchecken, Bordkarte rein** — Check-in bei der Airline, dann die Bordkarte (Wallet-Datei `.pkpass` oder
   Screenshot) hinzufügen. 4inOne liest den Code und zeigt die Karte. *(Schritt 1)*

## Skizze in Worten

**Buchung übernehmen** *(Schritt 2)*
- Fläche „PDF, Screenshot oder Wallet-Datei“, darunter die persönliche Weiterleitungs-Adresse.
- Karte „Erkannt aus Buchungsbestätigung.pdf — bitte prüfen“: Flug, Abflug, Rückflug, Hotel, Stornofrist.
- Knopf „In Reise übernehmen“.

**Flug im Blick** *(Schritt 2/3)*
- Karte „Hinflug XY 1234 — pünktlich“: Strecke `DUS ✈ LIS`, Abflug, Terminal, Gate („folgt“).
- Zeitleiste „Bis zum Abflug“: Online-Check-in geöffnet → **Jetzt einchecken** → Gepäckabgabe schließt → Boarding.
- Knöpfe „Bordkarte hinzufügen“ und „Zum Check-in der Airline ↗“.

**Bordkarte** *(Schritt 1)*
- Kopf: Airline · Flugnummer · Datum.
- Groß: Abflugort und Ankunftsort (IATA-Code + Stadt), dazwischen ✈.
- Zeile: Boarding · Abflug · Gate · Sitz.
- Perforation, dann **in der Mitte groß der Code der Airline** auf weißem Grund.
- Fuß: Name · Gruppe · Sequenznummer.
- Hinweis: Bildschirm bleibt an, Bildschirm hell stellen; offline verfügbar.

## Was automatisch geht — und was nicht

| Wunsch | Machbar? | Wie |
|---|---|---|
| Buchung von trip.com o. ä. automatisch holen | über Umweg | Keine offene Schnittstelle für private Buchungen. Stattdessen Mail weiterleiten (viele Mails enthalten maschinenlesbare Flugdaten, schema.org „FlightReservation“) oder PDF/Screenshot hochladen; den Rest liest eine KI aus. |
| Zeitpunkt Online-Check-in | ja | Aus den Regeln der Airline (meist 24–48 Std. vor Abflug), ohne Zusatzdienst. |
| Gate, Verspätung, Boardingzeit live | mit Dienst | Nur über einen kostenpflichtigen Flugdaten-Dienst (z. B. FlightAware, Aviationstack, Cirium). Lohnt sich zusammen mit Benachrichtigungen. |
| Online-Check-in direkt in 4inOne | nein | Machen nur Airline-App oder -Website. 4inOne verlinkt zur richtigen Zeit dorthin. |
| QR-Code selbst erzeugen | nein | Ein selbst gebauter Code wäre an Kontrolle und Gate ungültig. 4inOne zeigt den **echten** Code der Airline (Standard IATA BCBP), gelesen aus der importierten Bordkarte. |
| Bordkarte ohne Netz am Gate | ja | Wie die Offline-Einkaufsliste: auf dem Gerät gespeichert, beim Abmelden gelöscht. |

## Datenschutz und Sicherheit

> **Buchungscode + Name = Zugriff auf die Buchung.** Bei vielen Airlines kann man damit umbuchen oder stornieren.

- Eine Bordkarte sieht nur die Person, der sie gehört — auch bei geteilten Reisen.
- Der Code wird verschlüsselt gespeichert und nach der Reise automatisch gelöscht.
- Der Buchungscode erscheint in der Ansicht gekürzt (z. B. „K7••••“).
- Weitergeleitete Mails *(Schritt 2)*: nur Reisedaten übernehmen, die Mail danach löschen.
- Ausgelesene Daten sind immer ein Vorschlag; Live-Daten tragen Quelle und Stand.
- Hinweis in der Ansicht: im Zweifel die Bordkarte der Airline zeigen.

## Reihenfolge

| Schritt | Inhalt | Aufwand | Kosten |
|---|---|---|---|
| **1 · Bordkarte** | Import aus Wallet-Datei (`.pkpass`) oder Screenshot; Code auslesen; Bordkarten-Ansicht; offline; Bildschirm bleibt an; Löschen nach der Reise. | mittel | keine |
| **2 · Buchung übernehmen** | Hochladen bzw. Mail weiterleiten; Flüge, Hotel, Stornofrist als Vorschlag; Check-in-Zeitpunkt nach Airline-Regel. | groß | evtl. KI-Auslesen |
| **3 · Live-Flugstatus** | Gate, Verspätung, Boarding über einen Flugdaten-Dienst; Benachrichtigung bei Änderungen. | mittel | Dienst, je Abfrage |

## Offene Entscheidungen

- **Mail-Weiterleitung oder nur Hochladen?** Weiterleiten ist bequemer, braucht aber einen Mail-Empfang auf dem Server.
- **Flugdaten-Dienst und Budget** — erst bei Schritt 3 nötig; vorher Anbieter und Kosten vergleichen.

## Grenzen der Skizze

Beispieldaten: „Beispiel-Airline“, Flug XY 1234 und der abgebildete Code sind erfunden; der Code im Bild ist ein
Muster, kein lesbarer Barcode.
