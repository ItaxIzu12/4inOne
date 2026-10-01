# Öffentliche Startseite und neue URLs

Die Startseite erklärt 4inOne vor dem Einstieg in die Demo. Sie verwendet das vorhandene Markenlogo und die einheitlichen SVG-Icons. Keine neuen 3D-Modelle, externen Schriften oder Bildabhängigkeiten. Das persönliche Dashboard wurde nicht neu gestaltet; seine Änderungen betreffen ausschließlich Links und die explizite Trennung von Demo und persönlichem Konto.

## URLs

| Ziel | URL |
| --- | --- |
| Produktseite ohne Anmeldung / Dashboard mit Anmeldung | `/` |
| Bewusst ausgewählte Demo | `/demo` |
| Demo-Bereiche | `/demo/finanzen`, `/demo/haushalt`, `/demo/organisation`, `/demo/reisen` |
| Persönliche Bereiche (geschützt) | `/finanzen`, `/haushalt`, `/organisation`, `/reisen`, `/familie` |
| Bestehende Haushaltsfinanzen | `/haushaltsfinanzen` |
| Anmeldung / Registrierung | `/login`, `/registrieren` |
| Einrichtung für berechtigte neue/leere Konten | `/onboarding` |

Alte `/app`-Adressen werden umgeleitet; Queryparameter und Fragment bleiben erhalten. Die bereits bestehende Cookie-Sitzungswiederherstellung läuft vor der Routenauswahl. Nach erfolgreicher Anmeldung/Registrierung geht es nach `/`, gegebenenfalls mit dem vorhandenen Onboarding-Guard weiter nach `/onboarding`. Bei Abmeldung wird `/` auch dann neu ausgewertet, wenn die URL bereits `/` lautet.

Die Demo hat eigene Route-Provider und einen `DEMO_MODE`-Kontext. Sie bleibt auch mit aktiver Anmeldung eine Demo; ihre Navigation führt nicht versehentlich in echte Daten. Ein angemeldeter Nutzer kann über „Zu meinen Daten“ zurückkehren.

## Dateien

- Neu: `frontend/src/app/features/landing/landing.ts`, `.html`, `.scss`.
- Neu: `frontend/src/app/core/demo-context.ts` und `frontend/e2e/landing.spec.ts`.
- Routing: `app.routes.ts`, Login-Erfolgsnavigation, Onboarding-Guard und Abschlussziele, App-Shell-Navigation/Abmeldung.
- URL-Verweise in Dashboard, Einladung, Haushaltsfinanzen, Bereichsvorschau, Verknüpfungen und bestehenden Navigationskomponenten aktualisiert.
- Bestehende Tests auf explizite Demo- und persönliche URLs angepasst. September-bezogene Tests verwenden ein festes Datum.
- Architekturhinweise in `docs/ARCHITECTURE.md` ergänzt.

## Validierung und Grenzen

- 275 Frontendtests erfolgreich.
- Produktionsbuild inklusive Angular/TypeScript-Prüfung erfolgreich; bestehende Warnung zum alten `finanzen.scss` (16,69 kB statt 12 kB Warnbudget).
- 27 gezielte Browserprüfungen zu Startseite, Demo, Konto und Onboarding erfolgreich.
- Startseite bei 360, 820 und 1440 px: keine horizontalen Überläufe und keine von Axe gemeldeten WCAG-A/AA-Verstöße. Desktop- und Handy-Screenshot visuell geprüft.
- Zusätzliche Bereichsprüfung: 54 Tests zunächst erfolgreich; sieben wegen September-Annahmen gescheitert, anschließend mit festem Datum erfolgreich (acht Tests im gezielten Wiederholungslauf).
- Drei bestehende Reise-Tests melden Kontrastprobleme in Eingabefeldern (`#8894a5` auf nahezu Weiß). Diese nicht durch das Routing verursachten Styles wurden nicht geändert.
- Browser-Sitzungs-/API-Antworten werden in Tests simuliert; keine Produktionsbereitstellung und kein Live-Backend-Abnahmetest.
- Keine Django-Änderungen oder Migrationen.

## Redaktionelle und visuelle Straffung

Die Startseite besteht jetzt aus Produktbotschaft, kompakter Bereichserklärung und einem kurzen Abschluss. Vorteilsleiste, Einstiegsschritte, Bildflächen und zusätzliche Abschnittslinks wurden entfernt. Die vier Karten bei „Alles hat seinen Platz“ sind statische Inhalte ohne Links, Pfeile, Fokusziele oder Hover-Effekte. Nur gezielte Einstiege und rechtliche Links bleiben anklickbar. Die Typografie ist nun durchgehend serifenlos; Karten sind gerade ausgerichtet und zurückhaltender gestaltet.

Erneut geprüft: 275 Frontendtests, sieben Startseiten-/Routing-Browsertests und Produktionsbuild erfolgreich. Desktop- und Mobilansichten visuell geprüft; die bestehende Größenwarnung im alten Finanz-Stylesheet bleibt unverändert. Routing und Dashboard wurden bei dieser Straffung nicht geändert.

## Aktueller Aufbau: Produkt erklären statt Geräte-Mockup

Die neueste Fassung ersetzt die Symbolübersicht durch vier konkrete, nicht interaktive Funktionsbeispiele. Jedes ist als „Beispiel“ gekennzeichnet und ausschließlich lokaler Marketing-Inhalt; es werden keine Benutzerdaten geladen oder erzeugt. Die Texte erklären Einnahmen/Ausgaben und Sparziele, Haushaltsroutinen/Einkäufe, Termine/Aufgaben und Reisevorbereitung. Die doppelte Abschlusswerbung entfällt zugunsten eines kurzen Einstiegshinweises. Es gibt keine künstlichen Gerätefotos und keinen sichtbaren Platzhalter für das später vom Nutzer gelieferte reale Bild.

Erneute Prüfung: 275 Unit-Tests, sieben Browserprüfungen einschließlich 360/820/1440 px und Produktionsbuild erfolgreich. Desktop und Mobile visuell gesichtet. Routing und persönliches Dashboard bleiben unverändert. Bestehende Finanz-CSS-Warnung weiterhin vorhanden.

## Sticky-Header und Erklärung der Verbindungen

Der Startseitenheader bleibt beim Scrollen oben sichtbar (Desktop, Tablet und Handy). Der Einstiegshinweis „Starte mit dem Bereich …“ entfällt. Stattdessen erklärt ein statisches Waschmaschinen-Beispiel die tatsächlich unterstützten Verbindungen Sparziel–Aufgabe und Aufgabe–Termin. Es beschreibt die bewusste Auswahl durch den Nutzer und weist darauf hin, dass Verknüpfungen keine Zugriffsrechte verändern.

Dashboard- und Navigationsicons tragen ihre Bereichsfarben; inaktive Navigationstexte bleiben neutral. Aufgaben in Organisation verwenden Lila. Prüfung: 275 Unit-Tests, zehn Browserprüfungen inklusive Sticky-Verhalten und responsiven Domain-Ansichten sowie Produktionsbuild erfolgreich. Bestehende Finanz-CSS-Größenwarnung unverändert.
