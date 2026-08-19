# 4One Hub — Gesamtkonzept

> Vollständiges Produkt-, UX/UI-, Marketing- und Technik-Gesamtkonzept
> Stand: August 2026 · Konzeptversion 2.0
> Fitness · Finanzen · Organisation · Haushalt

**Leitidee:** 4One Hub ist eine digitale Lebenszentrale mit vier klar getrennten Welten. Das Dashboard ist die Klammer — Fitness, Finanzen, Organisation und Haushalt bleiben eigenständige Features.

---

## Inhalt

1. Executive Summary und Produktprinzipien
2. Produktidee und Positionierung (Ziel: 9,5/10)
3. Zielgruppen und Nutzungsprinzipien
4. Marke, Claim und Kommunikation
5. Gesamtarchitektur und Informationsarchitektur
6. Dashboard — Analyse und Zielzustand
7. Fitness — vollständiges Premium-Modul
8. Anmeldung, Registrierung und Onboarding
9. Finanzen — Modulkonzept
10. Organisation — Modulkonzept
11. Haushalt — Modulkonzept
12. Gemeinsame App-Ebene
13. Abo- und Geschäftsmodell
14. Marketing-Landingpage und Conversion
15. Design System, Responsive und Accessibility
16. Angular-Frontend-Architektur
17. Daten, Sicherheit und Datenschutz
18. Roadmap und Prioritäten
19. KPIs und Produktmessung
20. Launch-Checkliste und finale Vision

---

## 1. Executive Summary und Produktprinzipien

4One Hub bündelt vier zentrale Lebensbereiche in einer einzigen Anwendung. Die vier Module teilen Design, Navigation, Benutzerkonto und App-Infrastruktur, bleiben fachlich jedoch unabhängig. Dadurch entsteht keine überladene Super-App, sondern ein persönlicher Hub mit vier klaren Einstiegen.

**Kernversprechen:** Weniger App-Wechsel. Mehr Überblick. Vier Lebensbereiche in einer vertrauten Oberfläche.

**Produktprinzipien**

- **Klarheit vor Funktionsmenge:** Der Nutzer versteht jederzeit, wo er ist und was als Nächstes möglich ist.
- **Vier Welten, ein Designsystem:** Jede Section besitzt eigene Farbe und Fachlogik, aber dieselbe Bedienphilosophie.
- **Premium durch Details:** Qualität entsteht durch Typografie, Abstände, Zustände, Animation und konsistente Komponenten — nicht durch visuelle Überladung.
- **Free muss nützlich sein:** Premium erweitert Komfort, Personalisierung und Tiefe, statt Kernfunktionen künstlich zu blockieren.
- **Accessibility ist Grundfunktion:** Die Oberfläche muss für jüngere und ältere Nutzer gleichermaßen verständlich sein.
- **Keine erfundenen Vertrauenssignale:** Keine Fake-Nutzerzahlen, Fake-Reviews, Fake-Partner oder erfundene Zertifikate.

## 2. Produktidee und Positionierung — Ziel: 9,5/10

Die Produktidee ist bereits stark, weil die vier Bereiche sofort verständlich sind. Der nächste Qualitätssprung entsteht nicht durch mehr Features, sondern durch eine präzisere Value Proposition: Ein neuer Besucher muss innerhalb von drei bis fünf Sekunden verstehen, was 4One Hub ist und warum eine zentrale Oberfläche angenehmer ist als vier getrennte Apps.

| Frage des Nutzers | Antwort von 4One Hub |
|---|---|
| Was ist das? | Eine zentrale Anwendung für Fitness, Finanzen, Organisation und Haushalt. |
| Warum brauche ich das? | Weil wichtige Alltagsinformationen nicht auf viele unterschiedliche Apps verteilt sein müssen. |
| Sind die Bereiche vermischt? | Nein. Jedes Modul bleibt eigenständig und klar fokussiert. |
| Was ist der Vorteil? | Ein Konto, eine Navigation, ein Designsystem, vier Lebensbereiche. |
| Was soll ich jetzt tun? | Kostenlos starten oder als bestehender Nutzer anmelden. |

**Empfohlene Positionierung**

- **Primärer Claim:** *4One Hub — Dein Alltag. Ein Ort.*
- **Empfohlene Subheadline:** „Fitness, Finanzen, Organisation und Haushalt — übersichtlich in einer einzigen Anwendung.“

| Ebene | Empfehlung |
|---|---|
| Alternativclaim | Vier Lebensbereiche. Ein persönlicher Hub. |
| Primärer CTA | Kostenlos starten |
| Sekundärer CTA | Anmelden |
| Ton | Klar, freundlich, ruhig, modern, vertrauenswürdig |
| Logo-Verwendung | Bestehendes „4“-Icon und Wortmarke konsequent wiederverwenden |

