# Lumiknot — Design Tokens

> Teil der Brand Governance (`docs/BRAND_GOVERNANCE.md`): verbindlich für alle Token-Werte, Farben, Kontraste, Typografie-, Bewegungs- und Breakpoint-Werte.

Stand 28.11.2026. Verbindlich für alle Stylesheets. Übergeordnet: `docs/DESIGN_SYSTEM.md` (Regeln, Bausteine,
Layout), Kurzfassung `DESIGN.md`; Marke: `docs/BRAND_GUIDELINES.md`, `docs/BRAND_CONFIGURATION.md`.

**Designhaltung – Quiet Luxury:** warmes Papier (Ivory), tiefe Tinte (Midnight), wenig Farbe, klare Typografie,
präzise Abstände. Qualität zeigt sich in Ruhe und Sorgfalt, nicht in Effekten: keine Verläufe, kein Glas, kein Glow,
Schatten nur für echte Ebenen.

## 1. Ebenen

```text
1 Primitive        --lk-midnight, --lk-paper-200, --lk-finance-ink …     shared/styles/tokens.css
      ↓ nur über
2 Semantik         --surface-card, --text-secondary, --success …         src/styles.css (+ theme-dark.css)
      ↓
3 Komponenten      --button-primary-bg, --field-border, --card-radius …  shared/styles/tokens.css
4 Bereichs-Theme   --area-accent, --area-soft … an [data-area]          shared/styles/tokens.css
```

| Ebene | Regel |
|---|---|
| **Primitive** (`--lk-*`) | Die einzigen Stellen mit Farbwerten. Komponenten verwenden sie **nie** direkt. Neue Farben entstehen hier und werden über eine Rolle freigegeben. |
| **Semantik** | Rollen mit Bedeutung (Fläche, Text, Linie, Status, Fokus). Hell in `styles.css`, Dunkel überschreibt dieselben Namen in `theme-dark.css`. Komponenten verwenden diese Ebene. |
| **Komponenten** | Rollen eines Bausteins (Knopf, Feld, Karte, Chip, Dialog, Navigation). Zeigen auf Semantik. Neue und überarbeitete Bausteine nutzen sie; bestehende werden bei Gelegenheit umgestellt (kein Großumbau). |
| **Bereichs-Theme** | `--area-*` – der Akzent des aktuellen Bereichs. Die App-Shell setzt `data-area` (= Logo-Kontext aus `core/brand/brand.config.ts`); Komponenten, die „im Bereich“ eingefärbt sein sollen, nutzen `--area-accent` statt eines festen Bereichs. |

Ladefolge (`angular.json`): `tokens.css` → `styles.css` → Formular-Styles → `theme-dark.css`.

## 2. Farben

### Primitive

| Gruppe | Tokens | Werte |
|---|---|---|
| Markenneutrale | `--lk-midnight` · `--lk-graphite` · `--lk-ivory` · `--lk-white` | `#101820` · `#29323B` · `#F7F6F2` · `#FFFFFF` |
| Papier (warm, hell) | `--lk-paper-100…600` | `#F2F1EC` · `#EEECE7` · `#E8E6E0` · `#DFDCD5` · `#BAB6AD` · `#857F76` |
| Schiefer (kühl) | `--lk-slate-400/600` | `#8B929A` · `#4F5965` |
| Nacht (dunkel) | `--lk-night-950…50` | `#0E141A` … `#E9EDF1` (14 Stufen) |
| Bereiche | `--lk-<bereich>-brand/-ink/-tint/-ink-dark/-tint-dark/-fill-dark` | siehe unten |
| Status | `--lk-green/amber/red/blue-700/50/300/950` | hell: Text/Tönung, dunkel: Text/Tönung |
| Diagramme | `--lk-chart-*` (+ `-dark`) | Datenvisualisierung |

| Bereich | `-brand` (Logo) | `-ink` (Text hell) | `-tint` | `-ink-dark` | `-tint-dark` | `-fill-dark` |
|---|---|---|---|---|---|---|
| finance | `#13A274` | `#0E7957` | `#E3F4EE` | `#5CC79C` | `#17302A` | `#1F7A5C` |
| household | `#F59A42` | `#955E28` | `#FEF3E8` | `#F2A35C` | `#352719` | `#9A5A1F` |
| organization | `#7864E7` | `#6A59CC` | `#EFECFC` | `#A99BF2` | `#25213D` | `#5B4BC0` |
| travel | `#2197BE` | `#197390` | `#E4F3F7` | `#6CC3E0` | `#17303A` | `#1D6D88` |

### Semantik

