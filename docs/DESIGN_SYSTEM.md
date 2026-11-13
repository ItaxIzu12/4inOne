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
  Finanzen `--finance-accent #0b6e4b` · Haushalt `--household-accent #a8325a` · Organisation
  `--organization-accent #8a5800` · Reisen `--travel-accent #2453b4`; je `--*-soft` als helle Fläche
  (`#e4f4ec` · `#fce8ee` · `#fcefd9` · `#e7edfb`). Das sind die dunklen Textvarianten der Logo-Farben
  `#0f9d6b` · `#e04f78` · `#e3961a` · `#3b6fe0` (Flächen, Logo, Startseite; seit 21.10.2026).
- Status überall gleich: `--success #1e7a4d`, `--warning #8a5a00`, `--error #b3261e` (= `--danger`), `--info #245fb0`,
  je mit `--*-soft`. Status nie nur über Farbe (immer Text dazu). Badges sparsam, nur für echten Status.

### Typografie

Schibsted Grotesk (`--font-body` = `--font-display`, selbst gehostet, keine Kursive; seit 21.10.2026). Vier Gewichte:
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
  Inhalt (max. 680 px), am Handy als Blatt von unten. Langer Inhalt scrollt in `.modal-scroll` (31.10.2026; vorher
  schnitt das Panel ab und nichts ließ sich scrollen), das Schließen-Kreuz bleibt stehen; `flush`-Dialoge (Formulare,
  „Kalender teilen“) bringen eigenen Innenabstand und eigenen Scrollbereich mit.
- Anhänge (31.10.2026): gemeinsamer Baustein `shared/attachments/attachment-field.*` (`app-attachment-field`, Eingaben
  `attachments`, `load`, `privacy`; `commit(upload, remove)`, `reset()`; Farbe über `--att-accent/--att-soft/--att-on`,
  Standard Organisation, Haushalt `.att-household`), `shared/attachments/file-thumb.ts` (lädt private Bilder als Blob, Objekt-URL; CSP `img-src blob:` in
  `deploy/nginx/snippets/4inone-security-headers.conf`). Backend: `PersonalFile.note`, Upload `files/` mit `note=<id>`,
  nur JPG/PNG/WebP/PDF, max. 10 je Notiz; Fotos werden mit Pillow ohne EXIF neu gespeichert (`files.clean_image`).
  Haushalt: `FolderAttachment` (Gerät/Vertrag), `ordner/{id}/anhaenge/` (POST) und `ordner/{id}/anhaenge/{anhang}/`
  (GET, DELETE nur hochladende Person oder Admin); gemeinsame Prüfung `files.prepare_upload`.
- Termin-Dialog (01.11.2026): `.allday-row` zwischen Datum und Uhrzeit, nur „Ganztägig“ (min. 48 px, Rahmen `--border-subtle`) mit `.switch` = natives
  Kontrollkästchen `role="switch"` (`appearance: none`, Spur aus `#7d8796` ≥ 3:1, an `--organization-fill`).
  Agenda/Tagesblatt: `.allday` statt `<b>` für „Ganztägig“.
- Haushalt › wer ist dabei (01.11.2026): `haushalt/household-people.ts` (`app-household-people`, `.hp-*`) und
  `haushalt/household-people.service.ts` (`HouseholdPeople`, von der Haushalt-Seite bereitgestellt; `audience(adultsOnly)`
  für den Satz in `app-scope-note` der Dialoge). Quelle `HouseholdApiService.members()` (Demo:
  `core/household/demo-household-api.service.ts`, Sophie/Max). Lädt neu bei `MembershipChanges`.
- Demo-Besetzung (01.11.2026, in allen Bereichen gleich): **Sophie** (du; Kopfzeile, Finanzen, Haushalt-Admin, Reisen),
  **Max** (Familie, Konto 301: Haushalt „Unser Zuhause“, Familien-Kalender, Kalenderfreigabe, Reisen Berlin und Italien),
  **Lena** (Freundin, Konto 302: nicht im Haushalt; Reisen Italien und Skifahren; gibt ihren Kalender frei),
  **Jonas** (nur offene Kontakt-Einladung). Neue Demo-Daten nutzen nur diese Personen.
  Demo-Abgleich: `demo-contacts-api` führt Reisen nicht selbst, sondern liest sie aus `demo-reisen-api`
  (`demoTripsFor`, `demoInvite`, `demoAccept`) — Entfernen/Einladen bei Reisen und in Personen & Gruppen zeigen
  denselben Stand (solange nicht neu geladen wird). Im echten System rechnet `contacts/` ohnehin aus der Datenbank.
- Personen & Gruppen: `.shared-chip--more` ist ein Knopf (`toggleExpanded`, `aria-expanded`) statt einer Zahl.
- Connection Engine V2: `shared/connections/auto-links.*` (`app-auto-links`; Eingaben `sourceType`, `sourceId`, `previews`,
  `sourceLabel`; `commit(sourceId)`, `reset()`; `.al__row`, `.al__toggle` = Kontrollkästchen `role=switch`, Spur `#7d8796`,
  an `--accent`), Regeln für Vorschau und Demo `auto-link-rules.ts`, Demo `demo-auto-links-api.ts`.
  `features/organisation/org-household-tasks.*` (`app-org-household-tasks`, `.hh__*`, Schalter an `--household-fill`).
  Abgeleitete Kalendereinträge = `PersonalEvent` mit `derived` (negative ID, `calendar_color: slate`, nur lesbar).
- `shared/save-feedback` (01.11.2026): `.toast[data-tone]` (`success|warning|error`, sonst aus dem Text: `feedbackTone`),
  Dauer `feedbackDuration` (5–9 s), Pause bei `mouseenter`/`focusin`, Eingaben `message`, `tone`, `stamp` (gleiche Meldung
  neu starten), Ausgabe `dismissed`. Seiten setzen keinen eigenen Timer mehr. Live-Region `role=status` bleibt im DOM.
- `shared/reload-notice` (11.11.2026, `app-reload-notice` in `app.html`): Hinweis, wenn ein Bereich nicht nachgeladen
  werden konnte (Funkloch, neue Version). Logik `core/navigation/chunk-load-recovery.ts` über
  `withNavigationErrorHandler`: erster Fehler → Zielseite einmal neu laden (höchstens alle 10 s, Marke
  `4io_chunk_reload_at` im Sitzungsspeicher), zweiter → Karte „Diese Seite konnte nicht geladen werden.“ mit
  „Neu laden“ (Tinte, 44 px) und × (44 px). Gleiche Karte und Position wie `app-save-feedback` (oben mittig,
  `--radius-lg`, `--border-subtle`, `--shadow-overlay`), bleibt aber stehen, bis man handelt; `role=alert`.
- Demo-Abgleich Kalender: `demo-contacts-api` liest „Kalender: …“ und Kalenderfreigaben aus `demo-organisation-api`
  (`demoLinksFor`, `demoInviteArea`, `demoAcceptNow`).
- `shared/form/modal-form`: `submitIcon`/`cancelIcon` (optional); ohne Angabe passend zum Text (`submitIconName`:
  „…importieren“ → upload, „Vorschau“ → arrow, „Schließen“ → close, sonst check; `cancelIconName`: „prüfen/zurück“ →
  arrow-left, sonst close). Eigene Fußzeilen (Profil › Konto löschen, Reisen › Vorschläge, Person einladen) nutzen
  dieselben Symbole, 16 px.
- `shared/form/place-input.*` (`app-place-input`, ControlValueAccessor): Combobox nach WAI-ARIA (`role=combobox`,
  `aria-expanded`, `aria-activedescendant`, Listbox mit Gruppen „Deine Orte“/„Orte“, Live-Region „3 Vorschläge“);
  Pfeiltasten, Enter übernimmt (schickt das Formular nicht ab), Escape schließt nur die Liste. Eingaben `inputId`,
  `maxLength`, `placeholder`, `full`. Quelle `core/places/places.service.ts` → `GET /api/v1/places/?q=`
  (backend `core/places.py`: eigene Orte + Photon über den Server, 300 ms Pause, ab 3 Zeichen, 24 h Cache,
  60/min je Person); Demo `core/places/demo-places.service.ts` (Beispielorte, nichts nach außen).
  Unterkunft: `kind="lodging"` (Photon `osm_tag=tourism:hotel|hostel|guest_house|apartment|motel|chalet|camp_site|
  alpine_hut`, eigene = frühere Unterkünfte), `[near]` = Reiseziel (an den Suchtext gehängt), `(picked)` liefert den
  Treffer mit `area` (Stadtteil/Ort) → `reisen.ts accommodationPicked` füllt „Lage“, wenn leer.
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

- **Landingpage V4 (24.10.2026, aktueller Stand, nach Agentur-Brief):** Schrift bleibt Schibsted Grotesk
  (Nutzerentscheid gegen Manrope). Farben aus dem Brief: Sekundärtext `#52615B` (6,1:1 Porcelain), Haushalt
  `#AB445F` als Fläche und Text (≥ 4,75:1 auf allen Flächen, ersetzt `#B75369`/`#9E4559`), App-weit. Hero: „Vier
  Bereiche für deinen Alltag – und was zusammengehört, ist verbunden.“, „Demo ohne Anmeldung testen“ (Tinte) +
  „So funktioniert’s“ (zur Probe), „Mit Beispieldaten · Ohne Registrierung“, Produktbild näher am Text; H1 bis 60 px,
  Handy 32 px. Problem-Abschnitt „Vier Apps wissen nichts voneinander. Dein Alltag schon.“ mit zwei
  Vorher-/Mit-4inOne-Karten (Reise, Waschmaschine) und Link zur Probe. Probe in vier Schritten mit Schrittanzeige
  (`aria-current="step"`): Anlegen → Vorschläge → Entscheiden (je Vorschlag Verknüpfen · Später · Ablehnen,
  Zustand als Wort; abgelehnt durchgestrichen mit „Rückgängig“, später gestrichelt) → Ergebnis je Bereich („keine
  neuen Einträge, niemand bekommt Zugriff“); Fokus bleibt nach jeder Entscheidung in der Zeile. Ehrlich: nur echte
  Vorschlagsarten (Aufgabe, Termin, Sparziel), keine Packlisten-Automatik, als Vorschau gekennzeichnet. Bereichs-
  Panels: Problem (Zitat), Funktionen, größerer lesbarer Screenshot, „Dein Nutzen“. Datenschutz: drei belegte Fakten +
  Beispiel „Wer sieht was“ (Finanzen nur du/nicht teilbar, Haushalt du und Alex, Reise du und Ben, Verknüpfung ändert
  keine Rechte). Fragen um „Wie funktionieren Verknüpfungen?“, „Welche Funktionen gibt es schon?“ (inkl. was noch
  fehlt) und „Was kostet 4inOne?“ („steht noch nicht fest“). Abschluss „Probier aus, wie deine Alltagsbereiche
  zusammenarbeiten.“ mit „Demo ausprobieren“. Fuß: „So funktioniert’s“ ergänzt, kein „Kontakt“ (Seite existiert
  nicht). Probe-Styles in `landing-play.scss` (Budget). Labor-Messung (Produktions-Build, CSP): Handy gedrosselt
  LCP 1,8 s · CLS 0 · INP ≈ 88 ms; Rechner 1,4 s · 0 · 64 ms.
- **Offene Punkte V4 (25.10.2026):** H1 am Handy fließend `clamp(1.6875rem, 0.2rem + 7.4vw, 2rem)` — 27 px bei 320,
  32 px ab 390; überall 4 Zeilen, Demo-Knopf im ersten Bild. Probe: statt zweier Live-Regionen (Zähler, Ergebnis)
  eine feste unsichtbare Statuszeile (`role="status"`, `.sr-only`) mit einem Satz je Entscheidung („„Reisekasse
  Berlin“ verknüpft. Verknüpft mit 1 Eintrag.“, „Beispiel zurückgesetzt.“). Barrierefreiheitsbaum geprüft (Playwright
  `ariaSnapshot`): Sprunglink, benannte Abschnitte in Leserichtung, H1→H2→H3 ohne Sprung, benannte Navigationen im
  Fuß; ein Test mit echtem Screenreader (VoiceOver/NVDA) steht noch aus. Rechtsseiten: Hinweis „Platzhaltertext —
  noch nicht rechtsverbindlich …“ ohne interne Dateinamen. Öffentliche Seiten vorgerendert (`app.routes.server.ts`),
  Hydration ohne Event-Replay wegen strenger CSP; Webserver-Regeln in `deploy/nginx/`.
- **Hover auf der Landingpage (25.10.2026):** Hover nur als Zugabe am Rechner (`@media (hover: hover) and (pointer:
  fine)`), gleiches Feedback bei `:focus-visible`, nur Bewegung/Transparenz, 180–320 ms, bei „Bewegung reduzieren“ ohne
  Weg. (1) Probe: Überfahren/Fokus von „Verknüpfen“ zeigt die Verbindung als **gestrichelte, neutrale Vorschau**
  (`app-animated-beam [preview]`, `--beam-preview`), erst nach dem Klick farbig mit Impuls; auf Touch keine Vorschau.
  (2) Hauptwege in die Demo („Demo ohne Anmeldung testen“, „Demo ausprobieren“) mit Pfeil (`.btn--go`), der 4 px
  vorrückt; Textlinks mit Pfeil ebenso. (3) Bereichs-Tabs: weiße Fläche gleitet zum gewählten Tab (`.tabs__glider`,
  ab 641 px; vorgerendert trägt der Tab die Fläche selbst), beim Überfahren nimmt das Symbol die Bereichsfarbe an.
  Bewusst nicht: Hover auf nicht klickbaren Karten, Kippen, Glühen, Magnet-Knöpfe, Inhalte nur beim Hover.
- **Einblenden beim Scrollen (25.10.2026):** nur je Abschnitt die H2 (`#problem-title` … `#closer-title`) und das
  Bild/Beispiel (`.compare`, `.panel__shot`, `.share`), 12 px + Transparenz. Reines CSS mit `animation-timeline:
  view()` (`landing-end.scss`), an die Scroll-Position gebunden statt zeitgesteuert: kein JavaScript, nichts wartet.
  Überschrift voll sichtbar, sobald sie ganz im Bild ist (`entry 0%–100%`), Bild etwas später (`entry 8%–38%`, ≈ 250 px).
  Von oben zurück, nach Ankersprung und am Seitenende sofort voll da. Ohne Browser-Unterstützung (`@supports`) oder bei
  „Bewegung reduzieren“ keine Animation. Hero, Fließtext, Knöpfe und die Probe blenden nicht ein. Hinweis zum Messen:
  `html` scrollt weich — Tests scrollen mit `behavior: 'instant'`.
