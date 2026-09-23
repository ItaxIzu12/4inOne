# Gesamtkonzept: 4inOne
## Finanzen · Haushalt · Organisation · Reisen — dein Alltag, alles verbunden.

*Version 3 — bewusste Umbenennung und Umfang-Erweiterung von "Kompass" (3 Module) zu "4inOne" (4 gleichrangige Module inkl. Reisen), nach expliziter Entscheidung trotz vorheriger Bedenken zur Scope-Ausweitung. Diese Entscheidung wird hier dokumentiert, nicht erneut infrage gestellt — die vorherige Zurückhaltung bei "Reisen als eigenständiges Modul" ist damit bewusst aufgehoben, siehe Abschnitt "Entscheidungen, die nicht mehr offen sind".*

---

## 1. Executive Summary

Die Idee: eine zentrale Plattform, die Menschen von mehreren Logins und fragmentierten Einzel-Apps befreit, indem sie **vier** Lebensbereiche bündelt — Finanzen, Haushalt, Organisation, Reisen — barrierefrei, für Jung und Alt gleichermaßen nutzbar. Dieses Konzept liefert die Marktanalyse, die Produktstruktur, alle rechtlichen "Stolperfallen" sowie eine realistische Roadmap. Die technische Umsetzung steht separat in `Architektur.md`.

**Kernaussage, jetzt präzisiert als Leitgedanke:** *"Eine Information. Einmal eingeben. Überall sinnvoll verbunden."* Der größte Erfolgsfaktor ist nicht die Anzahl der Features, sondern wie tief die vier Bereiche wirklich integriert sind — über eine explizite **Connection Engine** (siehe Architektur.md), nicht durch bloßes Nebeneinanderstellen von vier Mini-Apps.

---

## 1.1 Vision

4inOne ist eine zentrale Plattform für die Organisation des persönlichen und gemeinsamen Alltags. Die Anwendung verbindet vier Lebensbereiche: **Finanzen · Haushalt · Organisation · Reisen**.

Das Ziel besteht nicht darin, vier voneinander getrennte Anwendungen innerhalb einer Oberfläche anzubieten. Die einzelnen Bereiche sollen miteinander kommunizieren und Informationen gemeinsam verwenden. Eine Information soll möglichst nur einmal eingegeben werden müssen. 4inOne erkennt Zusammenhänge zwischen Terminen, Aufgaben, Budgets, Haushaltsaktivitäten und Reisen und kann daraus Verknüpfungen, Vorschläge und Automatisierungen erzeugen.

## 1.2 Dashboard-Prinzip

Das Dashboard ist die zentrale Startseite. Es soll dem Nutzer nicht möglichst viele Informationen gleichzeitig zeigen, sondern beantworten: **Was ist heute wichtig?** Es zeigt heutige Termine, wichtige Aufgaben, offene Haushaltsaufgaben, Budgetinformationen, bevorstehende Reisen, Erinnerungen, automatisch verbundene Inhalte und intelligente 4inOne-Vorschläge. Personalisiert, mit Unterscheidung zwischen relevanten und weniger wichtigen Daten.

## 1.3 Modul: Finanzen

Verwaltet persönliche oder gemeinsame Finanzen übersichtlich. Kernfunktionen: monatliche Budgets, Einnahmen, Ausgaben, Kategorien, Sparziele, wiederkehrende Kosten, gemeinsame Kosten, Finanzübersichten, Statistiken. Besonders stark mit anderen Bereichen verbunden — ein Reisebudget gehört gleichzeitig zu Reisen UND Finanzen, ohne doppelte Anlage. Die bereits ausgearbeiteten Differenzierungsfeatures (Einkauf-zu-Ausgabe-Moment, Fairness-Anzeige, Abo-Radar, Einkommens-/Analysen-Berechnung, KI-Export) bleiben vollständig gültig — siehe Abschnitte 5.1–5.4 weiter unten, jetzt als Teilmenge dieses größeren Finanzen-Moduls zu verstehen.

## 1.4 Modul: Haushalt

Organisiert Aufgaben und Routinen: Haushaltsaufgaben, wiederkehrende Aufgaben, Einkaufslisten, Verantwortlichkeiten, gemeinsame Aufgaben, Haushaltsmitglieder, Fälligkeiten, Erinnerungen. Aufgaben lassen sich einzelnen Personen zuordnen (z. B. Müll herausbringen, Wäsche waschen, Küche reinigen, Einkauf erledigen, Pflanzen gießen). Verbindet sich mit Terminen und Reisen — steht eine Reise bevor, kann 4inOne vorschlagen: *"Du bist nächste Woche nicht zu Hause. Möchtest du deine Haushaltsaufgaben verschieben?"*

## 1.5 Modul: Organisation

Bildet die zeitliche und organisatorische Grundlage: Kalender, Termine, Aufgaben, Erinnerungen, Notizen, gemeinsame Termine, persönliche Termine, Projekte. Eng mit allen anderen Bereichen verbunden — eine Reise kann automatisch Termine für Abflug, Rückflug, Check-in, Hotel und Aktivitäten erzeugen.

## 1.6 Modul: Reisen

Bündelt alle Informationen zu einer Reise an einem Ort: Reiseziel, Reisedatum, Teilnehmer, Reisebudget, Sparziel, Aufgaben, Packliste, Dokumente, Buchungen, Termine, Aktivitäten. Eine Reise ist kein isolierter Datensatz, sondern verbindet automatisch Informationen aus mehreren Bereichen.

**Beispiel "Berlin Wochenende":** Reisen (Berlin, 16.–18. Mai) → Finanzen (Budget: 700 €) → Organisation (2 Termine) → Aufgaben (4 Aufgaben) → Haushalt (Aufgaben während der Abwesenheit anpassen).

