# Kompass — Style Reference
> ein klarer Weg durch den Alltag

**Theme:** ausschließlich hell — kein Dark Mode. Auf ausdrücklichen Wunsch entfernt (`ThemeService`, der Umschalt-Button in Header/Sidebar und alle `prefers-color-scheme`/`[data-theme]`-Regeln in `styles.css` sind gestrichen), nicht nur ungenutzt liegen gelassen.

**Version 3 — vollständiger Ersatz des vorherigen „Aurora"-Systems (Violett/Amber-Verlauf, Fraunces-Serife).** Ausgangspunkt war ein vom Nutzer vorgelegter Design-Entwurf (App- und Web-Mockup: Anmelden/Registrieren/Überblick/Finanzen), der ein ruhigeres, monochromeres Tannengrün-System zeigt — flache weiße Karten statt Glow-Schatten, eine einzige Sans-Serife statt zwei Schriftfamilien, kein Text-Verlauf auf der Hero-Zahl. Alle Farbwerte unten sind direkt aus diesem Entwurf gemessen (Pixel-Sampling), nicht neu erfunden. Die Entscheidung „komplett ersetzen, nicht parallel dokumentieren" wurde vom Nutzer bestätigt.

**Warum der Wechsel:** Das vorherige Aurora-System (Violett+Amber-Verlauf, Fraunces-Serife) war explizit als „signature wow effect" gedacht — unterscheidungskräftig, aber auch das Risiko einer für eine Finanz-App unruhigeren Optik. Tannengrün ist die naheliegendere Fintech-Konvention (vertrauter, „bankiger"), dafür ruhiger und mit weniger Reizüberflutung — was der eigenen Anforderung „wenig Animation, auch für ältere Nutzer:innen" (`GESAMTKONZEPT.md` §3) direkter entspricht. Das ist ein bewusster Tausch: weniger Wiedererkennungswert gegen mehr Vertrauens-Konvention, vom Nutzer nach Abwägung so entschieden.

**Was aus Version 2 übernommen bleibt (Prinzip, nicht Farbwert):** Karten mit weichem Schatten auf mobilen Breiten, flache Listen mit Trennlinien statt Karten-Raster in dichten Aufzählungen (Kategorien, Transaktionen, Feste Abzüge), „nie Farbe allein" bei Status, Mindestgrößen für Tastaturfokus/Tap-Ziele, skalierbare Typografie über einen `--text-scale`-Multiplikator.

**Was neu ist:** eine einzige Schriftfamilie (Inter) für Überschriften UND Fließtext statt zwei Familien; ein einziger Marken-Akzent (Tannengrün) statt drei Modulfarben für Navigation/aktive Zustände — Kategorien/Module unterscheiden sich stattdessen durch Icon-Form plus eine kleine, kuratierte Zusatzpalette (Amber, Terrakotta) für frei wählbare Kategorie-Farben; eine echte Sidebar-Navigation für breite Bildschirme (vorher: reine Kopfzeilen-Navigation ohne eigenständige App-Shell).

---

## Tokens — Farben

Alle Werte unten wurden per Pixel-Sampling aus dem Entwurf gewonnen (kein geschätzter Farbwert) und anschließend gegen WCAG 2.1 AA geprüft (relative Luminanz, sRGB).

