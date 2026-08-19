# 4One Hub — Design System

> Midnight-Workspace mit funktionaler Farbe. Eine ruhige, warme Aubergine-Oberfläche, editorial-große Typografie — und **Coral als einzige Aktionsfarbe**, ergänzt um **vier dezente Modul-Farben** als Wegweiser durch Fitness, Finanzen, Organisation und Haushalt.

Dieses System adaptiert die **Superlist**-Designsprache (dunkle Aubergine-Flächen, ein warmer Coral-Akzent, oversized Headlines, Pill-Buttons, 20px-Cards) für die besonderen Anforderungen von 4One Hub.

**Der eine wichtige Unterschied zu Superlist:** Superlist ist *bichromatisch* — eine Fläche, eine Akzentfarbe. 4One Hub hat aber **vier Bereiche**, die der Nutzer sofort auseinanderhalten muss. Deshalb erweitern wir die Regel bewusst und diszipliniert:

- **Coral bleibt die einzige *Aktionsfarbe*** — Buttons, primäre Interaktion, aktiver Zustand. Nichts anderes ist coral.
- **Die vier Modul-Farben sind *Wegweiser*, keine Akzente** — sie erscheinen nur klein und funktional: ein Punkt, ein 2px-Rand am aktiven Nav-Item, ein Kategorie-Tag, ein kleines Icon. Nie als große Fläche, nie als CTA.

So bleibt die Ruhe und Disziplin von Superlist erhalten, und die Farbe erfüllt trotzdem ihren wichtigsten Job: **Orientierung** — gerade für ältere Nutzer, denen Farbcodierung beim Wiederfinden hilft.

---

## 1. Farben

### Basis (dunkel — Standard)

| Token | Wert | Rolle |
|---|---|---|
| `--canvas` | `#181824` | Seiten-Hintergrund (warme Aubergine, nie reines Schwarz) |
| `--surface` | `#26253b` | Cards, Inputs, Nav-Container — erste Erhöhung |
| `--surface-recessed` | `#000000` | Tiefste Flächen, Screenshot-Rahmen, Footer |
| `--text` | `#ffffff` | Überschriften, Button-Text, Icon-Striche |
| `--text-body` | `#a9adbd` | Fließtext (aufgehellt ggü. Superlist für bessere Lesbarkeit) |
| `--text-muted` | `#8e8da0` | Sekundäre Labels, Divider |
| `--border` | `#33324a` | Feine Trennlinien (statt sichtbarer Rahmen: Flächenkontrast) |
| `--coral` | `#ff4a36` | **Einzige Aktionsfarbe** — CTA, aktiver Zustand, ein Highlight-Wort |

### Modul-Farben (Wegweiser — klein & funktional)

| Token | Wert | `*-soft` (Chip-Grund) | Modul |
|---|---|---|---|
| `--m-fitness` | `#ff6a4d` | `rgba(255,106,77,.14)` | Fitness |
| `--m-finance` | `#3fd196` | `rgba(63,209,150,.14)` | Finanzen |
| `--m-organize` | `#8a8cf0` | `rgba(138,140,240,.14)` | Organisatorisch |
| `--m-household`| `#ffb454` | `rgba(255,180,84,.14)` | Haushalt |

> Die Modul-Töne sind bewusst so gewählt, dass sie auf der Aubergine harmonieren und sich klar unterscheiden. Fitness liegt nah an Coral (Energie) — deshalb: im Fitness-Modul **nie** Coral und Fitness-Rot gleichzeitig als Aktion einsetzen, sonst verliert Coral seine Signalwirkung.

### Light-Mode (Barrierefreiheit — Pflicht, nicht optional)

4One Hub richtet sich auch an ältere Nutzer und an Menschen, die bei Tageslicht draußen die App bedienen. **Dark-only ist hier keine Option.** Der Dark-Mode ist die Standard-Stimmung, aber ein gleichwertiger Light-Mode gehört dazu.

| Token | Light-Wert |
|---|---|
| `--canvas` | `#f6f5f2` |
| `--surface` | `#ffffff` |
| `--surface-recessed` | `#efece6` |
| `--text` | `#1c1e2a` |
| `--text-body` | `#4a4d5e` |
| `--text-muted` | `#7a7d8c` |
| `--border` | `#e2ded6` |
| `--coral` | `#e5381f` *(etwas dunkler für Kontrast auf Hell)* |
| `--m-fitness` | `#e0574b` |
| `--m-finance` | `#1e9e77` |
| `--m-organize` | `#5b63d6` |
| `--m-household`| `#d68a24` |