| Rolle | Token | Hell | Dunkel |
|---|---|---|---|
| Hintergrund | `--surface-app` (= `--surface-background`) | Ivory | Nacht 950 |
| Fläche | `--surface-card` | Weiß | Nacht 900 |
| Erhöhte Fläche | `--surface-elevated` | Weiß | Nacht 850 |
| Hover | `--surface-hover` (= `--state-hover-bg`) | Papier 100 | Nacht 800 |
| Aktiv / gedrückt, zweite Fläche | `--surface-pressed` (= `--state-active-bg`), `--surface-sunken` | Papier 200 | Nacht 750 / 925 |
| Deaktiviert | `--surface-disabled`, `--text-disabled`, `--border-disabled`, `--state-disabled-opacity` | Papier 100, Schiefer 400, Papier 300, 0,5 | wie hell bzw. Nacht |
| Text primär | `--text-primary` | Midnight | Nacht 50 |
| Text sekundär / leise | `--text-secondary` = `--text-muted` | Schiefer 600 | Nacht 200 |
| Text auf Akzent | `--text-on-accent` | Weiß | Weiß |
| Linie | `--border-subtle` (= `--divider`) · `--border-default` · `--border-strong` | Papier 300 · 400 · 500 | Nacht 700 · 650 · 500 |
| Feldrand | `--border-control` | Papier 600 | Nacht 400 |
| Akzent (Knöpfe, Auswahl) | `--brand-primary` (= `--accent`), Hover `--brand-primary-hover` | Midnight / Graphite | Nacht 600 / 550 |
| Fokus | `--focus-color`, `--focus-width` 3 px, `--focus-offset` 2 px, `--focus-ring` | Midnight | Nacht 50 |
| Links | `--text-link`, `--text-link-hover` | Midnight / Graphite | Nacht 50 / Weiß |
| Erfolg | `--success`, `--success-soft` | Grün 700 / 50 | Grün 300 / 950 |
| Warnung | `--warning`, `--warning-soft` | Amber 700 / 50 | Amber 300 / 950 |
| Fehler | `--error` (= `--danger`), `--error-soft` | Rot 700 / 50 | Rot 300 / 950 |
| Information | `--info`, `--info-soft` | Blau 700 / 50 | Blau 300 / 950 |
| Bereich | `--<bereich>-accent/-soft/-fill/-on` | `-ink` / `-tint` / `-ink` / Weiß | `-ink-dark` / `-tint-dark` / `-fill-dark` / Weiß |
| Logo | `--logo-<bereich>` | `-brand` | `-brand` |

### Farbregeln

1. **Markenfarben sind keine Textfarben.** `--logo-*` nur für Logo, Farbpunkte, Dekor (2,2–4,4:1 auf Weiß).
2. **Bereichsfarben sind Akzente, keine Flächenfüller:** Symbol, Aktiv-Markierung, Balken, kleine Statusfläche.
3. **Farbe trägt nie allein Bedeutung:** Status immer mit Text oder Symbol, Diagramme mit Beschriftung, Bereiche mit
   Namen.
4. **Midnight für Handlungen** (Hauptknopf, Fokus), damit Bereichsfarben nicht mit Aktionen verwechselt werden.
5. **Neue Farbe = neues Primitiv + Rolle**, nie ein Hex-Wert in einer Komponente.

### Kontrast (WCAG 2.2 AA, berechnet 28.11.2026)

| Paar | Hell | Dunkel |
|---|---|---|
| Text primär auf Fläche/Hintergrund/zweiter Fläche | 17,9 / 16,6 / 15,2 | 14,3 / 15,7 / 10,9 |
| Text sekundär | 7,1 / 6,6 / 6,0 | 8,0 / 8,8 / 6,1 |
| Bereichstext (`-accent`) auf Weiß / Ivory / Papier 200 | ≥ 5,37 / ≥ 4,96 / ≥ 4,54 | ≥ 6,9 auf Nacht 900 |
| Akzent auf eigener Tönung | ≥ 4,62 | ≥ 6,35 |
| Weiß auf `-fill` | ≥ 5,37 | ≥ 5,25 |
| Status auf Weiß / Ivory / Papier 200 | ≥ 5,32 / ≥ 4,92 / ≥ 4,51 | ≥ 7,8 auf Nacht 900 |
| Feldrand (`--border-control`, ≥ 3:1) | 4,0 / 3,7 / 3,4 | 3,9 auf Nacht 900 |
| Weiß auf Hauptknopf | 17,9 (Hover 13,0) | 10,6 |
| Fokusring auf Fläche | 16,6 | 14,3 |