- **Audit-Runde (25.10.2026, /ui-taste):** Jede Kernaussage einmal — „was zusammengehört“ nur in der H1 (Hero-Zeile
  darunter jetzt konkret: „… Und die Reisekasse weiß, zu welcher Reise sie gehört.“), Abschluss eigene Aussage „Fang mit
  einem Bereich an und nimm später dazu, was du brauchst.“, „ändert keine Rechte“ nur noch im Freigabe-Beispiel.
  Bereichs-Panels ohne Versprechen-Zeile (Problem → drei Funktionen → Nutzen → Link). Screenshot-Ausschnitt je Bereich
  aus Daten (`shot.desk` [x, y, Breite] 3:2, `shot.phone` [x, y, Breite, Höhe]): am Handy ein Element in fast
  Originalgröße (Budgetstatus, Fristen, Termine heute, nächste Reise), Ränder nie durch Text. Probe im Startzustand mit
  einer Hauptaktion („Reise anlegen“), Demo als leiser Textlink, „Zurücksetzen“ erst nach der ersten Aktion; am Handy
  Beispiel-Knöpfe ohne Symbol (alle drei in einer Zeile ab 360 px). Hero-Zeile mit `text-wrap: pretty`.
  Zweite Runde: verknüpfte Zeile zeigt den Zustand einmal als Wort („✓ Verknüpft“), der Knopf sagt, was er tut
  („Lösen“, Name „Verbindung lösen: …“); Aktionen am Handy in jedem Zustand linksbündig unter dem Text;
  „Zurücksetzen“ textbündig (`margin-inline: -14px` gegen den Innenabstand der Klickfläche).
- **Landing-Audit umgesetzt (24.10.2026):** Warum jetzt im Hero („Budget, Termine, Einkauf und
  Reisen liegen meist in vier Apps …“), der Absatz danach kurz als Brücke zur Probe („Die Reisekasse zur Reise …
  Verknüpft wird nur, was du bestätigst.“, max. 34 px, unten Abstand zum dunklen Band). Verknüpfungs-Probe: vor dem
  Anlegen eine Vorschau der drei Vorschläge (nur Bereich und Titel, gedämpft, ohne Knöpfe); der Kasten darunter passt
  zum Zustand („Lieber gleich die ganze App sehen? → Demo ansehen“, erst nach dem ersten Verknüpfen „Das war ein
  Ausschnitt … In der Demo weitermachen“); Auswahl-Pillen am Handy wischbar; Knöpfe „Verknüpfen“/„Nicht relevant“
  44 px. Handy-Bild im Hero links über der Seitenleiste, damit „Für dich“ sichtbar bleibt; am Handy lädt das
  Rechner-Bild nicht mehr (`<picture>`). Bereichs-Screenshots als lesbarer Ausschnitt (3:2, ohne Seitenleiste,
  1,7-fach). Neuer E2E-Test `e2e/landing-journey.spec.ts` (Erstbesuch Handy/Rechner, nur Tastatur, tote Links,
  WCAG 2.2, Skript-Einschleusung über die Adresse, keine fremden Server). Produktions-Build ohne Inline-Skript
  (`inlineCritical: false`), geprüft unter strenger CSP.
- **Von der Idee zur Demo (22.10.2026, Nutzerwunsch):** Leitsatz „nicht schöner, sondern besser
  zur Demo führen“. Hauptaktion überall die Demo: Hero dunkel „Ohne Anmeldung ausprobieren“, Rand „Konto erstellen“,
  darunter „Die Demo startet sofort mit Beispieldaten. Kein Konto, nichts wird gespeichert.“; Kopf der Startseite und
  der Unterseiten „Demo ansehen“ statt „Konto erstellen“ (Anmelden bleibt). Absatz nach dem Hero sagt zuerst das
  Warum: „Budget, Termine, Einkauf und Reisen liegen meist in vier Apps, die nichts voneinander wissen.“ und dann die
  Antwort. Nach der Verknüpfungs-Probe ein nächster Schritt „Das war ein Ausschnitt … In der Demo weitermachen“
  (heller Knopf auf Deep Forest, Rahmen 20 px). Symbol-Links in `index.html` mit `?v=2`, damit Browser gespeicherte
  alte Symbole (Angular-Standard) neu laden.
- **Fuß und Rechtsseiten neu (22.10.2026, Nutzerwunsch):** `shared/tile-footer` ist jetzt ein
  klassischer Fuß auf Porcelain mit feiner Linie oben: links Marke (`app-brand`, 22 px) mit Leitsatz (voll: plus ein
  Satz), rechts Link-Spalten, unten eine ©-Leiste („Läuft im Browser …“). `full` (Startseite): Bereiche (Bereichsfarbe
  nur als 8-px-Punkt, Links in die Demo), Produkt (Demo ansehen, Anmelden, Konto erstellen), Rechtliches. `compact`
  (Rechtsseiten, 404): Marke + Rechtliches in einer Reihe, aktuelle Seite unterstrichen und `aria-current`. Entfallen:
  großer Schriftzug, Kacheln, Einladung. Farben über `--tf-ink/-muted/-line/-ground/-hover` und `--tf-finance …`
  (von der Seite geerbt; der Host setzt keine eigenen Werte). Rechtsseiten (`shared/legal-page`, alle vier):
  links „Rechtliche Seiten“ (Navigation zwischen den vier Seiten, aktuelle Seite als weiße Karte), rechts der Text
  auf einem weißen Blatt (Radius 28, Rand `--line`, Innenabstand bis 64 px), H1 650 bis 56 px, H2 650, Lesespalte
  68 ch, Links Evergreen, Platzhalter-Hinweis in Ocker-Tönung (Radius 20, ohne Emoji); ≤ 900 px Navigation als
  wischbare Pillen über dem Blatt (aktuelle Seite in Forest). Kopf der Unterseiten mit feiner Linie wie die Startseite.
  axe (2.2 AA + Best Practice) ohne Befund auf /, den vier Rechtsseiten und 404, 1440 und 390 px.
  Testversion (11.11.2026): `LegalPage` hat den Eingang `demo` (Standard `DEMO_ONLY`); im Pages-Build zeigen die vier
  Seiten Demo-Texte (`@if (demo)`), der Hinweis wird zu `.legal-warning--demo` („Gilt für die Testversion“, Sage
  `--ground-2`, Info-Kreis in `--ink-soft`). Kontakt-Links aus `shared/legal-page/demo-contact.ts`. Platzhalter der
  App-Fassung unverändert (dort „§ 18 Abs. 2 MStV“ statt veraltet „§ 55 RStV“, „Kompass“ → „4inOne“).
- **Demo-Verknüpfungen aus echten Daten (14.11.2026):** `DemoConnectionsApi` liest die Demo-Bereiche über den
  Injector, alle 9 Paare (`DEMO_PAIRS`), Regel `connection-relevance.ts`. `DEMO_PROVIDERS` in `demo.routes.ts` (auch für
  Tests). `app-connections` nimmt in der Demo auch Text-Kennungen an. Keine optische Änderung.
- **Verknüpfen nach Sinn (13.11.2026):** `connections/relevance.py` (`fits()` je Arten-Paar: gleiches Stichwort,
  Reisebezug, Datum in/kurz vor der Reise, Haushaltsaufgaben, die zuhause weiterlaufen); `candidates_for` liefert
  `fits` und sortiert Passendes zuerst. `app-connections`: `shownCandidates()`/`hiddenCandidates()`. Demo-Bestand mit
  allen vier Demo-Sparzielen, `demoFits()`. Organisation `calendarHint()` nur noch bei gesperrter Auswahl; `.ev--label .ev__text` und `.week__ev--start > b` mit `pointer-events: none`.
- **Stornofrist sichtbar (13.11.2026):** Reise-Dialog `form-step` 4 „Unterkunft“, Datumsfeld mit `[max]` = erster
  Reisetag und `cancellationError()`; `TripOverview` Ausgabe `editTrip`; abgeleiteter Eintrag `trip-cancel:<id>`
  (Art `TRIP_CALENDAR`). `PlaceInput` in `reisen.ts` nicht mehr importiert (vorerst).
- **Reise im Kalender erkennbar (13.11.2026):** `DerivedCalendarItem.location/context`; `derivedLabel()` in
  `organisation.ts`; `isTrip()` + `.ev__icon` (Monat/Woche), Woche `.week__ev--start` mit `--span` und `z-index: 2`.
- **Tagesablauf im Kalender (13.11.2026):** `AutoKind` `TRIP_ITINERARY` (Backend `connections/auto_links.py`,
  `DerivedItem` mit `starts_at/ends_at`, `all_day: false`); Frontend `derivedEvent()` baut daraus Termine mit Uhrzeit,
  `DERIVED_LABEL` „Aus Reisen › Ablauf“, `.is-trip` auch für diese Art. `app-auto-links` neu mit Eingang `defaultOn`
  (nur bei neuer Quelle). `app-modal-form` Ausgaben ohne eigenes `submitLabel`.
- **Organisation › mehrtägige Termine (13.11.2026):** `spanPart(e, day)` (`organisation-logic.ts`) liefert Anfang/Mitte/
  Ende; `.ev--span/--start/--mid/--end` (Monat, Rand-Überstand −7 px), `.ev--label` mit `--span` (Tage bis Sonntag/Ende),
  `.ev--quiet` für Fortsetzungen, `.week__ev--span…` (Woche), `.cell__bar` (Monat ≤ 760 px), `.is-trip` setzt `--cat`
  auf `--travel-accent`. Korrigiert: `onDay` zählt bei ganztägigen Terminen den letzten Tag mit (Ende = Mitternacht des
  letzten Tags, wie Backend `organisation/services.py`) – vorher fehlte er im Kalender. `eventsOn` sortiert bei gleichem
  Beginn den längeren Termin zuerst.
- **Reisen › Ablauf und Stornofrist (12.11.2026):** neuer Reiter `ablauf` (`trip-itinerary.ts/.html/.scss`, Logik
  `itinerary()`, `eventTime()`, `eventIcon()`, `cancellationInfo()` in `reisen-logic.ts`). Raster Tag | Einträge
  (`minmax(130px,170px) 1fr`), Eintrag `7.5rem 36px 1fr auto`; ≤ 640 px Datum über den Einträgen, Uhrzeit über dem
  Titel. Dialog „Programmpunkt“ mit Art-Chips (`.category-chip`, `--c: var(--travel-accent)`). Fünf Reiter passen am
  Handy (375 px) ohne Scrollen. Bordkarte: Marken-Typ `tab: null` = reine Info (Span statt Knopf), `track c.text`.
- **„Soft Editorial“ – neue Farbidentität für App und Website (22.10.2026, Nutzerwahl):** Neutral
  Porcelain `#F7F7F4`, Weiß, Sage `#ECEFEA`, Deep Forest `#172523` (Text, Knöpfe, dunkle Bänder), Linien `#DDE1DA`,
  Sekundärtext `#4F5D59`, Feldrand `#879189`; Akzent Evergreen `#17694F` (Links/Fortschritt, nicht Knöpfe). Bereichs-
  farben gedeckt (Finanzen `#17694F`, Haushalt `#B75369`, Organisation `#9A641E`, Reisen `#3D6B9A`) mit dunklerer
  Textvariante für Haushalt (`#9E4559`) und Organisation (`#85561A`), weil die Vorgaben als kleine Schrift auf
  Porcelain/Sage unter 4,5:1 lagen; Organisation trägt jetzt weißes Symbol (5,0:1). Logo behält seine Farben.
  Schrift bleibt Schibsted Grotesk (Nutzerentscheid gegen Manrope/Newsreader); Website-Überschriften 650 statt 700.
  Umgesetzt über die Tokens (`styles.css`, `shared/styles/_editorial.scss`) und eine Zuordnung aller festen Werte
  (App-Rahmen, Login, Onboarding, Dashboard, Fuß, Beam-Farben). Landing-Farbverteilung: Kopf/Hero Porcelain ·
  Bereiche weißes Band (Panel in Porcelain) · Verknüpfungs-Probe auf Deep Forest (weiße Quellkarte, Texte `#FFF` /
  `#C3CEC9` 9,8:1, Bereichswort in Tönung, Knöpfe weiß bzw. weiß umrandet, Fokus weiß) · Privatsphäre Sage · Fragen
  Weiß · Abschluss Deep Forest · Fuß Porcelain mit weißen Bereichs-Karten (Radius 24, Farbpunkt statt Pastellfläche).
  Website-Radius-Token 20. Produkt-Screenshots neu aufgenommen. Nicht übernommen: „So funktioniert's“ (entfernt) und
  eine Packlisten-Automatik (gibt es nicht). Prüfung: axe 2.2 AA ohne Verstöße auf /, /login, /registrieren,
  /impressum, /demo, /demo/finanzen, /demo/haushalt (1440/390); auf /demo/organisation und /demo/reisen bestehender
  Verstoß 2.5.3 (Label in Name) bei Kalenderzellen/Reisezeilen — als eigene Aufgabe angelegt.
- **Ein Abschluss, Reise als Ablauf, WCAG-2.2-Prüfung (22.10.2026):** Der Kachel-Fuß (`shared/
  tile-footer`, Variante `full`) hat keine eigene Einladung mehr („Fang mit einem Bereich an“ doppelte das Tinten-Band);
  ihr Gedanke steht jetzt im Abschluss-Band („… Danach fängst du mit einem Bereich an und verknüpfst später, was
  zusammengehört.“). Die vier Bereichs-Kacheln stehen in einer Reihe (≤ 900 px 2 × 2). Verknüpfungs-Probe, Beispiel
  „Eine Reise“: zuerst „Neue Reise“ mit Ziel und Zeitraum und dem Knopf „Reise anlegen“, rechts ein gestrichelter
  Hinweis; nach dem Anlegen erscheinen die Vorschläge (nur Verschiebung, keine Deckkraft), der Fokus springt auf
  „Vorschläge“; „Zurücksetzen“ beginnt wieder beim Anlegen. Nur echte Vorschlagsarten (Aufgabe, Termin, Sparziel),
  keine erfundene Packlisten-Automatik. Prüfung WCAG 2.2 AA (axe mit 2.2-Regeln auf /, /impressum, /datenschutz bei
  1440 und 390 px; Tastatur-Durchgang): keine Verstöße; alle Fokus-Stopps mit sichtbarem Rahmen; fokussierbare
  Elemente der Startseite mit `scroll-margin-top: 96px`, damit der Fokus nie unter dem festen Kopf liegt (2.4.11).
