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
- Menüs/Popover: ruhiges Einblenden `--motion-fast` (Deckkraft + 4 px), keine Feder-/Skalier-Effekte; Microinteractions
  nur mit CSS und Tokens, keine zusätzliche Animations- oder UI-Bibliothek.
- Laden: Skelette in Form des Inhalts, kein Seiten-Spinner; Fehler bereichsbezogen mit „Erneut versuchen“;
  Leerzustände ruhig mit einer Aktion.

### Referenz und Migrationsstand

- **Hausschrift Instrument Sans (11.10.2026):** ersetzt Helvetica überall (App, Login, Landingpage; auch `select` und
  `textarea`). Eine variable WOFF2-Datei (Gewicht 400–700, Breite 75–100 %, 89 KB) aus dem offiziellen Projekt
  `github.com/Instrument/instrument-sans`, selbst gehostet unter `public/fonts/instrument-sans/` mit `OFL.txt` — kein
  Google-Fonts-Server. `@font-face` in `styles.css`, `font-display: swap`, Preload in `index.html`; Ersatz Helvetica/
  Arial. Alle Gewichte (400/500/600/700) bleiben exakt. Laufweite der Landing-Überschriften gelockert (H1 −0,025 em,
  H2 −0,02 em), weil Instrument Sans enger läuft. Produkt-Screenshots der Landingpage neu aufgenommen (neue Schrift).

- **Startseite, zweite Runde (11.10.2026):** Einstieg ohne Vier-Punkte-Liste, großer lesbarer Ausschnitt des Dashboards
  (nur Inhaltsbereich, ohne rote Überfällig-Zeile — beim Aufnehmen ausgeblendet, sonst echte Oberfläche). Verbindungen
  als Höhepunkt über die volle Breite und zum Ausprobieren: „Verknüpfen“ zwischen Sparziel und Gerät, danach zeigen beide
  „Verknüpft mit“ (vorher „noch nichts“, gleiche Höhe), „Verbindung entfernen“ setzt zurück; Fokus bleibt am Ort,
  Ansage per `aria-live`. Berlin-Beispiel über die volle Breite (Kopf zweispaltig, Rahmen mit „Verknüpft mit“ |
  Vorschlag). Bereichs-Ausschnitte 1100 × 800, ohne abgeschnittene Beschriftungen. Zweispaltig bis 860 px (vorher
  1024): bei 1024 px ≈ 6.200 statt 8.100 px Seitenhöhe.
- **Öffentliche Startseite `/` (11.10.2026, Neugestaltung):** dieselbe Marke wie die App (Tokens, Helvetica, Buttons
  Primär `--brand-primary` / Sekundär umrandet, 48 px), editorialer: H1 bis 74 px (−0,035 em), H2 bis 48 px, Lead
  17–21 px in `--text-secondary`, Inhalt max. 1240 px, Lesetext ≤ 34 em. Rhythmus: helle Flächen wechseln
  (Weiß / `--surface-app`), genau ein dunkler Moment (Privatsphäre, Navy `#16223a`). Keine Verläufe, kein Glas,
  keine Eyebrows, keine Kartenwand, keine KI-Optik. Bilder ausschließlich echte Demo-Screenshots
  (`public/images/landing`, WebP 1×/2×, gesamt ≈ 0,7 MB, nur das erste Bild mit `fetchpriority=high`, Rest lazy);
  am Handy zeigt der Einstieg den Handy-Screenshot. Verbindungs-Beispiele sind Nachbauten echter Bausteine
  (Objektzeile, „Verknüpft mit“, Vorschlagsblock) und als Darstellung beschriftet. Bewegung: Abschnitte blenden beim
  Scrollen ein (350 ms, 12 px), die Verbindungslinie zeichnet sich und der Status wechselt einmal „Nicht verbunden“ →
  „Verknüpft“; ohne JavaScript oder mit reduzierter Bewegung ist alles sofort sichtbar. Bereiche als echte Reiter
  (Pfeiltasten, Pos1/Ende), das Bild folgt.

