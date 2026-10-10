# 4inOne — Design System (V3, verbindlich ab 10.10.2026)

> **Pflege:** Jede Änderung an Tokens, gemeinsamen Komponenten, Layout-Regeln oder Bereichsfarben wird hier und in
> der Kurzfassung [`/DESIGN.md`](../DESIGN.md) im selben Schritt nachgetragen (siehe AGENTS.md › Design-Dokumentation).
> Die Werte stehen als CSS-Variablen in `frontend/src/styles.css`; diese Datei ist ihre Beschreibung.

**Grundsatz:** Ein Designsystem, vier Fachbereiche. *Systematisch im Grundgerüst, flexibel im Inhalt.*
Complex underneath, simple on top. Weniger Elemente, bessere Ordnung — keine Dekoration, um Platz zu füllen.

### Flächen, Text, Linien

| Token | Wert | Verwendung |
| --- | --- | --- |
| `--surface-app` | `#f4f6fa` | Hintergrund der App (leicht blau getöntes Off-White) |
| `--surface-card` / `--surface-elevated` | `#ffffff` | Karten, Modals, Menüs |
| `--surface-hover` / `--surface-pressed` | `#f6f8fb` / `#eef2f7` | Hover / Press von Zeilen und Flächen |
| `--text-primary` | `#1b2a44` | Text (getöntes Navy, kein Schwarz) |
| `--text-secondary` = `--text-muted` | `#56657c` | Sekundärtext, Metadaten (≥ 5:1 auf `--surface-app`) |
| `--border-subtle` / `--border-default` / `--border-strong` | `#e7ebf1` / `#dfe4ed` / `#b9c0ce` | Karten, Trennlinien / Standard / Eingaben |

### Marke, Bereiche, Status

- Marke: `--brand-primary #245fb0` (Links, Fokusring, Startseite).
- Bereiche — **Akzente, keine Flächenfüller** (Symbol, kleiner Aktiv-Indikator, kleine Statusinfo):
  Finanzen `--finance-accent #1e7a4d` · Haushalt `--household-accent #b8432a` (warmes Coral) ·
  Organisation `--organization-accent #7541b5` · Reisen `--travel-accent #246db8`; je `--*-soft` als helle Fläche.
- Status überall gleich: `--success #1e7a4d`, `--warning #8a5a00`, `--error #b3261e` (= `--danger`), `--info #245fb0`,
  je mit `--*-soft`. Status nie nur über Farbe (immer Text dazu). Badges sparsam, nur für echten Status.

### Typografie

Systemschrift (`--font-body`, Helvetica/Arial) — bewusst, für eine ruhige Produkt-UI. Vier Gewichte:
400 `--fw-regular`, 500 `--fw-medium`, 600 `--fw-semibold`, 700 `--fw-bold`.

| Rolle | Token | Größe |
| --- | --- | --- |
| Seitentitel | `--fs-page` | 30 px (Handy 24 px), 700, −0,025 em |
| Abschnitt | `--fs-section` | 20 px, 700 |
| Unterabschnitt | `--fs-subsection` | 18 px |
| Kennzahl | `--fs-metric` | 24 px, tabellarische Ziffern |
| Kartenüberschrift / Listentitel / Wert | `--fs-card-heading` | 16 px, 600 |
| Fließtext, Seiten-Untertitel | `--fs-body` | 16 px |
| Sekundärtext, Label, Button | `--fs-secondary` / `--fs-label` / `--fs-button` | 14 px (Button 600) |
| Metadaten | `--fs-meta` | 13 px |
| Caption | `--fs-caption` | 12 px |

Zahlen (Beträge, Zeiten, Datum, Zähler): `font-variant-numeric: tabular-nums`. Hierarchie über Größe, Gewicht und
Abstand — nie nur über Farbe.

### Abstände, Radien, Schatten

- Abstände im 4er-Raster: `--space-1…9` = 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64. Verwandtes eng, Abschnitte
  großzügig, nicht überall derselbe Abstand (Startseite: Kopf→Band 32, Band→Heute 48, Heute→Für dich 40).
- Radien: `--radius-sm 8` (Icons, kleine Flächen, Menüeinträge) · `--radius-md 12` (Buttons, Eingaben, Menüs) ·
  `--radius-lg 16` (Karten, Kopfkarten, Modals) · `--radius-pill` nur für kleine Chips. Keine 20–32-px-Radien.
- Schatten nur für echte Ebenen: `--shadow-overlay` (Modal, Dropdown, Menü), sonst `--shadow-none`; Karten werden
  durch Fläche, Linie und Abstand getrennt.

### Layout