**Drei zentrale Nutzenargumente**

| Nutzen | Marketingaussage | Produktbedeutung |
|---|---|---|
| Alles an einem Ort | Weniger App-Wechsel. | Vier zentrale Bereiche über einen gemeinsamen Hub erreichbar. |
| Trotzdem klar getrennt | Vier Welten statt einer überladenen Super-App. | Keine fachliche Vermischung der Module. |
| Eine vertraute Bedienung | Ein Design, eine Navigation, ein Konto. | Geringere Lernkurve und konsistente UX. |

**Was 4One Hub nicht versprechen sollte**

- Nicht behaupten, jedes einzelne Spezialprodukt im Markt fachlich zu übertreffen.
- Keine austauschbaren Claims wie „Revolutioniere dein Leben“ oder „Die ultimative Super-App“.
- Keine AI als Selbstzweck in die Kernpositionierung schreiben. AI ist später ein Feature, nicht die Produktidentität.
- Nicht alle vier Module sofort im Onboarding konfigurieren lassen. Der Einstieg muss leicht bleiben.

**Mini-Brand-Story:** Unser Alltag verteilt sich auf immer mehr Apps: eine für Fitness, eine für Finanzen, eine für Termine und eine für den Haushalt. 4One Hub bringt diese wichtigen Bereiche an einen Ort — ohne sie miteinander zu vermischen. Vier Welten. Eine vertraute Oberfläche.

## 3. Zielgruppen und Nutzungsprinzipien

Die Zielgruppe umfasst jüngere, digital affine Nutzer ebenso wie ältere Nutzer, die eine verständliche und übersichtliche Oberfläche bevorzugen. Statt zwei getrennte Apps zu bauen, sollte 4One Hub progressive Komplexität nutzen: Die Basisansicht bleibt einfach, Details erscheinen auf Wunsch.

| Aspekt | Easy / zugänglich | Standard | Advanced |
|---|---|---|---|
| Informationsdichte | Wenige Kernwerte | Ausgewogene Übersicht | Detailansichten und Analysen |
| Schrift / Touch | Größer und klar | Standard | Kompakt, aber lesbar |
| Animation | Reduziert | Subtil | Subtil + mehr Interaktion |
| Sprache | Sehr verständlich | Alltagssprache | Fachbegriffe optional |
| Navigation | Große Ziele und Cards | Icons + Text | Shortcuts zusätzlich |

**Wichtige Accessibility-Regeln**

- Mindestens ca. 44 px große Touch-Ziele auf Mobile.
- Sichtbare Keyboard-Fokuszustände.
- Hoher Kontrast; Information niemals nur durch Farbe vermitteln.
- `prefers-reduced-motion` respektieren.
- Formulare mit echten Labels, verständlichen Fehlermeldungen und korrekten `autocomplete`-Attributen.
- Optional: größere Schrift, reduzierte Animationen und vereinfachte Ansichten in den Einstellungen.

## 4. Marke, Claim und Kommunikation

„4One Hub“ ist kurz, digital und transportiert indirekt die Bündelung von vier Bereichen. Die Marke sollte neutral über allen Modulen stehen. Das grüne Fitness-Design darf nicht den Eindruck erzeugen, die gesamte Anwendung sei primär eine Fitness-App.

## 5. Gesamtarchitektur und Informationsarchitektur

**Produkt- und Frontend-Architektur:** gemeinsame App-Schicht, vier eigenständige Features.

```
4ONE HUB — App Shell
├── Dashboard (4 Modul-Teaser)
└── Auth (Login / Register)
    ├── Fitness       — eigenständiges Feature
    ├── Finanzen      — eigenständiges Feature
    ├── Organisation  — eigenständiges Feature
    └── Haushalt      — eigenständiges Feature

Gemeinsame Ebene: Profil · Einstellungen · Benachrichtigungen · Design System · Accessibility · Core Services
```

**Informationsarchitektur**

| Ebene | Inhalte |
|---|---|
| Public | Landingpage, Funktionen, Preise, Datenschutz, Login/Register |
| App Shell | Dashboard, Header, Navigation, Profil, Einstellungen, Benachrichtigungen |
| Fitness | Home, Training, Workouts, Fortschritt, Gesundheit, Recovery, Ziele, Challenges, Profil |
| Finanzen | Übersicht, Konten, Einnahmen, Ausgaben, Budgets, Sparziele, Abos, Statistiken |
| Organisation | Kalender, Aufgaben, Erinnerungen, Notizen, Tages-/Wochenplanung |
| Haushalt | Übersicht, Aufgaben, Einkaufsliste, Reinigung, Vorräte, Haushaltsplanung |

**Empfohlene Routen**