- **Budgetjahr-Dialog (11.10.2026, Feinschliff):** statt zwölf umrandeter Kästen eine Liste in zwei Spalten (Jan–Jun |
  Jul–Dez; Handy eine Spalte) mit Haarlinien, Zeilen einheitlich 52 px; Betrag rechtsbündig, tabellarische Ziffern,
  „Nicht festgelegt“ leiser; Icons aus dem System (Pfeil, Haken) statt Textzeichen „›/✓“; gewählter Monat: Fläche in
  Bereichsfarbe + Haken + fett (kein farbiger Seitenstreifen); „Aktuell“ als kleine Zeile unter dem Monat. Kopf:
  „9 von 12 Monaten mit Budget“ („geplant“ ist in Finanzen für geplante Ausgaben reserviert) + kurzer Hinweis, Jahr als
  natives Select mit eigenem Chevron und Abstand zum Schließen-Knopf. Öffnen: Monate erscheinen leicht versetzt
  (15 ms je Zeile, 220 ms, aus bei reduzierter Bewegung) — Magic-UI-Prinzip in CSS, Magic UI selbst ist React-only.

- **Finanzen › Geplante Ausgaben (11.10.2026):** „Geplant“ statt „vorgemerkt“. Budgets: statt Rechenzeile eine
  Aufschlüsselung als `dl.breakdown` (Monatsbudget, Bereits ausgegeben, Geplant + Anzahl als Text-Link, Sparbeiträge,
  Verfügbar; 14 px, tabellarische Ziffern, Summe mit Linie und 600) — keine zusätzlichen Karten; unter 1100 px stehen
  Budget- und Rest-Karte untereinander. Klick auf „Geplant“ → Transaktionen › Geplant im selben Monat (ein Klick).
  Kategorie-Budget-Zeile kompakt (ersetzt die Tabellenspalten, die in der halben Kartenbreite überlappten): Name +
  „X € verfügbar“, Balken mit geplantem Anteil in derselben Farbe bei 40 % Deckkraft, darunter „ausgegeben · geplant
  · von Budget“ und die Prozentzahl (Statuswort nur bei Bald erreicht/Fast ausgeschöpft/Überschritten, Label immer); Klick → Transaktionen der Kategorie. Transaktionsliste: geplante Zeilen
  mit Uhr-Symbol + „Geplant“, Betrag `--text-secondary`; geplante wiederkehrende Zeile öffnet das Formular vorbelegt
  mit Hinweis (`.planned-note`). Formular: bei Ausgabe mit Datum nach heute „Diese Ausgabe gilt bis zu ihrem Datum als
  geplant und zählt dann als ausgegeben.“

- **Finanzen (11.10.2026, Begriff „vorgemerkt“ inzwischen durch „Geplant“ ersetzt — siehe oben):** Modal-Titel „Transaktion bearbeiten/erstellen“ statt „Buchung …“. „Kommt jeden Monat
  wieder“ erklärt je Art: Ausgabe „wird ab dem nächsten Monat jeden Monat vom Budget abgezogen (vorgemerkt). Eine neue
  Transaktion wird dabei nicht angelegt.“ / Einnahme „erscheint dann unter „Wiederkehrende Einnahmen“…“. Budget-Rechnung
  ergänzt um „− X € feste Ausgaben vorgemerkt“; Liste „Wiederkehrende Ausgaben“ zeigt je Posten den Status.

- **Haushalt › Zuhause, Vertragskosten privat (13.10.2026):** Beträge sieht nur, wer sie erfasst hat. Fremde
  Verträge zeigen im Detail „Betrag privat“ mit Erklärung; im Bearbeiten-Dialog steht statt des Kostenfelds ein
  ruhiger Hinweis (`.cost-private`, `--surface-sunken`). Die Kennzahl heißt dann „pro Monat (deine Verträge)“ mit
  „… ohne sichtbaren Betrag“ im Hinweis. Kostenfeld-Hinweis: „Nur für dich sichtbar – wird nicht in Finanzen gebucht.“