**Datenschutz-Hinweis (bereits in Architektur.md verankert):** Reisen bringt neue sensible Datenkategorien (Passnummern, Visadaten, Dokumente) mit vergleichbarer Sorgfaltspflicht wie Finanzdaten — dieselben Sicherheitsprinzipien (Verschlüsselung, HouseholdScopedPermission) gelten hier unverändert.

## 1.7 Connections — das eigentliche Kernkonzept

Connections verbinden Informationen unterschiedlicher Bereiche miteinander. Beispiel Japanreise: → Reise → Budget → Sparziel → Kalender → Aufgaben → Teilnehmer. Der Nutzer erkennt dadurch jederzeit, welche Informationen zusammenhängen. 4inOne soll sich dadurch nicht wie vier Apps anfühlen, sondern wie ein zusammenhängendes System. **Technische Umsetzung:** siehe Architektur.md, Abschnitt 2.1b (Connection Engine, generisches Verknüpfungsmodell).

## 1.8 4inOne-Vorschläge

Kontextbezogene Vorschläge, z. B.: *"Deine Berlin-Reise beginnt in fünf Tagen. Möchtest du deine Packliste öffnen?"* / *"Du hast morgen einen Arzttermin. Möchtest du eine Erinnerung zwei Stunden vorher?"* / *"Dein Urlaub beginnt am Montag. Drei Haushaltsaufgaben liegen während deiner Reise."* / *"Für dein Reiseziel fehlen noch 420 €. Möchtest du dein monatliches Sparziel anpassen?"* Der Nutzer behält immer die Kontrolle, ob ein Vorschlag übernommen wird — **keine Automatisierung ohne Zustimmung**, siehe Architektur.md 2.1c.

## 1.9 Automatisierungen (Post-MVP)

Später können aus Vorschlägen Automatisierungen entstehen — z. B. beim Anlegen einer Reise automatisch: Reisebudget erstellen, Packliste erzeugen, Reise im Kalender eintragen, Haushaltsaufgaben prüfen, Teilnehmer informieren. **Automatisierungen müssen transparent und jederzeit deaktivierbar sein** — diese Anforderung ist bereits in Architektur.md 2.1c als bindende MVP-Abgrenzung festgehalten, nicht nur als Absichtserklärung.

## 1.10 Familie und gemeinsame Nutzung

4inOne funktioniert sowohl allein als auch gemeinsam. Ein Nutzer kann andere Personen zu einem Haushalt oder zu bestimmten Bereichen einladen. Berechtigungen werden granular vergeben — technisch bereits als `ModulBerechtigung`-Erweiterung in Architektur.md 2.1e festgehalten. Konkrete Rollenbeispiele:

| Rolle | Finanzen | Haushalt | Organisation | Reisen |
|---|---|---|---|---|
| Partner | Bearbeiten | Bearbeiten | Bearbeiten | Bearbeiten |
| Kind | Kein Zugriff | Eingeschränkt | Bearbeiten | Ansehen |
| Freund | — | — | — | Nur eine gemeinsame Reise |

Die "Freund"-Zeile zeigt eine noch nicht abgedeckte Anforderung: Zugriff auf **einen einzelnen Datensatz** (eine bestimmte Reise), nicht auf ein ganzes Modul — das bestehende `ModulBerechtigung`-Modell (Zugriff pro Modul) reicht dafür nicht aus, es braucht zusätzlich objektbezogene Freigaben (eine Connection zwischen Person und einzelnem Reise-Datensatz, nicht dem ganzen Haushalt). **Offener Punkt für die technische Detailplanung**, siehe Architektur.md "Offene Punkte".

## 1.11 Designprinzip

4inOne soll trotz großen Funktionsumfangs nicht kompliziert wirken: **Komplexe Funktionen – einfache Oberfläche.** Die Oberfläche soll ruhig, freundlich, modern, verständlich, großzügig und barrierearm sein. Farben dienen primär der Orientierung: Grün (Finanzen), Rosa (Haushalt), Lila (Organisation), Blau (Reisen). Dekorationen, Illustrationen und verspielte Elemente werden sparsam eingesetzt — siehe `design_system.md` für die technische Umsetzung dieses Prinzips.

## 1.12 Produktprinzip

Bei jeder neuen Funktion wird geprüft: **Mit welchem anderen Bereich kann diese Funktion sinnvoll verbunden werden?** 4inOne soll keine Sammlung einzelner Funktionen werden — die Verbindung zwischen den Lebensbereichen ist das wichtigste Alleinstellungsmerkmal, nicht die Anzahl der Features selbst.

**Leitgedanke, verbindlich für jede künftige Entscheidung:** *Eine Information. Einmal eingeben. Überall sinnvoll verbunden.*

---

## 2. Marktanalyse

### 2.1 Der globale Super-App-Trend
Das "eine App für alles"-Modell gewinnt weltweit an Bedeutung. Der globale App-Markt wird 2026 auf ca. 1,05 Billionen US-Dollar geschätzt, mit starkem Wachstum bei Fintech-Apps.

### 2.2 Die europäische Realität
Deutsche Nutzer bevorzugen tendenziell mehrere spezialisierte Apps gegenüber einer App, die vieles nur mittelmäßig kann – kulturell und durch Datenschutz-Sensibilität bedingt. **Positionierung:** nicht "eine App für alles im WeChat-Stil", sondern gegen die Reibung von 3–4 Einzel-Apps im Alltag.

### 2.3 Wettbewerbslandschaft nach Modul

| Bereich | Etablierte Wettbewerber | Stärken der Konkurrenz |
|---|---|---|
| Finanzen/Haushaltsbuch | Finanzguru, Outbank, Woolsocks, YNAB, MoneyControl, Monee | Kontoverknüpfung, KI-Kategorisierung, Community-Vertrauen |
| Haushalt/Organisation | hauszettl, Flatastic, Bring!, Home Tasker, Sweepy | Fokussiert, einfach, oft kostenlos |
| Organisation (Kalender) | Google Kalender, Todoist, Microsoft To Do | Riesige Nutzerbasis, kostenlos |