- App Shell überall gleich: Sidebar + Topbar + Inhalt (eine Komponente `app-shell`, keine Bereichs-Shells).
- Inhalts-Container: `max-width: var(--content-max-width)` = **1280 px**, zentriert; Ränder
  `--content-padding-x` = 32 (Desktop) · 24 (≤ 1024) · 16 (≤ 760). Alle Seiten starten an derselben Kante.
- Seitenkopf: Titel (`--fs-page`) · 4 px · Untertitel (`--fs-body`, `--text-secondary`) · Hauptaktion rechts auf der
  Titelachse. Bereiche nutzen dafür `shared/styles/domain-layout.scss` (Kopfkarte `--radius-lg`, `--border-subtle`).
- Navigation: genau **ein** aktiver Eintrag — Start nur exakt, ein Bereich auch auf Unterseiten; Query-Parameter
  (`?tab=`, `?trip=`) zählen nie mit (`app-shell.ts` `startMatch`/`areaMatch`). Handy: Bottom-Navigation
  Start · Finanzen · Haushalt · Organisation · Reisen; „Personen & Gruppen“ über das Profilmenü.
- Karten: gleiche Höhe nur innerhalb einer Gruppe nebeneinander (z. B. Kennzahlen); sonst bestimmt der Inhalt die
  Höhe. Keine Karte in Karte, nicht jedes Element als Karte — Listen bleiben strukturierter Inhalt mit Trennlinien.
- Listen-Zeile: führend Symbol/Checkbox · Titel + Metadaten · optional Status · rechts Aktion/Chevron; die ganze
  Zeile ist Klickfläche, mindestens 44 px.

### Bedienelemente und Zustände

- Steuerhöhe `--control-height` 44 px (Touch-Minimum), Buttons 14 px/600, Eingaben 44 px mit `--radius-md`.
  Varianten: Primary (nur die wichtigste Aktion je Ansicht), Secondary, Ghost, Destructive.
- Formulare: Labels immer sichtbar; Pflichtfehler und roter Rand **erst nach dem ersten Speichern**, danach live
  (`app-field` setzt `aria-invalid`; kein `.ng-touched`-Rot). Abbrechen prüft nichts.
- Dialoge: `app-modal` / `app-modal-form` — Titel · Inhalt · Fuß (Abbrechen, Hauptaktion); Breite 520 px, Höhe nach
  Inhalt (max. 680 px), am Handy als Blatt von unten.
- Fokus: global `:focus-visible { outline: 3px solid var(--brand-primary); outline-offset: 2px }` — verändert nie die
  Form des Elements; Komponenten passen ihn an, entfernen ihn nie ersatzlos.
- Hover: leichte Flächen-/Linienänderung; Press: 1 px bzw. `--surface-pressed`; Bewegung 120–200 ms
  (`--motion-fast`/`--motion-base`), nichts Federndes; `prefers-reduced-motion` schaltet Übergänge ab.
- Laden: Skelette in Form des Inhalts, kein Seiten-Spinner; Fehler bereichsbezogen mit „Erneut versuchen“;
  Leerzustände ruhig mit einer Aktion.

### Referenz und Migrationsstand

- **Referenz-Screen:** Startseite (`features/dashboard`) — nutzt ausschließlich diese Tokens (docs/DASHBOARD_V1.md).
- Global wirksam in allen Bereichen: Tokens, Inhaltsbreite, Seitenkopf-Rollen und Kopfkarte (`domain-layout`),
  Fokus, Formularfelder, Auswahl, Modals, Navigation.
- **Migriert:** Startseite (Referenz), **Finanzen** (10.10.2026): Text- und Linienfarben aus den Tokens (kein
  Grünstich mehr), Radien 12/16, Gewicht 600 statt 650, Typo-Skala, Buttons 44 px/600 mit Hover/Press,
  Umschalter und Links 44 px, durchgehend tabellarische Ziffern. Feste Hauptaktion „+ Transaktion“ in allen Reitern
  (auf „Einnahmen“ mit vorausgewählter Einnahme); „Budget ändern“ (Karte Monatsbudget) und „Sparziel erstellen“
  (Karte Deine Sparziele) als Sekundäraktionen. Fachliche Farben bleiben: Ausgaben Rot, Gespartes Blau — immer mit
  Vorzeichen/Text.