---

## 2. Typografie

Superlist nutzt kommerzielle Schriften (Haffer XH, Satoshi). Wir verwenden die **freien, offiziell empfohlenen Substitute** — beide über Google Fonts, damit sie in Angular sofort einsetzbar sind:

- **Display / Headlines:** `Inter Tight`, SemiBold **600**, Tracking `-0.02em`. Das ist die editoriale Stimme.
- **Body / UI:** `Inter`, **400** (Text) / **500** (Buttons, betonte Labels), Tracking `-0.01em`.

```
--font-display: 'Inter Tight', system-ui, sans-serif;
--font-body:    'Inter', system-ui, sans-serif;
```

### Type-Scale

| Rolle | Größe | Line-Height | Tracking | Einsatz |
|---|---|---|---|---|
| `display-xl` | 88px | 0.95 | -1.76px | Landingpage-Hero |
| `display` | 70px | 0.95 | -1.4px | Marketing-Headlines |
| `heading-lg` | 48px | 1.1 | -0.96px | Section-Titel (Marketing) |
| `heading` | 30px | 1.1 | -0.6px | Seitentitel **in der App** |
| `heading-sm` | 24px | 1.2 | -0.48px | Card-/Modul-Titel |
| `subheading` | 18px | 1.3 | -0.36px | Zwischenüberschrift |
| `body` | 16px | 1.4 | -0.32px | Fließtext (App-Minimum) |
| `body-sm` | 14px | 1.3 | -0.28px | Nav, sekundär |
| `caption` | 12px | 1.2 | -0.24px | Meta, Tags |

**Regeln:**
- Die 70–88px-Stimme ist für **Marketing/Landingpage** — nicht für die App. In der App ist `heading` (30px) das obere Ende, sonst wirkt die Oberfläche für die Zielgruppe erschlagend.
- Headlines immer **600**, nie 400.
- Fließtext nie in reinem Weiß — `--text-body` verwenden. `--text` (Weiß) bleibt Überschriften und Icons vorbehalten.
- **App-Minimum 16px Fließtext** (Superlist geht runter bis 12px — für unsere Zielgruppe zu klein; 12px nur für echte Meta-Labels).

---

## 3. Abstände, Radien, Schatten

**Spacing-Skala (px):** 4 · 8 · 10 · 16 · 20 · 24 · 32 · 40 · 56 · 64 · 80
Dichte: **komfortabel** — Element-Gaps 10–16px, Card-Padding 24px, Section-Gap 80px (Marketing) / 24–32px (App).

**Radien — nur zwei Werte, streng:**
- **Cards, Container, Frames, Inputs-groß:** `20px`
- **Buttons, Tags, Pills, Chips:** `100px` (voll rund)
- Kleine Inputs: `8px`. **Keine Zwischenwerte** wie 12/16px.

**Schatten (nur auf Dark sparsam, Flächenkontrast trägt die Trennung):**
```
--shadow-md:     rgba(0,0,0,.08) 0px 10px 15px 0px;   /* schwebende Screenshots/Modals */
--shadow-subtle: rgba(0,0,0,.10) 0px 1px 1px 0px, rgba(0,0,0,.05) 0px 2px 4px 0px;
```

---

## 4. Komponenten

### Primär-Button (Coral CTA)
Pill (100px), `background: --coral`, Text weiß Inter 500 / 16px, Padding `12px 24px`. **Die einzige chromatische Aktion.** Pro Viewport möglichst nur einer.

### Sekundär-Button (Ghost)
Kein Hintergrund, kein Rand. Text weiß Inter 500 / 14px, Padding `8px 16px`. Hover: Farbwechsel zu `--text-muted`, kein Füll-Hover.

### Card
`background: --surface`, Radius 20px, Padding 24px, **kein sichtbarer Rand** — der Flächenkontrast canvas↔surface trennt. Schatten nur bei schwebenden Elementen.

### Sidebar (App-Navigation)
Breite ~240px, `background: --canvas`. Items Inter 400 / 14px in `--text-muted`; **aktives Item**: Text weiß + **2px linker Rand in der Modul-Farbe** des Bereichs (Fitness→`--m-fitness` usw.), Dashboard-Item aktiv in Coral. Padding 8px pro Item, 4px Gap. Avatar unten rund.

### Listen-Item (z. B. Aufgabe / Einkauf)
Zeile: 18–20px runde Checkbox (Rand `--text-muted`, gefüllt in Modul-Farbe wenn erledigt), Text Inter 400 / 16px weiß, optional Avatar 20px rechts. Padding `10px 0`, Trennlinie 1px `--border`. Erledigt: Durchstreichung in `--text-muted`.

