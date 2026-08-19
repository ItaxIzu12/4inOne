# 4One Hub — DESIGN_SYSTEM_V2.md

> **Status:** Verbindliche visuelle Source of Truth für das neue 4One Hub Frontend V2.
>
> **Gilt für:** Global Dashboard, App Shell, Fitness, Finanzen, Organisation, Haushalt und zukünftige Module.
>
> **Wichtig:** `PROJECT_RULES_V2.md` definiert Produkt-, Architektur- und Datenregeln.  
> `DESIGN_SYSTEM_V2.md` definiert die konkrete visuelle Sprache und UI-Primitives.
>
> Bei Konflikten gilt:
>
> 1. `PROJECT_RULES_V2.md`
> 2. `DESIGN_SYSTEM_V2.md`
> 3. bestehende funktionierende Architektur
> 4. freigegebenes Referenzbild
> 5. alte UI
> 6. persönliche Präferenz des Agents

---

# 1. Design-Ziel

4One Hub V2 soll wirken wie ein hochwertiges, ruhiges persönliches Command Center.

Die Oberfläche muss:

- sofort verständlich
- modern
- hochwertig
- ruhig
- präzise
- vertrauenswürdig
- konsistent
- zugänglich

wirken.

Sie darf **nicht** wirken wie:

- ein Angular Admin Template
- ein generisches SaaS Dashboard
- Glassmorphism
- Neon/Cyberpunk
- eine Krypto-App
- vier zusammengeklebte Apps
- ein bunter KPI-Wall

---

# 2. Kernprinzip

> **Achromatische Basis + sparsame Domain-Farbe**

Die gesamte App basiert hauptsächlich auf:

- Schwarz
- Carbon
- Graphit
- Weiß
- Grau

Domain-Farben dienen ausschließlich als Signale.

---

# 3. Globale Design Tokens

Diese Werte sind für Frontend V2 verbindlich:

```css
:root {
  /* =========================================================
     GLOBAL CANVAS
     ========================================================= */

  --one-bg: #0A0A0A;
  --one-sidebar: #0A0A0A;

  /* =========================================================
     SURFACES
     ========================================================= */

  --one-surface: #171717;
  --one-surface-hover: #1C1C1C;
  --one-surface-selected: #202020;
  --one-surface-elevated: #1A1A1A;

  /* =========================================================
     STRUCTURE
     ========================================================= */

  --one-border: #222222;
  --one-border-strong: #2B2B2B;
  --one-divider: #222222;

  /* =========================================================
     TEXT
     ========================================================= */

  --one-text: #FFFFFF;
  --one-text-secondary: #C7C7C7;
  --one-text-muted: #9B9B9B;
  --one-text-disabled: #666666;

  /* =========================================================
     GLOBAL BRAND SIGNAL
     ========================================================= */

  --one-signal: #3FE280;
  --one-signal-hover: #53E98E;
  --one-signal-active: #31C96E;
  --one-signal-soft: rgba(63, 226, 128, 0.10);
  --one-signal-border: rgba(63, 226, 128, 0.32);
  --one-signal-ink: #0A0A0A;

  /* =========================================================
     DOMAIN SIGNALS
     ========================================================= */

  --fitness-accent: #3FE280;
  --finance-accent: #3B82F6;
  --organization-accent: #F59E0B;
  --household-accent: #EC4899;

  /* =========================================================
     DOMAIN SOFT STATES
     ========================================================= */

  --fitness-soft: rgba(63, 226, 128, 0.10);
  --finance-soft: rgba(59, 130, 246, 0.10);
  --organization-soft: rgba(245, 158, 11, 0.10);
  --household-soft: rgba(236, 72, 153, 0.10);

  /* =========================================================
     SEMANTIC STATUS
     ========================================================= */

  --status-success: #3FE280;
  --status-info: #3B82F6;
  --status-warning: #F59E0B;
  --status-danger: #EF4444;

  /* =========================================================
     GEOMETRY
     ========================================================= */

  --radius-card: 12px;
  --radius-button: 16px;
  --radius-control: 12px;
  --radius-pill: 9999px;

  /* =========================================================
     SPACING — 8PX SYSTEM
     ========================================================= */

  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-8: 64px;

  /* =========================================================
     MOTION
     ========================================================= */

  --motion-fast: 140ms;
  --motion-default: 180ms;
  --motion-slow: 220ms;
}
```