- **Landingpage: Verknüpfen zum Ausprobieren (22.10.2026):** Nach externer Kritik („noch wenig echte
  Produktinteraktion“, „Mehrwert nur teilweise sofort erkennbar“) ersetzt eine Verknüpfungs-Probe die statische
  Beispielkette und rückt direkt hinter den Aussage-Absatz (vor die Bereiche; Navigation „Ausprobieren“). Drei
  Beispiele (Reise · Gerät · Vertrag, `aria-pressed`-Auswahl); je Ausgangseintrag Vorschläge mit Begründung in
  Alltagssprache nach den echten Engine-Regeln (Reise ↔ Aufgabe/Termin/Sparziel, Gerät ↔ Sparziel, Vertrag ↔
  Aufgabe) und je ein „Bewusst nicht vorgeschlagen“ mit Grund („Die Zeit allein reicht nie“, „Nur der Anbieter ist
  gleich“). „Verknüpfen“ zieht eine Lichtlinie (`app-animated-beam`, 2 Impulse) zum Ziel, füllt dessen Farbfeld,
  der Zähler „Verknüpft mit N Einträgen“ ist `aria-live`; „Nicht relevant“ nimmt den Vorschlag weg; „Zurücksetzen“.
  Knopfname folgt dem sichtbaren Wort („Verknüpfen: …“ / „Verknüpft: …, Verbindung lösen“, kein doppeltes
  `aria-pressed`). Nur auf der Seite, nichts gespeichert, so beschriftet. Form bewusst anders als die Bereichs-Karte:
  eigenes Band `--ground-2` über die volle Breite, Quelle als Block mit 14-px-Ecken, Vorschläge als Liste mit Linien,
  „nicht vorgeschlagen“ gestrichelt. Überschrift Bereiche spezifischer: „Jeder Bereich hat seine eigenen Werkzeuge.“
- **Landingpage „Produkt im Mittelpunkt“ (22.10.2026, Nutzerwahl):** Neu aufgebaut nach dem Muster
  hochwertiger SaaS-Seiten (verglichen: Linear, Mercury, Things): das echte Produkt statt Deko. Hero zentriert: H1 „Dein
  ganzer Alltag auf einer Startseite.“, ein Satz, „Konto erstellen“ (Tinte) + „Ohne Anmeldung ausprobieren“ (Rand),
  Hinweis „Läuft im Browser …“. Darunter die Bühne: echtes Dashboard (Aufnahme der Demo, 1440 × 900, @2x) im
  Passepartout (8 px `--ground-2`, Radius 22, weicher Schatten) und das Handy (Tinten-Rahmen, Radius 36) davor; am
  Handy nur das Handy-Bild. Dann ein großer Aussage-Absatz (erster Satz Tinte, Rest `#6F6A5F`, 5,1:1), die vier Bereiche
  als Umschalter (WAI-ARIA-Tabs mit Pfeiltasten; Reiter-Pillen mit Farbfeld, Panel mit drei Fähigkeiten als Liste mit
  Linien und echtem Screenshot; am Handy lesbarer Ausschnitt hinter der Seitenleiste), „Ein Eintrag führt zum
  nächsten.“ mit `app-link-chain`, „Privat ist die Grundeinstellung.“ als Faktenliste, Fragen, Abschluss-Band in Tinte.
  Entfernt: Unschärfe-Einblendung, Satzfetzen-Überschriften, Karten mit Häkchen-Listen, 1-2-3-Schritte, dunkler
  Schalter-Block, `motion`-Animationen (Seite 29,6 kB). Einzige Bewegung: das Produktbild setzt sich beim Laden (nur
  transform, nicht bei reduzierter Bewegung). Screenshots in `public/images/landing` neu aus der Demo erzeugt.
- **Dashboard-Neugestaltung und Finanzen-Übersicht (27.10.2026, Nutzerwahl „komplett neu“, „Noch verfügbar“,
  „Ausgabenkurve“):** Kein Kachel-Band mehr. Raster `.board` (Desktop 1.5fr | 1fr, ab 1100 px eine Spalte):
  `today money` / `foryou soon`; die Finanzen-Karte rückt 44 px ein, damit ihre Oberkante mit der Karte „Heute“
  abschließt. „Heute“ als Zeitleiste: feine Schiene (2 px `--border-subtle`) durch die Bereichsfelder einer Gruppe
  (erst ab zwei Zeilen), „Als Nächstes“ mit weißer Marke „in 40 Min.“ in Bereichsfarbe; der Zähler neben „Heute“
  entfällt (steht schon unter der Begrüßung). Finanzen-Karte: Label „Noch verfügbar im Oktober · von 3.000,00 €“,
  Zahl 2,75 rem Display, Tagessatz, kompakte Kurve (64 px), „Letzte Transaktionen“ (3). Demnächst als zwei Kacheln
  (Reise: Zeitraum „8.–10. Nov.“, Titel 22 px Display, Countdown/Aufgaben, Packbalken in Reisefarbe; Haushalt:
  Frist „8. Nov.“, Einkaufszeile). Seitenleiste ohne „Alles Wichtige …“-Karte.
  **Ausgabenkurve** `shared/spend-curve` (`app-spend-curve`, Daten `spend-curve-data.ts`): aufsummierte Ausgaben des
  Monats bis heute (nur Typ EXPENSE), gestrichelt das gleichmäßige Budget-Tempo, Punkt für heute; SVG ohne Bibliothek
  (`preserveAspectRatio="none"` + `non-scaling-stroke`, Punkte als HTML). Kompakt = Bild mit `aria-label`; voll =
  `role="slider"` (← → Pos1 Ende, Maus/Finger), Zeile darüber „Heute · 1.272,71 € ausgegeben · Plan: 2.613 €“, Achse
  „1. Okt. … 31. Okt.“. Fläche Finanzgrün 11 %, keine Verläufe.
  **Finanzen › Übersicht:** Zeitraum-Umschalter und Monatsauswahl in einer Zeile; darunter eine weiße Kopf-Karte:
  „Noch verfügbar im Oktober 2026“, Zahl `clamp(2.5rem, …, 3.5rem)` Display, „etwa 140 € pro Tag für die restlichen
  5 Tage · 23 % von 3.000 €“, rechts drei ruhige Werte mit Punkt (Einnahmen grün, Ausgaben rot, Gespart blau) durch
  Haarlinien getrennt, darunter die Kurve (200 px, Handy 150 px). Wochenbalken entfallen in der Übersicht.
  „Letzte Transaktionen“ nach Tagen gruppiert („Heute“, „Gestern“, sonst „Samstag, 24. Oktober“, mit Tagessumme),
  Ausgaben in Tinte, Einnahmen grün. „Budgets“, „Sparziele“ und „Gut zu wissen“ (statt „Intelligente Hinweise“, ohne
  Glühbirne und ohne „Weiter so!“) rechts. Klassen `.kpis/.kpi/.kpi--danger` bleiben am Kopf (Tests, Meldungen).
  Stile seit 06.11.2026 in `finanzen/overview/finance-overview-tab.scss` (siehe „Finanzen › Ordnerstruktur“).
  **Ganzer Finanzen-Bereich (27.10.2026, zweiter Schritt):** eine Formsprache für alle Ansichten, gemeinsame Teile in
  `finanzen/shared/_fin-look.scss` (in den Reitern als Stil-Datei, in `overview/finance-period.scss` per `@use`, weil alle
  Komponenten ihre Stile kapseln). **Steuerzeile:** Segment-Umschalter `.seg` (Sage-Spur `--surface-pressed`, Radius 12, gewähltes Feld
  weiß mit feinem Schatten, 40 px hoch; Handy volle Breite, gleich breite Felder) links, Datumsauswahl rechts in
  derselben Zeile; unter 900 px darunter. Gilt für Zeitraum (Tag · Woche · Monat · Benutzerdefiniert) und Art
  (Alle · Ausgaben · Einnahmen · Geplant). Die Bereichs-Reiter bleiben wie in allen Bereichen. **Kopfkarte**
  `.kpis.fin-hero` (weiß, Radius 16, 28/32 px, Handy 20/18): eine große Zahl (`.fin-hero__value`, Display
  `clamp(2.25rem, …, 3.5rem)`, nie umbrechend) mit Label und Unterzeile, rechts bzw. darunter ruhige Werte
  (`.hero-stats`, Haarlinien, farbiger Punkt: Einnahmen grün, Ausgaben rot, Gespart blau, Fixkosten Tinte, Variable
  hell). Je Ansicht: Übersicht „Noch verfügbar“ + Kurve; Tag/Woche/Zeitraum „Ausgaben“ + Einnahmen/Gespart;
  Transaktionen › Alle „Ausgaben im …“ + Einnahmen/Gespart; › Ausgaben „Gesamtausgaben“ + Fixkosten/Variable und ein
  geteilter Balken fest/variabel; Budgets links „Monatsbudget“ (Gültigkeit, „Budget ändern“) | rechts „Noch
  verfügbar“ mit Balken, Tagessatz und Aufschlüsselung (unter 900 px untereinander); Sparziele „Gespart im …“ +
  Aktive Sparziele/Sparrate. Alte Kachel-Klassen `.kpis/.kpi/.kpi__label/.kpi--danger` bleiben als Haken für Tests
  und Meldungen. **Listen** überall nach Tagen gruppiert (`.day-head`: „Heute“, „Gestern“, sonst „Samstag,
  24. Oktober“, rechts Tagessumme; ein Tag nur mit Geplantem zeigt „geplant“), Zeile ohne Datum; Ausgaben in Tinte,
  Einnahmen grün. „Letzte Ausgaben“ entfällt in Transaktionen › Ausgaben (stand doppelt zur vollständigen Liste);
  dort Kategorien | Vergleich nebeneinander, Wiederkehrende darunter. **Sparziele als Karten** (`.goal-cards`, 2
  Spalten, Handy 1; der Abschnitt selbst ist keine Karte): Symbol · Name/Status · Prozent groß, Balken, „1.800 € von
  3.000 €“, Fuß mit Zieltermin | Sparrate „300 € / Monat“ + Zeitraum. „Insights & Hinweise“ heißt „Gut zu wissen“.
  Perioden-Liste mit Kategorie-Feld statt Punkt.
  **Nachschliff (29.10.2026):** Bereichs-Reiter bis 360 px mit 12 px Schrift und schmaleren Rändern (`domain-layout.scss`),
  bis 340 px 2 px Innenabstand — alle vier Reiter in allen Bereichen ohne Wischen auch bei 320 px. „Monat im Blick“
  (Tag) und Monatsbudget (Zeitraum) als Zeilen mit Haarlinie statt getönter Kästchen. Beträge der Finanzen mit
  geschütztem Leerzeichen vor „€“. Kurve: Zeile „Budget anteilig: 2.806 €“ statt „Plan“, darunter eine Legende
  („Ausgaben, aufsummiert“ durchgezogen · „Budget gleichmäßig auf den Monat verteilt“ gestrichelt). Dialoge:
  Beträge beim Bearbeiten deutsch („6,50“, „3.000,00“ statt „6.50“/„3000.00“); Betrag im Transaktions-Dialog als
  Mittelpunkt (64 px Feld, 34 px Display, fett, Einnahme grün).
  Verständlichkeit: Vormonatsvergleich in Worten („12 % mehr als im September“, „50 € weniger als im September“,
  „so viel wie im …“) statt „+ 12 % zu September“ (`finance-tabs.ts › deltaLabel/deltaEuro`); Anteil „23 % deines
  Budgets von 3.000 €“.
  Sprung zurück („Aktueller Monat/Woche/Tag“, `.to-today`) steht am Rechner links neben der Datumsauswahl und kommt in
  der Tab-Reihenfolge davor; am Handy in eigener Zeile darunter, volle Breite bündig mit dem Datumsfeld (Text mittig, umrandet), damit die Auswahl nicht springt, wenn er
  erscheint. Gilt in Übersicht, Zeiträumen, Transaktionen, Budgets und Sparzielen.
  Hauptaktion je Reiter (Kopf am Rechner, schwebender Knopf am Handy, `headAction()`): Übersicht und Transaktionen
  „Transaktion“ (Name „Transaktion erfassen“); Budgets „Budget“ mit Stift („Budget ändern“) bzw. Plus („Budget
  festlegen“) — der kleine Link „Budget ändern“ in der Kopfkarte und der Knopf im leeren Budget-Monat entfallen
  (genau ein Einstieg); Sparziele „Sparziel“ („Sparziel erstellen“) — der zweite Knopf über der Liste entfällt. Der
  Abstandhalter des Handy-Knopfs hält das Seitenende frei.
  **Verständlichkeit für neue Nutzer (29.10.2026):** (1) Übersicht eines neuen Kontos: Karte „So startest du mit
  Finanzen“ (`.start`, „0 von 3 erledigt“) mit drei Schritten — Monatsbudget festlegen · Erste Ausgabe erfassen (darunter
  „Oder Kontoauszug als CSV importieren“) · Sparziel anlegen (optional); Kreis mit Nummer, erledigt grün mit Haken und
  durchgestrichen; jeder Schritt öffnet den vorhandenen Dialog. Sichtbar, solange Budget oder Transaktion fehlen; im
  Monat ohne Budget und ohne Daten ersetzt sie Kopfkarte, Kurve und leere Karten (keine Wand aus Nullen, kein zweiter
  Startknopf). (2) Unter der großen Zahl aufklappbar „Wie entsteht diese Zahl?“ (`details.calc`): Monatsbudget −
  ausgegeben − Geplant − Sparbeiträge = Noch verfügbar. (3) Begriffe erklärt, wo sie stehen: `shared/term-hint`
  (`app-term-hint`, (i) 18 px, Klickfläche 44 px, Toggletip statt Hover, Blase Tinte/weiß, bleibt per Messung 16 px im
  Bild, Escape/Klick daneben schließt, Text als Statusmeldung) bei Geplant, Sparbeiträge (Übersicht + Budgets) und
  Fixkosten; unter „Geplant“ in Transaktionen ein Erklärsatz über der Liste.
  **Monatsrückblick und Fixkosten (29.10.2026):** (4) In den ersten sieben Tagen des laufenden Monats (nicht bei
  sichtbarer Startliste) steht oben in der Übersicht `section.review` „Dein {Vormonat} im Rückblick“: Zeile mit
  Ausgaben und Vergleich zum Monat davor in Worten (`deltaLabel`), „Wofür am meisten“ mit den drei größten Kategorien
  (Name + Betrag, darunter 6-px-Balken relativ zur größten in `categoryColor`), Fakten mit Symbol: für Sparziele
  zurückgelegt (netto), bis zu zwei Ziele mit Einzahlung, Budget gehalten oder überschritten (aus `summary` des
  Vormonats). Daten nur aus echten Buchungen (`monthReview()` in `finance-tabs.ts`). „Ausblenden“ (Textknopf rechts
  oben) speichert den Monat in `localStorage` (`4io-finanzen-rueckblick-ausgeblendet`). (5) Transaktionen › Ausgaben:
  `section.fixed-costs` ersetzt „Wiederkehrende Ausgaben“ (Überschrift-ID `rec-exp-h` bleibt): „Fixkosten“ mit
  (i), Summe pro Monat groß (Display, `<small>pro Monat</small>`), darunter „Aufs Jahr gerechnet …“ fett und Anteil an
  den Ausgaben des Monats, dann die wiederkehrenden Posten als Zeilen mit Kachel. Styles: seit 06.11.2026 je Reiter
  (`overview/` Start und Rückblick, `transactions/` Fixkosten, gemeinsame Teile in `shared/finance-blocks*.scss`).
  **„Dein Jahr“ im Budgets-Reiter (29.10.2026):** `finanzen/budgets/budget-year-card.{ts,html,scss}` ersetzt die Zeile
  „Jahresplanung · Jahresübersicht ansehen“ (die bleibt nur als Rückfall, solange `summary/year/` lädt oder fehlt). Karte
  weiß, Rand `--border-subtle`, Radius 16, Abstand oben 24; Raster `1fr auto`. Kopf: H2 „Dein Jahr {Jahr}“ (Display
  22/20 px), rechts Textknopf „Budgets je Monat“ (Stift) → bestehender Dialog (`app-budget-year`, Titel jetzt „Budgets je
  Monat · {Jahr}“); ≤ 760 px wird der Knopf zur Fußzeile der Karte (volle Breite, Trennlinie oben, 44 px). Darunter die
  große Zahl (Ausgaben bisher, Display 30/26 px) mit „ausgegeben von {€} Jahresbudget“ (sekundär) und das Urteil mit
  Symbol (Haken grün, bei Überschreitung (i) rot): „In X von Y Monaten im Budget geblieben“; bewertet werden nur
  abgeschlossene Monate mit Budget und Buchungen. Zwölf Säulen als Knöpfe in EINER Reihe (Höhe 132/104 px): getönte
  Säule (Finanzgrün 11 %) = Monatsbudget, Füllung = Ausgaben, beide relativ zur höchsten Säule; gehalten
  `--finance-accent`, überschritten `--fin-red`, laufender Monat Finanzgrün 45 %, ohne Budget Grau 45 %, künftige nur
  Tönung; 2-px-Grundlinie für leere Monate. Monatsname darunter (Jan…Dez; ≤ 520 px Anfangsbuchstabe; laufender Monat
  fett, angezeigter Monat fett + unterstrichen, `aria-current`). Jede Säule mit `aria-label` in Worten (Monat, ausgegeben,
  Budget, Zustand bzw. „um … überschritten“). Antippen: Monat wechseln, Fokus bleibt, Sprung zur Budget-Kopfkarte
  (`scroll-margin-top` 160/230 px, ohne Animation bei reduzierter Bewegung). Zielgröße: ab 360 px ≥ 24 px breit; bei
  320 px gilt die WCAG-2.2-Ausnahme „gleichwertige Bedienung“ (Monatsauswahl, Dialog). Füllung wächst einmal von unten
  (520 ms, aus bei `prefers-reduced-motion`). Legende: Im Budget · Überschritten · Laufender Monat · Monatsbudget
  (· Ohne Budget), Handy 2 × 2.
  Dialog „Budgets je Monat“ (`budget-timeline.scss`): Kopf (Titel, Zahl, Jahr) bleibt stehen, nur die Monatsliste scrollt
  (`overflow-y: auto`, `overscroll-behavior: contain`, 4 px seitliche Luft für den Fokusrahmen) — das Panel ist in der
  Höhe begrenzt, vorher waren am Handy September–Dezember nicht erreichbar. Beim Öffnen (`openYear()`) wird der
  angezeigte Monat in den sichtbaren Teil gescrollt. ≤ 640 px: „Jahr“ steht neben der Auswahl statt darüber.
  **UI-Taste-Durchgang Finanzen (30.10.2026):** (a) Ausgabenkurve (Finanzen + Startseite): Tempo-Linie = Monatsbudget
  minus Sparbeiträge (`spendingBudget()` in `shared/spend-curve/spend-curve-data.ts`), dieselbe Grundlage wie „Noch
  verfügbar“; Legende „Budget für Ausgaben (ohne Sparbeiträge), gleichmäßig verteilt“. (b) „Kontoauszug importieren“
  ist ein Textlink mit Symbol im Kopf der Transaktionsliste (`.all-rows__head .tx-import`), nicht mehr in der
  Steuerleiste. (c) „Budgetstatus“ erscheint nur bei echter Überschreitung (Monatsbudget oder Kategorie über Limit);
  „fast ausgeschöpft“ zeigt allein die Kategorie-Zeile. „Gut zu wissen“: Übersicht ohne „Monatsbudget prüfen“ und
  „liegt im Plan“ (`overviewHints`), Sparziele nur „fast erreicht“ und „langfristig“ (`goalHints`). (d) Datumsangaben im
  Text mit einer Monatskurzform `ABBR` (Jan., Feb., März, Apr., Mai, Juni, Juli, Aug., Sept., Okt., Nov., Dez.):
  „01. Okt. 2026“, „Ziel Juli 2027“, Sparziel-Zeitraum „Ab Apr. 2026“, „Juli – Sept. 2031“, „Nur Okt. 2026“.
  Buchungen und Tagessummen in der Zeitraum-Ansicht immer mit Cent (`exact()`), wie in der Transaktionsliste.
  (e) Budget-Dialog: Lösch-Hinweis als leise `.impact-note` (Symbol, 13 px, sekundär) statt großer Absatz; der gesperrte
  Startmonat erklärt sich („Er lässt sich nicht ändern – …“). (f) Kategorie-Budgets ≤ 520 px: Name und „… verfügbar“
  immer in einer Zeile (Name kürzt mit …), kein Pfeil — jede Zeile gleich gebaut.
  (g) „… weitere anzeigen“ überall gleich: `.show-more` in `_fin-look.scss` (volle Breite, 44 px, weiß, Rand
  `--border-subtle`, Text Akzent 600; Hover `--surface-hover`) — Transaktionen und Zeitraum-Ansicht. (h) Ausgaben:
  Vergleichskarte heißt „Die letzten sechs Monate“ und zeigt nur den Verlauf (Betrag/Vergleich stehen in der
  Kopfkarte); Ringdiagramm ≤ 520 px 140 px. Fixkosten-Zeilen kurz: „✓ Gebucht“, „Noch offen · im Budget eingeplant“,
  „Nächste: …“ („monatlich“ sagt die Überschrift). (i) Untertitel im Kopf je Reiter (`intro()`). (j) Benutzerdefinierter
  Zeitraum: Datum nur einmal unter der großen Zahl. (k) Filter und Suche der Transaktionsliste nur, wenn es Einträge gibt
  oder gefiltert wird; leeres „Geplant“ sagt nur „Für … ist nichts geplant.“ (Erklärung steht darüber). (l) „Bereits
  gespart“ startet mit „0,00“. (m) Übersicht Desktop: links Letzte Transaktionen + Gut zu wissen, rechts Budgets +
  Sparziele (Spalten etwa gleich lang; am Handy folgt „Gut zu wissen“ direkt auf die Transaktionen).
  **Rechenprüfung (30.10.2026):** (n) Vormonatsvergleich fair: im laufenden Monat bis heute gegen den Vormonat bis
  zum selben Tag (`compareDay`, `monthTotalUntil`, `savedUntil`), Text kurz „… als bis 30. Sept.“ (am Monatsende gekappt);
  abgeschlossene Monate ganz gegen ganz. (o) „Ausgaben“ in Übersicht und „Alle Transaktionen“ = bis heute gebucht
  (`spentNow`, wie „Bereits ausgegeben“); künftig datierte stehen unter „Geplant“. (p) „Fast erreicht“: höchstens 15 %
  fehlen, bei kleinen Zielen höchstens 100 € UND 25 %; „im Plan“ beachtet das Ende des Sparzeitraums. (q) „Dein Jahr“:
  Sparbeiträge als blauer Abschnitt auf der Ausgaben-Füllung (`--fin-blue`, Legende „Für Sparziele“), Kopf „… ausgegeben,
  dazu … für Sparziele – von … Jahresbudget“; ein Monat zählt nur mit echten Buchungen oder Einzahlungen als bewertet.
  (r) Tagessatz auf der Startseite abgerundet wie im Finanzen-Tab. Backend: Warnungen (`available_for_month`) ziehen
  geplante wiederkehrende Ausgaben ab wie `month_figures`.
  **Abschluss (30.10.2026):** (s) Reiter 761–1000 px ohne Symbole (Padding 12 px), damit alle vier in die Zeile passen.
  (t) Kein lesbarer Text unter 13 px: Hinweise unter Kennzahlen am Handy `--fs-meta`, Monatsnamen in „Dein Jahr“ und
  „Ab Apr. 2026“ 13 px. (u) Eine Monatskurzform `MONTH_ABBR` in `shared/form/date-utils.ts` (auch für die Kurvenachse);
  `MONTH_SHORT` (drei Buchstaben) bleibt für Diagrammachsen. (v) Ausgaben-Ansicht: große Zahl, fest/variabel und Anteile
  aus bis heute gebuchten Ausgaben (`expenseBooked`, wie der Vergleich). (w) Toter Code entfernt
  (`finance-settings.ts/.scss`, `finanzen/budget/`).
  Backend: `GET finanzen/private/summary/year/?year=JJJJ` (nur lesend, nur eigene Daten, Jahr 2000–2100) liefert je Monat
  budget, expenses, saved, available, has_data, state (past/current/future) — bis zum laufenden Monat über
  `month_figures`, damit Jahr und Monat nie verschieden urteilen; künftige Monate nur mit Budget.
