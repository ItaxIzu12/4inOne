# 4inOne — External Beta Preparation

Plan für 5–15 reale Testpersonen · 11. Oktober 2026

## Beta Test Plan

### Ziel und Freigabe

Wir prüfen, ob Menschen 4inOne verstehen, einen persönlichen Nutzen finden, passende Dinge zusammenbringen und Vorschläge richtig einordnen. Entscheidend sind beobachtetes Verhalten und konkrete Schwierigkeiten, nicht Zustimmung zum Konzept.

**Dieser Plan ist keine Beta-Freigabe.** Der [Readiness Audit](PRE_BETA_READINESS_AUDIT.md) steht auf NO. Vor externen echten Konten müssen Passwort-Recovery, die produktive API-Konfiguration und die Anbieter-/Datenschutzinformationen fertig sein. Die offenen Paket-, Deployment- und Accessibility-Prüfungen ebenfalls abschließen. Danach P0 = 0 und P1 = 0 erneut bestätigen.

### Teilnehmer und Ablauf

- Mit 5 Personen beginnen, anschließend bei stabilen Kernabläufen auf höchstens 15 erweitern. Möglichst Personen außerhalb des Entwicklungsteams, mit unterschiedlichen alltäglichen Organisationsbedürfnissen. Keine Repräsentativität einer großen Marktstudie behaupten.
- Smartphone und Desktop berücksichtigen. Nur grobe Geräteklasse und Browser erfassen; keine demografischen Profile sammeln. Mindestens eine Session mit Tastaturbedienung vorsehen, sofern eine Person so arbeitet.
- Pro Person: 30–40 Minuten beobachtete erste Nutzung inklusive kurzem Interview. Danach 7 Tage freiwillige Nutzung und ein 10-minütiges Abschlussgespräch. Keine Pflicht, täglich aktiv zu sein.
- Aufgaben einzeln zeigen. Verknüpfungs- und Vorschlagsaufgaben erst nach der freien ersten Nutzung geben, damit sie das anfängliche Produktverständnis nicht beeinflussen.
- Erster Eindruck: Startseite etwa 10 Sekunden ansehen lassen. Danach fragen: „Was glaubst du, kannst du hier machen?“ Erklärung erst nach der Antwort, falls für das Weiterkommen notwendig; Hilfe protokollieren.

### Moderation

Einstieg: „Wir testen das Produkt, nicht dich. Du kannst jederzeit pausieren oder abbrechen. Verwende bitte erfundene Angaben für Beträge, Reisen und Haushaltsgegenstände. Sag gern, was du erwartest oder suchst.“

Nicht Funktionen vorführen, Buttons benennen oder Erfolg bestätigen. Bei Stillstand zunächst „Was suchst du gerade?“ oder „Was würdest du jetzt versuchen?“ fragen. Erst bei ausdrücklichem Hilfewunsch oder nach etwa drei Minuten ohne Fortschritt eine minimale Hilfe geben. Ergebnis dann als **mit Hilfe**, nicht als selbstständig gelöst zählen. Bei Risiko oder Unwohlsein sofort eingreifen.

### Beobachtung und Datenschutz

Für jede Aufgabe notieren: Test-ID, Aufgabe, selbstständig / mit Hilfe / abgebrochen / nicht testbar, grobe Dauer, beobachteter Umweg, erwartetes Verhalten und anonymisierte Aussage. Keine privaten Objektinhalte abschreiben. Verhalten und Interpretation in getrennten Notizen halten.

Konten bleiben leer; keine Demo-Daten ungefragt hineinladen. Für die Registrierung ist eine erreichbare E-Mail erforderlich, aber keine zusätzliche persönliche Befragung. Tester müssen weder reale Finanzdaten noch Dokumente, Anschriften oder Reisedaten eingeben. Keine Konto-/Datenbankexporte zum Debuggen verlangen. Keine Tokens, Passwörter, vollständigen Requests oder persönlichen Inhalte in Logs aufnehmen.

Keine Session-Replay-, Tracking- oder Aufnahmefunktion einbauen. Standard ist eine Notiz der Moderation. Eine freiwillige Aufnahme wäre gesondert zu vereinbaren; Ablehnung darf Teilnahme nicht verhindern. Rohnotizen unter Test-IDs verwahren, Zugriff auf die auswertenden Personen begrenzen und spätestens 30 Tage nach Abschluss der Runde löschen; nur eine anonymisierte Problemliste behalten. Diese interne Regel ist vor Start organisatorisch umzusetzen, keine Behauptung über bereits implementierte automatische Löschung.