- **Login/Registrierung (12.10.2026, Auth-Audit):** Feldfehler erst nach dem ersten Absenden (vorher schon beim
  Verlassen eines Feldes), danach live — wie alle Formulare. Optik unverändert. Gesperrter Login nach zu vielen
  Versuchen: „Zu viele Anmeldeversuche. Bitte warte einen Moment …“ statt „E-Mail oder Passwort falsch“.

- **Haushalt › Heute, Rechner (11.10.2026):** Raster neu gewichtet statt neuer Inhalte: „Heute fällig“ über die
  volle Inhaltsbreite, darunter „Demnächst“ | „Einkauf“ 50/50 (Abstand `--space-5`); unter 961 px wie bisher
  untereinander (Heute fällig → Demnächst → Einkauf). Aufgabenzeilen ab 961 px in festen Spalten
  (Kästchen · Titel + Wiederholung · Fälligkeit 12rem rechtsbündig · Priorität 4.5rem), „Heute“ als ruhiger Text in
  `--text-secondary` statt Pille, Überfällig weiter als dezente Marke mit Text, „Hoch“ als kleine Marke; Zeilen
  60 px. Bewusst ohne Kennzahlenzeile und ohne Zuhause-Kachel (kein Mehrwert gegenüber den sichtbaren Karten).

- **Rückmeldung an Einladende (11.10.2026):** Annahmen erscheinen in der Glocke unter „Neu“ (Symbol
  `check-circle` auf `--success-soft`, z. B. „Lena hat deine Einladung angenommen. Ihr seid jetzt verbunden.“,
  „Ben ist jetzt bei „Berlin“ dabei.“) mit nächstem Schritt als Textlink („Etwas teilen“, „Zum Haushalt“, „Zur
  Reise“); gelesene Meldungen in `--text-secondary`. Startseite: ungelesene Annahme als `.invite-hint--done`.
  Ablehnungen werden nie gemeldet — in Personen & Gruppen still unter „Nicht angenommen“ (gedämpfte Zeilen,
  14 Tage), Zähler „Offene Einladungen“ nur bei offenen.

- **Kontaktanfragen in der App + E-Mail-Bestätigung (11.10.2026):** Glocke zeigt auch „Richard möchte dich als
  Familie hinzufügen.“ (Symbol `user-plus` auf `--info-soft`, Meta „Kontakt · vor 2 Minuten“, Annehmen/Ablehnen).
  Unbestätigte Adresse: Hinweisfläche `.bell-verify` (`--info-soft`) mit „Bestätigungs-Mail senden“; auf der
  Startseite dieselbe ruhige Zeile wie die Einladung (`.invite-hint--quiet`, Symbol `mail`, Knopf „Mail senden“).
  Neue Seite `/email-bestaetigen` im Stil von „Neues Passwort“ (zentrierte Karte, ohne App-Leisten). Lokal ohne
  Mailserver erscheint nach „Mail senden“ „Entwicklungsmodus: …“ mit Link „Jetzt bestätigen“ / „Link öffnen und bestätigen“.

- **Invitation System V1 (11.10.2026):** Neue Komponente `shared/notification-bell` ersetzt den leeren
  „Benachrichtigungen“-Dialog der Shell: gleiche 44-px-Glocke, Zähler als Zahl in `--brand-primary` mit weißem Rand,
  `aria-label` „Benachrichtigungen, 1 ungelesen“; Popover (`role=dialog`, Fokus auf erstes „Annehmen“, Escape und
  Klick außerhalb schließen, Fokus zurück zur Glocke), 150 ms Einblenden, ohne Bewegung bei reduzierter Bewegung; am
  Handy (≤ 600 px) fest unter der Kopfzeile mit 12 px Rand. Leer: „Keine neuen Benachrichtigungen.“ Startseite:
  `.invite-hint` (52 px Zeile, Symbol `user-plus` auf `--info-soft`, „Ansehen →“). Personen & Gruppen: Einladungs-
  zeilen mit Bereichssymbol (Haushalt Coral, Reise Blau), „Von Sophie · Haushalt · Mitglied“ bzw. „An Ben · … ·
  Ausstehend“; offene eigene Einladung je Person als „Eingeladen · ausstehend“ (Uhr-Symbol); Haushaltskarte mit
  Mitgliedern, „Entfernen“/„Haushalt verlassen“ mit Rückfrage. Haushalts-Einladungsdialog neu: Person (Auswahl aus
  Kontakten), „Zu“ und „Rolle“ als Faktenliste, Hinweis, was geteilt wird; Tokens V3 statt alter Violett-Werte.
  Gemeinsame Hilfsfunktion `shared/time-ago.ts`.