| Bereich | Routen |
|---|---|
| Public | `/` `/features` `/pricing` |
| Auth | `/login` `/register` `/forgot-password` |
| App | `/dashboard` |
| Fitness | `/fitness` `/fitness/training` `/fitness/workouts` `/fitness/progress` `/fitness/health` `/fitness/recovery` `/fitness/goals` `/fitness/challenges` |
| Finanzen | `/finance` `/finance/transactions` `/finance/budgets` `/finance/accounts` `/finance/subscriptions` `/finance/statistics` |
| Organisation | `/organization` `/organization/calendar` `/organization/tasks` `/organization/notes` |
| Haushalt | `/household` `/household/tasks` `/household/shopping` `/household/cleaning` `/household/inventory` |

## 6. Dashboard — Analyse und Zielzustand

**Was bereits stark ist:** Das 2×2-Raster ist sofort verständlich und bietet große Klickflächen. Der dunkle Hintergrund schafft Ruhe, die vier Modulfarben geben Orientierung, und die niedrige Informationsdichte funktioniert gut für jüngere wie ältere Nutzer. Die zentral begrenzte Content-Breite wirkt deutlich hochwertiger als ein vollflächiges Admin-Dashboard. Subtile Hover-Elevation, animierte Progress-Werte, Skeleton Loading und klare Empty States geben dem Dashboard später den Premium-Feinschliff.

**Ziel: Karten als Mini-Dashboards**

| Card | Empfohlene Dashboard-Informationen |
|---|---|
| Fitness | Wochenziel %, 3/4 Trainings, heutige Aktivität oder nächstes Training |
| Finanzen | Ausgaben dieses Monats, Budgetfortschritt, verbleibendes Budget |
| Organisation | Anzahl Termine, nächster Termin, offene Aufgaben |
| Haushalt | Offene Aufgaben, erledigt/heute, Einkaufsliste oder nächste Aufgabe |

## 7. Fitness — vollständiges Premium-Modul

Fitness wird als vollwertiges eigenständiges Produkt innerhalb von 4One Hub gestaltet. Es enthält keine Finanz-, Organisations- oder Haushaltslogik. Die grüne Modulfarbe aus dem Haupt-Dashboard wird als Accent Color übernommen.

**Fitness-Navigation**

| Navigation | Zweck |
|---|---|
| Übersicht | Tagesstatus, Wochenziel, Aktivität, nächstes Training, Recovery |
| Training | Aktive Trainingspläne und Training starten |
| Workouts | Workout-Bibliothek und Filter |
| Fortschritt | Entwicklung, Volumen, persönliche Rekorde |
| Gesundheit | Schritte, Herzfrequenz, Schlaf und später Wearables |
| Recovery | Erholung, Mobility, Stretching, Schlafstatus |
| Ziele | Persönliche Fitness- und Bewegungsziele |
| Challenges | Challenges, XP, Level und Achievements |

**Fitness-Overview: Kernkarten**

| Card | Inhalt |
|---|---|
| Wochenziel | 78 %, 3 von 4 Trainings, animierter Progress Ring, Ziel bearbeiten |
| Aktivität heute | Schritte, Schrittziel, Distanz, kcal, aktive Minuten |
| Aktuelle Serie | 6 Tage, Wochenpunkte, dezente Trendline |
| Nächstes Training | Workout, Uhrzeit, Dauer, Kategorie, Start und Details |
| Tagesziele | Schritte, aktive Minuten, Trainings, Wasser inkl. Progress Bars |
| Körperbatterie | Subjektiver Energie-/Recovery-Wert und Verlauf |
| Herzfrequenz | Ruhepuls und Linienchart — zunächst Mock-Daten |
| Recovery | Recovery %, Schlafdauer und Schlafqualität |

**Killer-Funktion: „Was passt heute zu mir?“**

Der Nutzer wählt verfügbare Zeit, Energielevel, Ziel, Trainingsort und Equipment. Daraus erstellt die App einen passenden Trainingsvorschlag. Diese Funktion sollte zunächst regelbasiert funktionieren; AI kann später als Premium-Erweiterung hinzukommen.

| Eingabe | Beispiele |
|---|---|
| Zeit | 10 / 20 / 30 / 45 / 60+ Minuten |
| Energie | Müde / normal / energiegeladen / gestresst |
| Ziel | Kraft / Cardio / Mobility / allgemeine Fitness |
| Ort | Zuhause / Gym / draußen |
| Equipment | Keins / Kurzhanteln / Geräte / frei definierbar |

**Fitness Journey und Gamification**

