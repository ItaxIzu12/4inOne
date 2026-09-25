# Kompass · Leichtigkeit — Designsystem

> **Hinweis (24.09.2026):** Maßgeblich ist `docs/DESIGN_SYSTEM.md` (Rang 6 in `AGENTS.md`). Dieses Dokument enthält noch die konkreten Token-Werte (Farben, Radien, Maße), die dort fehlen, und bleibt dafür gültig, bis sie übernommen sind. Bekannte Widersprüche: Markenname „Kompass“ statt „4inOne“, ein Lavendel-Akzent für alle Bereiche statt eigener Bereichsfarben (Haushalt rosa, Finanzen grün, Organisation lila, Reisen blau).

Version 4 · 23. September 2026 · verbindliche Richtung: Variante C.

Dieses System ersetzt das bisherige Tannengrün-Design. Referenz sind die ausgewählten App- und Web-Entwürfe „C / Kompass · Leichtigkeit“. Die Referenz zeigt fünf Ansichten: Anmelden, Registrieren, Heute, Finanzen Übersicht und Analyse.

## Farben

| Rolle            | Wert                 | Verwendung                                              |
| ---------------- | -------------------- | ------------------------------------------------------- |
| Hintergrund      | `#F4F5FA`            | App, Inhaltsbereich, Authentifizierung                  |
| Oberfläche       | `#FFFFFF`            | Karten, Eingaben, Navigation                            |
| Text             | `#29374E`            | Überschriften, Beschriftungen, Beträge                  |
| Sekundärtext     | `#5A6476`            | Erklärungen und Datumsangaben                           |
| Primärfarbe      | `#514775`            | Aktionen, Links, aktive Icons, Restbetrag               |
| Primär Hover     | `#40365F`            | Hover-Zustand wichtiger Aktionen                        |
| Lavendel         | `#E9E5F6`            | Heute-Karte, Analyse-Zusammenfassung, aktive Navigation |
| Mint             | `#DDEEDC`            | Illustration, Avatar und dekorative Akzente             |
| Trennlinie       | `#DFE4ED`            | Dezente Abgrenzung                                      |
| Eingaberand      | `#B9C0CE`            | Eingabefelder; Fokus zusätzlich mit Primärfarbe         |
| Erfolg           | `#355E53`            | Bestätigungen                                           |
| Fehler           | `#A13F40`            | Fehlertext und ungültige Felder                         |
| Diagramm-Akzente | `#779889`, `#B2865E` | Zusätzliche Balken, immer mit Zahlen/Beschriftung       |

Zentrale Variablen stehen in `src/styles.css`. Bestehende Aliasnamen bleiben kompatibel; neue Komponenten verwenden semantische Tokens wie `--accent`, `--text`, `--lavender` und `--mint`. Kein zweites Farbsystem, keine Verläufe oder dekorativen Glow-Effekte. Die Gestaltung ist hell; ein Dunkelmodus ist nicht Bestandteil dieser Variante.

## Typografie und Maße

- Helvetica, Arial, sans-serif für alle Ansichten. Keine extern geladenen Schriften.
- Seitenüberschrift: 28 px, fett; Authentifizierung Desktop 30 px, Markenheadline 36 px.
- Abschnittsüberschriften: 19–22 px; Fließtext 14–16 px; ergänzende Angaben 12–13 px.
- Finanzbeträge: 33–40 px, tabellarische Ziffern. Eurobeträge mit deutschem Zahlenformat und zwei Nachkommastellen.
- Kartenradius: 22 px. Buttons: 12 px. Eingaben: 10 px. Segmente: 14 px außen, 11 px innen.
- Eingaben und Authentifizierungsbuttons: 52 px hoch. Sonstige Hauptaktionen mindestens 44 px.
- Abstandsraster: 4, 8, 12, 16, 20, 24, 28, 34, 40 px. Kartenpadding Desktop 24 px, mobil 20 px.
- Linien-Icons überwiegend 22–24 px, abgerundete Enden und konsistente Strichstärke. Icons unterstützen sichtbare Beschriftungen.

## Responsive Aufbau

Die Referenzmaße sind 390 × 844 px mobil und 1100 × 700 px auf dem Desktop. Inhalte fließen bei anderen Größen; feste Screenshot-Höhen dürfen Texte, Fehlermeldungen oder vergrößerte Schrift nicht abschneiden.

Ab 960 px: Seitennavigation 190 px, Kontextzeile 62 px, Inhaltspadding 34 px. Dashboard und Finanzübersicht verwenden Spalten im Verhältnis 510:308 mit 24 px Abstand. Authentifizierung: 40 % Markenfläche, 60 % Formularfläche; Formular höchstens 445 px breit.