- **Haushalt** (10.10.2026): Typo-, Radius- und Gewichts-Skala, neutrale Flächen und Textfarben aus den Tokens,
  Kopf-Button 44 px/600 mit Hover/Press, Titel/Untertitel nur aus dem gemeinsamen Seitenkopf. Untertitel „Alles rund um
  dein Zuhause.“; Hauptaktion bleibt je Reiter benannt (Aufgabe/Artikel bzw. Liste/Gerät/Vertrag), auf „Heute“ keine.
  Kleine Bedienelemente (Abhak-Kästchen 22 px, Symbol-Knöpfe, Vorschlags-Chips) behalten ihre Optik, die Klickfläche
  reicht unsichtbar (`::before`) auf 44 px. Einzelperson zuerst: der Hinweis „Gemeinsame Aufgaben …“ nur bei mehr als
  einer Person. Hinweiskarte „Einkauf wird zur Ausgabe“ neutral statt Coral-Fläche.
- **Organisation** (10.10.2026): Bereichsfarbe jetzt das Token `--organization-accent` (#7541b5, vorher eigenes
  #6d3fc4 — wich von Navigation/Startseite ab), Text und Flächen ohne Violettstich aus den Tokens, Typo-/Radius-/
  Gewichts-Skala, Buttons 44 px/600 mit Hover/Press, Umschalter Tag/Woche/Monat und Links 44 px. Untertitel und
  benannte Hauptaktionen bleiben. Notizen bleiben eine geordnete Liste (Angeheftet / Alle).
- **Aufgaben-Kästchen** (Haushalt und Organisation gleich): 22 px, `--radius-sm`, Rand `#8592a6` (≥ 3:1 auf Weiß),
  Klickfläche 44 px.
- **Reisen** (10.10.2026): Bereichsfarbe das Token `--travel-accent` (#246db8, vorher eigenes #2563eb), Text/Linien/
  Flächen aus den Tokens, Typo-/Radius-/Gewichts-Skala, Filter-Chips und Links 44 px. Meine Reisen: Hauptaktion
  „+ Reise“ (Name für Screenreader „Reise erstellen“), Abstand Kopf → erste Gruppe 32 px. Reise-Kopf: Zeitraum, Ziel
  und Status brechen am Handy als eigene Stücke um. Planung → „Vorschläge für Aufgaben“ (vorher fälschlich „… und
  Packliste“). Alle vier Reise-Reiter mit identischer Kopf- und Reiterposition.
- **Globaler Abgleich** (nach Reisen): Haushalt-Hauptbutton flach statt Verlauf/Farbschatten und 44 statt 46 px;
  Profil-Kreis oben rechts flach in `--brand-primary` statt Blau-Violett-Verlauf. Geprüft über alle fünf Bereiche:
  Titel 30/700, Untertitel 16 px `--text-secondary`, Textfarbe, Kartenradius 16, Kartenlinie, Reiter 46 px,
  Hauptaktion 44 px/600, Startkante.
- App Shell: überschreibt keine Farb-Tokens mehr (vorher eigenes `--text`/`--text-muted`/Hintergrund).
- **Alle Bereiche migriert.** Bekannte Reste (bewusst nicht angefasst, weil linke Navigation unverändert bleibt):
  drei durch spätere Regeln überschriebene, unsichtbare Verläufe in `app-shell.scss` (aktiver Sidebar-Eintrag,
  Sidebar-Hinweis, Demo-Banner).

---

# Hintergrund: Design-Richtung V2 (Grundsätze, gelten weiter, soweit V3 nichts anderes festlegt)

## Design goal

The real product should feel:

- calm;
- modern;
- adult;
- friendly;
- trustworthy;
- understandable;
- not overly “AI-mockup-like”.

The interface should support long-term daily use rather than optimizing every screen for visual wow.

## Visual balance

Recommended product balance:

- approximately 80–85% normal product UI;
- approximately 15–20% illustration/3D/emotional visual accents.

Marketing material may use more expressive imagery than the daily product.

## Domain colors

Use a consistent orientation system:

- Finanzen — green
- Haushalt — warmes Coral (`#b8432a`, Fläche `#fdeee9`, dunkel `#9c3722`; 5,4:1 auf Weiß)
- Organisation — purple
- Reisen — blue

Domain colors are accents, not backgrounds for entire dense screens.

Preferred pattern (V3): neutral surface + small domain-colored icon. A light domain-tinted icon container is
reserved for page headers of the four areas; summaries and lists use the plain icon.

## Base surfaces

Prefer:

- white or warm off-white main surfaces;
- dark navy/charcoal primary text/navigation;
- restrained borders;
- subtle shadows;
- consistent card radius;
- generous spacing.

Avoid excessive gradients, glow effects and floating decorative objects in functional views.

## Icon system

Use one consistent icon family already available in the project where possible.

If Angular Material/Material Symbols is already established, prefer **Material Symbols Rounded**.

If a coherent family such as Lucide is already established, keep it rather than adding another library.

### Domain icons

Use stable concepts across the entire product:

- Finanzen — wallet/savings
- Haushalt — home
- Organisation — calendar/task
- Reisen — flight/travel

Do not change the main domain symbol between screens.

### Icon sizes

Suggested scale:

- utility: 16 px
- list: 20 px
- navigation: 22–24 px
- cards: 24–28 px
- section headers: 28–32 px

Do not use oversized 3D icons for ordinary data cards.

## 3D and illustration

Good uses:

- onboarding;
- landing/marketing;
- empty states;
- app-store imagery;
- occasional travel/hero moments.

Avoid as primary controls in:

- sidebar/bottom navigation;
- settings;
- finance transactions;
- task lists;
- calendars;
- forms;
- tables.

## Finanzen

Finances should be the most restrained domain.

Prioritize:

- clear numbers;
- readable charts;
- trust;
- minimal decoration;
- green as accent rather than full-page theme.

## Haushalt

Can feel warm and friendly, but tasks/information stay primary.

Device imagery may be used sparingly. Prefer normal device icons or small thumbnails over large decorative 3D appliances.

## Organisation

Should feel especially clean and productive.

Use simple calendar/task/reminder icons and restrained purple accents.

## Reisen

May be the most emotional domain.

Allowed:

- destination cover imagery;
- light illustrations;
- travel hero imagery.

Functional controls still use the same normal icon system as the rest of the product.

## Navigation

Inactive navigation:

- neutral navy/gray.

Active navigation:

- domain accent and/or light domain background.

Do not rely only on color; preserve text/shape/state cues.

## Profile menu

The top-right profile entry may open a compact menu with:

- Mein Profil
- Konto
- Personen & Gruppen
- Benachrichtigungen
- Datenschutz
- Einstellungen
- Hilfe
- Abmelden

The menu should feel simple rather than becoming a second sidebar.

## Accessibility

- icon-only buttons require accessible labels;
- state must not be communicated only by color;
- focus states remain visible;
- text and controls require sufficient contrast;
- touch targets should be comfortable on mobile.


## Fehler und Bestätigungswarnungen

- Fehler beim Speichern, Validieren und Laden erscheinen über die gemeinsame
  globale Fehleranzeige außerhalb des Modals. Sie sind per X schließbar und
  verschwinden nach fünf Sekunden; Maus- und Tastaturinteraktion pausiert die Zeit.
- Die Anzeige liegt über Dialogen und gehört zu deren Tastatur-Fokusfolge.
  Erneutes Absenden muss auch denselben Fehler erneut anzeigen können.
- Bestehende Fehlerbeschreibungen für `aria-describedby` bleiben unsichtbar
  verfügbar. Wiederholen-Aktionen und Hinweise zu fehlenden Berechtigungen bleiben
  im jeweiligen Seitenkontext.
- Warnungen mit einer bewussten Entscheidung, etwa „Trotzdem speichern“ bei
  Budgetüberschreitung, bleiben oben im Modal sichtbar. Sie verschwinden nicht
  automatisch. Gemeinsame Formulare nutzen dafür den `modalWarning`-Bereich.


## Mobile Dichte und Formulare

Mobile Kopfbereiche bleiben kompakt bei mindestens 44 px großen Bedienelementen. Beschreibungstexte in den Bereichen und Formularhinweise verwenden mindestens 14 px. Lange Formulare werden durch benannte Gruppen gegliedert; optionale Angaben bleiben sichtbar und werden eindeutig bezeichnet. Globale Fehler-Popups ergänzen dauerhafte Feldfehler mit Text, Rahmen und `aria-describedby`; diese verschwinden erst bei Korrektur beziehungsweise erneuter gültiger Prüfung.

## Gemeinsames Dashboard

Demo und angemeldete Nutzer verwenden dasselbe Layout (`features/dashboard`). Aufbau, Inhalte und Regeln stehen in
`docs/DASHBOARD_V1.md`; es ist der Referenz-Screen des Design Systems V3. Keine Fotos, keine Diagramme, höchstens eine
„Für dich“-Information. Die Suche umfasst nur die geladenen Überblicks-Inhalte („Im Überblick suchen …“).

## Finanz-Übersicht und gemeinsamer Kopfbereich

Die Finanz-Übersicht verwendet kompakte Kennzahlenkarten für Monatsrest, Ausgaben und Einnahmen, eine Kategorienliste und darunter Buchungen sowie Sparziele. Die Budgetrechnung und Warnungen bleiben sichtbar; die übrigen Finanz-Reiter behalten ihr Layout. Alle AppShell-Seiten verwenden den gemeinsamen Such-/Datums-/Profilkopf. Außerhalb des Dashboards führt eine abgesendete Suche zum passenden persönlichen oder Demo-Dashboard. Die tatsächliche Header-Höhe bestimmt den Sticky-Abstand der Bereichsüberschriften.