- **Personen & Gruppen neu (11.10.2026, nach Vorlage):** Seitenkopf mit Untertitel und grüner Hinweis-Karte „Eine
  Verbindung teilt noch keine Daten.“ (`--success-soft`, Schild-Symbol). Reiter Übersicht / Gruppen / Geteilte Bereiche
  als umrandete 44-px-Felder mit Symbol — bewusste Ausnahme vom Unterstrich-Reiter der Fachbereiche, da diese Seite
  keine Bereichsfarbe hat. Übersicht: „Offene Einladungen“ (erhaltene + gesendete, Zähler, „Alle anzeigen“ ab 3, Zeit
  „vor 2 Stunden“), „Deine Personen“ (Suche ab 2 Personen; je Zeile Avatar in ruhiger Bereichsfläche, Beziehung, was
  ihr teilt bzw. „Noch nichts geteilt“, „Teilen …“-Menü, „…“-Menü mit Beziehung umstellen / Verbindung beenden).
  Rechte Spalte: „Person einladen“ (Feld mit Brief-Symbol, Familie/Freund:in als 48-px-Felder, breiter Primärknopf)
  und „Häufige Fragen“ (`details`). Gruppen = Familie / Freund:innen; Geteilte Bereiche = Reisen und Haushalte mit
  Personen. Neue Symbole `mail`, `send` im bestehenden `app-icon`. Backend: `contacts/` liefert je Kontakt `shared`
  und `can_add_to`, Einladungen `created_at`. Haushalts-Einladungen an dich und echte Gruppen gibt es noch nicht —
  deshalb nicht gezeigt.
  Seitenbreite wie die Fachbereiche: max. 1280 px, zentriert, Ränder `--content-padding-x` (32 px), bis 1100 px
  20 px, am Handy 16 px.

- **Passwort zurücksetzen (11.10.2026, Pre-Beta-Audit):** „Passwort vergessen“ ruft jetzt das Backend auf und
  zeigt danach immer dieselbe neutrale Bestätigung (Hinweisbox `.notice`, ersetzt den Stub-Hinweis). Neue Seite
  `/passwort-zuruecksetzen` (Ziel des Mail-Links) mit drei Zuständen: Formular, „Passwort geändert“ mit „Zur
  Anmeldung“, „Dieser Link funktioniert nicht mehr“ mit „Neuen Link anfordern“. Beide Seiten nutzen dieselbe
  Karte und laufen wie Login ohne Kopfzeile/Bottom-Nav (`shell: 'bare'`). Button und Fokus von Violett
  (`--color-violet-ink`) auf `--brand-primary` umgestellt, Radius `--radius-md`, 600, wie Login.

- **Alte Marke entfernt (11.10.2026):** Beim Neuladen blitzte kurz die Marketing-Kopfzeile mit dem alten Kompass-Logo
  auf, weil `app.ts` sie zeigte, solange die erste Navigation (inkl. Anmeldeprüfung) noch lief. Kopfzeile, Footer
  und Bottom-Nav erscheinen jetzt erst nach der ersten Navigation. Kompass-Logo und -Name sind in Kopfzeile,
  „Passwort vergessen“, Copyright und Demo-Bericht durch `<app-brand>`/„4inOne“ ersetzt, `logo-kompass` ist
  gelöscht; `favicon.ico` (bisher Angular-Standardlogo) zeigt jetzt die vier 4inOne-Felder wie `favicon.svg`.