| Name | Value | Token | Rolle | Kontrast auf Canvas |
|------|-------|-------|------|------|
| Sage Canvas | `#eaf0eb` | `--color-sage-canvas` | Seiten-Hintergrund — helles, leicht grünliches Off-White statt reinem Weiß | — |
| Card White | `#ffffff` | `--color-card-white` | Karten-/Modul-Flächen auf dem Canvas | — |
| Fog Surface | `#f5f7f4` | `--color-fog-surface` | Eingabefeld-Hintergründe, dezente Gruppierung auf weißen Karten | — |
| Pine (Primär) | `#164c49` | `--color-pine` | **Text-sicherer** Marken-Akzent — Buttons (gefüllt), Links, aktive Icons, Hero-/Sidebar-Flächen | **9.70:1** (AAA) |
| Pine Deep | `#205753` | `--color-pine-deep` | Zweiter Tanngrün-Ton für große flächige Bereiche (Sidebar-Panel, Login-Splitpanel) — dieselbe Familie wie Pine, minimal heller für Tiefenwirkung ohne Verlauf | — |
| Midnight Pine | `#183b3b` | `--color-midnight-pine` | Primäre Überschriften, Fließtext, größte Beträge — nahezu Schwarz mit grünem Unterton | **10.51:1** (AAA) auf Canvas, **12.16:1** auf Weiß |
| Dusk Sage | `#556660` | `--color-dusk-sage` | Sekundärtext, Bildunterschriften, Meta-Angaben | **5.26:1** (AA) auf Canvas, **6.08:1** auf Weiß |
| Hairline | `#e2e8e4` | `--color-hairline` | Karten-Ränder, Trennlinien | — |
| Hairline Strong | `#bfcfc4` | `--color-hairline-strong` | Icon-Container-Tint, kräftigere Trennlinie, Fortschrittsbalken-Track | — |
| Amber | `#c98f59` | `--color-amber` | Dekorativer Zusatzakzent (Kategorie-Farbe, "fast am Ziel") — **nur** als Fläche, nie als Text auf hellem Grund | 2.78:1 (nur Fläche/Dekoration) |
| Amber Ink | `#8a5a23` | `--color-amber-ink` | Text-sichere Variante von Amber für Labels/Warnhinweise | **5.09:1** (AA) auf Canvas |
| Success | `#276b48` | `--color-success` | Text/Icon „im Rahmen", positive Einschätzung | **5.53:1** (AA) auf Canvas |
| Danger | `#a8452f` | `--color-danger` | Text/Icon „über dem Ziel", Fehler | **5.11:1** (AA) auf Canvas |

**Kern-Kontrastregel (unverändert aus Version 2):** Amber und jeder rein dekorative Farbwert tragen niemals allein die Information — jede Text-/Icon-Verwendung hat eine dunklere „Ink"-Variante mit geprüftem Kontrast. Dusk Sage ist absichtlich so gewählt, dass es **auf beiden** Untergründen (Canvas und Weiß) über 4,5:1 liegt — anders als in Version 2 (dort war „Dusk Helper" nur ab 14px sicher), damit hier keine Größenausnahme mehr dokumentiert werden muss.

### Warum keine drei Modulfarben mehr

Version 2 kodierte Finanzen/Haushalt/Organisation über drei Akzentfarben (Violett/Amber/Grün). Der neue Entwurf verwendet **einen** Marken-Akzent (Pine) für alle aktiven/interaktiven Zustände, gleich in welchem Modul — Unterscheidung passiert über die Icon-Form (Wallet/Haus/Kalender), nicht über Farbton. Das ist bewusst ruhiger.

**Ausnahme, bewusst beibehalten:** Die „Deine Module"-Liste auf dem Dashboard nutzt weiterhin drei unterschiedlich getönte Icon-Container zum schnellen visuellen Scannen (vormals dokumentiert als „bewusste Ausnahme vom Minimalismus", Version 2) — jetzt als gedämpfte Sage-/Pine-Familientöne statt eines Regenbogens:

| Token | Value | Rolle |
|---|---|---|
| `--module-finance-bg` / `--module-finance-ink` | `#e2ede9` / `#164c49` | Icon-Container „Finanzen" |
| `--module-household-bg` / `--module-household-ink` | `#f3ead9` / `#8a5a23` | Icon-Container „Haushalt" |
| `--module-organize-bg` / `--module-organize-ink` | `#dfe9e1` / `#205753` | Icon-Container „Organisation" |

### Kuratierte Kategorie-Farbpalette