- XP und Level: sichtbar, aber nicht dominierend.
- Achievements für konsistente Fortschritte, nicht für extreme Leistung.
- Persönliche Rekorde und Wochenmissionen.
- Optional positive Streaks; kein aggressives „Streak verloren“-Design.
- Mögliche Journey: Beginner → Active → Strong → Athlete → Legend.
- Challenges können später privat, mit Freunden oder in Gruppen stattfinden.

**Fitness MVP und Ausbau**

- Fitness Home, Workout-Bibliothek und Trainingsdetail.
- Training starten / pausieren / abschließen sowie Ziele und Fortschritt.
- Manuelle Aktivitätseinträge und Recovery-Basis.
- Responsive Sidebar / Mobile Navigation.
- Zentrale Mock-Daten über Service/Store statt Hardcoding in Templates.
- Ausbau später: Wearables, echte Health-Daten nach Zustimmung, AI Coach, Community-Challenges und Advanced Analytics.

## 8. Anmeldung, Registrierung und Onboarding

**Wichtige UI-Regel:** Das Referenzbild zeigt Login und Registrierung nur zu Präsentationszwecken nebeneinander. In der echten App öffnet „Anmelden“ ausschließlich `/login`. „Noch kein Konto? Registrieren“ führt zu `/register`; dort kann „Bereits ein Konto? Anmelden“ zurück zu `/login` führen.

**Empfohlener Einstieg und Nutzerfluss**

```
Landingpage (Produkt verstehen)
        ↓
Registrieren /login oder /register
        ↓
Onboarding (1 Bereich wählen)
        ↓
Dashboard (4 Lebensbereiche)
        ↓
Feature öffnen (z. B. Fitness)

LOGIN  ──„Noch kein Konto? → Registrieren“──▶  REGISTER
LOGIN  ◀─„Bereits Konto? → Anmelden“──────────  REGISTER
```

Produktiv gilt: immer nur eine Auth-Ansicht gleichzeitig — das Split-Screen-Bild ist nur Designreferenz.

**Login**

- Headline: „Willkommen zurück“; Subline: „Melde dich an und verwalte dein Leben an einem Ort.“
- E-Mail-Adresse und Passwort mit Sichtbarkeits-Toggle.
- „Angemeldet bleiben“ und „Passwort vergessen?“.
- Großer Primary Button „Anmelden“.
- Optional Google/Apple UI vorbereiten, aber keine neue Auth-Library ohne Bedarf installieren.
- Unter dem Formular: „Noch kein Konto? Registrieren“.

**Registrierung** — kurzer 3-Schritt-Prozess, damit die Seite professionell wirkt und der Nutzer nicht mit einem langen Formular überfordert wird.

| Schritt | Inhalt |
|---|---|
| 1. Persönliche Daten | Vorname, Nachname, E-Mail-Adresse |
| 2. Kontodetails | Passwort, Passwort bestätigen, Password Strength, Datenschutz/AGB, optionaler Newsletter |
| 3. Fertig | Success State mit „Willkommen bei 4One Hub“ und CTA „4One Hub starten“ |

**Formular- und Security-Regeln**

- Angular Reactive Forms und typed Forms verwenden.
- Fehler erst bei `touched` oder Submit anzeigen.
- Newsletter niemals vorauswählen.
- Keine Passwörter oder Credentials loggen oder in `localStorage` speichern.
- Loading State verhindert Mehrfach-Submit.
- Globale Formfehler als hochwertige Alert Card, keine Browser Alerts.
- Korrekte `autocomplete`-Werte und `aria-label`s verwenden.
- Spätere echte Auth über saubere `AuthService`-Abstraktion; keine Fake-Security als Produktionslösung ausgeben.

**Onboarding nach Registrierung:** Nach dem Success State sollte der Nutzer nicht alle vier Bereiche konfigurieren müssen. Stattdessen erscheint eine einfache Auswahl: „Was möchtest du zuerst einrichten?“ mit Fitness, Finanzen, Organisation, Haushalt und „Später einrichten“.

## 9. Finanzen — Modulkonzept

Finanzen bleibt eine eigenständige Section mit Fokus auf Übersicht, Alltagstauglichkeit und verständliche Zahlen. Der Bereich sollte seriöser und ruhiger wirken als Fitness.

| Unterbereich | MVP-Funktionen |
|---|---|
| Übersicht | Monatsausgaben, Budget, Sparziele, letzte Transaktionen |
| Konten | Manuelle Konten / später Banking-Integration |
| Einnahmen & Ausgaben | Transaktionen, Kategorien, Suche, Filter |
| Budgets | Monatsbudgets und Kategorien |
| Sparziele | Zielbetrag, Fortschritt, Termin optional |
| Abos | Wiederkehrende Zahlungen, Kosten pro Monat/Jahr, Kündigungsnotiz |
| Statistiken | Monatsvergleich und Kategoriencharts |