- **Verknüpfungen/Vorschläge — Pre-Launch-Audit (11.10.2026):** Zeilenaktion sichtbar „Verbindung entfernen“ (vorher
  „Entfernen“, missverständlich als Löschen); rutscht auf schmalen Breiten unter den Eintrag. Leerzustand erklärt:
  „Verknüpfe Einträge, die zusammengehören … beide bleiben dabei unverändert.“ Vorschlagsblock: „Nur ein Vorschlag:
  Verknüpft wird erst, wenn du zustimmst, und geändert wird dabei nichts.“ „Verknüpfen“ zeigt beim Speichern
  „Wird verknüpft …“. Geprüft bei 360/390/430/768/1024 px.
- **Vorschläge (11.10.2026):** unter „Verknüpft mit“ ein ruhiger Block „Das könnte zusammengehören“ —
  `--surface-card`, gestrichelter `--border-default`, Radius 12; je Vorschlag Symbol der Art, Titel, Begründung
  (13 px `--text-secondary`), darunter „Verknüpfen“ (primär) und „Nicht relevant“ (sekundär), 44 px, am Handy
  je halbe Breite. Hinweis: „Vorschläge entstehen nur aus Einträgen, auf die du Zugriff hast.“ Keine Prozentzahl,
  kein Funkeln. „Für dich“ zeigt höchstens einen starken Vorschlag, nur wenn sonst nichts ansteht.
- **Token-Korrektur (11.10.2026):** Ein älterer Satz Pixel-Tokens definierte `--space-4: 4px` und `--space-8: 8px`
  nach den V3-Stufen und überschrieb sie still (16 bzw. 48 px). Entfernt; dessen Nutzer (Header, Rechtsseiten,
  Passwort vergessen, Onboarding, Einladung, Modul-Karte, „Bald verfügbar“) nutzen jetzt `--space-2` (8 px) — keine
  sichtbare Änderung. Folge: Der untere Seitenrand der vier Bereiche ist am Rechner jetzt wie vorgesehen 48 statt 8 px.
- **Verknüpfungen (10.10.2026):** Abschnitt heißt „Verknüpft mit“, Aktion „+ Verknüpfen“, Zeilenaktion „Entfernen“
  (Screenreader: „Verbindung zu „…“ entfernen (der Eintrag selbst bleibt erhalten)“) — nur sichtbar, wenn der
  Server `can_delete` meldet. Fehlertexte je Art (Berechtigung, nicht mehr verfügbar, besteht bereits, zu viele
  Änderungen, keine Verbindung). Details: docs/CONNECTION_ENGINE.md.