Automatisch geprüft durch die axe-Tests in Playwright (`accessibility.spec.ts`, `dark-mode-a11y.spec.ts`).

## 3. Typografie

| Token | Wert | Verwendung |
|---|---|---|
| `--font-brand` = `--font-display` | Manrope | Name, Überschriften (650–700) |
| `--font-body` | Inter | Oberfläche, Formulare, Fließtext (400–600) |
| `--lk-font-size-12…60` | 12 · 13 · 14 · 16 · 18 · 20 · 24 · 30 · 34 · 44 · 60 | Skala (Primitive) |
| `--fs-caption` · `--fs-meta` · `--fs-secondary`/`--fs-label`/`--fs-button` · `--fs-body` | 12 · 13 · 14 · 16 | Rollen |
| `--fs-card-heading` · `--fs-subsection` · `--fs-section` · `--fs-metric` · `--fs-page` | 16 · 18 · 20 · 24 · 30 (Handy 24) | Rollen |
| `--fw-regular/medium/semibold/bold` | 400 · 500 · 600 · 700 | genau vier Gewichte |
| `--lk-line-tight/snug/normal/relaxed` | 1,1 · 1,3 · 1,45 · 1,6 | Zeilenhöhen |
| `--text-*`, `--leading-*`, `--tracking-*` | Website-Skala bis 72 px | öffentliche Seiten |
| `--font-numeric-tabular` | `tabular-nums` | Beträge, Summen, Spalten |

**Regeln:** Hierarchie über Größe, Gewicht und Abstand, nie nur über Farbe. Keine Kursive (auch nicht vom Browser
erzeugt). **Tabellarische Ziffern** für Beträge, Kennzahlen, Zeiten in Spalten: Klasse `.num` oder
`font-variant-numeric: var(--font-numeric-tabular)`. Inter und Manrope setzen dabei nur die Ziffern auf gleiche
Breite; Komma, Punkt und Doppelpunkt bleiben schmal (gemessen 28.11.2026). Die frühere globale Sperre für die alte
Hausschrift ist entfallen, die vorhandenen `tabular-nums`-Stellen wirken wieder.

**Lizenzen:** Manrope und Inter stehen unter der SIL Open Font License 1.1 (`public/fonts/*/OFL.txt`): Nutzung,
Einbettung und Self-Hosting erlaubt, auch kommerziell; nicht als eigene Schrift verkaufen. Selbst gehostet, keine
Anfrage an Google (keine IP-Übertragung an Dritte).

## 4. Abstände, Radien, Linien

| Gruppe | Tokens | Werte |
|---|---|---|
| Abstände (4er-Raster) | `--space-1…9` | 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 |
| Radien | `--radius-sm/md/lg/pill` | 8 · 12 · 16 · 999 |
| Linienstärken | `--border-width`, `--border-width-strong` | 1 px · 2 px |
| Steuerhöhe | `--control-height` | 44 px (Klickfläche) |
| Inhalt | `--content-max-width`, `--content-padding-x` | 1280 px; 32 · 24 (≤ 1024) · 16 (≤ 760) |

Die älteren Namen (`--space-16`, `--radius-cards`, `--canvas` …) zeigen auf diese Tokens und bleiben für bestehende
Komponenten; neu nicht mehr verwenden.

## 5. Schatten, Ebenen, z-Index

| Token | Wert | Verwendung |
|---|---|---|
| `--elevation-0` (`--shadow-none`) | keiner | Seite, Karten (Trennung durch Linie und Abstand) |
| `--elevation-1` (`--shadow-subtle`) | 1 px, 5 % | gewähltes Segment, leicht abgehobene Elemente |
| `--elevation-2` (`--shadow-raised`) | 4/12 px, 12 % | Aufklappmenüs, Hinweise |
| `--elevation-3` (`--shadow-overlay`) | 12/28 px, 25 % | Dialoge, Blätter von unten |
| `--z-sticky` · `--z-dropdown` · `--z-overlay` · `--z-toast` | 100 · 200 · 1000 · 1100 | Stapelreihenfolge für neue Bausteine |

Im Dunkelmodus sind die Schatten dunkler (`theme-dark.css`), Flächen heben sich zusätzlich über Nacht-Stufen ab.

## 6. Breakpoints

| Name | Wert | Bedeutung |
|---|---|---|
| sm | 480 px | kleine Handys |
| md | 760 px | Handy ↔ Tablet: Bottom-Navigation, fester Hauptknopf |
| lg | 1024 px | Tablet ↔ Desktop: Seitenleiste |
| xl | 1280 px | maximale Inhaltsbreite |