- **Dashboard „Kommandozentrale“ (22.10.2026, abgelöst am 27.10.2026):** SaaS-typischer Aufbau aus echten
  Daten. Unter der Begrüßung ein Überblick-Band mit vier Kacheln (Desktop 4 Spalten, ab 1100 px 2 × 2): Heute
  („N offen“, überfällig in Rot), Budget (Zahl + Balken in Finanzgrün), Reise und Haushalt (aus „Demnächst“; fehlt
  eines, steht dort ein ehrlicher Leerzustand mit Weg in den Bereich). Kachel: weiß, Rand `--border-subtle`, Radius 16,
  Kopf mit 30-px-Farbfeld + Bereichswort, Wert 26 px Display (Handy 20 px, umbrechend mit Silbentrennung), eine
  Zeile Kontext; Hover: Rand `--border-strong`, weicher Schatten, −1 px. Darunter links der Tagesplan, rechts Für dich
  (Verknüpfung mit Lichtlinie, 3 Impulse) und neu „Letzte Buchungen“ (höchstens vier echte Buchungen des Monats:
  Notiz oder Kategorie, Kategorie · Datum, Betrag mit Vorzeichen, Einnahmen in Finanzgrün; Link „Alle“).
  `.budget`/`.soon` bleiben als Bausteine (per `display: contents` im Raster des Bandes); der Datumsblock entfällt.
- **Seitenleiste mit Farbfeldern (22.10.2026, Nutzerwunsch):** Linke Navigation wie Tableiste und
  Startseite: Symbole in Bereichsfarbe in einer gleichen 36-px-Box, der aktive Eintrag als Farbfeld
  (`--nav-fill`/`--nav-on`, Amber mit Tinte) auf warmer Fläche `--surface-pressed`, Text Tinte 600. Symbolformen,
  Reihenfolge und Einträge unverändert. Unter 800 px Fensterhöhe entfällt der Deko-Hinweis „Alles Wichtige …“.
- **App in der Website-Farbwelt, Kopfzeile ohne Suche, Dashboard neu (21.10.2026):**
  Zentrale Tokens (`styles.css`): `--surface-app #FAF8F4`, Hover `#F6F3EC`, Press/Sunken `#F2EEE6`,
  `--text-primary #121826`, `--text-secondary #4A5263`, Linien `#ECE6DB` / `#E6E0D4` / `#C4BCAE`,
  `--brand-primary #121826` (Tinte statt Markenblau; `--brand-primary-hover #252E44`), `--accent*` und Lavendel-Altnamen
  zeigen darauf. Neu: Flächenfarben `--finance-fill #0F9D6B`, `--household-fill #E04F78`, `--organization-fill
  #E3961A`, `--travel-fill #3B6FE0` mit `--*-on` (Weiß; Amber trägt Tinte). Status (`--info` Blau, `--error` Rot)
  unverändert. **Ziffern:** Schibsted Grotesk setzt mit `tabular-nums` auch `. , :` auf Ziffernbreite („21 .
  Oktober“, „16 : 00“) — eine globale Regel hält Ziffern überall proportional. `layout/app-shell.scss`: alle festen
  Blau-/Grautöne auf die warme Palette; Suchfeld und ⌘K ausgeblendet (`searchEnabled = false`, Logik über `?q=`
  bleibt); Kopfzeile und Tableiste deckend statt Weichzeichner (Scroll-Leistung am Handy); Tableiste: Symbole in
  Bereichsfarbe, aktiver Reiter als Farbfeld (`--nav-fill`/`--nav-on`), gleiche Box für alle Symbole (kein Springen).
  Seitenleiste bleibt in Aufbau und Symbolen. Dashboard: Begrüßung in der Display-Schrift (40 px, Handy 30), Karten
  weiß mit Rand `--border-subtle`, Radius 16; Tagesplan-Zeilen mit Bereichs-Farbfeld 36 px, „Als Nächstes“ in der
  Tönung seines Bereichs mit größerer Uhrzeit, Vorbei blass; rechte Spalte neu geordnet: Budget (Zahl 32 px
  Display, Balken in Finanzgrün) → Demnächst (Datumsblock Tag groß / Monat klein) → Für dich (Sparziel und Aufgabe
  übereinander, dazwischen die Lichtlinie der Startseite, in der App nur 3 Impulse: `app-animated-beam
  [iterations]`). Am Handy Titel zweizeilig statt abgeschnitten. Leistung: Tagesplan als ein `computed` statt
  zehn Getter je Durchlauf, `ChangeDetectionStrategy.OnPush`, Ladeflächen in fester Höhe.