**Abo-Tracker innerhalb Finanzen**

- Name, Preis, Abrechnungsintervall und nächste Zahlung.
- Monatliche und jährliche Gesamtkosten.
- Kategorien und optionale Erinnerungen.
- Keine automatische Kündigung versprechen, solange keine entsprechende Integration existiert.
- Später Import aus Bankdaten möglich, aber nur mit geeigneter Infrastruktur und Einwilligung.

## 10. Organisation — Modulkonzept

| Unterbereich | Funktionen |
|---|---|
| Kalender | Tages-, Wochen- und Monatsansicht |
| Aufgaben | Priorität, Fälligkeit, Status, wiederkehrende Aufgaben |
| Erinnerungen | Termin- und Aufgabenreminder |
| Notizen | Schnelle Notizen, Kategorien, Suche |
| Planung | Tages-/Wochenplanung und Fokusansicht |

Organisation darf als eigenständiger Planer funktionieren. Auf dem Haupt-Dashboard wird lediglich der nächste Termin bzw. die Anzahl offener Aufgaben angeteasert.

## 11. Haushalt — Modulkonzept

| Unterbereich | Funktionen |
|---|---|
| Übersicht | Offene Aufgaben, heutige To-dos, Einkauf |
| Aufgaben | Einmalig / wiederkehrend, Status, Fälligkeit |
| Einkaufsliste | Artikel, Mengen, Kategorien, erledigt |
| Reinigung | Routinen und wiederkehrende Aufgaben |
| Vorräte | Bestände und „bald leer“-Status |
| Haushaltsplanung | Optional später Mitglieder und Aufgabenverteilung |

## 12. Gemeinsame App-Ebene

Nur Funktionen, die wirklich für alle Bereiche gelten, werden zentral aufgebaut. Fachlogik bleibt in den jeweiligen Features.

- Benutzerkonto und Profil.
- Authentifizierung und Route Guards.
- Einstellungen, Theme, Sprache und Accessibility.
- Benachrichtigungen und Notification Center.
- Globale Navigation und App Shell.
- Gemeinsame UI-Komponenten und Design Tokens.
- Optional globale Suche — erst wenn genügend Inhalte vorhanden sind.
- Cloud-Synchronisation / Backup als App-Infrastruktur, nicht als Modulfeature.

## 13. Abo- und Geschäftsmodell

> **Preisstatus:** Die folgenden Preise sind Produktvorschläge und noch keine finalen Marktpreise. Sie sollten später mit Zielgruppen-Tests und Kostenstruktur validiert werden.

**Empfohlene Pläne**

| Plan | Preisidee | Zielgruppe | Kernnutzen |
|---|---|---|---|
| FREE | 0 € | Einstieg / gelegentliche Nutzung | Alle vier Bereiche sinnvoll testen und grundlegend nutzen |
| PLUS | 4,99 €/Monat oder 49,99 €/Jahr | Regelmäßige Nutzer | Mehr Personalisierung, Statistiken, Komfort und Exporte |
| PRO | 9,99 €/Monat oder 99,99 €/Jahr | Power User | AI-Funktionen, Advanced Analytics und Premium-Integrationen |
| FAMILY | 14,99 €/Monat oder 149,99 €/Jahr | Familien / gemeinsame Haushalte | Mehrere Profile und gemeinsame Haushalts-/Organisationsfunktionen |

**Feature-Matrix**

| Feature | Free | Plus | Pro | Family |
|---|---|---|---|---|
| Dashboard + 4 Module | Ja | Ja | Ja | Ja |
| Kernfunktionen | Ja | Ja | Ja | Ja |
| Erweiterte Statistiken | Basis | Ja | Ja | Ja |
| Themes / Personalisierung | Basis | Ja | Ja | Ja |
| Export / Reports | Begrenzt | Ja | Ja | Ja |
| Fitness Journey | Basis | Ja | Ja | Ja |
| AI Coach / Planung | Nein | Basis | Voll | Voll |
| Advanced Analytics | Nein | Teilweise | Ja | Ja |
| Wearables | Basis | Ja | Ja | Ja |
| Mehrere Profile / Shared | Nein | Nein | Nein | Ja |

**Abo-Prinzipien:** Free bleibt dauerhaft brauchbar. Premium verkauft Komfort, Tiefe, Personalisierung, AI und Integrationen. Das Jahresabo kann etwa 15–20 % effektiven Vorteil bieten. Kündigung und Preisdarstellung bleiben transparent, Werbung ist nicht das Standardmodell, und Family startet erst mit sauberem Mehrprofil- und Rechtekonzept.

## 14. Marketing-Landingpage und Conversion