CSS-Variablen gehen in Media Queries nicht; deshalb `shared/styles/_breakpoints.scss` (`@include below($md)`,
`@include above($lg)`), Referenzwerte `--lk-breakpoint-*` in `tokens.css`. Mindestbreite der Prüfungen: 320 px.

## 7. Bewegung

| Token | Wert | Verwendung |
|---|---|---|
| `--motion-fast` | 150 ms | Hover, Farbe |
| `--motion-base` | 200 ms | Auf-/Zuklappen, Wechsel |
| `--motion-logo` | 240 ms | Logo-Kontext (nur Deckkraft) |
| `--motion-slow` | 300 ms | Blätter, größere Übergänge |
| `--ease-standard`, `--ease-out` | `cubic-bezier(0.2,0,0,1)`, `cubic-bezier(0,0,0.2,1)` | Kurven |

Bewegung erklärt Zustandswechsel, sie schmückt nicht. Keine Dauerbewegung. Bei `prefers-reduced-motion` setzt
`styles.css` alle Übergänge und Animationen auf nahezu null.

## 8. Fokus und Zustände

- **Fokus:** `:focus-visible` überall mit `--focus-ring` (3 px) und `--focus-offset` (2 px). Komponenten dürfen ihn
  anpassen, nie ersatzlos entfernen. Hell Midnight, dunkel Nacht 50 – beide ≥ 14:1 auf der Fläche.
- **Hover** `--state-hover-bg` · **Aktiv/gedrückt** `--state-active-bg` · **Ausgewählt** `--state-selected-bg`
  (weißes Segment auf Papier-Spur) · **Deaktiviert** `--text-disabled` / `--surface-disabled` /
  `--state-disabled-opacity`.
- Zustände nie nur über Farbe: Auswahl zusätzlich über Gewicht, Haken oder `aria-pressed`/`aria-selected`.

## 9. Komponenten-Tokens

| Baustein | Tokens |
|---|---|
| Knopf | `--button-height`, `--button-radius`, `--button-primary-bg/-bg-hover/-fg`, `--button-secondary-bg/-bg-hover/-fg/-border` |
| Feld | `--field-height/-radius/-bg/-fg/-placeholder/-border/-border-focus/-border-error` |
| Karte | `--card-bg/-border/-radius/-padding/-shadow` |
| Chip | `--chip-radius/-bg/-fg` |
| Dialog | `--dialog-bg/-radius/-shadow` |
| Navigation | `--nav-item-fg/-fg-active/-bg-active` |

## 10. Bereichs-Themes

```css
[data-area='travel'] { --area-accent: var(--travel-accent); --area-soft: var(--travel-soft);
                       --area-fill: var(--travel-fill); --area-on: var(--travel-on); --area-logo: var(--logo-travel); }
```

- Setzt die App-Shell am äußeren Container (`data-area` = `global` · `finance` · `household` · `organization` ·
  `travel`, aus der URL über `brandAreaForUrl`). Ohne Bereich gelten Midnight und Papier.
- Ein Bereich darf **nur** Akzent, Bildsprache und ausgewählte fachliche Darstellungen (Diagramme, Kategorie-
  Farben) individualisieren. Flächen, Schrift, Abstände, Radien, Fokus und Bausteine bleiben gemeinsam.
- Hell und dunkel funktionieren automatisch, weil `--area-*` auf die semantischen Bereichs-Tokens zeigt.
- Neuer Bereich: Primitive `--lk-<id>-*`, semantische `--<id>-accent/-soft/-fill/-on` (hell und dunkel),
  `[data-area='<id>']`-Regel, Eintrag in der Brand-Registry (`docs/BRAND_CONFIGURATION.md` › Regeln).

## 11. Prüfung und Pflege

- `npm run check:brand`: Logo-Farben (`--lk-*-brand` = Brand-Konfiguration, `--logo-*` zeigt darauf), Theme-Tokens je
  Bereich vorhanden.
- axe-Tests hell und dunkel in Playwright; Breitenprüfung bis 320 px (`mobile-domain-controls.spec.ts`).
- Jede Token-Änderung: hier, in `docs/DESIGN_SYSTEM.md` und `DESIGN.md` nachtragen (AGENTS.md › Design-Dokumentation).
- **Altlast:** Komponenten enthalten noch feste Hex-Werte (etwa 750, viele davon nur Rückfallwerte in `var(…, #hex)`).
  Sie werden bereichsweise bei ohnehin anstehenden Änderungen auf Tokens umgestellt, nicht als Großumbau
  (`docs/audits/LUMIKNOT_MARKEN_AUDIT_2026-11-28.md` › C8).