Kein Anbieter deckt alle drei Bereiche gemeinsam ab. Gegen Google Kalender ist Frontalangriff aussichtslos – Fokus auf Verknüpfung/Import statt Neubau.

### 2.4 Monetarisierungstrend
Fast jede relevante App setzt auf Abo-Modelle (0,99–19,99 €/Monat). Freemium mit Basis kostenlos + Premium-Funktionen entspricht der Markterwartung.

### 2.5 Kundengewinnung realistisch einordnen — aktuelle Zahlen (Stand 2026)

Diese Zahlen sind entscheidend für die Marketingstrategie in Abschnitt 11 und sollten bei jeder Wachstumsplanung als Realitätscheck dienen:

| Kennzahl | Wert | Einordnung |
|---|---|---|
| Deutscher Markt für digitale Personal-Finance-Apps | 2,4 Mrd. $ (2024) → 4,2 Mrd. $ (2033 prognostiziert), 6,7 % CAGR | Wachsender, aber nicht explodierender Markt |
| Europas Anteil am globalen Markt | ca. 25–30 % | — |
| Aktive Fintechs in Deutschland | 700+ | Harte Konkurrenzdichte |
| Meistgeladene Finance-App DE | PayPal, 6,9 Mio. Downloads/Jahr | Dominanz etablierter Player |
| **Kundenakquisekosten (CAC) Consumer-Fintech** | **ca. 1.450 $ pro Kunde** | **Bezahlte Werbung ist für ein Solo-Projekt ohne Budget nicht der richtige Kanal — siehe Abschnitt 11** |
| Anteil Subscription/Premium am Branchenumsatz | ca. 48 % | Bestätigt das Freemium-Modell aus 2.4 |
| Gen Z/Millennials als Nutzeranteil bestehender Apps | 70 %+ | **Ältere Nutzer sind strukturell unterversorgt — echte Nischen-Chance für die Zielgruppen-Entscheidung in Abschnitt 3** |
| Sicherheits-Apps-Wachstum DE (z. B. ElsterSecure) | +195,9 % im Jahresvergleich | Sichtbare Sicherheit ist ein wachsendes, nicht nur ein bestehendes Kaufargument |

**Ehrlich zur Datenlage:** Globale Marktgrößen-Schätzungen schwanken zwischen Quellen um den Faktor 5–10. Die regionalen/spezifischeren Zahlen oben (Deutschland, CAC, Gen-Z-Anteil) sind verlässlicher als eine einzelne große globale Zahl und sollten als Entscheidungsgrundlage bevorzugt werden.

---

## 3. Zielgruppen: Jung und Alt gemeinsam denken

**Persona A – "Junger Nutzer" (20–35):** Mobile-first, Wisch-Gesten, Dark Mode, schnelle Eingabe, geringe Geduld für Erklärtexte.

**Persona B – "Älterer Nutzer" (60+):** Große, klar lesbare Schrift, hohe Kontraste, wenig Animation, klare textuelle Beschriftung, Bestätigungsdialoge vor kritischen Aktionen, Vertrauenssignale.

**Praktische Konsequenz:** Ein adaptives UI-Konzept mit einstellbarer Textgröße/Kontraststufe statt zwei getrennter Interfaces – bedient WCAG-Pflicht und beide Zielgruppen gleichzeitig.

**Marktbestätigung (neu, siehe 2.5):** Diese Zielgruppen-Entscheidung ist nicht nur eine Nice-to-have-Haltung, sondern eine echte Marktlücke — 70 %+ der aktuellen Nutzer bestehender Personal-Finance-Apps sind Gen Z/Millennials, ältere Nutzer sind strukturell unterversorgt.

---

## 4. Value Proposition & Gegenüberstellung

### 4.1 "Beim Öffnen direkt erkennen, worum es geht"
1. Ein Satz: "Finanzen, Haushalt und Organisation – ein Login, eine App, ein Überblick."
2. Visuelle Gegenüberstellung direkt im Onboarding.
3. Interaktiver Mini-Test: "Welche Apps nutzt du aktuell?" → App zeigt personalisiert, wie viele Logins ersetzt werden.
4. Sofort nutzbarer Home-Screen, kein Pflicht-Tutorial.

### 4.2 Gegenüberstellungs-Tabelle

| Ohne deine App | Mit deiner App |
|---|---|
| 3–4 separate Apps, 3–4 Logins | 1 App, 1 Login |
| Daten in Silos | Verknüpfte Daten (Einkaufsliste fließt automatisch ins Budget) |
| Unterschiedliche Bedienkonzepte | Ein konsistentes, barrierefreies Bedienkonzept |
| Nicht für ältere Nutzer optimiert | Einstellbare Kontrast-/Schriftgrößenstufen |
| Mehrere Abos parallel | Ein Abo, volle Kostentransparenz |

Diese Tabelle wortwörtlich auf Landingpage, App-Store-Listing und Onboarding verwenden.

---

## 5. Funktionsumfang MVP

**Nicht alle drei Module gleich tief starten.** Haushalt+Finanzen zuerst (natürlichste Verzahnung), Organisation schlanker starten.

- **Finanzen:** Manuelle Erfassung, Kategorien, wiederkehrende Ausgaben automatisch erkennen, Budgetziele, geteilte Haushaltskasse.
- **Haushalt:** Einkaufsliste (gemeinsam bearbeitbar), Aufgabenverteilung, Erinnerungen.
- **Organisation:** Gemeinsamer Kalender, bewusst schlank, Google-Kalender-Import statt Eigenbau.

**Der eigentliche USP – Querverbindungen:**
- Einkaufsliste → automatisch geplante Ausgabe im Budget
- Wiederkehrende Haushaltsaufgaben → automatisch im Kalender
- Zentrales "Diese Woche"-Dashboard über alle drei Module