Das Dashboard ist die App-Startseite für eingeloggte Nutzer, aber nicht die ideale Marketing-Landingpage für neue Besucher. Vor der Registrierung sollte eine öffentliche Seite die Produktidee in wenigen Sekunden erklären.

**Empfohlene Landingpage-Struktur**

1. Hero mit Claim „Dein Alltag. Ein Ort.“, Subheadline, „Kostenlos starten“ und „Anmelden“.
2. Produktvorschau mit dem echten 4One-Hub-Dashboard.
3. Vier Module mit jeweils einer klaren Nutzenbotschaft.
4. „Warum 4One Hub?“ mit drei Benefits: weniger App-Wechsel, mehr Überblick, eine vertraute Oberfläche.
5. Kurzer Bereich für junge und ältere Nutzer / Accessibility.
6. Preise erst nach Nutzen und Produktverständnis.
7. Trust-Bereich: Datenschutz, Datenkontrolle, Export/Löschung — nur reale Aussagen.
8. Finaler CTA „Kostenlos starten“.

**Copy-Vorschlag für Hero**

> **4One Hub**
> Dein Alltag. Ein Ort.
> Fitness, Finanzen, Organisation und Haushalt in einer modernen Anwendung — klar getrennt und trotzdem immer griffbereit.
> CTA: Kostenlos starten | Sekundär: Anmelden

**Vier Module — Nutzen statt Funktionsliste**

| Modul | Headline | Kurztext |
|---|---|---|
| Fitness | Bleib in Bewegung. | Training, Fortschritt, Ziele und Gesundheit übersichtlich verfolgen. |
| Finanzen | Behalte dein Geld im Blick. | Ausgaben, Budgets, Abos und finanzielle Ziele verständlich organisieren. |
| Organisation | Plane deinen Alltag. | Termine, Aufgaben und Erinnerungen an einem zentralen Ort. |
| Haushalt | Bring Struktur nach Hause. | Einkäufe, Aufgaben und Haushaltsorganisation einfach verwalten. |

**Conversion-Regeln:** Für neue Besucher ist „Kostenlos starten“ der primäre CTA, während „Anmelden“ bestehende Nutzer adressiert. Preise erscheinen erst nach Nutzen und Produktverständnis. Es werden keine erfundenen Nutzerzahlen eingesetzt; echte Dashboard-Screenshots sind stärker als generische Stock-Illustrationen. Pro Abschnitt sollte es einen klaren Haupt-CTA geben.

## 15. Design System, Responsive und Accessibility

**Modulfarben**

> Übernommen 1:1 aus `DESIGN_SYSTEM_V2.md` (§3, §19–22), der verbindlichen Design-Quelle seit V2 — abweichend sowohl von den Farbrollen der ursprünglichen PDF-Vorlage (Fitness Grün, Finanzen Blau, Organisation Orange, Haushalt Pink/Rot) als auch vom früheren Coral/Aubergine-System (V1).

| Modul | Farbrolle | Wert (Dark, Standard) | Designwirkung |
|---|---|---|---|
| Global Signal | Grün | `#3fe280` | Einzige globale Akzentfarbe — Primary Buttons, Fokus-Ring, aktiver Zustand |
| Fitness | Grün (= Global Signal) | `#3fe280` | Energie, Aktivität, Fortschritt |
| Finanzen | Blau | `#3b82f6` | Vertrauen, Klarheit, Ruhe |
| Organisation | Amber | `#f59e0b` | Fokus, Zeit, Aktivität |
| Haushalt | Pink | `#ec4899` | Wärme, Zuhause, Aufmerksamkeit |

V2 ist eine **achromatische Carbon-Basis** (Canvas `#0a0a0a`, Cards `#171717`, Border `#222222`, Text `#ffffff`/`#9b9b9b`) statt der früheren warmen Aubergine-Fläche. Domain-Farben bleiben **Signale, keine Flächenfarben** (Icon, Accent-Line, Progress-Fill, Link/CTA des jeweiligen Bereichs) — keine komplett farbigen Modul-Cards. Dass Fitness und die globale Signalfarbe identisch sind, ist bewusst so definiert; in Ansichten, in denen beide gleichzeitig auftreten (z. B. ein globaler CTA neben einem Fitness-Tag), ist entsprechend besondere Sorgfalt nötig, um Verwechslung zu vermeiden.

**Gemeinsame UI-Bausteine**

- Cards mit weichen Radien, subtilen Borders und klaren Hover-Zuständen.
- Metric Cards, Progress Rings, Progress Bars, Timeline, Quick Actions.
- Buttons mit konsistenter Höhe, Radius, Focus und Loading State.
- Inputs, Dropdowns, Dialoge, Toasts und Empty States.
- Skeleton Loading, Error States und Success States.
- Dark Mode als Leitdesign; Light Mode optional später.

**Responsive**