---

# 4. Farbregeln

## 4.1 Global Dashboard

Das globale Dashboard bleibt zu mindestens ca. 85–90 % achromatisch.

Domain-Farbe darf verwendet werden für:

- Domain-Icon
- kleine Accent-Line
- Progress Fill
- aktiven Micro-State
- Link / CTA des jeweiligen Bereichs
- kleine Statuspunkte

Nicht erlaubt:

- komplett grüne Fitness-Card
- komplett blaue Finanz-Card
- komplett orange Organisations-Card
- komplett pinke Haushalts-Card
- große farbige Hintergründe pro Domain

---

# 5. Typografie

## Schrift

Verbindlich:

# Inter

Fallback:

```css
font-family:
  "Inter",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Keine zweite UI-Schrift hinzufügen.

---

# 6. Typografische Hierarchie

```text
Hero / Produkt-Statement
56–64px
font-weight: 400–500
line-height: 1.00–1.08

Page Title
36px
font-weight: 400–500

Section Heading
20–24px
font-weight: 500

Card Heading
16–20px
font-weight: 500

Body
16px
font-weight: 400
line-height: 1.5

Caption / Label
14px
font-weight: 400–500

Micro Label
12px
font-weight: 500
```

Für Zahlen:

```css
font-variant-numeric: tabular-nums;
```

---

# 7. Schriftgewicht-Regel

Nicht alles fett darstellen.

Verwende 600–700 nur sehr sparsam.

Premium-Wirkung soll entstehen durch:

- Größenhierarchie
- Weißraum
- Kontrast
- präzise Alignment

nicht durch durchgehend fette Schrift.

---

# 8. Spacing-System

Verwende primär:

```text
8px
16px
24px
32px
40px
48px
64px
```

Keine zufälligen Werte wie:

```text
17px
19px
27px
37px
```

außer für tatsächliches Pixel-Matching.

---

# 9. Card Primitive

Standard Card:

```css
.one-card {
  background: var(--one-surface);
  border: 1px solid var(--one-border);
  border-radius: var(--radius-card);
}
```

Standard Padding:

```text
24px Desktop
16px Mobile
```

Keine dekorativen Drop-Shadows.

---

# 10. Interactive Card

```css
.one-card--interactive {
  transition:
    background-color var(--motion-default) ease-out,
    border-color var(--motion-default) ease-out;
}

.one-card--interactive:hover {
  background: var(--one-surface-hover);
  border-color: var(--one-border-strong);
}
```

Keine großen Hover-Lifts.

Optional maximal:

```css
transform: translateY(-1px);
```

wenn wirklich nötig.

---

# 11. Button System

## Primary Global

```css
.one-button-primary {
  min-height: 44px;
  padding: 12px 24px;
  border: 0;
  border-radius: var(--radius-button);
  background: var(--one-signal);
  color: var(--one-signal-ink);
  font-weight: 500;
}
```

Hover:

```css
background: var(--one-signal-hover);
```

## Secondary

```css
.one-button-secondary {
  min-height: 44px;
  padding: 12px 24px;
  border: 1px solid var(--one-border);
  border-radius: var(--radius-button);
  background: transparent;
  color: var(--one-text);
}
```

## Domain Primary

Innerhalb eines Moduls darf der Primary Button die jeweilige Domain-Farbe nutzen.

Beispiel Fitness:

```css
background: var(--fitness-accent);
```

---

# 12. App Shell

Desktop:

```text
┌──────────────────┬──────────────────────────────────────────────┐
│ Sidebar          │ Top Utility Area                             │
│ ~208px           ├──────────────────────────────────────────────┤
│                  │ Main Content                                 │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

Recommended:

```text
Sidebar width: 208px
Main padding: 24–32px
Page max-width: fluid / responsive
```