### 5.1 Konkrete Differenzierungsfeatures im Finanzmodul (neu)

Diese vier Ideen sind das, was Kompass von reinen Budget-Trackern (Finanzguru, YNAB) tatsächlich unterscheidet, weil sie das Mehrpersonenhaushalt-Datenmodell voraussetzen, das die Einzel-Wettbewerber nicht haben:

1. **Der Einkauf-zu-Ausgabe-Moment:** Nach Abschluss der Einkaufsliste ein freundlicher Bestätigungs-Screen mit Schieberegler statt Zahlen-Tippen ("War es ungefähr 64 €?"). Technisch: `finanzen.services.create_transaction_from_shopping_list()`, ausgelöst beim Abhaken der letzten Position — siehe `Architektur.md`, Abschnitt 2.1.
2. **Fairness-Anzeige:** Transparente, wertungsfreie Darstellung, wer wie viel zu den gemeinsamen Ausgaben beigetragen hat ("Anna 58 % / Jonas 42 %"). Löst ein reales WG-/Partnerschafts-Reibungsproblem, das Einzelnutzer-Apps strukturell nicht adressieren können. Voraussetzung im Datenmodell: `created_by`-Feld auf jeder Transaktion.
3. **Abo-Radar mit Haushalts-Zuordnung:** Wiederkehrende Ausgaben erkennen plus die Frage "Wer nutzt das eigentlich noch?" bei Abos, die einem ausgezogenen/inaktiven Haushaltsmitglied zugeordnet waren.
4. **Beruhigender statt alarmierender Ton bei Budgetüberschreitung:** "Ihr seid diesen Monat etwas über Plan – hier ist, wo's herkam" statt roter Warnmeldungen. Reine Text-/Ton-Entscheidung, aber verhaltensökonomisch belegt wirksamer gegen App-Vermeidung als Alarm-Formulierungen.

**Zusätzliches Vertrauensargument, das bewusst positiv kommuniziert werden sollte:** "Keine Bankverbindung nötig" / "Wir sehen deine Bankdaten nicht" — die manuelle Eingabe ohne Banking-API (Phase 5 erst später) ist bei datenschutzbewussten deutschen Nutzern eher ein Vertrauensvorteil als eine funktionale Lücke, sollte also aktiv beworben statt entschuldigt werden.

### 5.2 Budgetziele — bewusst einfach statt vollständig (revidiert)

**Kurskorrektur gegenüber der vorherigen Fassung:** Ein Zero-Based-Envelope-System (wie in einer früheren Version dieses Abschnitts beschrieben) wurde erwogen, aber wieder verworfen — es verlangt monatliches manuelles Zuweisen jedes Euros und viel Zahleneingabe, was direkt der Kernanforderung "stark und simpel für alle Nutzer, möglichst wenig Tippen" widerspricht, die besonders für Persona B (60+) entscheidend ist. Komplexität und Tipp-Aufwand sind hier höher zu gewichten als Funktionsumfang.

**Prinzip:** Jede Kategorie hat ein Budgetziel, das automatisch aus dem Vormonat übernommen wird — keine monatliche Zuweisungs-Pflicht. Ändern ist optional, nicht Voraussetzung. Fortschritt wird als einfacher Balken (ausgegeben von Ziel) gezeigt, keine dreiteilige Zugewiesen/Ausgegeben/Verfügbar-Logik.

**Eingabe so tippfrei wie möglich, durchgängiges Prinzip für das ganze Finanzmodul:**
- Beträge per Schieberegler mit Preset-Chips (exakter Betrag / ungefährer Betrag / mehr) statt Zahlenfeld — wie beim Einkauf-zu-Ausgabe-Moment
- Kategorie-Auswahl per Ein-Klick-Chip (häufigste Kategorien direkt antippbar), Dropdown nur als Ausweichoption für seltene Fälle
- Kein Pflichtfeld für Beschreibung — Kategorie + Betrag reichen für einen gültigen Eintrag

**Bewusst nicht Teil des Finanzmoduls:** Monatliche Zuweisungs-Rituale, Sparziele-Gruppen mit eigener Übertragslogik, Geld-Verschieben zwischen Kategorien — alles aus der verworfenen Envelope-Fassung. Falls später eine fortgeschrittene Budgetierung gewünscht wird, gehört sie als **optionaler, versteckter "Erweitert"-Modus** in den Backlog (Abschnitt 12), nie als Standardansicht.

---

### 5.3 Einkommen, feste Abzüge und regelbasierte Analyse (neu, ersetzt die vorherige "Analysen"-Leerstelle)

**Endlich konkret definiert, nachdem zwei vorherige Anläufe als leere Tab-Beschriftung verworfen wurden.**

**Einkommen:** Jedes Haushaltsmitglied kann ein monatliches Einkommen hinterlegen — eine einzelne Zahl, kein exaktes Gehalt mit Belegen nötig. Aus Datenschutz-/Vertrauensgründen zwischen Haushaltsmitgliedern (siehe Architektur.md) ist die individuelle Zahl standardmäßig nur für die Person selbst sichtbar, nicht für andere Haushaltsmitglieder — nur die kombinierte Haushalts-Gesamtsumme fließt in gemeinsame Berechnungen ein.

**Feste, wiederkehrende Abzüge:** Miete, Verträge/Abos werden einmal als "immer wiederkehrend" hinterlegt (Name, Betrag, Kategorie) — nicht jeden Monat neu eingetragen. Sie fließen automatisch in die monatliche Berechnung ein, ohne dass dafür einzelne Transaktionen angelegt werden müssen.

**Puffer:** Ein zusätzlicher, frei wählbarer Betrag für Sparen/Rücklagen, der ebenfalls automatisch abgezogen wird, bevor der "wirklich frei verfügbare" Betrag berechnet wird.