| Breakpoint | Layoutprinzip |
|---|---|
| Desktop ≥ 1200 px | Sidebar + Multi-Column Grid; Dashboard 2×2 |
| Tablet 768–1199 px | Kompakteres Grid; Sidebar reduziert oder collapsible |
| Mobile < 768 px | Einspaltige Cards; Bottom Navigation; 16–24 px Seitenabstand |

**Motion:** Animationen sollen Feedback geben und das Produkt lebendig wirken lassen, ohne zum Selbstzweck zu werden. Empfehlenswert sind etwa 150–300 ms, ease-out, leichte Elevation, kurze Fade-/Translate-Transitions und animierte Fortschrittswerte. Reduced Motion muss respektiert werden.

## 16. Angular-Frontend-Architektur

Die Architektur sollte feature-basiert sein. Vor jeder Umsetzung muss Claude Code bzw. der Entwickler die bestehende Struktur analysieren und sich daran anpassen, statt blind neue Ordner oder Libraries einzuführen.

| Ordner | Verantwortung |
|---|---|
| `core/` | Auth, Guards, Interceptors, globale Services, Models |
| `shared/` | Wirklich allgemeine UI-Komponenten, Directives, Pipes, Utils |
| `layout/` | App Shell, Header, Sidebar, Mobile Navigation |
| `dashboard/` | Dashboard Page, Modul-Widgets, Dashboard Services |
| `features/auth/` | Login, Register, Forgot Password, Auth-Components |
| `features/fitness/` | Fitness Pages, Components, Services, Models, Store |
| `features/finance/` | Finance Pages, Components, Services, Models, Store |
| `features/organization/` | Organization Pages, Components, Services, Models, Store |
| `features/household/` | Household Pages, Components, Services, Models, Store |

**Angular-Regeln**

- Standalone Components bevorzugen, wenn das bestehende Projekt sie nutzt.
- Angular Signals, `computed()` und `inject()` verwenden, sofern das Projekt bereits auf moderne Patterns setzt.
- Reactive Forms für Auth und komplexe Formulare.
- Business-Logik nicht im Template.
- Keine duplizierten Styles oder Daten.
- Feature-State bleibt innerhalb des Features.
- Keine neue UI-, Chart- oder Auth-Library installieren, bevor `package.json` und bestehende Lösungen geprüft wurden.
- OnPush bzw. moderne Change-Detection-Patterns verwenden, wenn passend.

**Fitness-Komponentenbeispiel**

| Komponente | Verantwortung |
|---|---|
| `fitness-overview` | Seitenkomposition |
| `weekly-goal-card` | Wochenziel + Progress |
| `activity-card` | Schritte, Distanz, kcal, aktive Minuten |
| `streak-card` | Aktuelle Serie |
| `next-workout-card` | Nächstes Training + Start/Details |
| `daily-goals-card` | Tagesziele |
| `body-battery-card` | Energie / Verlauf |
| `heart-rate-card` | Herzfrequenz / Chart |
| `recovery-card` | Recovery + Schlaf |

## 17. Daten, Sicherheit und Datenschutz

4One Hub verarbeitet potenziell sehr persönliche Informationen. Gerade Finanz- und Gesundheitsdaten erhöhen die Anforderungen an Transparenz, Einwilligung und technische Sicherheit. Das Konzept sollte deshalb Vertrauen als Produktfeature behandeln, nicht als Footer-Text.

- Passwörter niemals im Frontend speichern oder loggen.
- Auth-Tokens und Sessions nach Backend-/Security-Best-Practices behandeln.
- Gesundheits-/Wearable-Daten nur nach ausdrücklicher Zustimmung anbinden.
- Finanzintegrationen erst mit geeigneten, rechtssicheren Schnittstellen umsetzen.
- Nutzer müssen Daten einsehen, exportieren und löschen können.
- Privacy Settings klar und in Alltagssprache erklären.
- Keine Sicherheitszertifikate oder Schutzversprechen kommunizieren, die technisch nicht belegt sind.

## 18. Roadmap und Prioritäten

| Phase | Fokus | Definition of Done |
|---|---|---|
| 1 | Auth + App Shell | Login/Register Flow, Routing, responsive Navigation, Basis-Designsystem |
| 2 | Dashboard Polish | Mini-Dashboards, Hover/Loading/Empty States, Responsive |
| 3 | Fitness MVP | Übersicht, Training, Workouts, Fortschritt, Ziele |
| 4 | Fitness Premium | Recovery, Journey, Challenges, Advanced UX |
| 5 | Marketing | Landingpage, Positionierung, Preise, Trust, CTA |
| 6 | Finanzen | Transaktionen, Budgets, Sparziele, Abo-Tracker |
| 7 | Organisation | Kalender, Aufgaben, Erinnerungen, Notizen |
| 8 | Haushalt | Aufgaben, Einkauf, Reinigung, Vorräte |
| 9 | Monetarisierung | Subscriptions, Entitlements, Billing UX |
| 10 | AI & Integrationen | AI Coach/Planung, Wearables, optionale externe Daten |