- **Neue Bereichsfarben in der App, Onboarding neu (21.10.2026):** Die globalen Bereichstokens in
  `styles.css` folgen jetzt Logo und Startseite (dunkle Textvariante für Schrift/Symbole, Tönung als Fläche):
  `--finance-accent #0B6E4B / --finance-soft #E4F4EC`, `--household-accent #A8325A / #FCE8EE`,
  `--organization-accent #8A5800 / #FCEFD9` (vorher Violett), `--travel-accent #2453B4 / #E7EDFB`; alle ≥ 5,3:1 auf
  Weiß und auf der eigenen Tönung. `--m-finance/--m-organize` (vorher Violett-Grau) zeigen auf diese Tokens.
  Bereichsseiten nachgezogen (21.10.2026): die rund 40 festen Altwerte (#1e7a4d, #b8432a, #7541b5, #246db8 samt
  Tönungen/Hover) in `finanzen/`, `haushalt/`, `familie/`, `organisation/`, `reisen/`, Benachrichtigungen,
  Verknüpfungs-Chips, Import-Dialog, Datumswahl und Startseiten-Deck zeigen jetzt auf die Tokens; `--accent-hover`
  je Bereich per `color-mix` (85 % + Schwarz, ≥ 7,6:1 mit Weiß). Weiß auf gefüllten Akzenten: Finanzen 6,3 ·
  Haushalt 6,4 · Organisation 6,0 · Reisen 7,1:1 — auch das dunkle Amber trägt weiße Schrift; das helle Logo-Amber
  `#e3961a` bleibt Logo/Startseite vorbehalten und bekäme dunkle Schrift. Bewusst unverändert: Erfolgsgrün
  (`--success`, gleicher Wert wie früher Finanzen) für „Gespeichert“, MFA-Schritt erledigt, Plus-Beträge. Kalender-
  Kategorie „Arbeit“ (`--c-arbeit`) zeigt jetzt auf `--organization-accent` statt Violett; die ungenutzte Regel
  `.status--violet` in `reisen/trip-common.scss` ist entfernt (Reise-Status kennt nur green/blue/gray/red).
  Untere Tableiste und Seitenleiste (`layout/app-shell.scss`, gemeinsame Regel) nutzen die Tokens statt fester Werte;
  „Start“ in Tinte `#121826` statt Markenblau. Aufbau und Icons der Navigation unverändert. `favicon.ico` (Browser-Tab)
  aus dem neuen `favicon.svg` neu erzeugt (16/32/48 px), Manifest `theme_color #121826`, `background_color #FAF8F4`.
  Onboarding (`features/onboarding`) im Startseiten-Stil: warmweißer Grund, weiße Karte mit Rand, Schritte mit
  Tinten-Ziffern, Display-Titel; Schritt 1 erklärt Verknüpfen mit `app-link-chain` statt schräger Kacheln;
  Auswahlkarten weiß mit Rand, gewählt = Tintenrand + Haken-Symbol (statt ✓/› als Text), Bereiche mit Farbfeld,
  gewählter Bereich in seiner Tönung; Zusammenfassung als Pillen in Bereichstönung; Knöpfe als Pillen (Tinte /
  Tintenrand); Handy ganzflächig mit Fortschrittsbalken in Tinte. Logik unverändert. Noch offen: Innerhalb der
  Bereichsseiten stehen die alten Akzentfarben an ~40 Stellen fest im Code (z. B. `private-finance.scss --accent`,
  `haushalt.scss`, `einkauf-tab.scss`, `familie.css`).
- **Login/Registrierung im Startseiten-Stil, Kette als Baustein (21.10.2026):** Die Beispielkette
  ist jetzt der globale Baustein `shared/link-chain` (`app-link-chain`; Eingänge `heading`, `caption`, `links`;
  Lichtlinien über `viewChildren`, Werte bei Containerbreite ≤ 380 px ausgeblendet). Die Bereichsklassen `.tone-*`
  (`--c`, `--c-deep`, `--c-tint`, `--c-on`) kommen aus dem Mixin `editorial.area-tones`. Startseite nutzt den Baustein
  im Hero (Hero-Abstand unten etwas kleiner). Login und Registrierung: Markenspalte warmweiß mit Überschrift, Satz und
  Kette statt der schrägen Symbolkacheln in alten Farben; Formular weiß, Display-Titel, Felder 52 px mit Rand
  `#948C7E` (3,3:1), Fokus Tinte, Knöpfe als Pillen in Tinte bzw. mit Tintenrand, Trenner „Neu bei 4inOne?“ mit
  Linien. Am Handy keine Symbolreihe mehr, nur Zurück + Logo + Formular. Formularlogik unverändert.
- **Eine Schrift, keine Kursive, Nutzen statt Deko (21.10.2026):** Schibsted Grotesk (Google Font,
  OFL, variabel 400–900) ersetzt Instrument Sans und Instrument Serif überall (App, Website, Formulare, Logo, Teilen-
  Bild); selbst gehostet, zwei Teildateien nach Zeichenbereich, `font-synthesis-style: none`, `em/i/cite` normal.
  Startseite nach externer Kritik geschärft: kürzerer Einstieg, die vier schwebenden Karten um das Logo ersetzt durch
  eine Beispielkette, die den Nutzen einer Verknüpfung zeigt (Gerät → Sparziel → Aufgabe → Termin, jede Verbindung
  real), „Ohne Anmeldung ausprobieren“ als gleichwertiger Rand-Knopf neben „Konto erstellen“ (Hero, So geht’s, Fragen).
  Kontaktseite, Danke-Seite, Formular-Baustein und der öffentliche Backend-Endpunkt `/api/v1/site/contact/` samt
  Tabelle (Migration `website.0002`) entfernt. `familie.css`: `.people-card` mit `min-width: 0` (breitere Schrift
  erzeugte bei 360 px 3 px Überstand). Der folgende Eintrag gilt sonst weiter.
- **Logo, Unterseiten, ohne Kontakt (21.10.2026):** Das Logo (`shared/brand`, Favicon, App-Icons,
  Teilen-Bild) nutzt die vier Bereichsfarben der Startseite (Finanzen `#0F9D6B`, Reisen `#3B6FE0`, Organisation
  `#E3961A`, Haushalt `#E04F78`), Schriftzug in Tinte `#121826`; das Favicon zeichnet die Felder als echte
  Blütenform (enge Ecke zur Mitte). Impressum, Datenschutz, Nutzungsbedingungen und Barrierefreiheit (dazu Kontakt,
  Danke, 404) im Stil der Startseite über dieselben Tokens (`shared/styles/_editorial.scss` als SCSS-Mixin für
  Startseite und `shared/public-shell`). Der Kontaktbereich auf der Startseite und der Kontakt-Link im Fuß sind
  entfernt (Nutzerwunsch); `/kontakt` bleibt erreichbar (404 „Fehler melden“). Der Name im Kachel-Fuß steht immer in
  der Markenschrift, nur Überschriften nutzen die Serife. Der folgende Eintrag gilt sonst weiter.
- **Startseite „Editorial hell“ (21.10.2026):** Auf Nutzerwunsch („modern, elegant, Agentur-Niveau,
  nicht verspielt; bunte, einheitliche Farben für die vier Bereiche; hochwertige Karten und Animationen; stilvolle
  Schrift; klar erklären, was die App ist“) aus drei Richtungen gewählt und mit ui-taste, ui-ux-pro-max, magic-ui und
  impeccable umgesetzt. Werte, Aufbau und Bausteine: `design-system/4inone/MASTER.md`. Ersetzt Runde 3 (Blüten-Motiv,
  Inclusive Sans — Schrift entfernt). Neue globale Bausteine: `shared/spotlight` (Lichtkegel, Magic Card) und
  `shared/animated-beam` (Lichtlinie, Animated Beam); `app-tile-footer` farblich und typografisch über `--tf-*`
  anpassbar (Host setzt keine eigenen Werte mehr, die die Seite überdecken würden).
- **Startseite, Runde 3: weniger generisch (20.10.2026):** Nach eigener Kritik („wirkt zu zwei
  Dritteln wie eine KI-Vorlage“) mit `ui-ux-pro-max` und dem Taste-Skill umgebaut (Richtung „One motif“, Prüfung
  `inspect.mjs`: 0 FAIL, 0 WARN; Bewertung nach `critique.md` ≈ 8/10). Die Blüte ist das einzige Motiv. Schrift
  Inclusive Sans statt Plus Jakarta Sans (humanistisch, auf Nutzerwunsch). Neu: Satz-Bänder mit Schaltern (wer
  sieht was), Karteikarten-FAQ, Coupon-Kontakt, echter 16-s-Mitschnitt der Demo (VP9, 183 KB, `tag-morgens.webm`).
  `app-area-deck`: Vorschau-Zeilen mit echten Inhalten (`preview`), einmaliges Auffächern (`fanIn`), Größen über
  `--deck-title/-text/-small`, Punktfarbe über `--deck-dot`; Nachbarkarten ohne `aria-label` (Name aus sichtbarem
  Text, WCAG 2.5.3), keine Linien/Schatten. `app-tile-footer`: die vier Bereichsfelder bilden das Zeichen (enge Ecke
  zur Mitte), ohne Icons; Größen über `--tf-*`. Kopf ohne Glas-Effekt. Der folgende Eintrag gilt sonst weiter.
- **Globale Bausteine Fächer und Kachel-Fußzeile (20.10.2026):** Nach Auswahl aus der Kombai-Galerie
  (Vorbilder „Daymoor“ und „Yieldr“, nichts kopiert, in unser System übertragen):
  `shared/area-deck` (`app-area-deck`) zeigt beliebige Bereichskarten als Fächer — gleich für alle vier Bereiche,
  nur die Farbe wechselt (Logo-Feld als Symbolgrund, helles Feld für Stichworte und Nachbarkarten, Text Tinte).
  Bewegung 450 ms transform/opacity, keine Auto-Drehung, Wischen am Handy, horizontal abgeschnitten (kein
  seitliches Scrollen). `shared/tile-footer` (`app-tile-footer`) ersetzt den dunklen Startseiten-Fuß (`full`) und
  den Fuß von `shared/public-shell` (`compact`). Startseite: Fächer im Hero, das Bento der Bereiche entfällt (sonst
  doppelt), das echte Startseiten-Bild sitzt jetzt in „Ein Tag mit 4inOne“. Der folgende Eintrag gilt sonst weiter.
- **Öffentliche Startseite, Neuentwurf (20.10.2026):** Auf Nutzerwunsch komplett neu erfunden, mit dem
  Skill `ui-ux-pro-max` (Designsystem in `design-system/4inone/MASTER.md`; der automatische Erstvorschlag — dunkles
  Glas, Handschrift-Fonts, Video-Hero — wurde als unpassend verworfen). Stil Bento + Soft UI: Karten Radius 24 px mit
  8-px-Ecke, Schatten zweistufig, Papiergrund `#F7F6F2`, Karten weiß, Tinte `#0F1B3D` (15,6:1), Akzent `#1E40AF`
  (8,1:1), gedämpft `#475569` (7:1); Bereichsfarben nur als Kachelgrund/Symbolfeld, Text darauf Tinte (≥ 8,8:1).
  Schrift Plus Jakarta Sans variabel (60 KB, OFL, `public/fonts/plus-jakarta-sans`), nur auf `/` — die App bleibt
  bei Instrument Sans. Bewegung: Paket `motion` 14.4 als `motion/mini` (Web Animations API) + `inView`/`stagger`,
  Landing-Chunk 40 KB (11,6 KB übertragen); nur transform/opacity, Dauer 400–700 ms, ease-out `[0.22, 1, 0.36, 1]`,
  Versatz 60 ms. Hero-Bilder neu aus der Demo (Tagesplan, 08:30). Am Handy keine Desktop-Ausschnitte in den
  Bereichskacheln (unlesbar), Kopf ≤ 420 px nur „Anmelden“. FAQ als natives `<details>` (sanftes Aufklappen per
  `::details-content`, wo unterstützt). Kontaktformular als gemeinsame Komponente `shared/contact-form` (Startseite
  und `/kontakt`). Die alte Startseite (Satz-Bühne, Verknüpfungs-Karte `link-steps`, Teilen-Schalter) ist entfernt.
- **Öffentliche Unterseiten (20.10.2026):** Impressum, Datenschutz, Nutzungsbedingungen, Barrierefreiheit, Kontakt,
  Danke und 404 stehen im gemeinsamen Rahmen `shared/public-shell` im Stil der Startseite: Kopfzeile 72 px mit Marke
  (22 px, Handy 20) und „Anmelden“ / „Konto erstellen“ (Pill, `--brand-primary`), Inhalt max. 1120 px, Fußzeile mit
  Kontakt · Impressum · Datenschutz · Nutzungsbedingungen · Barrierefreiheit (15 px, je ≥ 44 px Tippziel) und
  Copyright. Keine App-Navigation mehr auf diesen Seiten (führte Besucher nur zur Anmeldung). Lange Überschriften
  trennen (`hyphens: auto`), am Handy 28 px — „Barrierefreiheitserklärung“ erzeugte sonst seitliches Scrollen.
  Formular (Kontakt): Felder 48 px, Schrift 17 px (kein iOS-Zoom), Rand 1,5 px, Fokus mit 3-px-Ring in
  `--brand-primary`, Fehler als Text unter dem Feld, Zeichenzähler, Absenden als Pill 52 px (Handy volle Breite).
  Teilen-Bild `public/og-image.png` (1200 × 630, Marke, Satz, vier Bereichs-Pills in den Logo-Feldfarben) und
  `apple-touch-icon.png` (180 px) / `icon-512.png` aus dem Logo-Zeichen — gerendert, kein Screenshot.
- **Zugängliche Namen (20.10.2026):** Knöpfe und Links mit sichtbarem Text bekommen kein `aria-label` mehr, das den
  Text ersetzt (WCAG 2.5.3, axe 4.14 `label-content-name-mismatch`): Zusätze wie „Kontomenü“ oder „– erledigt“ stehen
  als `sr-only`-Text im Element.
- **Tagesplan: Erkennbarkeit für neue Nutzer (17.10.2026):** Die 10-px-Farbpunkte (Logo-Farben,
  nur 1,7–2,0:1 Kontrast, Organisation gelb statt violett wie in der Navigation) sind ersetzt durch Bereichs-Symbole
  30 px: dasselbe Icon und dieselbe Farbe wie in der Navigation (`--finance/household/organization/travel-accent` auf
  `-soft`, 5,3–6,6:1); Überfälliges rot (`--late` auf `#fcebea`). Der Bereich steht als erstes Wort im Hinweis (auch
  am Handy; die eigene Bereichsspalte entfällt), Doppelungen sind weg („Heute“ in der Zeitspalte, „Überfällig“ im
  Hinweis — für Screenreader bleibt „überfällig“ als `sr-only`). „Für dich“ erklärt in einem Satz, was eine
  Verknüpfung bringt; „Erste Schritte“ sagt in einem Satz, was 4inOne ist. Zeichen vor der Begrüßung und das tägliche
  Entfalten (localStorage `4inone.dashboard.seen`) sind entfernt — die Startseite hat keine eigene Bewegung mehr außer
  Drücken `scale(0.995)` und Hover bei Maus. Der folgende Eintrag gilt sonst weiter.