- **Globaler Konsistenz-Audit (10.10.2026)** — Startseite, alle Reiter der vier Bereiche, Reise-Detail, Login und
  Registrierung bei 360/390/430/768/1024/1280/1440/1600/1920 px gemessen (Überlauf, Shell, Kopf, Reiter, Buttons,
  Karten, Überschriften, Klickflächen, axe WCAG A/AA). Ergebnis: eine Shell (Seitenleiste 280, Kopfzeile 72 / Handy
  146), ein Seitenkopf (136 / Handy 120 px, Reise-Detail höher wegen Zurück-Link), ein Dialog-System (`modal-form`),
  keine axe-Verstöße, kein Überlauf. Behoben:
  - Haushalt › Zuhause am Handy: Raster blieb zweispaltig (Container-Query nur am Rechner) → Liste auf 12 px gequetscht;
    jetzt einspaltig. Am Tablet (768 px, Liste ~450 px) liefen Tabellenspalten über die Karte → kompakte Zeilen per
    Container-Query (`compact-rows`, ≤ 560 px Listenbreite) wie am Handy.
  - Ungültige Farben `var(--text-primary)33/4d` (Detail-Blatt Schatten/Abdunklung fehlten) → `rgb(27 42 68 / …)`.
  - Klickflächen 40 → 44 px: Filter-Chips (Haushalt/Organisation › Aufgaben), Umschalter Geräte/Verträge, Häkchen und
    Zeilenmenü im Einkauf (Kästchen 20 → 22 px), Senden-Knöpfe der Eingabezeilen per `::before`.
  - Reisen: Hauptbutton 46 px/16 px → 44 px/14 px; Sekundär-Buttons 400 → 600; Filter-Chips 13 → 14 px; Karten 18/20 → 20/22 px.
  - Haushalt: Kartenüberschriften 20 → 18 px (h3 18 → 16), Detailtitel 24 → 20 px, Karten 24 bzw. 20 → 20/22 px,
    Suche in Zuhause 42/14 px → 44/16 px, „Bearbeiten“ 600.
  - Inaktive Reiter: Finanzen/Organisation/Reisen hatten eigene getönte Grautöne → `--text-secondary`.
  - Finanzen: Rand der Transaktionssuche noch grünstichig → `--border-default`. Organisation › Notizen: Gruppenlabel 700 → 600.
  - Login/Registrierung: Titel 32/29 → `--fs-page`, Radien 10/11 → `--radius-md`, Blau/Fokus auf Tokens, Rechtslinks 44 px.
  Bewusst unverändert: Fachlogik, APIs, Datenmodelle, Informationsarchitektur, Navigation, Icons; Formularfelder
  15/16 px; Handy-Aktionsknopf (50 px, eine gemeinsame Komponente); Auth-Eingaben 52 px; getönte Handy-Reiterleisten je
  Bereich (subtiler Akzent, überall gleich aufgebaut).

- **Konsistenzprüfung (10.10.2026)**, Startseite + vier Bereiche bei 1440 und 390 px gemessen: Seitenkopf (Titel 30/700,
  Handy 24; Untertitel 16 px), Inhaltsbreite (max. 1280 px, Ränder 32/16), Hauptbutton (44 px, Radius 12, 14 px/600),
  Kartenradius 16 und Reiter (46 px, 16 px/400, aktiv 600) stimmen überein. Angeglichen: Reiter am Handy überall 13 px
  (`--fs-meta`, im gemeinsamen `domain-layout`; Reisen vorher 12, Haushalt 14) und Abstand Kopf→Inhalt im Haushalt
  16 px (Handy 12) wie in den anderen Bereichen. Bewusst so: gemeinsame Formularfelder 15 px am Rechner / 16 px am
  Handy (nicht Teil der Text-Skala, aber einheitlich); Startseite ohne Kopfkarte, daher Titel am Rechner 7 px tiefer.
  Am Handy steht die Begrüßung der Startseite jetzt auf derselben Höhe wie die Bereichstitel (oberer Rand
  `--space-6`, vorher lag sie direkt unter der Kopfzeile).

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

Reise-Erstellung (11.10.2026): bestehende Kalenderkomponente mit gesperrten Tagen vor heute für den Beginn und vor dem Beginn für das Ende. Eintägige Reisen möglich; vergangene Bestandsreisen bleiben bearbeitbar. Keine neuen Layout-/Farb-Tokens.

Meine Reisen bei vielen Reisen (15.10.2026): Große Karten (`.trip`) nur noch für „Jetzt unterwegs“ und „Als Nächstes“ (eine Karte, 300–420 px). Alle weiteren bevorstehenden Reisen stehen daneben unter „Danach“ als kompakte Zeilen (`ul.rows` / `button.row`: Titel + Ziel · Zeitraum · Status, min. 60 px, Haarlinien in einer Karte); unter 1100 px untereinander, am Handy (≤ 760 px) zweizeilig. „Vergangen“ zeigt die letzten 3 als Zeilen, der Rest hinter „Alle N vergangenen Reisen anzeigen“ (`aria-expanded`). Vergangene Reisen ohne offene Aufgaben/Packstand, „Vorbei“ in `--text-secondary`; Abgesagt bleibt eingeklappt und nutzt ebenfalls Zeilen. Keine neuen Tokens, Bereichsfarbe und Symbole unverändert.