**Ergebnis-Kennzahl "Verfügbares Einkommen":** Haushalts-Gesamteinkommen minus Summe aller aktiven festen Abzüge minus Puffer. Das ist eine eigenständige, andere Kennzahl als das bestehende Kategorien-Budget (welches verfolgt, wie viel von einem gesetzten Ziel bereits ausgegeben wurde) — beide ergänzen sich, ersetzen sich nicht.

**"Analyse" — ausdrücklich KEINE echte KI, keine laufenden API-Kosten:** Konsistent mit dem Era-inspirierten Prinzip aus dem Backlog (Abschnitt 12): Die Bewertung "ist das sinnvoll?" erfolgt über feste, im Code hinterlegte Schwellenwert-Regeln (z. B. "Fixkosten über 50 % des Einkommens gelten als hoch", "Puffer unter 10 % des Einkommens ist gering"), nicht über einen Aufruf an ein Sprachmodell. Das vermeidet genau die Kosten-/Sicherheitsprobleme, die bei der ursprünglich erwogenen, dann verworfenen Prompt-Engineering-Idee identifiziert wurden.

**Tab-Struktur, jetzt final:** Zwei Tabs — **Übersicht** (Kategorien mit antippbarem Budgetziel, Fairness, Transaktionen inkl. Modal, Abo-Radar) und **Analysen** (Einkommen/Abzüge/Puffer verwalten, Verfügbares Einkommen, regelbasierte Hinweise). Kein separater "Budgets"-Tab (Budgetziel bleibt in der Übersicht antippbar) und kein separater "Transaktionen"-Tab (bleibt im Modal).

### 5.4 Reichweite der öffentlichen Demo — explizit festgelegt

**Entscheidung:** Die öffentliche Demo (Route `/`, siehe Architektur.md) beschränkt sich bewusst auf die **Dashboard-Übersicht** mit Beispieldaten. Es gibt **keine** öffentlich zugängliche, bearbeitbare Finanzen-Unterseite. Jede Aktion, die echte, persönliche Finanzdaten erfassen oder ändern würde (Ausgabe erfassen, Budgetziel ändern, Einkommen eintragen), setzt zwingend eine Anmeldung voraus — aus Sicherheits- und Datenschutzgründen, nicht aus technischer Bequemlichkeit. Das ist konsistent mit der bereits in der Architektur festgelegten Regel, dass Aktionen mit echtem serverseitigem Effekt im Demo-Modus zu einem Registrierungs-Hinweis führen, nicht zu einer funktionierenden, aber folgenlosen Simulation.

**Demo-Interaktivität unterscheidet sich bewusst je Modul (Marketing-Entscheidung, nicht Sicherheitsfrage):** Die Persistenz-Regel oben gilt für alle Module gleich (nichts wird ohne Login dauerhaft gespeichert) — aber wie viel innerhalb der Demo tatsächlich anklickbar ist, unterscheidet sich bewusst danach, wo der stärkste Überzeugungsmoment liegt:

- **Finanzen:** Mittlere Interaktivität — Ausgabe erfassen funktioniert (lokal, siehe 5.4 oben), Bearbeiten/Löschen/Einkommen bleiben Login-pflichtig.
- **Haushalt:** **Hohe Interaktivität, bewusst mehr als bei Finanzen.** Der Einkauf-zu-Ausgabe-Moment (Abschnitt 5.1) ist das einzige Feature, das laut Marktanalyse (siehe `Inspiration-starke-Finanz-Apps.md`) bei keiner der fünf analysierten Top-Apps existiert — das ist der stärkste Überzeugungsmoment im gesamten Produkt. Ein Demo-Besucher muss ein Beispiel-Einkaufslisten-Item abhaken können und dabei live sehen, wie sich das Demo-Budget im Dashboard verändert (komplett In-Memory über die Demo-Datenprovider, kein echter Request) — dieser Moment darf nicht hinter dem Login versteckt werden, weil er der eigentliche Konversions-Hebel ist.
- **Organisation:** Niedrige Interaktivität, nur Ansicht. Organisation ist laut Abschnitt 5 bewusst schlank gehalten ("kein Frontalangriff auf Google Kalender") und hat aktuell kein vergleichbares Alleinstellungsmerkmal — eine aufwändige interaktive Demo würde Aufwand in das Modul mit der niedrigsten strategischen Priorität stecken.

## 6. Barrierefreiheit & Usability – Pflicht seit 2025

### 6.1 Rechtliche Pflicht (BFSG)
Seit 28. Juni 2025 gilt das BFSG (EU-Umsetzung des European Accessibility Act), verpflichtet zu WCAG 2.1 AA. Ausnahme nur für Kleinstunternehmen unter bestimmten Bedingungen — schützt nicht vor UWG-Abmahnungen.

**Oft übersehen:**
- Öffentlich zugängliche Barrierefreiheitserklärung erwartet.
- Registrierungs-/Login-Seiten müssen barrierefrei sein.
- Der gesamte Weg bis Vertragsabschluss muss barrierefrei sein, nicht nur die Startseite.

### 6.2 Praktische WCAG-2.1-AA-Umsetzung
Kontrastverhältnis ≥4,5:1, Tastatur-/Screenreader-Bedienbarkeit, skalierbare Schrift, Alternativtexte, keine reine Farbcodierung, klare Fehlermeldungen, `angular-eslint` mit a11y-Regeln, automatisiertes Testing (axe-core/Lighthouse) in CI.

---

## 7. Versteckte Inhalte

### 7.1 Finanzmodul: Banking-Zugriff ist rechtlich hochreguliert
PSD2-Richtlinie: eigene BaFin-Lizenz oder lizenzierter Kontoinformationsdienst (FinAPI, Tink, Salt Edge) — laufende Kosten pro Nutzer/Abfrage.