### Einfacher Feedback-Weg

**Antwort auf die persönliche Beta-Einladung an die einladende Person.** Dieselbe Ansprechperson ist für Rückfragen und Sicherheitsmeldungen zuständig. Keine neue Supportplattform und kein Feedback-Feature nötig.

Vor Einladungen eine tatsächlich betreute Antwortadresse und Vertretung festlegen. Aktuell enthalten die produktseitigen Kontaktinformationen noch Platzhalter; dieser Plan erfindet keine Adresse. Keine Einladung versenden, solange dieser Kontakt offen ist.

Meldungen benötigen nur: Was wolltest du erreichen? Was ist passiert? Was hattest du erwartet? Grobe Geräte-/Browserangabe optional. Screenshots nur freiwillig und ohne persönliche Inhalte. Sicherheits-/Datenschutzmeldungen direkt und vertraulich, nicht in einer gemeinsamen Testergruppe. Eingangsbestätigung spätestens am nächsten Werktag vorsehen; akute Sicherheitsfälle sofort behandeln.

## Tester Tasks

Diese Aufgaben können mit frei erfundenen Angaben bearbeitet werden. Es gibt keinen vorgegebenen Klickweg. Eine Aufgabe darf ausgelassen werden; den Grund notieren.

1. **Konto:** Erstelle ein Konto und richte deinen Einstieg so ein, wie es zu dir passt.
2. **Freie erste Nutzung:** Wähle den Bereich, der dir am ehesten helfen könnte, und halte dort etwas fest. Entscheide selbst, was.
3. **Aufgabe:** Du möchtest nächste Woche etwas erledigen. Halte es so fest, dass du später weißt, was ansteht.
4. **Haushaltsobjekt:** Du hast eine Waschmaschine und möchtest die wichtigsten Angaben dazu wiederfinden können. Erfasse einen erfundenen Gegenstand.
5. **Reise:** Plane einen erfundenen kurzen Aufenthalt in Berlin im kommenden Monat. Halte fest, was du dafür brauchst.
6. **Finanzen:** Du möchtest Geld für einen Zweck einplanen oder zurücklegen. Erfasse ein Budget oder Sparziel mit erfundenen Beträgen.
7. **Zusammenhang:** Zwei deiner Einträge gehören zu derselben Sache, beispielsweise ein Haushaltsgegenstand und ein dafür bestimmtes Sparziel. Stelle diesen Zusammenhang im Produkt dar. Erkläre anschließend, was sich deiner Meinung nach geändert hat.
8. **Vorschlag:** Sieh dir einen angebotenen Vorschlag an. Entscheide, ob du ihn nutzen möchtest oder nicht. Was erwartest du vor deiner Entscheidung, und was ist danach passiert?
9. **Wiederfinden:** Wechsle zu einem anderen Bereich und finde einen zuvor erstellten Eintrag wieder. Lade die Seite neu und prüfe, ob er noch da ist.
10. **Konto und Kontrolle:** Finde Profil oder Einstellungen. Prüfe eine Angabe, ändere bei Bedarf einen erfundenen Anzeigenamen und melde dich anschließend ab und wieder an.

**Nur für die Moderation:** Keine Einträge passend machen, bevor die Person frei gearbeitet hat. Falls für Aufgabe 7 kein unterstütztes Paar vorhanden ist, einen passenden Alltagskontext als Zusatzaufgabe anbieten und die Aufgabe als angeleitet markieren. Die aktuelle Kombination Gerät + Sparziel vor der Runde auf dem Beta-Stand überprüfen.

Vorschläge sind bedingungsabhängig. Falls keiner erscheint, Aufgabe 8 als **nicht testbar** protokollieren, nicht als Verständnisfehler. Für eine gesonderte Vorschlagsprüfung kann die Person ausdrücklich eine zusätzliche erfundene Berlin-Reise etwa 30 Tage in der Zukunft und eine Organisationsaufgabe „Hotel Berlin bestätigen“ sieben Tage davor anlegen. Dieser Kontext entspricht einer vorhandenen getesteten Regel. Er ist als vorbereitete Zusatzaufgabe zu kennzeichnen; keine heimlich eingespeisten Daten. Für eine unabhängige Entscheidung zum Vorschlag ein noch nicht manuell verknüpftes Paar verwenden.

## Interview Questions

Nach der ersten Nutzung, ohne Produktbegriffe vorab zu erklären:

- Was glaubst du, ist 4inOne?
- Wobei könnte es dir helfen? Wobei eher nicht?
- Was war für dich der größte Vorteil, falls du einen gesehen hast?
- Was bedeutet „Verknüpfen“ für dich?
- Was glaubst du, passiert, wenn zwei Einträge verknüpft sind? Wer kann sie dann sehen?
- Was glaubst du, warum dieser Vorschlag erschienen ist?
- War etwas unklar? Kannst du eine konkrete Stelle nennen?
- Welchen Bereich würdest du wirklich verwenden?
- Welche Funktion würdest du als Erstes wieder nutzen?
- Was hat dich gestört oder aufgehalten?
- Was hast du erwartet, aber nicht gefunden?
- Wenn du etwas weglassen könntest: Was wäre das?

Nach der freiwilligen Woche:

- Hast du 4inOne noch einmal geöffnet? Für welche konkrete Situation?
- Welche Bereiche hast du von dir aus verwendet? Warum diese?
- Gab es einen Moment, in dem du lieber ein anderes Werkzeug benutzt hast? Was war leichter?
- Hast du einen Zusammenhang oder einen Vorschlag genutzt? Was hat dir das erspart, falls etwas?

Nicht fragen, ob die „Connection Engine gut“ ist. Begriffe wie „einfach“, „praktisch“ oder „innovativ“ nicht in Fragen vorgeben. Kritik nicht rechtfertigen; Nachfragen beziehen sich auf das konkrete Verhalten.

## Feedback Categories

| Kategorie | Bedeutung |
| --- | --- |
| BUG | Verhalten weicht reproduzierbar vom vorgesehenen Ablauf ab; z. B. ein gespeicherter Eintrag verschwindet. |
| UX | Funktion existiert, ist aber schwer zu finden oder zu bedienen. |
| COPY | Begriff, Erklärung oder Fehlermeldung führt zu Missverständnissen. |
| PERFORMANCE | Wahrnehmbare Wartezeit, stockende Bedienung oder wiederholtes Laden. |
| MISSING EXPECTATION | Erwartetes Ergebnis fehlt; zunächst offenlassen, ob Funktion, Erklärung oder Auffindbarkeit die Ursache ist. |
| FEATURE REQUEST | Wunsch nach zusätzlichem Verhalten; nicht automatisch eine Bauentscheidung. |
| SECURITY / PRIVACY | Fremde Daten, ungewolltes Teilen, sensible Logs oder missverständliche Zugriffskontrolle. |

Zusätzlich getrennt einstufen: **P0** Sicherheitsvorfall/Datenverlust/unbenutzbar; **P1** wichtiger Ablauf kaputt; **P2** UX-Problem; **P3** Polish. Kategorie beschreibt die Art, Priorität die Dringlichkeit. Ein Sicherheitsverdacht wird zuerst untersucht, nicht durch Mehrheitsabstimmung relativiert.

Erfassungsvorlage:

```text
Feedback-ID / Test-ID:
Kategorie / Priorität:
Aufgabe oder Kontext:
Beobachtetes Verhalten:
Erwartung der Person:
Reproduktion mit erfundenen Daten:
Selbstständig / mit Hilfe / abgebrochen / nicht testbar:
Anzahl betroffener Personen / Anzahl mit derselben Gelegenheit:
Nächster Schritt / verantwortlich / Status:
```

Jeden Feature Request anhand des Problems prüfen: Wie viele Personen hatten unabhängig dieselbe Schwierigkeit? Löst er ein Kernproblem von 4inOne? Passt er zu vier eigenständigen Bereichen mit optionalen Zusammenhängen? Gibt es bereits einen einfacheren Weg, etwa verständlichere Copy oder bessere Auffindbarkeit? Erst danach Entscheidung: vorhandenen Weg verbessern / später prüfen / nicht verfolgen. Nicht Wünsche zählen, sondern gemeinsame Ursachen und Auswirkungen.

## Success Criteria

Arbeitsziele für diese kleine qualitative Runde, keine statistisch belastbaren Marktkennzahlen. Vor Beginn festhalten und danach nicht zugunsten eines besseren Ergebnisses ändern.