Frei angelegte Finanz-Kategorien wählen aus einer kleinen, geprüften Palette (ersetzt die vorherige Violett/Amber/Rot-Auswahl):

`#164c49` (Pine) · `#8a5a23` (Amber Ink) · `#a8452f` (Danger/Terrakotta) · `#205753` (Pine Deep) · `#556660` (Dusk Sage)

---

## Tokens — Typografie

### Inter — einzige Schriftfamilie, für Überschriften UND Fließtext · `--font-inter`

**Bewusste Vereinfachung gegenüber Version 2:** Der Entwurf zeigt durchgängig eine einzige serifenlose Schrift, keine zweite Display-Schrift für Überschriften/Beträge. Das spart eine Web-Font-Ladung, verringert das Risiko einer Optik, die „gestylt" statt „ruhig" wirkt, und entspricht der Grundhaltung des neuen Entwurfs. Fraunces entfällt vollständig.

- **Google Fonts:** `Inter:wght@400;500;600;700;800`
- **Gewichte:** 500 (Standard-Fließtext), 600 (Zwischenüberschriften, aktive Navigation), 700 (Buttons, Beträge), 800 (größte Überschriften/Hero-Beträge)
- **Zeilenhöhe:** 1.15–1.2 für Überschriften, 1.5–1.6 für Fließtext
- **Laufweite:** normal (0), Großbuchstaben-Labels +0.04em
- **OpenType-Feature:** `font-variant-numeric: tabular-nums` verpflichtend auf allen Geldbeträgen

### Type Scale

| Rolle | Größe | Gewicht | Zeilenhöhe | Token |
|------|------|--------|-------------|-------|
| caption | 13px | 500 | 1.4 | `--text-caption` |
| body-sm | 15px | 500 | 1.5 | `--text-body-sm` |
| body | 17px | 500 | 1.6 | `--text-body` |
| body-lg | 19px | 500 | 1.6 | `--text-body-lg` |
| subheading | 21px | 600 | 1.3 | `--text-subheading` |
| heading-sm | 24px | 700 | 1.2 | `--text-heading-sm` |
| heading | 32px | 700 | 1.15 | `--text-heading` |
| display | 40px | 800 | 1.1 | `--text-display` |
| amount-hero | 44px | 800, tabular-nums | 1.05 | `--text-amount-hero` |

**Skalierbarkeit (BFSG-Pflicht, unverändert aus Version 2):** Alle Größen laufen über `--text-scale` (100/115/130 %), `rem`-basiert.

---

## Tokens — Abstand & Formen

**Dichte:** comfortable, unverändert aus Version 2 — großzügiger Weißraum, große Tap-Ziele.

### Radien

| Element | Wert |
|---|---|
| Karten (mini-cards, Sidebar-Panel) | 20px |
| Zeilen (task-rows, Kategorie-Zeilen) | 16px |
| Hero-/Bilanz-Karte | 24px |
| Eingabefelder | 12px |
| Buttons | 100px (Pill) |
| Icon-Container | 10–12px |

### Tap-Ziele (BFSG/WCAG 2.5.5, unverändert)

| Element | Mindestgröße |
|---|---|
| Buttons, Icon-Buttons | 44×44px |
| Bottom-Nav-/Sidebar-Einträge | 48×48px |
| Eingabefelder | Höhe ≥ 48px |

### Schatten

**Deutlich zurückhaltender als Version 2** — kein Glow-Effekt mehr, keine Verlaufs-Schatten. Ein einziger, dezenter Kartenschatten:

| Name | Wert | Token | Verwendung |
|---|---|---|---|
| card-soft | `rgba(22, 40, 36, 0.08) 0px 8px 20px -10px` | `--shadow-card-soft` | Standard-Karten (Hero, Mini-Karten, Sidebar-Panel) |
| focus-ring | `0 0 0 3px rgba(22, 76, 73, 0.35)` | `--shadow-focus` | Tastaturfokus auf jedem interaktiven Element — **Pflicht** |