### 7.2 Finanzdaten bleiben sensibel, auch ohne Art.-9-DSGVO-Pflicht
Ohne Fitness-Modul entfällt die strenge Sonderkategorie, Finanzdaten verdienen trotzdem vergleichbare Sorgfalt (Rückschlüsse auf Lebensstil, Bonität).

### 7.3 Weitere rechtliche Pflichten
- Impressumspflicht & AGB.
- Widerrufsrecht bei Abo-Zahlungen (14 Tage).
- App-Store-Richtlinien: vollständige Konto-/Datenlöschung in-App.
- Kleinunternehmerregelung vs. OSS-Verfahren bei EU-Verkauf.
- Auftragsverarbeitungsverträge mit jedem Drittanbieter.
- **Löschung vs. Aufbewahrungspflicht:** DSGVO-Löschrecht vs. § 257 HGB/§ 147 AO (6–10 Jahre) — Soft-Delete-Konzept in `Architektur.md`, Abschnitt 2.3.

### 7.4 Kostenfaktor, der gern unterschätzt wird
Banking-API, E-Mail-Versand, Push-Notifications, Hosting, App-Store-Gebühren, Rechtsberatung, Penetrationstests — vollständige Liste in `Architektur.md`, Abschnitt 5.

---

## 8. Technische Architektur
Steht vollständig in `Architektur.md`.

---

## 9. Entscheidungen, die nicht mehr offen sind

Diese Liste existiert, damit Grundsatzfragen nicht wiederholt neu aufgerollt werden, sobald ein schwieriger Moment im Projekt auftritt — jeder erneute Wechsel kostet Zeit ohne Produktfortschritt.

| Entscheidung | Festgelegt auf | Wird nicht mehr neu diskutiert, außer bei zwingendem technischen Grund |
|---|---|---|
| Backend-Sprache/Framework | Django + Python | ✅ Endgültig |
| Frontend-Framework | Angular | ✅ Endgültig |
| Mobile-Strategie | Angular + Capacitor (kein Flutter, keine native Neuentwicklung) | ✅ Endgültig |
| Datenbank (lokal) | SQLite, ausschließlich Solo-Entwicklung | ✅ Endgültig |
| Datenbank (Mehrbenutzer) | PostgreSQL, ab dem ersten Mehrbenutzerzugriff verpflichtend | ✅ Endgültig |
| Repo-Struktur | Ein Repo mit `frontend/`/`backend/`-Trennung jetzt, spätere Aufteilung in zwei Repos möglich | ✅ Vorgehen festgelegt |
| **Produktname** | **4inOne** (vormals "Kompass") | ✅ Umbenannt, Version 3 |
| **Modulanzahl/-umfang** | **Vier gleichrangige Kernmodule: Finanzen, Haushalt, Organisation, Reisen** | ✅ Erweitert — Reisen von "später/Querschnittsthema" auf vollwertiges Kernmodul gehoben, bewusste Entscheidung nach expliziter Abwägung |
| Erstes vollständig auszubauendes Modul | Finanzen | ✅ Aktuell in Bearbeitung |
| **Aktueller Baufokus (Stand jetzt)** | **Login/Registrieren komplett mit Django, Token-Auth (JWT), allen Sicherheitsmaßnahmen aus Architektur.md 3.1 — siehe `prompt-login-register-complete.txt`** | 🔧 In Umsetzung |
| Fitness-Modul | Weiterhin nicht Teil des Produkts | ✅ Endgültig gestrichen, nicht "später vielleicht" — diese Entscheidung bleibt von der Reisen-Erweiterung unberührt |
| **Farbschema** | Grün (Finanzen) · Rosa (Haushalt) · Lila (Organisation) · Blau (Reisen), Farben primär zur Orientierung zwischen Modulen | ✅ Neu festgelegt, ersetzt Aurora-Trust-Violett/Amber — siehe design_system.md |

---

## 10. Empfohlene Roadmap (realistisch für ein Nebenprojekt)

1. **Phase 0 – Fundament (4–6 Wochen):** Django + Postgres + Angular Grundgerüst, Auth/MFA, Design-System mit Barrierefreiheits-Basis.
2. **Phase 1 – Ein starkes Modul (6–10 Wochen):** Login/Registrierung vollständig (aktueller Stand), danach Finanzen komplett inkl. der Differenzierungsfeatures aus 5.1.
3. **Phase 2 – Drittes und viertes Modul (10–16 Wochen):** Haushalt, dann Organisation, dann Reisen (inkl. Connection Engine zwischen allen vier Modulen — siehe Architektur.md 2.1b).
4. **Phase 3 – Barrierefreiheits-Audit.**
5. **Phase 4 – Beta mit echten Nutzern.**
6. **Phase 5 – Banking-API-Anbindung** erst, wenn Budget/Nutzerbasis es tragen.

### 10.1 Konkretes, realistisches Jahresziel 2026 (neu)
**Web-Beta mit Login + Finanzen, erreichbar unter einer Test-URL, für 5–10 bekannte Testpersonen — kein App-Store-Launch, kein Zahlungsmodell, keine vollständige BFSG-Zertifizierung.** Das ist der Maßstab für "erfolgreich dieses Jahr", nicht ein vollständiger Produktlaunch. Diese Korrektur ersetzt ein vages "dieses Jahr live gehen" durch ein greifbares, erreichbares Ziel.

*Hinweis zur Realitätsprüfung:* Als Solo-Nebenprojekt eher das 1,5- bis 2-Fache der genannten Zeiträume einplanen.

---

## 11. Kundengewinnung — konkrete, realistische Schritte

Angesichts der ~1.450-$-CAC-Realität aus Abschnitt 2.5 ist bezahlte Werbung als primärer Kanal für dieses Projekt ausgeschlossen. Die Strategie basiert auf drei aufeinanderfolgenden, kostenlosen Phasen:

**Phase 1 – Die ersten 5–10 Nutzer (deckt sich mit dem Jahresziel aus 10.1):**
- Eigener Haushalt/Familie als erste echte Nutzer, nicht nur zum Testen, sondern im echten täglichen Gebrauch.
- 3–5 Personen aus dem persönlichen Umfeld persönlich fragen (deutlich höhere Erfolgsquote als jede Landingpage in dieser Phase).
- Explizit nach Abbruchpunkten fragen, nicht nur nach genereller Zufriedenheit.

**Phase 2 – Sichtbarkeit ohne Werbebudget:**
- Launch-Posts in thematisch passenden Nischen-Communities (Foren/Subreddits zu persönlichen Finanzen, Barrierefreiheit, Mehrgenerationenwohnen) statt Massenplattformen.
- "Build in public" – der eigene Entwicklungsprozess (Architektur-Entscheidungen, Sicherheitsüberlegungen) als Content, gewinnt technisch interessierte Frühnutzer.
- Direkte Ansprache von Multiplikatoren: Verbraucherzentralen, Seniorenbüros, Wohnprojekte für Mehrgenerationenwohnen.

**Phase 3 – Der eingebaute Wachstumsmotor:**
- Haushaltsmitglieder-Einladung als zentraler, sichtbarer Onboarding-Schritt, nicht als versteckte Einstellung — jeder Nutzer bringt strukturell weitere Nutzer mit, das ist bei einer Mehrpersonen-App günstiger als bei Einzelnutzer-Apps.

**Bewusst nicht empfohlen:** Bezahlte Google-/Meta-Ads vor Produktvalidierung — bei den CAC-Werten aus 2.5 wäre das Budget in Tagen aufgebraucht, ohne dass das Produkt an echten Nutzern erprobt wurde.

---

## 12. Mögliche spätere Module (Backlog, ausdrücklich nicht MVP)

**Hinweis zum Umgang mit diesem Abschnitt:** Sobald Finanzen, Haushalt, Organisation und Reisen als Kernmodule fertig und stabil live sind, ist es ausdrücklich vorgesehen, ein bis zwei weitere Ideen aus diesem Backlog (oder neu hinzukommende) auszuwählen und umzusetzen — nicht vorher. Neue Ideen, die währenddessen auftauchen, werden hier dokumentiert, nicht sofort verfolgt, damit der aktuelle Fokus (siehe Abschnitt 9) nicht wiederholt unterbrochen wird. **Reisen ist seit Version 3 kein Backlog-Punkt mehr, sondern eigenes Kernmodul — siehe Abschnitt 1.6.**

- **Pflegekoordination für Angehörige**, **Vereinsverwaltung**, **B2B-Barrierefreiheits-Audit-Tool:** Als alternative Produktideen diskutiert und bewusst nicht verfolgt — 4inOne bleibt der aktuelle Fokus, diese Ideen sind hier nur dokumentiert, damit sie nicht wiederholt neu erwogen werden müssen.
- **"Für KI-Analyse exportieren" statt eigener Prompt-Bibliothek (überarbeitet):** Die ursprünglich erwogene Idee einer eingebauten KI-Prompt-Vorlagen-Bibliothek (kuratierte + selbst gespeicherte Prompts) wurde nach einer Marktbeobachtung überarbeitet und ersetzt. Grund: Eine echte KI-Anbindung würde eine neue, laufende technische Abhängigkeit schaffen (API-Kosten pro Anfrage, zusätzliche Latenz, neue Sicherheitsfläche durch Prompt-Injection), die in keiner bisherigen Kosten-/Architekturplanung vorgesehen ist. Die Finanz-App "Era" (Marktbeobachtung 2026) verfolgt einen leichteren Ansatz: keine eingebaute KI, stattdessen werden die eigenen Finanzdaten für die freie KI-Wahl des Nutzers freigegeben ("deine KI kommt zu dir, nicht umgekehrt"). Übertragen auf Kompass: ein einfacher **"Für KI-Analyse exportieren"-Button** in Finanzen/Haushalt, der die eigenen Daten des Nutzers (Kategorien, Ausgabenverlauf, offene Haushaltsaufgaben) plus einen mitgelieferten, gut formulierten Beispiel-Prompt bereitstellt — der Nutzer fügt beides selbst in sein bevorzugtes KI-Werkzeug (Claude, ChatGPT o. ä.) ein. Keine laufenden API-Kosten für Kompass, kein neues Sicherheitsrisiko durch automatisierte KI-Aufrufe, aber der ursprünglich gewünschte Nutzen ("bessere, professionellere Prompts") bleibt erhalten. **Sicherheitshinweis unverändert relevant:** Der Export selbst enthält Finanzdaten und muss über `HouseholdScopedPermission` sowie das bestehende Export-Rate-Limit (Architektur.md, Abschnitt 3.9) abgesichert werden wie jeder andere Datenexport.
- **n8n-Automatisierungs-Anbindung — ausgewählt als zweite Erweiterung nach den Kernmodulen (Entscheidung getroffen):** Idee, Kompass' API von außen mit n8n (Workflow-Automatisierungswerkzeug) zu verbinden, um eigene Automatisierungen zu bauen (z. B. automatischer Export bestimmter Finanzdaten, Benachrichtigungen bei Budgetüberschreitung an andere Dienste). Folgt demselben Grundprinzip wie der KI-Export-Ansatz oben: Kompass baut keine eigene Automatisierungs-Engine ein, sondern öffnet sich für externe Werkzeuge nach freier Wahl des Nutzers. **Technischer Haken, bereits identifiziert:** Das bestehende Auth-System (kurzlebiger Access-Token + `httpOnly`-Refresh-Cookie) ist für Browser-Sitzungen gebaut, nicht für dauerhaft laufende externe Dienste ohne Browser. Eine Umsetzung bräuchte ein separates **Personal-Access-Token-System** (langlebiger, gezielt einschränkbarer und jederzeit widerrufbarer API-Schlüssel, unabhängig vom normalen Passwort-Login) — ein eigenständiges Sicherheitsthema, das denselben sorgfältigen Prozess (erst Scope definieren, dann Sicherheitsmodell, dann Umsetzung) verdient wie jedes andere Modul. **Zusätzlich bestätigt (Konkurrenzbeobachtung 2026):** TimeTree — mit über 60 Mio. Nutzern einer der größten Wettbewerber in der Familien-Organizer-Kategorie — wurde in unabhängigen Vergleichen explizit der "Organizer"-Kategorie zugeordnet (manuelle Eingabe, kein proaktives Mitdenken), eine öffentlich nutzbare Automatisierungs-Schnittstelle für Werkzeuge wie n8n ist in keiner der recherchierten Quellen für TimeTree oder vergleichbare Apps dokumentiert — spricht dafür, dass eine offene API-Anbindung eine echte, von der etablierten Konkurrenz nicht abgedeckte Lücke wäre, nicht nur "auch noch nicht gemacht". Bewusst zurückgestellt, bis Kernmodule (Finanzen, Haushalt, Organisation) fertig und getestet sind — zusammen mit Reisen (siehe oben) die beiden gewählten Erweiterungen für danach.