Unter 960 px: vier Ziele unten — **Heute, Finanzen, Haushalt, Kalender**. Außenabstand 24 px, bei sehr schmalen Ansichten 16 px. Einspaltige Kartenfolge, Eingaben 16 px Schrift. System-Safe-Area berücksichtigen. Keine nachgebauten Betriebssystemleisten oder fiktiven Uhrzeiten. Scrollbereiche erhalten Platz für die untere Navigation und gegebenenfalls die Ausgabe-Aktion.

## Ansichten

### Anmelden und Registrieren

Desktop: lavendelfarbene Markenfläche mit „Ein Zuhause. Viele kleine Pläne.“ und der originalen Häuserillustration. Formular auf hellem Hintergrund. Mobil: Logo und kompakte Illustration beim Login; Registrierung ohne Illustration. Login-Titel „Schön, dass du da bist.“.

Registrierung in zwei Schritten: Zugang, anschließend Zuhause. Feldvalidierung, Passwortsichtbarkeit, Passwortbestätigung und Zurück-Navigation bleiben erhalten. „Angemeldet bleiben“ bleibt als bestehende Funktion zusätzlich zur Vorlage erreichbar. Rechtliche Links bleiben sichtbar.

### Heute

Die lavendelfarbene Tagesübersicht steht zuerst. Danach Einkaufsliste und Kalender, dann Restbetrag und Ausgabe-Aktion. Desktop ergänzt eine weiße Illustrationskarte rechts; der Restbetrag liegt darunter. Letzte Ausgaben folgen aus echten Transaktionen. „Berechnung ansehen“ öffnet direkt die Analyse; „Alle anzeigen“ öffnet die Ausgabenliste.

### Finanzen – Übersicht

Weiße Ausgabenkarte, eindeutiges **Ausgabenlimit**, Fortschritt und verbleibender Betrag. Kategorien sind als anklickbare Zeilen mit Betrag, Limit und Balken angeordnet. Desktop zeigt rechts den verfügbaren Restbetrag und bei mehreren Haushaltsmitgliedern deren Beiträge. Die mobile Restbetragsberechnung befindet sich im Analyse-Tab. Ausgaben erfassen, bearbeiten, löschen sowie Kategorien anlegen bleiben zugänglich.

### Finanzen – Analyse

Lavendelfarbene Zusammenfassung des laufenden Monats. Darunter Monatsvergleich links und Berechnung rechts; mobil untereinander. Einkommen minus aktive Fixkosten minus Einzelausgaben minus Rücklage ergibt den verfügbaren Betrag. Einkommen, Rücklage, laufende Kosten, Hinweise und CSV/PDF-Berichte sind unter einer aufklappbaren Verwaltung erreichbar.

## Daten und Zustände

Die Namen, Termine, Einkaufszahlen und historischen Balken der Vorlage sind illustrative Beispieldaten. Sie dürfen nicht als echte Haushaltsdaten übernommen werden. Dashboard und Analyse verwenden denselben Finanzzustand. Im aktuellen Stand fehlen eine angebundene Tagesplanung und ein aggregierter Dreimonatsvergleich. Dort erscheinen ausdrücklich beschriftete Platzhalter statt erfundener Termine oder Balken. Die originale Häuserillustration ist eine gemeinsame SVG-Komponente (`IllustrationHome`).

Vorhandene Demo-Routen bleiben von authentifizierten Daten getrennt. Beitragsvergleiche erscheinen nur bei mehreren Personen. Änderungen an Einkommen und Ausgaben aktualisieren den Restbetrag. Ein laufender Monat darf nicht als vollständiger Sparvergleich gegenüber abgeschlossenen Monaten dargestellt werden.

## Zugänglichkeit

Sichtbare Feldlabels, Tastaturbedienbarkeit, erkennbare Fokusrahmen, Fehlermeldungen in Textform und beschriftete Navigation sind verbindlich. Beträge und Fortschritt werden nicht ausschließlich durch Farbe vermittelt. Dekorative Illustration ist für Screenreader verborgen. Bewegungsreduktion und Safe Areas beachten. Kontrast und Layout sind bei neuen Elementen erneut zu prüfen; dieses Dokument behauptet keine vollständige WCAG-Zertifizierung.

### Aufgeklappte Finanzverwaltung

Der Analysebereich verwendet eigenständige weiße Karten für Einkommen, Rücklage, laufende Kosten und Berichte. Auf breiten Ansichten stehen sie in zwei gleich breiten Spalten, unter 700 px untereinander. Lavendel und Mint kennzeichnen die kleinen Abschnittssymbole. Eingaben und Speicheraktionen sind 52 px hoch. Monats-/Jahresauswahl als Segmentsteuerung; CSV und PDF als getrennte Downloadaktionen. Hinweise folgen in einer lavendelfarbenen Karte. Die Aufklappzeile besitzt eine Beschreibung, einen Zustandspfeil und einen sichtbaren Tastaturfokus.