- **App-Startseite „Tagesplan“ (17.10.2026, Grundlage):** Nach Nutzerwunsch „ruhig und modern, klar was wann
  steht, ohne zu überfordern“ ersetzt der Tagesplan Tagesbühne, Tagessatz mit Feldern, Doppelrahmen und
  Tageszeitleiste (alle entfernt). Aufbau und Werte siehe DESIGN.md › App-Startseite. Prinzipien: eine Zeilen-Form
  für alles (lernt man einmal); Gruppenüberschriften 13 px/600 in `--text-secondary` statt Farbflächen; Farbe nur als
  10-px-Zeichenfeld und für zwei Zustände (Überfällig rot als Schrift, Als Nächstes hellblau); Bereich auch als Wort;
  nichts doppelt; Bewegung nur: Zeichen entfaltet sich einmal pro Tag (localStorage `4inone.dashboard.seen`, nie bei
  reduzierter Bewegung), Drücken `scale(0.995)`, Hover nur bei Maus. Styles: dashboard.scss (Begrüßung, Tagesplan),
  dashboard-side.scss (Demnächst, Budget, Für dich, Erste Schritte), dashboard-parts.scss — je unter 12 kB.
  Die folgenden Einträge vom 17.10. (Bühne, Satz) sind damit überholt.
- **App-Startseite (17.10.2026, „kein zweites Menü“, ersetzt Kacheln und Zeitleiste):** Nach Nutzer-Bewertung
  (6/10, „Standard-Dashboard“) und auf Wunsch handyzuerst neu geordnet. Skills: design-taste-frontend/copywriting
  (wie Landingpage), impeccable, emil-design-eng (Bewegung: Drücken `scale(0.97–0.99)`, Hover nur bei Maus,
  keine Animation über Transparenz), Prüfung mit playwright-cli (feste Uhr 08:30 und 21:10).
  - Entfernt: die vier Bereichskacheln (doppelt zur Navigation, am Handy zur unteren Leiste; zwei davon doppelt zur
    Liste) samt Hervorhebung der Onboarding-Auswahl; die Tageszeitleiste (vom Nutzer als überflüssig bewertet).
  - Heute: Überfälliges (`.today-list--late`, Fläche `#fdeeed`, Uhrzeit/Text `#b3261e`) → Tagesbühne mit „Als
    Nächstes“ (nächster kommender Termin; sonst erste Aufgabe ohne Uhrzeit „Heute noch“; sonst Abend-Zustand mit dem
    Zeichen) → Rest (`#today-list`, kommende Termine, ohne Uhrzeit, Vergangenes mit „vorbei“ und ruhiger Schrift).
    Nichts doppelt (Vergleich über Bereich/Uhrzeit/Titel). Die Uhr läuft jede Minute mit.
  - Demnächst (`.soon`): nächste Reise („in 12 Tagen · 4 Aufgaben offen · 12 / 24 gepackt“) und nächste Frist im
    Haushalt (≤ 30 Tage), je Zeile mit Zeichen-Feld und Link; leer: ein ruhiger Satz; lädt: Skelett.
  - Für dich: nur Verknüpfungs-Vorschläge (live vom Server, Demo: Sparziel „Badmintonschuhe“ ↔ Aufgabe); Aktion als
    Pille in der hellen Bereichsfläche, damit „Hinzufügen“ die einzige kräftige Aktion bleibt.
  - Budget (`.budget`): „702,29 € übrig“ (28 px), Balken (ausgegeben/geplant vom Monatsbudget), „von 3.000,00 € im
    Oktober“; ohne Budget „Starte mit deinem Monatsbudget“; Fehler „Gerade nicht verfügbar“ + gemeinsames
    „Erneut versuchen“. Ganze Karte führt zu Finanzen.
  - Abschnittsköpfe einheitlich 18 px/700, 44 px hoch. Styles: dashboard.scss (Gerüst, Listen, Demnächst, Budget),
    dashboard-stage.scss (Bühne, Für dich), dashboard-parts.scss (Menü, Hinweise, Suche) — je unter 12 kB.
- **App-Startseite (15.10.2026, kompletter Neubau):** Grundlage PRODUCT.md (neu): kurzer Blick am Morgen, oft am
  Handy; erste Frage „Was muss ich heute tun?“; Gemeinsames nur, wenn wirklich geteilt. Aufbau per impeccable
  (Operate, Konzept-Wurf, gewählt „Als Nächstes + Reihe“) in der Welt der Landingpage (Instrument Sans, Tinte
  `#101d40`, weiche Formen mit einer engeren Ecke, Zeichenfarben als Bereichskennung). Linke Navigation, Kopfzeile
  und Icons unverändert.
  - Begrüßung: H1 30–40 px (Handy 24), darunter Datum + Tagesstand aus echten Zahlen; „Hinzufügen“ voll gerundet in
    `--brand-primary` (Handy runder 46-px-Knopf), Liste der bestehenden Formulare unverändert.
  - Raster: „Heute“ (1,75 fr) | „Für dich“ (≥ 280 px), darunter die vier Bereiche; unter 1100 px untereinander.
  - Heute: erste Zeile der sortierten Liste (Überfälliges zuerst) als große Zeile in `--soft` des Bereichs, Radius
    24/8, Uhrzeit 30–40 px, „in 40 Min.“ in Bereichsfarbe (nur für kommende Uhrzeiten von heute), „Öffnen“-Pille;
    Screenreader hören „Als Nächstes: …“. Übrige Zeilen weiß, 60 px, Uhrzeit · kleines Zeichen-Feld (10 px) ·
    Titel/Notiz · Pfeil; Gruppe mit weicher Ecke unten. Leerer Tag: das Zeichen klein + „Heute ist nichts Dringendes
    offen“ + Hinzufügen.
  - Für dich: weiße Karte Radius 24/8, Bereich in Akzentfarbe, Titel 20 px, Aktion als Pille in `--soft`.
  - Bereiche: Reihe aus vier weißen Feldern (äußere Ecken weich), je Zeichen-Feld 44 px mit Bereichs-Icon, Name
    14 px, Stand 19 px fett (bricht ausgewogen um), Detail 14 px; Handy 2 × 2.
  - Bewegung: Zeilen, Karte und Bereiche setzen sich beim Laden (12 px, gestaffelt bis 180 ms) — nur Bewegung, keine
    Transparenz, damit Kontrast und Lesbarkeit immer voll da sind; reduzierte Bewegung: keine.
- **Öffentliche Startseite `/` (15.10.2026, komplette Neugestaltung):** Ziel: hochwertiger Auftritt auf Agentur-Niveau,
  Wow-Moment beim ersten Besuch, Verknüpfungen glasklar erklärt. Richtung „Der Satz ist die Bühne“ (Skill
  design-taste-frontend, seed 1029055409; Texte nach Skill copywriting). Idee: Das 4inOne-Zeichen (vier Felder mit je
  einer engeren Ecke) steht im H1 für „Alles“: „Dein Alltag. [Zeichen] verbunden.“ Beim Laden sitzt es kurz als 2×2,
  entfaltet sich zu Finanzen · Haushalt · Organisation · Reisen, „verbunden.“ gleitet nach, dann öffnet sich der
  echte Startseiten-Screenshot von unten (clip-path, ≈ 2 s gesamt). Screenreader lesen „Dein Alltag. Alles
  verbunden.“; mit reduzierter Bewegung oder ohne JS steht sofort der Endzustand.
  - Schrift Instrument Sans: H1 so groß wie die Breite erlaubt (bis 168 px, −0,045 em, Zeilenhöhe 0,94; unter
    1280 px steht das Zeichen selbst als Wort: „Dein Alltag. [Logo 2 × 2 mit Bereichs-Symbolen] verbunden.“, Farben
    wie im Logo; zusätzlich höchstens 22 % der Bildschirmhöhe, damit Handy quer passt), H2 32–72 px (≤ 400 px: 28, ≤ 340 px: 24) (−0,035 em), Zwischenüberschrift 28–44 px,
    Lead 22, Text 18, Klein 15.
  - Farben: Grund `#f4f6fa` / Weiß, Tinte `#101d40` (Wortmarke), Aktion `--brand-primary`; große Flächen aus den
    Zeichenfarben (`#76cda4`, `#efa1c2`, `#ffd175`, `#99c5ff`) und ihren hellen Stufen. Abschluss dunkel `#101d40`.
  - Formen: Radius 28 px mit einer engeren 8-px-Ecke (wie im Zeichen) für Bilderrahmen, Flächen und Bänder;
    Knöpfe voll gerundet (52 px, klein 44 px). Keine Verläufe, Schatten, Linien oder Eyebrows.
  - Überarbeitung nach Marketing-Feedback (15.10.2026): Nutzen vor Bedienung — Hero-Lead nennt das Problem („statt
    verteilt auf Apps, Zettel und Ordner“) und den Vorteil („vom Sparziel direkt zur Waschmaschine“); Abschnitt 2
    beginnt mit „Ohne Verknüpfung“ (helle Fläche) / „Mit Verknüpfung“ (dunkle Fläche `#101d40`), dann „So verknüpfst du
    zwei Einträge“ (22 px) und die vier Felder; danach drei kurze Punkte (Beide bleiben · Niemand sieht mehr · Du
    entscheidest) und die Kombinationsliste eingeklappt (`details`, Pillen-Knopf „Was sich verknüpfen lässt +“).
    Ruhiger: H2 32–56 px statt bis 72, keine wiederholten Zweiteiler („Nutze nur, was du brauchst.“), Teilen-Bänder
    eingeschaltet nur hell getönt (`#d9f1e5`, `#dcebff`, `#fbe3ed`), gesperrt grau. Preise/Beta-Status bewusst nicht
    genannt, solange nicht entschieden.
  - Abschnitte: (1) Hero; (2) „Was zusammengehört, bleibt zusammen.“ — Komponente `app-link-steps`, Bauform „Eine
    Karte, vier Felder“ (Neubau 15.10.2026, ersetzt den Regler): vier Farbfelder in den Zeichenfarben, jedes mit einer
    engeren Ecke zur Mitte; darin dieselbe App-Karte jeweils einen Schritt weiter (Sparziel mit „Noch nichts verknüpft“ →
    „Was möchtest du verbinden?“ → „Gerät auswählen“ / „Verknüpfung bestätigen“ → „Verknüpft mit Waschmaschine“, die
    Gegenseite liegt versetzt dahinter); unten je ein Satz („Zuerst öffnest du das Sparziel.“ …). Rechner 4 nebeneinander,
    Tablet 2 × 2, Handy untereinander; die Felder werden von Schritt zu Schritt breiter (0,9 → 1,12 fr). Felder öffnen sich beim Hineinscrollen nacheinander (clip-path, 90 ms versetzt),
    Karten heben sich beim Zeigen um 6 px;
    darunter „Das passiert“ / „Das bleibt, wie es ist“, die erlaubten Paare und Vorschläge mit echtem Begründungstext;
    (3) „Vier Bereiche. Jeder für sich.“ — Reiter (Pfeiltasten, Pos1/Ende) mit Screenshots; (4) „Verknüpfen ist nicht
    Teilen.“ — vier Schalter (`role=switch`) zeigen, was andere sehen; „Finanzen teilen“ ist gesperrt; (5) dunkler
    Abschluss + Fußzeile mit angeschnittenem Namen „4inOne“. Kopfzeile ≤ 400 px: nur Marke + „Anmelden“
    („Konto erstellen“ steht direkt darunter im ersten Bildschirm).
  - Bewegung: Abschnittsteile gestaffelt (60–240 ms, 16 px, 600 ms; Auslösung sobald der Abschnittsanfang
    sichtbar ist — auch bei sehr hohen Abschnitten am Handy), Knöpfe heben sich beim Zeigen, Regler/Schalter mit
    Rückmeldung. Prüfung: tasteskill inspect (1440/768/390) ohne Fehler; Hinweise: kein Video (es gibt kein ehrliches) und
    zehn Schriftgrößen (davon mehrere in den App-Ausschnitten), axe ohne Verstöße.

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

- Finanzen — green (`--finance-accent #0b6e4b`)
- Haushalt — Beere (`--household-accent #a8325a`, Fläche `--household-soft #fce8ee`; 6,4:1 auf Weiß)
- Organisation — Amber (`--organization-accent #8a5800`; weiße Schrift auf der Füllung 6,0:1)
- Reisen — blue (`--travel-accent #2453b4`)

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

Use simple calendar/task/reminder icons and restrained amber accents (`--organization-accent`). The only full area
fill is the Heute hero card (see „Organisation — Dein Tag, Stunde für Stunde“ below).

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

### Dashboard-Feinschliff und Teilen-Beispiel (15.10.2026)
Bestehende Tagesbühne und Farbwelt beibehalten; mobile Innenabstände 16 px, führende Uhrzeit 30 px, vergangenes Datum
22 px, Titel 21 px. Nächster noch anstehender Termin vor überfälligen Aufgaben hervorgehoben, ohne diese auszublenden.
Die einzelne „Für dich“-Karte demonstriert in der öffentlichen Demo einen begründeten Zusammenhang; der Dialog
kennzeichnet seinen lokalen, beim Reload zurückgesetzten Zustand. Live-Daten unverändert. Landing-Teilen-Erklärung
mit explizitem Simulationshinweis und voneinander abhängigen Texten. Keine neuen Tokens oder Navigationsbereiche.

Handyansicht: Die zusätzliche dekorative Tagesachse entfällt; Uhrzeiten bleiben in den bedienbaren Zeilen. Demo-Dialogaktionen und Objektlinks besitzen mindestens 44 px Höhe und sichtbaren Tastaturfokus.

### Helle Dashboard-Übersicht (15.10.2026)
Ersetzt die dunkle Tagesbühne vollständig: weiße, dezent umrandete Tagesliste mit gleich großen Zeilen und ruhiger Markierung „Im Fokus“. Keine große Datumszahl oder Tagesachse. Priorisierung bleibt erhalten. Demo-Zusammenhang zeigt Sparziel und Aufgabe als zwei beschriftete, direkt erreichbare Objekte mit verbindender Erklärung und separater Aktion. Bestehende Navigation, Icons und Bereichsfarben bleiben bestehen. Diese Entscheidung ersetzt die vorherige Tagesbühnen-Gestaltung.
Die vier unveränderten Bereichskarten bilden nun ein kompaktes Band unter der Begrüßung (Desktop vier Spalten,
Handy zwei). Darunter Tagesliste und die einzelne Kontextkarte. Dadurch bleiben die Bereiche direkt erreichbar.

### Haushalt › Heute und Aufgaben — „Dein Zuhause, Raum für Raum“ (31.10.2026)

- **Idee:** Räume sind der rote Faden des Haushalts (Task.room, später auch Geräte). Kein anderer Bereich hat sie;
  sie machen den Bereich als „mein Zuhause“ erkennbar. Rechnungen in `haushalt/zuhause-logic.ts` (nur echte Daten).