---

## Komponenten

### Primärer Button
Gefüllt, Hintergrund `--color-pine`, Text `#ffffff` (Kontrast 9.70:1), Radius 100px (Pill), Padding 14px 28px, Inter 700 17px, Pfeil-Icon optional. Kein Verlauf, kein Glow — flache Füllung.

### Sekundärer Button
Hintergrund `--color-card-white`, Text `--color-pine`, Rand 1.5px `--color-pine`, Radius 100px, Padding 14px 28px, Inter 600 17px.

### Hero-/Bilanz-Karte
**Zwei Varianten, je nach Kontext — beide OHNE Text-Verlauf (Unterschied zu Version 2):**

- **Gefüllt (Login/Register-Splitpanel, mobiler Dashboard-Hero):** Hintergrund `--color-pine` oder `--color-pine-deep`, Radius 24px, Padding 22px, Text durchgängig Weiß, Betrag Inter 800 44px mit `tabular-nums`. Fortschrittsbalken-Track `rgba(255,255,255,0.25)`, Fortschrittsbalken-Fill Weiß.
- **Flach (Finanzen-Übersicht/-Analysen, Web-Dashboard):** Keine Kartenfläche, nur `border-bottom: 1px solid var(--color-hairline)`, Betrag in `--color-midnight-pine` (kein Verlauf, kein transparent-Trick), Fortschrittsbalken-Track `--color-hairline-strong`, Fill `--color-pine`.

Beide Varianten zeigen den Fortschritt **immer zusätzlich als Zahl**, nie nur als Balkenfläche.

### Sidebar-Navigation (neu — ersetzt die reine Kopfzeilen-Navigation für breite Bildschirme)
**Rolle:** Primäre Navigation ab 960px Breite, für alle angemeldeten App-Bereiche (Überblick/Finanzen/Haushalt/Organisation).