### Modul-Kachel (Dashboard)
Card 20px, oben ein **3px-Balken** oder ein kleiner Farbpunkt in der Modul-Farbe + Modul-Label als Caption (12px, uppercase, Modul-Farbe). Große Kennzahl in Inter Tight 600 / 28px weiß. So bleibt die Fläche ruhig, die Farbe nur Wegweiser.

### Tag / Pill
100px, `background: --surface`, Text Inter 500 / 12px in `--text-muted` — oder für Modul-Zuordnung Text in Modul-Farbe auf `*-soft`-Grund. Keine Icons.

### Input / Suchfeld
`background: --surface`, Radius 8px (Suchpille 100px), Text 14px, Placeholder `--text-muted`, kein harter Rand.

---

## 5. Do's & Don'ts

**Do**
- Coral chirurgisch einsetzen — höchstens **ein** coral-Element pro Viewport (CTA *oder* ein Highlight-Wort *oder* aktiver Zustand).
- Modul-Farben nur **klein & funktional**: Punkt, 2px-Nav-Rand, Tag, kleines Icon.
- Flächen stapeln (`--canvas` → `--surface` → `--surface-recessed`) statt Rahmen zu zeichnen.
- Tracking -0.01 bis -0.02em ab 14px aufwärts — die enge Laufweite macht den editorialen Charakter.
- Immer **Dark *und* Light** ausliefern; jede Farbe über Tokens, nie hart codiert.
- Fließtext ≥16px in der App, Kontrast prüfen (WCAG AA, für die 60+-Zielgruppe eher AAA anstreben).

**Don't**
- Keine Modul-Farbe zur großen Fläche oder zum zweiten CTA machen — das verwässert Coral.
- Keine scharfen Ecken (0–4px) auf interaktiven Elementen; keine Zwischenradien (12/16px).
- Fließtext nicht in reinem Weiß (Glare auf Dunkel) — `--text-body` nutzen.
- Kein reines `#000000` als Canvas — die warme Aubergine `#181824` ist die Signatur.
- Headlines nie in 400; die Display-Stimme braucht 600.
- Nicht die 88px-Marketinggröße in die App schleppen.

---

## 6. Barrierefreiheit (Kern, nicht Kür)

Zielgruppe 16–70+. Deshalb verbindlich:
- Tap-Ziele **≥ 44px**.
- Fließtext **≥ 16px**, Zeilenhöhe ≥ 1.4.
- Kontrast **mindestens WCAG AA**, für zentrale Textrollen AAA anstreben (darum ist `--text-body` heller als in der Original-Referenz).
- Optionaler **„Einfach-Modus"** mit größerer Schrift und reduzierten Optionen.
- Farbe nie als *einzige* Information — Modul-Farbe immer mit Icon **und** Label kombinieren (Farbfehlsichtigkeit).
- Sichtbarer Fokus-Zustand auf allen Bedienelementen; `prefers-reduced-motion` respektieren.

---

## 7. Umsetzung in Angular

- Tokens als CSS-Custom-Properties in `src/styles/tokens.css` (global), Theme-Umschaltung über `:root` (Light) und `[data-theme="dark"]` / `@media (prefers-color-scheme: dark)`.
- Fonts via `<link>` zu Google Fonts (`Inter Tight` + `Inter`) oder self-hosted für DSGVO-freundliches Ausliefern ohne Google-Request (empfohlen für die Privat-Positionierung).
- Komponenten kapseln die Tokens (`--surface`, `--coral`, `--m-*`) — kein Bauteil setzt Farben direkt.
- Ein `ThemeService` schaltet `data-theme` und merkt sich die Wahl.

```css
:root {                    /* Light — Standard-Definition */
  --canvas:#f6f5f2; --surface:#ffffff; --text:#1c1e2a; --text-body:#4a4d5e;
  --coral:#e5381f; --m-fitness:#e0574b; --m-finance:#1e9e77;
  --m-organize:#5b63d6; --m-household:#d68a24; /* … */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --canvas:#181824; --surface:#26253b; --text:#ffffff; --text-body:#a9adbd;
    --coral:#ff4a36; --m-fitness:#ff6a4d; --m-finance:#3fd196;
    --m-organize:#8a8cf0; --m-household:#ffb454; /* … */
  }
}
[data-theme="dark"] { /* gleiche Dark-Werte, damit der Toggle in beide Richtungen gewinnt */ }
```