- **Kopfkarte** (`heute-hero.scss`, `.hero`): Fläche `--household-accent`, Radius 20 mit 8-px-Ecke oben rechts (wie die
  Startseiten-Karte), Innenabstand 26/28 (Handy 20/18). Zeile Datum · „Dein Zuhause heute“ (14 px, Weiß 93 %), Titel
  Display 28–40 px/700 „N Aufgaben heute“ + „ · ca. X Min.“ (Weiß 93 %, Handy eigene Zeile ohne Punkt) bzw. „Heute
  ist nichts fällig“. Marken 30 px rund: „N überfällig“ weiß mit Beere-Text, „N heute erledigt“ (Haken) in dunklerer
  Haushaltsfarbe. Verteilung (nur ≥ 2 Personen mit Erledigtem diesen Monat): „Diesen Monat erledigt: Anna 3 · Ben 3“ +
  8-px-Balken je Person (weiß / 55 % weiß); ab 1100 px rechts neben der Zahl (schmaler darunter, sonst bricht der Titel). **Ausnahme** von „Bereichsfarben nur für
  kleine Flächen“: genau diese eine Kopfkarte je Bereich darf die Bereichsfarbe als Fläche tragen.
- **Räume** (`.rooms`): Überschrift „Nach Räumen“ (Abschnitt 20 px), Raster `auto-fill minmax(160px, 1fr)` (Handy 2
  Spalten), max. 6, dringendste zuerst. Karte weiß, Rand `--border`, Radius 16, min. 124 px: Symbol 36 px auf
  `--household-soft`, Name 600 (Trennung nur an Silben), Zustand 13 px sekundär („1 überfällig“ fett in Beere),
  Balken 6 px (Füllung 8/40/72/100 % nach Stufe; ab „heute“ volle Haushaltsfarbe). Ganze Karte ist Knopf mit
  `aria-label` in Worten; Hover Rand Beere 45 %, −1 px.
- **Heute fällig:** volle Breite; Zeile Titel + „Raum · Dauer · ↻ Wiederholung“ (13 px). Rechner: Fälligkeit und
  Priorität `auto` breit.
- **Aufgaben:** Werkzeugzeile Suche | Umschalter (Sage-Spur, gewählt weiß, 38 px, 13 px; Handy volle Breite).
  Raumfilter-Zeile „Nur Badezimmer · ✕ Alle Räume zeigen“. Gruppenüberschrift 13 px/700 + Anzahl (Überfällig
  `#a12323`, Raum-Gruppen mit Raumsymbol). Kürzel-Kreis 30 px `--accent-soft`/`--accent-hover` 12 px/700.
- **Erledigt-Moment** (Heute und Aufgaben): Kästchen gefüllt + Haken (260 ms, leichtes Überschwingen), Titel
  durchgestrichen sekundär, Zeile auf 35 % (260 ms, danach entfernt bzw. neu geladen, insgesamt 520 ms); bei
  `prefers-reduced-motion` ohne Animation und sofort. Einblenden von Titel und Raumkarten nur per `translateY`
  (gestaffelt 40 ms), nie über Deckkraft — Text bleibt in jedem Moment kontrastfest.

### Haushalt › Einkaufen — Kacheln und der Weg zu den Finanzen (31.10.2026)

- **Umschalter** `.view-switch` „Liste · Kacheln“ (Sage-Spur, gewählt weiß, 38 px, Symbole `list`/`grid`; Handy volle
  Breite) unter der Eingabezeile; Wahl in `localStorage` (`4io-einkauf-ansicht`), Standard „Liste“.
- **Kacheln** (`einkauf-tiles.scss`): Raster `auto-fill minmax(104px, 1fr)` (Handy 3 Spalten), Abstand 8. Offene
  Artikel: Kachel in der Tönung ihres Ladenbereichs (`tone--*`), Symbol 26 px, Name 13 px/600, Menge 12 px sekundär,
  min. 96 px, Radius 12; antippen = in den Wagen (kurzes Eindrücken 0,96). „Im Wagen“: Sage-Fläche, Haken in Akzent,
  Name durchgestrichen; antippen = zurück auf die Liste. „Oft gekauft“: weiß, 1,5 px gestrichelter Rand, „+“ oben
  rechts; nur Vorschläge, die nicht schon auf der Liste stehen (`suggestTiles`). Überschriften „Auf der Liste N“,
  „Im Wagen N“, „Oft gekauft“ (13 px/700). Jede Kachel ist ein Knopf mit Aktion im Namen („Bananen, 1 kg abhaken“).
- **Leiste „im Wagen“**: Zahl + „im Wagen“ in einer Zeile, darunter „wird zur Ausgabe in Finanzen“ (12 px, Finanzen-
  Symbol, Weiß 82 % auf Tinte) — nur wenn gebucht werden kann. Der Einkaufsmodus nutzt weiterhin die Liste.
- Neues Symbol `grid` (vier Quadrate) in `shared/icons/app-icon.ts`.

### Haushalt › Zuhause — Als Nächstes und Geräte nach Raum (31.10.2026)

- **Kennzahlen** (`zuhause-tab.scss` überschreibt `haushalt-stats.scss` nur hier; Routinen behalten ihre Kacheln):
  Chips 40 px, Radius rund, Zahl 16 px/700 + Beschriftung 14 px sekundär in einer Zeile; Symbol, Hinweis und Pfeil
  ausgeblendet; Filterwirkung unverändert (antippbare Chips filtern die Liste).
- **Als Nächstes** (`.next`, `nextDeadlines()` in `zuhause-logic.ts`): Fristen ab heute der laufenden Einträge
  (nicht außer Betrieb/beendet/gekündigt), früheste zuerst, höchstens 4. Feste Spalten: ab 1100 px 4, darunter 2,
  Handy 1 (nie 3 + 1). Karte weiß, Radius 16, min. 76 px: Kalenderblatt 56 px (Sage; ≤ 14 Tage Haushaltsfarbe mit
  weißer Schrift), Name 600 mit Symbol (gekürzt mit „…“, voller Name im `aria-label`/Tooltip), darunter „Wartung ·
  in 12 Tagen“ / „Garantie endet · …“ / „Kündigen bis · …“. Hover: Rand Beere 45 %, −1 px.
- **Geräte nach Raum** (`devicesByRoom()`): Überschrift-Zeile im Listenkopf-Stil (13 px/700, Raumsymbol in Beere,
  Anzahl gedämpft); Reihenfolge der Räume wie im Formular, „Ohne Raum“, zuletzt „Außer Betrieb“ (Archiv-Symbol).
  Nur ab zwei Gruppen; Verträge bleiben eine Liste.
- **Gerätesymbole** (`deviceIcon`): Spülmaschine, Wasch-/Trockner, Kühl-/Gefrier, Sauger, Heizung/Therme, Ofen/Herd/
  Mikrowelle, Kaffee/Espresso, Handy/Tablet, Werkzeug/Mäher; sonst `device`.
- **Handy-Zeile:** Raster `40px 1fr 16px`, Name volle Breite (keine Trennung mitten im Wort), Status-Marke und
  nächste Frist darunter in einer Zeile.

### Haushalt — Abschluss nach `/ui-taste` (31.10.2026)

- **Kennzahlen** in `haushalt-stats.scss` jetzt grundsätzlich als Filter-Chips (Routinen und Zuhause gleich): 40 px rund,
  Zahl 16/700 + Beschriftung 14 sekundär; Symbol, Hinweis und Pfeil ausgeblendet. Routinen: „N aktive Routinen“, „N heute
  fällig“, „92 % erledigt (4 Wochen)“, „N geteilte Routinen“.
- **Routinen-Liste** (`routinen-tab.scss`): Listenform (Symbol · Titel + Rhythmus · Fälligkeit über Serie · Schalter · Menü)
  ab ≤ 1000 px Fensterbreite statt ≤ 760; nur die Handy-Details (Chips wischbar, Sortierung aus) bleiben ≤ 760.
- **Schriftgröße:** im Haushalt `--fs-caption` = 13 px (`haushalt.scss :host`) — Zusatzzeilen, Marken, Zähler, Mengen nie
  unter 13 px.
- **Heute:** Zeit („ca. 45 Min.“) bis 960 px eigene Zeile, 0,75 em, ohne Trennpunkt.
- **Einkaufen** (`einkauf-tiles.scss`): ≤ 900 px Listen als umbrechende Pillen (44 px, Symbol 18, Name nowrap, Zähler,
  kein Balken, „Neue Liste“ gestrichelt); Seitenkarte „Einkauf wird zur Ausgabe“ ≤ 900 px aus. Leiste: Hinweis
  „wird zur Ausgabe in Finanzen“ nowrap (≤ 360 px umbrechend), Knopf am Handy „Abschließen“ mit `aria-label` „Einkauf
  abschließen“. Gruppenkopf Spalten `32px 1fr auto 44px 44px` (keine überlappenden Trefferflächen). Listennamen ohne
  Silbentrennung (`hyphens: manual`).

### Organisation — „Dein Tag, Stunde für Stunde“ (31.10.2026)

- **Reiter:** Heute · Kalender · Aufgaben · Notizen. Heute ist Start (`organisation.ts`, `OrgTab = 'today' | …`), lädt nur
  die Termine des Tages (`loadToday`); `?tab=` steht nur für die anderen Reiter, alte/unbekannte Werte → Heute.
- **Heute** (`org-today.*`, Rechnungen in `org-day-logic.ts`): Kopfkarte `.day-hero` auf `--organization-accent`
  (Radius 20 mit 8-px-Ecke oben rechts, Text ≥ 93 % Weiß, Titel 28–40 px Display), „Als Nächstes“ und Marken
  (überfällig weiß/rot, freie Zeit dunkler Amber). Raster 1,4fr | 1fr (≤ 960 px eine Spalte). Tageslinie `ol.line`:
  Zeit 44 px · Schiene 2 px · Termin (Kategorie über `--cat` aus `org-common.scss`, Tönung 10 %, Kante 4 px, ≥ 56 px)
  bzw. freie Zeit (gestrichelt 1,5 px, 44 px, Plus in Amber). `dayLine()` zählt frei nur 07:00–22:00 ab jetzt, Lücken
  ≥ 30 Min.; `nextUp()` ≤ 180 Min. als Abstand, sonst Uhrzeit. Aufgaben heute: Kästchen 44 px, überfällige zuerst.
  Einblenden nur per `translateY` (nie Transparenz).
- **Kalender** (`org-calendar.*`): `.week__ev` mit Kategorie-Tönung und 3-px-Kante; `.legend` (8-px-Punkte, 13 px) nur
  bei ≥ 2 Kategorien im Zeitraum; `.cell__dots` (bis 3 Punkte à 6 px, je Kategorie) im Monat am Handy und im
  Tagesstreifen. Handy-Start: Woche.
- **Aufgaben** (`org-tasks.*`, `groupTaskList()` in `organisation-logic.ts`): Segment `.group-by` (38 px, weißer
  aktiver Knopf) „Nach Tag · Nach Projekt“, gemerkt unter `4io-org-aufgaben-gruppe` (try/catch); Gruppenkopf `.group-h`
  13 px Versalien mit Anzahl, Überfällig rot `#a12323`. Erledigt-Moment: Haken `tick` 240 ms, Zeile `settle`, nach
  480 ms speichern (reduzierte Bewegung: sofort).
- **Notizen** (`org-notes.*`): `.quick` (56 px, Radius 16, Fokusring in Amber, Speichern-Knopf in Tinte), Suche ab 4
  Notizen, `.board` `repeat(auto-fill, minmax(230px, 1fr))` (≤ 560 px eine Spalte), Karte Radius 16, ≥ 132 px, Hover
  hebt 2 px; angeheftet `--organization-soft`, Stern in Amber. Schnellnotiz: `quickNote()` in der Hülle speichert
  `{ title: '', body, pinned: false }` über die bestehende Notiz-API (Server prüft Länge und Besitz wie bisher).
- **Schrift:** `--fs-caption` im Bereich 13 px (`organisation.scss :host`).

### Reisen — „Von hier nach dort“ (31.10.2026)

- **Bordkarte** `trip-pass.*` (`app-trip-pass`, `mode="list" | "detail"`): Fläche `--travel-accent` mit feinem
  135°-Linienmuster (3,5 % Weiß), Radius 22 mit 8-px-Ecke oben rechts, Text ≥ 93 % Weiß. Orte in Display 28–44 px,
  Abrissteil (`.pass__stub`) 44–64 px, Perforation 2 px gestrichelt, Einkerbungen 24 px in `--surface-app`. Marken 32 px
  (`color-mix` 24 % Schwarz), im Detail Knöpfe 36 px mit Pfeil. `container-type: inline-size`; ≤ 620 px Kartenbreite
  Handy-Layout. Rechnungen in `reisen-logic.ts`: `placeParts`, `passStub`, `preparation` (gezählt, kein Score).
- **Liste** `trip-list.*`: `.later` `repeat(auto-fill, minmax(250px, 1fr))`, `.later-card` ≥ 150 px, Hover hebt 2 px;
  `.leaf` Kalenderblatt 48 px (klein 40 px, vergangen/abgesagt grau).
- **Übersicht** `trip-overview.*`: Raster 1,5fr | ≥ 280 px (≤ 960 px eine Spalte); `.track` Linie mit 12-px-Punkten,
  `.track__depart` Marke; `.tile-card` mit 56-px-Ring (`conic-gradient` + Maske, Zahl darüber).
- **Planung** `trip-planning.*`: `taskTimeline()` (Überfällig · Vor der Abreise · Unterwegs · Nach der Reise · Ohne
  Datum), `.tl-head`, `.tl-rows` (Schiene 2 px `--travel-soft`, Punkt 10 px), `.tl-depart`.
- **Packliste** `trip-packing.*`: `.cat-tiles` (118 px Mindestbreite, Handy wischbar 104 px), Ring 48 px; `.all-packed`;
  `.groups` ab 1100 px `columns: 2`.
- **Budget** `trip-budget.*`: `.kpis` — DOM-Reihenfolge Gesamtbudget · Ausgegeben · Noch übrig (Rechnung für
  Screenreader), sichtbar „Noch übrig“ per `order: -1` groß vorn; `.stack` 14 px (über Budget: roter Innenrand) +
  `.legend`; Farben `BUDGET_COLOR`; `.exp-day` Tageskopf.
- **Dialoge** `trip-dialogs.scss` (eigene Datei wegen Stilbudget von `reisen.scss`): `.ticket-preview` (sticky),
  `.form-step` mit 24-px-Nummer, `.transport-chip`/`.category-chip` 44 px.
- **Reisekopf ≤ 760 px:** `.heading-icon` aus, `h1` `overflow-wrap: break-word` (in `trip-dialogs.scss`). `.pass__facts`
  setzt den Trennpunkt vor jeden Eintrag und schneidet ihn links per `clip-path` ab.
