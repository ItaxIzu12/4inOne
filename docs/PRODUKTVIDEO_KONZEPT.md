# Produktvideo für die Startseite – Konzept für später

Stand: 2. Oktober 2026
Status: Vorgemerkt. Noch keine Aufnahme, Produktion oder Video-Integration starten.

## Verbindliche Reihenfolge

1. Die Funktionen der App zuverlässig fertigstellen und prüfen.
2. Design, Navigation und responsive Darstellung sauber abschließen.
3. Den vorgesehenen Beispielablauf im fertigen Produkt durchspielen.
4. Erst danach Drehbuch aktualisieren, Video aufnehmen und auf der Startseite einbinden.

Dieses Dokument hält die Idee fest. Es ist kein Auftrag, jetzt ein Video zu produzieren oder zusätzliche Funktionen ausschließlich für das Video zu bauen. Der Video-Platzhalter im Startseitenentwurf ist bislang Teil eines Bildentwurfs, kein fertiger Player.

## Entscheidung: Reise als roter Faden

Empfehlung: „Ein Wochenende in Berlin vorbereiten“ als Hauptbeispiel. Das Ziel ist konkret und leicht verständlich. Reisedaten, Packliste, Aufgaben und Reisebudget zeigen mehrere nützliche Funktionen anhand einer zusammenhängenden Geschichte.

Die Reise erklärt besonders gut den Reisebereich und den Einstieg über das Dashboard. Sie beweist allein noch keine bereichsübergreifenden Verbindungen. Deshalb zu Beginn die vier Bereiche kurz einordnen, ohne das Produkt als reine Reise-App darzustellen.

Das Waschmaschinen-Beispiel bleibt als separates Beispiel auf der Startseite oder für ein späteres kurzes Erklärvideo zu Verbindungen geeignet. Beide Geschichten nicht in ein einziges kurzes Einführungsvideo pressen.

## Produktgrenzen ehrlich darstellen

Zum Zeitpunkt dieses Konzepts unterstützt die Connection-Registry diese Paare:

- Sparziel ↔ persönliche Aufgabe
- persönliche Aufgabe ↔ Termin
- Haushaltsaufgabe ↔ Termin

Quelle: `backend/connections/registry.py`. Vor der Aufnahme erneut prüfen.

Reisebudget, Reiseaufgaben und Packliste sind Funktionen innerhalb von Reisen. Nicht behaupten, dass dadurch automatisch Buchungen im privaten Finanzbereich, persönliche Kalendertermine oder Haushaltsaufgaben entstehen. Reiseverbindungen zu anderen Bereichen nur zeigen, wenn sie zum Aufnahmezeitpunkt tatsächlich verfügbar und geprüft sind. Keine Automatik, Synchronisation oder Freigabe suggerieren, die das Produkt nicht bietet.

## Ziel und Kernbotschaft

Der Besucher versteht nach dem Video:

- 4inOne ist eine Web-App für Finanzen, Haushalt, Organisation und Reisen.
- Jeder Bereich lässt sich eigenständig nutzen.
- Das Dashboard gibt einen kompakten Einstieg in den Alltag.
- Am Reisebeispiel sieht man die echte Bedienung und einen konkreten Nutzen.
- Die Demo lässt sich ohne Anmeldung mit getrennten Beispieldaten ausprobieren.

Kernbotschaft: „Weniger zusammensuchen. Wissen, was noch zu tun ist.“
Keine garantierten Zeitersparnisse oder finanziellen Vorteile behaupten.

## Storyboard – ungefähr 60–75 Sekunden

Zeitangaben sind Schnittziele, keine bereits feststehende Videolänge.

| Zeit | Bild und Handlung | Sprechertext als Arbeitsfassung |
| --- | --- | --- |
| 0–8 Sek. | Kurze persönliche Begrüßung, dann echtes Dashboard. | „Ausgaben, Termine, Haushalt und Reisen: Im Alltag gibt es einiges im Blick zu behalten. Dafür gibt es 4inOne.“ |
| 8–18 Sek. | Vier Bereichskarten und Heute-Ansicht gezielt zeigen. | „Hier findest du vier Bereiche an einem Ort. Du kannst mit einem anfangen. Dein Dashboard zeigt dir, was heute ansteht.“ |
| 18–28 Sek. | In Reisen wechseln, vorbereitete Berlin-Reise öffnen. | „Zum Beispiel dein nächstes Wochenende in Berlin: Ziel und Zeitraum stehen schon fest. Jetzt geht es an die Vorbereitung.“ |
| 28–42 Sek. | Packliste öffnen und einen Gegenstand abhaken; anschließend eine offene Reiseaufgabe zeigen. | „Mit der Packliste behältst du im Blick, was noch fehlt. Aufgaben wie Tickets buchen sammelst du direkt bei deiner Reise.“ |
| 42–53 Sek. | Reisebudget und vorhandene Ausgaben zeigen. Nur geprüfte Anzeigen verwenden. | „Auch dein geplantes Reisebudget und die erfassten Reiseausgaben findest du hier.“ |
| 53–63 Sek. | Zur Reiseübersicht zurückkehren; tatsächlichen Stand der Vorbereitung zeigen. | „So siehst du, was vorbereitet ist und was noch offen bleibt – ohne alles erneut zusammensuchen zu müssen.“ |
| 63–75 Sek. | Abschluss mit ruhigem Dashboardbild oder kurzer persönlicher Verabschiedung. | „Probier 4inOne ohne Anmeldung mit Beispieldaten aus. Wenn es zu dir passt, startest du anschließend mit deinem eigenen Konto.“ |