| Kriterium | Ziel |
| --- | --- |
| Sicherheit und Kernbetrieb | Keine offenen P0/P1; keine ungewollte Datenfreigabe oder Datenverluste. |
| Erste Orientierung | Mindestens 80 % beschreiben nach dem ersten Eindruck eine Alltagsorganisation und erkennen mehrere Bereiche ohne Erklärung. |
| Erster Nutzen | Mindestens 80 % schließen Konto, Einstieg und eine selbst gewählte erste Aktion ohne Hilfe ab. |
| Zusammenhang | Mindestens 70 % der Personen mit einem geeigneten Paar stellen den Zusammenhang ohne Klickhilfe her und beschreiben ihn als Beziehung zwischen Einträgen. |
| Zugriffskontrolle | Niemand wird mit dem unaufgeklärten Eindruck entlassen, Verknüpfen teile automatisch private Daten oder bewege Geld. Solche Missverständnisse separat untersuchen. |
| Suggestions | Mindestens 70 % der Personen, die tatsächlich einen Vorschlag sehen, verstehen Anlass und Entscheidung; Akzeptieren ist kein Erfolgskriterium. |
| Wiederfinden | Mindestens 80 % finden ihren Eintrag selbstständig wieder; gespeicherte Inhalte bleiben nach Reload erhalten. |
| Freiwillige Wiederverwendung | Mindestens die Hälfte berichtet nach sieben Tagen eine konkrete selbst gewählte Nutzung; Nichtnutzung samt Grund zählt als wertvolle Beobachtung. |
| Mehrere Bereiche | Freiwillige Mehrbereichsnutzung mit konkretem Anlass separat zählen. Erzwungene Testeraufgaben nicht als Adoption werten; Einbereichsnutzung ist kein Misserfolg. |

Bei 5 Personen bedeutet 80 % mindestens 4 und 70 % ebenfalls mindestens 4. Immer absolute Werte und Nenner berichten. Wenn nur zwei Personen einen Vorschlag gesehen haben, ist daraus keine belastbare Aussage für alle Tester möglich. Schwache Produktverständniswerte führen zu Überarbeitung und erneuter kleiner Prüfung, nicht automatisch zu neuen Features.

## Stop Criteria

- **Beta sofort pausieren:** bestätigte fremde Daten, ungewolltes Teilen, Datenverlust, kompromittierte Zugangsdaten oder anderer P0. Zugang begrenzen, notwendige Maßnahmen dokumentieren und betroffene Personen über den definierten Kontakt informieren; keine sensiblen Daten zum „Beweis“ sammeln.
- **Keine weiteren Einladungen bei P1:** Registrierung/Login/Recovery, Speichern, Reload oder Löschen ist verlässlich kaputt. Den betroffenen Ablauf stoppen, beheben und vor Wiederaufnahme regressionsprüfen.
- **Einzelne Session stoppen:** Person möchte abbrechen, wirkt unwohl oder müsste private Inhalte offenlegen. Teilnahme ist freiwillig; keine Rechtfertigung verlangen.
- **Wiederkehrende Sackgasse:** Zwei Personen scheitern unabhängig an derselben Kernaufgabe. Aufgabe nicht weiteren Personen unverändert zumuten; Ursache untersuchen. Das ist eine Prüfregel, kein Beweis statistischer Häufigkeit.
- **Feedback-/Datenschutzbasis fehlt:** unbeaufsichtigter Kontakt, ungeklärter Datenumgang oder neue sensible Logdaten. Runde nicht starten bzw. pausieren, bis organisatorisch geklärt.

Wiederaufnahme erst nach überprüfter Behebung des Auslösers; bei P0/P1 erneut technische Freigabe. Kein beliebiges Kalenderdatum ersetzt diese Entscheidung.

## What Not To Build Yet

- Kein neues Dashboard-/Landing-Redesign allein für diese Runde.
- Keine Bankanbindung, Investments, KI, automatische Cross-Domain-Aktionen oder zusätzlichen großen Fachbereiche.
- Kein Ticketportal, komplexes Supportsystem, Session Replay oder neue Analytics-Infrastruktur.
- Keine automatische Übernahme von Demo-Daten in echte Konten.
- Kein Feature für jeden Einzelwunsch; zunächst das zugrunde liegende Problem prüfen.
- Keine großen Warnbanner. Ein optionales dezentes Beta-Label ist für den Testplan nicht erforderlich; der Beta-Status wird in der Einladung erklärt.
- Keine neuen Automationen zur Nachverfolgung der Tester und kein ungefragtes Anschreiben.

Erst Freigabeblocker beheben, vorhandene Funktionen verständlich testen und wiederkehrende Probleme priorisieren. Dieser Vorbereitungsschritt erstellt nur den Plan; keine Nutzer eingeladen und keine Produktänderungen vorgenommen.