### Konkurrenzbeobachtung: FamilyWall — Erkenntnisse aus echten Nutzerbewertungen (Google Play, September 2026)

Direkter Konkurrent (siehe Abschnitt 2.3 Wettbewerbslandschaft), bereits am Markt mit über 22.000 Bewertungen. Drei konkrete, aus echten Nutzerbewertungen belegte Erkenntnisse — nicht aus Marketing-Texten, sondern aus tatsächlichen Beschwerden:

- **Kalender-Sync-Zuverlässigkeit als wiederkehrendes Problem:** Eine Nutzerin berichtet, dass bei der Google-Kalender-Synchronisation 1–2 Mal jährlich Termine um einen Tag verschoben oder in der Dauer verändert dargestellt werden — die einzige Lösung war, jeden einzelnen Termin manuell neu zu öffnen und zu speichern. **Konsequenz für Kompass:** Sobald das Organisation-Modul mit externem Kalender-Sync gebaut wird, muss Synchronisations-Zuverlässigkeit explizit getestet werden (wiederholte Sync-Zyklen, Zeitzonen-Wechsel), nicht nur der Erstabgleich — das ist kein Rand-, sondern ein Kernanforderungspunkt.
- **Aggressives Abo-Modell als expliziter Abwanderungsgrund:** Ein Nutzer bewertet die App trotz grundsätzlicher Zufriedenheit mit nur 2 Sternen, weil es keine Einmalzahlungs-Option gibt und wiederholt aggressive "Rabatt"-Angebote fürs Jahresabo erscheinen — er sucht aktiv nach einer weniger aggressiven Alternative. **Bestätigt eine bereits getroffene Entscheidung:** Kompass' kostenloses Kernmodell (keine Paywall für Budget-Funktionen, siehe Abschnitt 5.3) ist damit kein nur behaupteter, sondern ein durch echte Konkurrenz-Frustration bestätigter Vorteil.
- **Einkaufslisten-Lücke, konkret und umsetzbar:** Ein Nutzer lobt, dass gespeicherte Einkaufslisten-Einträge nach mehrfacher Nutzung nur noch angeklickt werden müssen — bemängelt aber, dass beim tatsächlichen Einkaufen die GESAMTE Liste durchgescrollt werden muss, statt nur die aktuell benötigten (nicht bereits abgehakten) Punkte zu sehen. **Konkrete, bereits validierte Funktionsidee fürs künftige Haushalt-Modul:** eine "Nur offene Punkte"-Ansicht beim aktiven Einkaufen, die erledigte/nicht benötigte Einträge ausblendet, statt die volle Liste zu scrollen — ein kleiner, aber laut echtem Nutzerfeedback spürbarer Unterschied.

---

## 13. Kurz zusammengefasst – die wichtigsten "Aha-Punkte"

- Europa (v. a. DE) ist super-app-skeptisch – Positionierung als "Reibungslos statt Alles".
- BFSG/WCAG 2.1 AA ist seit Juni 2025 Pflicht, inkl. Registrierungsseite.
- Banking-Datenanbindung ist reguliert (PSD2) – "keine Bankverbindung nötig" aktiv als Vertrauensvorteil kommunizieren, nicht nur als spätere Lücke behandeln.
- Ältere Nutzer sind im bestehenden Markt strukturell unterversorgt (70 %+ Gen Z/Millennial-Dominanz) – echte, datengestützte Nischen-Chance.
- Kundenakquisekosten im Fintech-Bereich (~1.450 $) schließen bezahlte Werbung als primären Kanal aus – organisches Wachstum über Haushaltseinladungen ist der realistische Weg.
- Technische Details stehen in `Architektur.md` – Security ist dort kein nachgelagertes Feature.
- Grundsatzentscheidungen (Abschnitt 9) sind bewusst schriftlich festgehalten, um wiederholte Neubewertung zu vermeiden.
- Realistisches Jahresziel: Web-Beta mit Login+Finanzen für 5–10 Testpersonen, kein vollständiger App-Store-Launch.

---

*Quellen (Auswahl, Stand August 2026): digital-magazin.de, sam-solutions.de, heuking.de, ihk.de, aktion-mensch.de, sevdesk.de (BFSG 2025), hauszettl.de/t3n.de/handelsblatt.de (Wettbewerbsübersicht), marketresearchfuture.com, verifiedmarketreports.com, coinlaw.io, apptweak.com, firstpagesage.com (Marktgrößen/CAC 2026).*