Nach Abschluss von Funktion und Design den Text an die dann vorhandenen Oberflächen und Begriffe anpassen. Die Aufnahme muss den gezeigten Ablauf wirklich ausführen, nicht nur mit Schnitten vortäuschen.

## Aufnahme und Gestaltung

- Echte Bildschirmaufnahme der fertigen Anwendung statt generierter Oberfläche.
- Person kurz am Anfang und optional am Ende; während der Bedienung steht das Produkt im Mittelpunkt.
- Ausschließlich vorbereitete Beispieldaten verwenden; keine persönlichen Daten oder Zugangsdaten aufnehmen.
- Reisezeitraum zum Aufnahmezeitpunkt passend wählen. Datum, Countdown und Fortschritt müssen zusammenpassen.
- Wenige gezielte Klicks, ruhiger Mauszeiger, gut lesbare Ausschnitte.
- Keine langen Texteingaben, hektischen Zooms oder aufwendigen Logo-Intros.
- Bestehende Icons, Farben und Begriffe der App verwenden.
- Klare Sprachaufnahme; Musik höchstens dezent und optional.
- Deutsche Untertitel prüfen und ein Texttranskript bereitstellen.
- Wichtige Handlungen auch sprachlich erklären, nicht nur durch Mausbewegungen zeigen.

## Platzierung auf der Startseite

- Video rechts neben dem Nutzenversprechen; auf dem Handy unter dem Einstieg.
- Echtes Dashboard-Standbild als Vorschaubild, klarer Play-Button.
- Titel: „So unterstützt dich 4inOne im Alltag“.
- Erst nach dem Schnitt die tatsächliche Laufzeit angeben.
- Kein Autoplay. Nutzer starten und steuern das Video selbst.
- Primärer Einstieg bleibt: „Ohne Anmeldung ausprobieren“.
- Zusatz: „Direkt starten. Mit Beispieldaten kennenlernen.“
- Die Startseite erklärt das Produkt auch ohne das Video vollständig.
- Bis zur fertigen Aufnahme keinen scheinbar funktionierenden Play-Button veröffentlichen, hinter dem nichts liegt. Einen etwaigen Platzhalter ausdrücklich als solchen kennzeichnen.

## Voraussetzungen vor der Aufnahme

Diese Punkte sind eine spätere Prüfliste, keine Behauptung, dass bereits alles abgeschlossen ist:

- [ ] Registrierung, Anmeldung, Demo und echte Konten sauber getrennt.
- [ ] Gezeigte Reiseabläufe funktionieren einschließlich Speichern und erneutem Laden.
- [ ] Packlisten, Aufgaben und Budgetanzeigen stimmen mit den zugrunde liegenden Daten überein.
- [ ] Dashboard und Reisebereich zeigen konsistente Informationen.
- [ ] Lade-, Fehler- und Leerzustände sind verständlich.
- [ ] Desktop- und Mobilgestaltung sind abgestimmt; Sticky-Bereiche überdecken keine Bedienelemente.
- [ ] Navigation, Tastaturbedienung und relevante Kontraste geprüft.
- [ ] Das endgültige Startseitendesign steht fest.
- [ ] Aktuelle Tests und Build für die betroffenen Funktionen erfolgreich.
- [ ] Der gesamte Aufnahmeablauf wurde einmal ohne Schnitt erfolgreich durchgespielt.

## Spätere technische Umsetzung

Das Vorschaubild zuerst laden; Video oder externen Player erst bei Bedarf. Bestehende Website-Komponenten wiederverwenden. Abspielsteuerung, Untertitel und mobile Wiedergabe prüfen. Bei einem externen Anbieter die tatsächlich erforderlichen Datenschutzmaßnahmen berücksichtigen. Keine Entscheidung über Anbieter oder zusätzliche Infrastruktur vor der fertigen Aufnahme erzwingen.

## Spätere Erfolgskontrolle

Mit Personen testen, die 4inOne nicht kennen: Können sie die vier Bereiche, den Nutzen und den Einstieg ohne Anmeldung erklären? Video nicht allein nach Wiedergaben bewerten, sondern auch danach, ob Besucher anschließend die Demo sinnvoll nutzen. Kein garantierter Conversion-Effekt angenommen.