**Prioritätsprinzip:** Ein vollständig hochwertiger Produktpfad verkauft 4One Hub besser als vier halbfertige Module. Deshalb zuerst Auth → Dashboard → Fitness komplett → Marketing → weitere Module.

## 19. KPIs und Produktmessung

Um die Produktidee später objektiv zu verbessern, sollten wenige verständliche Kennzahlen definiert werden. Ziel ist nicht maximale Datensammlung, sondern zu verstehen, ob Nutzer den Hub verstehen und regelmäßig nutzen.

| KPI | Was sie zeigt |
|---|---|
| Landingpage → Registrierung | Ob Value Proposition und CTA überzeugen |
| Registrierung abgeschlossen | Ob Auth/Stepper verständlich ist |
| Onboarding: erstes Modul eingerichtet | Ob der erste Wertmoment erreicht wird |
| Dashboard → Modul / Feature | Welche Bereiche relevant sind und wo Fokus nötig ist |
| 7-Tage-Aktivierung | Ob Nutzer innerhalb der ersten Woche zurückkehren |
| 30-Tage-Retention | Ob 4One Hub dauerhaft nützlich ist |
| Free → Plus/Pro Conversion | Ob Premium-Nutzen nachvollziehbar ist |

## 20. Launch-Checkliste und finale Vision

**Produktklarheit**

- [ ] Ein neuer Nutzer versteht innerhalb von 5 Sekunden, was 4One Hub ist.
- [ ] Die vier Bereiche und ihr jeweiliger Nutzen sind sichtbar.
- [ ] Die App wirkt nicht wie vier zufällig zusammengefügte Tools.
- [ ] Primary CTA und nächster Schritt sind eindeutig.

**UX / Technik**

- [ ] Login und Registrierung sind getrennte Views und vollständig responsive.
- [ ] Dashboard und Fitness funktionieren auf Desktop, Tablet und Mobile.
- [ ] Keyboard Navigation, Focus States und Reduced Motion sind geprüft.
- [ ] Keine Console Errors, keine unnötigen Dependencies und keine doppelte Feature-Logik.
- [ ] Loading-, Error-, Empty- und Success-States sind definiert.
- [ ] Mock-Daten sind sauber vom späteren Backend getrennt.

**Business / Vertrauen**

- [ ] Free/Plus/Pro/Family sind verständlich abgegrenzt.
- [ ] Preise sind als final erst nach Validierung zu kommunizieren.
- [ ] Keine Fake-Reviews, Fake-Nutzerzahlen oder erfundenen Trust-Signale.
- [ ] Datenschutz und Datenkontrolle sind sichtbar und verständlich.
- [ ] Kündigung und Abo-Verwaltung sind transparent.

**Finale Vision:** 4One Hub ist nicht vier Apps auf einer Seite. 4One Hub ist eine digitale Lebenszentrale: ein vertrauter Einstieg, vier klar getrennte Welten und eine konsequent hochwertige Nutzererfahrung.

---

### Produktziel

Ein modernes, vertrauenswürdiges und zugängliches digitales Produkt, das Nutzer nicht mit mehr Komplexität belastet, sondern vier wichtige Lebensbereiche in einer konsistenten Oberfläche vereinfacht.

Dieses Dokument ist die vollständige Konzeptbasis für Produktdesign, Marketing, UX/UI und Angular-Umsetzung. Preisangaben und spätere Integrationen sind als strategische Vorschläge zu verstehen und sollten vor einem öffentlichen Launch technisch, rechtlich und wirtschaftlich validiert werden.

---

> **Hinweis zum aktuellen Umsetzungsstand:** Produktname und Modulfarben sind zwischen diesem Dokument, `DESIGN_SYSTEM_V2.md` und dem Frontend abgeglichen. Das Produkt heißt durchgängig **„4One Hub“**; die Modulfarben in Abschnitt 15 entsprechen 1:1 den Tokens aus `DESIGN_SYSTEM_V2.md` §3 (Grün/Blau/Amber/Pink auf achromatischer Carbon-Basis statt der ursprünglich hier vorgeschlagenen Rollen oder des früheren Coral/Aubergine-Systems V1). `DESIGN_SYSTEM_V2.md` beschreibt zusätzlich eine sidebar-basierte App-Shell-Navigation (§12–13), die im Frontend aktuell noch nicht umgesetzt ist — dort läuft weiterhin ein Header mit Bottom-Navigation.
