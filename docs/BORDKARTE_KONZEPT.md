# Bordkarte und Flugdaten in 4inOne — Konzept

Stand: 22.11.2026 · Bereich: Reisen · Skizze: [Artifact „Bordkarte in 4inOne“](https://claude.ai/artifact/CWrc8fAD1rHbGfhQykmN5A) (privat)

**Status:** Schritt 1 (Bordkarte importieren und anzeigen) ist **gebaut und zum Testen bereit** (22.11.2026). Schritt 2
und 3 sind Ideen und werden erst nach ausdrücklicher Freigabe gebaut.

## Stand Schritt 1 (zum Testen)

- **Wo:** Reise öffnen › Übersicht › Karte „Bordkarten“ › „Bordkarte hinzufügen“. Demo: Reise „Italien Sommerurlaub“.
- **Wallet-Datei (.pkpass):** der Server liest Code, Strecke, Gate, Boarding, Gruppe. Funktioniert in jedem Browser.
- **Screenshot:** der Code wird im Browser gelesen (das Bild verlässt das Gerät nicht). Geht nur, wo der Browser
  `BarcodeDetector` kann (Chrome am Mac und Android); **iPhone/Safari und Firefox können das nicht** – dort erscheint
  der Hinweis auf die Wallet-Datei. Aus einem Screenshot kommen nur die Angaben im Code (Strecke, Flug, Datum, Sitz,
  Name), kein Gate und keine Boardingzeit.
- **Anzeige:** Vollbild, echter Code schwarz auf Weiß, Bildschirm bleibt an (wo der Browser es kann).
- **Offline:** die eigenen Karten liegen auf dem Gerät und stehen auch auf `/offline`; beim Abmelden gelöscht.
- **Sicherheit:** nur die eigene Person (auch bei geteilten Reisen), Code verschlüsselt (Schlüssel aus `SECRET_KEY`;
  ein neuer `SECRET_KEY` macht gespeicherte Karten unlesbar), Buchungscode gekürzt, höchstens 20 Karten je Reise,
  `cleanup_expired` löscht zwei Tage nach Flug bzw. Reiseende.
- **Technik:** `backend/reisen/boarding.py`, `boarding_views.py`, Modell `BoardingPass` (Migration `reisen 0015`);
  Frontend `features/travel/boarding/*`, `shared/boarding-logic.ts`, `shared/boarding-offline.ts`.
- **Noch offen:** PDF-Bordkarten; Screenshot-Lesen auch in Safari (bräuchte eine eigene Lese-Bibliothek).

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
- **PDF-Bordkarten** — Schritt 1 liest Wallet-Dateien und Bilder; PDF folgt, wenn sich das im Test als nötig zeigt.

## Grenzen der Skizze

Beispieldaten: „Beispiel-Airline“, Flug XY 1234 und der abgebildete Code sind erfunden; der Code im Bild ist ein
Muster, kein lesbarer Barcode.