- **Symbol:** `bus` neu in `shared/icons/app-icon.ts` (gleiche Strichsprache); `transportIcon('BUS')` nutzt es.

### Verknüpfungen sichtbar (31.10.2026)

- **`<app-link-hints [items] [exclude] [max]>`** (`shared/connections/link-hints.ts`): Pillen 24 px, Padding 0 9 px,
  Symbol 13 px, Schrift `--fs-meta` 600, Farbe je Bereich (`dom-reisen|finanzen|haushalt|organisation` →
  `--*-soft`/`--*-accent`), `max-width: min(240px, 100%)`, Titel mit Ellipse. Für Screenreader „verknüpft mit …“.
  Daten über `connectionHints(type, ids)` — ein Abruf je Liste.
- **`<app-connections variant="card" heading="…">`**: Karten-Variante (Padding 20/22, Rand `--border-subtle`, Radius
  `--radius-lg`, Titel `--fs-subsection`) für Seiten; Standard bleibt der graue Abschnitt im Dialog.

### Startseite — Vier Antworten, Fortschritt, Idee für heute (31.10.2026)

- Rechnungen in `features/dashboard/dashboard-pulse.ts` (rein, getestet in `dashboard-pulse.spec.ts`): `financeAnswer`
  (heute ausgegeben via `spentOn`, Tagessatz), `householdAnswer`, `organisationAnswer` (nutzt `dayLine`/`nextUp` aus
  `organisation/org-day-logic.ts`; Termine des Tages lädt das Dashboard über `OrganisationApi.events`),
  `travelAnswer` (`preparation`), `progressRings`, `ideaForToday`.
- `app-dash-answers` (`dash-answers.*`): 4 Spalten, ≤ 1100 px 2 × 2; Karte ≥ 150 px (Handy 132), `--a`/`--a-soft` je
  Bereich, Hover hebt 2 px, Einblenden gestaffelt nur per `translateY`.
- `app-dash-progress` (`dash-progress.*`): `container-type: inline-size`, ab 560 px Ringe nebeneinander; Ring =
  `conic-gradient` + Maske, dreht einmal auf (nur Bewegung); „Idee für heute“ gestrichelte Karte.
- Raster `.board`: `'today money' 'pulse soon' 'foryou soon'`, ≤ 1100 px eine Spalte (today · money · pulse · soon ·
  foryou). „Demnächst“: `app-trip-pass` über volle Breite (`.soon__pass`), Haushalt-Frist darunter.

### Abnahme-Korrekturen (31.10.2026)

- `spend-curve.ts`: Ablesewert am heutigen Tag „Bis heute im <Monat>“.
- Tagessatz nur bei ≥ 2 Resttagen (Dashboard `money.left`, Finanzen `daysLeft()`).
- Wortwahl Zeitlücken: „ohne Termin“ / „nichts eingetragen“ (`org-today.html`, `dashboard-pulse.ts`); nie „frei“.
- `reisen-logic.ts`: `preparation()` ersetzt durch `packingShare()` (nur Packliste). `trip-pass` ohne
  Vorbereitungsbalken; `trip-list` Balken = Packliste mit Beschriftung `.later-card__bar-label`; `dash-answers`
  Balken nur mit `barLabel`.
- Haushalt `.room__bar` entfällt → `.room__count` („n offene Aufgaben“, Trennlinie oben); `RoomState.fill` entfernt.
- Dashboard ≤ 760 px: `TODAY_ROWS_MOBILE = 3`, `h1` 1.625rem, `.greeting` Abstand `--space-4`.
- Demo: `daysToNext(month, day)` in `demo-reisen-api.ts`.
- Nachtrag: `dashboard.ts dayLine` ohne Datum; `.hero__fairbar` ist eine `ul` mit `li` je Person (`flex-grow` = Anzahl,
  `min-width: max-content`, 30 px, abwechselnd `#fff`/`#8f1f3c` und `color-mix(#000 28%, --household-accent)`/`#fff`);
  `link-hints .hint__t` mit `overflow-wrap: anywhere` statt Ellipse; Demo-`allItems` mischt `household().today` ein.
- Datum nur in der Kopfzeile: `uebersicht-tab` (`.hero__date` „Dein Zuhause heute“) und `org-today` (`.day-hero__date`
  „Dein Tag“) ohne `dateLine`.

### Personen & Gruppen und Einstellungen (31.10.2026)

- `familie-circle.scss`: `.circle` (Tinte, Text ≥ 93 % Weiß, Schild `#9fe0bd`), `.circle__faces` (Avatare 64/48 px,
  Rand 3 px Tinte, −14 px Überlappung, Einblenden nur per `translateY`), `.shared-chips`/`.shared-chip[data-kind]`
  (28 px, Radius 12, `--travel-*`/`--household-*`). `familie.ts circleFacts()` zählt Personen, Familie, geteilte Bereiche.
  `.people-row` Spalten `auto 0.8fr 1.4fr auto`.
- `einstellungen/settings-layout.ts/.scss`: `220px | minmax(0, 720px)`, Navigation sticky (top 24 px), Links 44 px;
  ≤ 960 px eine Spalte, Leiste aus, `.sl__back` an. Neues Symbol `monitor` in `app-icon`.
- `einstellungen.css` (gemeinsam für Profil, Zwei-Faktor, Sitzungen): nur Tokens; `.settings-profile` (Avatar 64 px
  Tinte), `.settings-check` mit `.is-ok` (`--success-soft`), `.is-todo` (`--warning-soft`, Knopf in Tinte), `.is-wait`.
  Kontoschutz-Daten: `currentUser().email_verified`, `MfaApiService.status()`, `AuthService.sessions()` — unbekannt =
  „wird geprüft …“, nie eine Behauptung.
- Profil/Zwei-Faktor/Sitzungen: Blau-Werte (`#164ed0`, `#142143`, `#56627a`, …) durch Tokens ersetzt; kleinste Schrift
  13 px.
- `shared/scroll-lock`: sperrt nur noch `html` (nicht `body` — dessen `height: 100%` schnitt die Seite ab und setzte
  die Scrollposition auf 0). `shared/modal`: erst entsperren, dann Fokus mit `preventScroll` zurückgeben.
- WCAG 2.5.3: kein `aria-label`, das vom sichtbaren Text abweicht — stattdessen `.sr-only`-Zusatz nach dem sichtbaren
  Text (z. B. Kalender `dayRest()`: „26“ + „. Oktober 2026 (Montag), 1 Termin“). Prüfung mit
  `wcag21a`/`wcag21aa` auf allen Bereichsseiten.

### Gemeinsame Kalender (31.10.2026)

- `organisation/org-calendars.*` (`app-org-calendars`): Filter `CalendarFilter = 'all' | 'mine' | id` (Chips 44 px,
  aktiv Tinte, Farbpunkt 10 px), Verwaltungs-Dialog (`app-modal`, max. 560 px, `.sc-card` mit 4-px-Farbkante,
  Mitglieder-Zeilen 44 px, Rolle als natives `select`, Entfernen 44-px-Knopf mit verstecktem Namen).
- `organisation.ts`: `calendars`, `calendarFilter`, `visibleEvents` (Filter), `writableCalendars`, `eventReadOnly`,
  `calendarLocked`, `calendarHint`; Formularfeld `calendar` ('' = privat). `modal-form`: leeres `submitLabel` = ohne
  Speichern-Knopf.
- `.cal-tag[data-color]` in `org-common.scss` (Agenda, Heute); `.cal-choice*` und `.ro-event*` in `organisation.scss`.
- Demo: `DemoOrganisationApi` mit Kalender „Familie“ (Sophie Besitzerin, Max „Kann bearbeiten“) und zwei gemeinsamen
  Terminen; `DemoContactsApiService` teilt „Familie“ mit Max und bietet ihn Lena an.
- Kalenderfreigabe (wie Outlook): Filter-Chip „Kalender von …“ (`CalendarFilter` `p<id>`, Initiale 22 px statt
  Farbpunkt, Farbe Schiefer); Verwaltungs-Dialog heißt „Kalender teilen“ mit Karten „Dein Kalender“ (Freigaben mit
  Rolle als `select`, Beenden-Knopf, „Person freigeben“ mit Personen- und Rollen-Chips) und „Für dich freigegeben“
  (Entfernen), danach Zwischentitel `.sc-section` „Gemeinsame Kalender für Gruppen“. Bedienelemente einer Zeile in
  `.sc-ctrl` (bricht als Gruppe rechtsbündig um, Namen brechen nie mitten im Wort). Termin-Dialog: „Wer sieht den
  Termin?“ (🔒 Nur ich · Gruppen-Kalender · Personen-Chips mit Initiale `.cal-choice__avatar`, mehrfach wählbar),
  Hinweis `aria-live`. Fremde freigegebene Termine: Marke „Kalender von …“ (Schiefer) und Nur-Ansehen-Ansicht.
  Demo: Sophies Kalender für Max freigegeben („Badminton“ geteilt), Lenas Kalender für Sophie („Lenas Umzug“).
- Tagesblatt `organisation/org-day-sheet.*` (`app-org-day-sheet`, `app-modal`): Kopf mit 44-px-Symbol, Zeilen
  `.ds__row` (76 px Zeit | Text | Pfeil, min. 60 px), `.ds__add` (48 px, gestrichelt, `--organization-soft`). Steuerung in
  `organisation.ts`: `daySheet`, `openOnDay` (mit Terminen → Tagesblatt, sonst Dialog), `fromSheetOpen`/`fromSheetAdd`,
  `editorClosed` kehrt zum Tagesblatt zurück. Woche: `.week__col` als Flex-Spalte, `.week__add` füllt den Rest
  (min. 44 px). Demo-Annehmen: `.sc-link--demo` (Kalender) und `.shared-chip--demo` (Personen & Gruppen), nur bei
  `DEMO_MODE`; offene Einladungen neben Geteiltem: `.shared-chip--pending` (gestrichelt).
- Datums-/Uhrzeitauswahl: `aria-labelledby` = Beschriftung + Wert-Span (`dp-text-n`/`tp-text-n`), bei Teil-Feldern
  `aria-label` „Feld – Teil, Wert“.
- Kündigungsfrist im Vertragsdialog (02.11.2026, `haushalt/ordner-tab.*`): `.field-row.notice-field` (immer 2 Spalten,
  `align-items: end`) mit `app-field` „Kündigungsfrist“ und `app-select` (Einheit, `aria-labelledby` auf versteckten
  Text „Einheit der Kündigungsfrist“, `.sr-only`); `.notice-renewal` (min. 44 px) für „Verlängert sich automatisch“.
  Logik: `vertraege-logic.cancellationDeadline(end, days, months)` und `noticeLabel(days, months)`, dieselbe Regel wie
  backend `haushalt/services.cancellation_deadline`.
- Vertrag/Gerät-Felder (02.11.2026, `haushalt/ordner-tab.*`): Signale `formNextCost`/`formNextFrom`, `formLead`
  (`LEAD_OPTIONS`), `formLastMaintenance`/`formSerial`; `setMaintenanceBasis(last, interval)` setzt „Nächste Wartung“ =
  `addMonthsIso(last, interval)`. Anzeige `leadLabel`, `moneyLabel` (`vertraege-logic.ts`). Regeln gespiegelt in
  `shared/connections/auto-link-rules.ts`: `costOn(c, day)`, `contractLeadDay(c, day)`; Demo `applyDuePrice` und
  Kalender-Eintrag `contract-lead:{id}`. „Erinnern“ steht mit der Checkbox in einer `.field-row` (`.check-field`).
- Beta-Feedback (04.11.2026): `shared/beta-feedback/beta-feedback-dialog.*` (`app-beta-feedback-dialog`, Eingaben `open`,
  `areas`, `tasks`, `area`; `reset()` beim Öffnen), Dienst `beta-feedback.service.ts` (GET Schalter/Listen, POST
  senden; kein Lesen). Umschalter `.bf-option` (44 px, `aria-pressed`, `--border-control`, gewählt `--brand-primary`),
  Fragen als `fieldset.bf-scale` mit `legend`. Kontomenü: `AppShell.betaInfo` (einmal beim ersten Öffnen),
  `.beta-mark`. `app-modal-form`: leeres `cancelLabel` blendet „Abbrechen“ aus.
- Testversion GitHub Pages (06.11.2026): `core/demo-only.ts` (`DEMO_ONLY` aus `environment.pages.ts`); Komponenten
  blenden Wege zu Anmeldung/Registrierung mit `@if (!demoOnly)` aus. Schriftpfad `/fonts/…` setzt
  `scripts/build-pages.mjs` auf den Unterordner. Vor dem Livegang entfernen (`docs/GITHUB_PAGES_DEMO.md`).
- Finanzen › Ordnerstruktur (06.11.2026, Umbau ohne Änderung an Optik und Verhalten — pixelgleich geprüft):
  `features/finanzen/` = Rahmen `private-finance.*` (Kopf, Reiter, Monatsladen, Formular-Zustand, Import, Meldungen); der
  gemeinsame Dialog Transaktion/Budget/Sparziel ist seit 07.11.2026 `editor/finance-editor.*` (Formular-Ansicht,
  Warnungen, neue Kategorie, Verbindungen, Speichern/Löschen; `open()` bleibt im Rahmen und setzt über
  `resetLinks()` den Verbindungs-Baustein zurück) + `finance-context.ts` (Token `FINANCE_CONTEXT`, Typen `FinanceTab`/`ListRow`/…).
  Reiter als eigene Komponenten: `overview/finance-overview-tab.*` (mit `finance-period.*`, `finance-periods.ts`),
  `transactions/finance-transactions-tab.*` (mit Kontoauszug-Import), `budgets/finance-budgets-tab.*` (mit
  `budget-year-card`, `budget-timeline`, `category-manager`), `goals/finance-goals-tab.*`; Datumsauswahl
  `shared/finance-date-nav.*` (`display: contents`, Varianten `in-period`/`in-toolbar`). Daten in `data/` (APIs, Demo,
  Datenquellen, Zustand), Berechnungen in `shared/finance-tabs.ts`/`finance-overview.ts`. Stile je Komponente in fester
  Reihenfolge: `shared/finance-charts.scss` → `shared/finance-blocks.scss` → `shared/_fin-look.scss` →
  `shared/finance-blocks-late.scss` → eigene Datei (so bleibt die Kaskade wie vorher; jede Datei unter 12 kB). Die
  Reiter lesen Zustand und Aktionen über `inject(FINANCE_CONTEXT)` (Signale, keine Kopien). Typografie des Seiten-
  Layouts (`.domain-page small` …) gilt in den Reitern über `:host-context(.domain-page)`.