---

# 13. Globale Sidebar

Struktur:

```text
4•ONE
HUB

Start

Fitness
Finanzen
Organisation
Haushalt

────────

Benachrichtigungen
Einstellungen

flex spacer

User Profile
```

Nav Item:

```text
height: 48px
padding: 0 16px
gap: 12px
radius: 12px
```

Active:

```text
background: #171717
white label
2–3px left accent
```

---

# 14. Domain-Farben Navigation

Auf dem Global Dashboard:

```text
Start → global green
Fitness → green icon
Finanzen → blue icon
Organisation → amber icon
Haushalt → pink icon
```

Inaktive Labels bleiben weiß/grau.

Die Navigation darf nicht wie ein buntes Menü wirken.

---

# 15. Top Utility Bar

Enthält:

- Suche
- Quick Add
- Benachrichtigungen
- Profil

Search:

```text
height: 44px
max-width: ~560px
background: #171717
border: #222222
radius: 12px
```

Utility Icons:

```text
40–44px
neutral
circular or rounded
```

---

# 16. Global Hero

Der zentrale Satz lautet:

> **Dein Alltag. Ein Ort.**

Zweck:
Ein neuer Nutzer versteht sofort den Produktnutzen.

Supporting copy:

> Fitness, Finanzen, Organisation und Haushalt – alles, was deinen Alltag strukturiert, in einer Anwendung.

Der Hero darf visuell stark sein, aber nicht wie eine Marketing-Landingpage wirken.

---

# 17. Hero-Regeln

Erlaubt:

- sehr große Typografie
- eine kleine grüne Betonung
- dezente 4One Brand Mark
- viel Weißraum

Nicht erforderlich:

- Stockfoto
- Bergbild
- große Illustration
- Gradient
- Glow

Das Interface muss auch ohne Hero-Bild hochwertig aussehen.

---

# 18. Domain Cards

Alle vier Domain Cards sind visuell gleichwertige Einstiegspunkte.

Anatomie:

```text
Accent Line

Icon + Titel

Beschreibung

Current Summary

CTA
```

---

# 19. Fitness Card

Accent:

```text
#3FE280
```

Purpose:

> Trainiere. Bewege dich. Sieh deinen Fortschritt.

Summary:

```text
Nächstes Training
Heute · 18:00
Pull · Rücken & Bizeps
```

CTA:

```text
Fitness öffnen →
```

Nur echte Daten verwenden.

---

# 20. Finanzen Card

Accent:

```text
#3B82F6
```

Purpose:

> Verstehe dein Geld und behalte deine Ziele im Blick.

Example:

```text
Monatsbudget
1.240 € verfügbar
```

CTA:

```text
Finanzen öffnen →
```

---

# 21. Organisation Card

Accent:

```text
#F59E0B
```

Purpose:

> Plane deinen Tag, deine Termine und deine Aufgaben.

Example:

```text
Heute
3 Aufgaben · 2 Termine
```

CTA:

```text
Organisation öffnen →
```

---

# 22. Haushalt Card

Accent:

```text
#EC4899
```

Purpose:

> Organisiere dein Zuhause, ohne alles im Kopf behalten zu müssen.

Example:

```text
Heute
4 Aufgaben offen
```

CTA:

```text
Haushalt öffnen →
```

---

# 23. Domain Card Layout

Desktop ≥ 1440px:

```text
repeat(4, 1fr)
```

Desktop / Tablet:

```text
2 × 2
```

Mobile:

```text
1 column
```

Gap:

```text
16px
```

oder

```text
24px
```

je nach Gesamtbreite.

---

# 24. Heute für dich

Zweck:

> Konkrete Dinge zeigen, die heute Aufmerksamkeit brauchen.

Row:

```text
Zeit
Domain Icon / Accent
Titel
Kontext
optional CTA
```

Beispiel:

```text
18:00
Fitness
Training · Pull
Rücken & Bizeps
```

---

# 25. Ziele / Status

Bevorzuge explizite Werte.

Gut:

```text
Fitness
4 / 5 Trainings

Finanzen
1.240 € Restbudget

Organisation
3 Aufgaben offen

Haushalt
4 Aufgaben offen
```

Nicht:

```text
Fitness 78%
Life Score 82%
```

wenn die Bedeutung nicht klar ist.

---

# 26. Progress Bars

Track:

```text
#222222
```

Height:

```text
4–6px
```

Fill:

jeweilige Domain-Farbe.

Circular Progress nur sparsam.

---

# 27. Keine Fake Scores

Diese Elemente sind standardmäßig nicht Teil des Systems:

```text
Life Score
Tages-Balance
Gesamt-Lebensscore
Produktivitätsindex
```

Nur implementieren, wenn eine reale, dokumentierte Formel existiert.

---

# 28. Icons

Verwende nur die bereits im Projekt bestehende Icon-Familie.

Nicht mischen:

- Material Icons
- FontAwesome
- Lucide
- Heroicons

ohne zwingenden Grund.

Keine Emojis als Kernnavigation.

---

# 29. Form Controls

```css
.one-input {
  min-height: 44px;
  background: var(--one-surface);
  border: 1px solid var(--one-border);
  border-radius: var(--radius-control);
  color: var(--one-text);
}
```

Focus:

```css
border-color: var(--one-signal);
outline: 2px solid rgba(63, 226, 128, 0.20);
outline-offset: 1px;
```

Innerhalb eines Domains darf der Fokus-Akzent die Domain-Farbe nutzen.

---

# 30. Tables

Background bleibt dunkel.

Header:

```text
14px
muted
```

Body:

```text
14–16px
```

Divider:

```text
#222222
```

Keine weißen Tabellen.

---

# 31. Charts

Global Dashboard:

wenige Charts.

Deep Analytics:

nur innerhalb eines Domains.

Chart Defaults:

```text
transparent plot background
#222222 grid
muted axis labels
domain accent primary series
```

---

# 32. Loading States

Skeletons müssen die finale Layout-Geometrie widerspiegeln.

Farben:

```text
#171717
#202020
```

Keine hellgrauen Skeletons.

---

# 33. Empty States

Struktur:

```text
Titel
kurze Erklärung
eine nächste Aktion
```

Beispiel:

```text
Noch kein Training geplant

Plane dein erstes Training.

[ Training planen ]
```

---

# 34. Error States

Keine rohen API-/SQLite-Fehler anzeigen.

Beispiel:

```text
Daten konnten nicht geladen werden.

[ Erneut versuchen ]
```

---

# 35. Motion

Default:

```text
140–220ms
ease-out
```

Erlaubt:

- opacity
- border color
- surface color
- kleine Arrow-Bewegung

Nicht erlaubt:

- Bounce
- permanente Animation
- großer Scale-Hover
- Neon Pulse

Immer:

```css
@media (prefers-reduced-motion: reduce)
```

respektieren.

---

# 36. Accessibility

Pflicht:

- sichtbarer Keyboard Focus
- semantische Struktur
- verständliche Labels
- mindestens ca. 44px Touch Targets bei Aktionen
- keine Information nur über Farbe
- hoher Kontrast
- reduzierte Motion
- lesbarer Muted Text

---

# 37. Responsive Breakpoints

```text
Mobile   < 768px
Tablet   768–1199px
Desktop  ≥ 1200px
Wide     ≥ 1440px
```

---

# 38. Desktop Dashboard

Wide Desktop:

```text
Sidebar
Main Content
optional restrained support rail
```

Domain Cards:

```text
4 columns
```

Today / Goals:

```text
2 columns
```

---

# 39. Tablet Dashboard

Domain Cards:

```text
2 × 2
```

Today / Goals:

stack or 2 columns depending available width.

Sidebar:

collapse according to existing architecture.

---

# 40. Mobile Dashboard

Reihenfolge:

```text
Mobile Header
Dein Alltag. Ein Ort.
Fitness
Finanzen
Organisation
Haushalt
Heute für dich
Ziele / Status
```

Keine Desktop-Skalierung.