Feste linke Spalte, 260px breit, Hintergrund `--color-card-white`, rechter Rand 1px `--color-hairline`. Von oben nach unten: Logo + Markenname, Haushalts-Kennung (Name + Mitglieder-Avatare, wiederverwendet aus dem bestehenden „household-strip"-Muster), Navigationsliste (Icon + Label, aktiver Eintrag: Hintergrund `--color-fog-surface`, Text/Icon `--color-pine`, linker Akzentstrich 3px `--color-pine`), am unteren Rand abgesetzt durch `--color-hairline`: Einstellungen-Link + Profil-Avatar. Unter 960px vollständig ausgeblendet, dort übernimmt die bestehende Bottom-Navigation.

### Login-/Register-Splitpanel
**Rolle:** Anmelde-/Registrierungsseite, zweispaltig ab 720px (einspaltig darunter, Splitpanel entfällt zugunsten des reinen Formulars).

Linke Spalte (ca. 44% Breite): Hintergrund `--color-pine`, Text Weiß, große Headline (zweizeilig, z. B. „Ein Überblick. Für euren Alltag."), darunter eine kleine, **abgedunkelte** Vorschau-Karte (Hintergrund `--color-pine-deep`, Rand `rgba(255,255,255,0.12)`) mit Beispiel-Betrag und zwei Mini-Fakten (Icon + Kurztext), unten der Vertrauenshinweis „Keine Bankverbindung nötig." Rechte Spalte: Formular auf `--color-card-white`, Feldgruppen wie gewohnt.

### Balance-Streifen / Kategorien-Zeile
Kein Card-Rahmen in Listenkontexten (Kategorien, Feste Abzüge, Transaktionen) — Zeilen mit `border-bottom: 1px solid var(--color-hairline)`, letzte Zeile ohne Trennlinie. Fortschrittsbalken pro Zeile: Track `--color-hairline-strong`, Fill `--color-pine` (oder die individuell gewählte Kategorie-Farbe), Höhe 5px, immer mit Prozentzahl daneben.

### Status-Anzeige
Unverändert aus Version 2: **nie** Farbe allein — farbiger Punkt (min. 10px) **+** Icon **+** Textlabel.

---

## Do's and Don'ts

### Do
- Ein einziger Marken-Akzent (Pine) für alle aktiven/interaktiven Zustände, modulübergreifend
- Flache, gefüllte Buttons — kein Ghost-Outline als Primäraktion
- `tabular-nums` auf jedem Geldbetrag
- Sidebar ab 960px, Bottom-Nav darunter — nie beide gleichzeitig sichtbar
- Ein einziger, dezenter Kartenschatten (`--shadow-card-soft`) statt mehrerer Schatten-Ebenen
- Sichtbarer Fokusring auf jedem interaktiven Element, ausnahmslos

### Don't
- Kein Text-Verlauf mehr auf Beträgen (war Version 2, jetzt entfernt)
- Kein Glow-Schatten, keine Ambient-Blobs
- Keine zweite Schriftfamilie für Überschriften
- Kein reiner Amber-Ton als Text auf hellem Grund — nur die „Ink"-Variante
- Keine drei Modulfarben mehr für Navigation/aktive Zustände (Ausnahme: die drei gedämpften „Deine Module"-Icon-Container, siehe oben)

---

## Agent Prompt Guide

**Quick Color Reference**
- Primärtext: `#183b3b` (Midnight Pine)
- Sekundärtext: `#556660` (Dusk Sage)
- Canvas-Hintergrund: `#eaf0eb`
- Karten: `#ffffff`
- Primäraktion: `#164c49` (Pine), gefüllt, nie Ghost-Outline
- Kein Verlauf, keine zweite Schriftfamilie

## Quick Start

### CSS Custom Properties

```css
:root {
  --text-scale: 1; /* 1 / 1.15 / 1.3 je nach Einstellung */

  --color-sage-canvas: #eaf0eb;
  --color-card-white: #ffffff;
  --color-fog-surface: #f5f7f4;
  --color-pine: #164c49;
  --color-pine-deep: #205753;
  --color-midnight-pine: #183b3b;
  --color-dusk-sage: #556660;
  --color-hairline: #e2e8e4;
  --color-hairline-strong: #bfcfc4;
  --color-amber: #c98f59;
  --color-amber-ink: #8a5a23;
  --color-success: #276b48;
  --color-danger: #a8452f;

  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --text-caption: calc(13px * var(--text-scale));
  --text-body: calc(17px * var(--text-scale));
  --text-subheading: calc(21px * var(--text-scale));
  --text-heading: calc(32px * var(--text-scale));
  --text-display: calc(40px * var(--text-scale));
  --text-amount-hero: calc(44px * var(--text-scale));

  --radius-cards: 20px;
  --radius-hero-card: 24px;
  --radius-inputs: 12px;
  --radius-buttons: 100px;

  --shadow-card-soft: rgba(22, 40, 36, 0.08) 0px 8px 20px -10px;
  --shadow-focus: 0 0 0 3px rgba(22, 76, 73, 0.35);
}
```

## Was bewusst NICHT aus Version 2 übernommen wurde

- **Dark Mode** — auf ausdrücklichen Wunsch vollständig entfernt (Code, Tokens, Umschalter), nicht nur ungenutzt belassen.
- **Der Aurora-Text-Verlauf** auf der Hero-Zahl (Violett→Amber) — ersetzt durch flache Einfarbigkeit.
- **Fraunces** als zweite Schriftfamilie — ersetzt durch Inter durchgängig.
- **Drei Modulfarben** für Navigation/aktive Zustände — ersetzt durch einen Marken-Akzent plus Icon-Form-Unterscheidung.
- **Glow-Schatten/Ambient-Blobs** — ersetzt durch einen einzigen dezenten Kartenschatten.
- **Kopfzeilen-only-Navigation** für breite Bildschirme — ersetzt durch eine eigenständige Sidebar.