---

# 41. Domain-Shell-Prinzip

Jeder Bereich erbt das globale System.

```text
GLOBAL V2 SYSTEM
      ↓
DOMAIN SHELL
      ↓
DOMAIN CONTENT
```

Es gibt kein komplett eigenes Fitness-, Finance-, Organisation- oder Haushalt-Designsystem mehr.

---

# 42. Fitness V2

Fitness nutzt:

```text
global surfaces
global borders
global typography
global spacing
+
#3FE280 as active signal
```

---

# 43. Finanzen V2

Finanzen nutzt:

```text
global surfaces
+
#3B82F6 as signal
```

Keine “Banking App” mit komplett blauem Theme.

---

# 44. Organisation V2

Organisation nutzt:

```text
global surfaces
+
#F59E0B as signal
```

---

# 45. Haushalt V2

Haushalt nutzt:

```text
global surfaces
+
#EC4899 as signal
```

---

# 46. Bildreferenzen

Ein freigegebenes Screenshot-/Bild-Design definiert:

- Layout
- Hierarchie
- relative Größen
- Card-Verteilung
- Art Direction

Es definiert NICHT:

- echte User-Daten
- exakte Token-Farben
- Backend-Logik
- Schrift
- globale UI-Regeln

Bei Abweichungen:

```text
PROJECT_RULES_V2.md
→ DESIGN_SYSTEM_V2.md
→ Backend
→ Screenshot
```

---

# 47. Bilder / Stock Assets

Keine zufälligen externen Stockbilder automatisch laden.

Wenn Referenzbilder Foto-Flächen zeigen, aber keine finalen Assets vorhanden sind:

- neutrale Placeholder verwenden
- korrektes Seitenverhältnis reservieren
- später nur Source austauschen

---

# 48. Premium-Regel

Premium entsteht durch:

- klare Typografie
- präzises Grid
- konsistentes Spacing
- ruhige Flächen
- Hairline Borders
- klare Sprache
- schnelle Interaktion

Premium entsteht NICHT durch:

- mehr Farbe
- mehr Schatten
- mehr Animation
- mehr Widgets
- mehr Gradients

---

# 49. Do

```text
✓ Inter
✓ #0A0A0A Canvas
✓ #171717 Cards
✓ #222222 Borders
✓ 12px Cards
✓ 16px Buttons
✓ 8px Spacing
✓ sparsame Domain-Akzente
✓ explizite verständliche Daten
✓ echte Empty States
✓ Responsive
✓ Accessibility
```

---

# 50. Do not

```text
✗ Glassmorphism
✗ neon cyberpunk
✗ random gradients
✗ card shadows everywhere
✗ rainbow dashboard
✗ fake Life Score
✗ fake personal data
✗ arbitrary hex colors
✗ separate visual system per module
✗ generic Bootstrap/Material appearance
```

---

# 51. Final Visual Quality Gate

Vor Abschluss einer V2-Seite:

```text
[ ] globale Token verwendet
[ ] Inter verwendet
[ ] #0A0A0A Canvas
[ ] #171717 Surfaces
[ ] #222222 Hairline Borders
[ ] 12px Card Radius
[ ] 16px Button Radius
[ ] 8px Rhythmus
[ ] keine Card-Shadows
[ ] keine dekorativen Gradients
[ ] Domain-Farbe nur als Signal
[ ] echtes / ehrliches User-Data-Verhalten
[ ] Loading State
[ ] Empty State
[ ] Error State
[ ] Keyboard Focus
[ ] Desktop
[ ] Tablet
[ ] Mobile
```

---

# 52. Final Design Test

Ohne Logo und Seitentitel muss die App weiterhin wie **4One Hub** wirken durch:

- matte-black canvas
- klare Inter-Typografie
- Carbon-Surfaces
- Hairline Borders
- 8px-Rhythmus
- sparsame Domain-Farben
- klare Sprache

Wenn eine Seite nur aufgrund ihres Logos oder ihrer Überschrift wiedererkennbar ist, ist das Designsystem nicht konsequent genug umgesetzt.
