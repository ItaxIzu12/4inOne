# Lumiknot — Bereichsidentitäten

> Teil der Brand Governance (`docs/BRAND_GOVERNANCE.md`): verbindlich für den Charakter der vier Bereiche und ihre erlaubten Abweichungen.

Stand 28.11.2026. Ein Produkt, eine Marke, vier Bereiche. Jeder Bereich hat einen eigenen Charakter – erkennbar am
Logo-Element, am Akzent und an der Bildsprache –, aber kein eigenes Designsystem. Technik: Registry
`docs/BRAND_CONFIGURATION.md`, Tokens `docs/DESIGN_TOKENS.md` › Bereichs-Themes, Logo `docs/LOGO_USAGE.md`,
Bewegung `docs/MOTION_GUIDELINES.md`. Haltung und Ton: `docs/BRAND_IDENTITY.md`.

## Die vier Bereiche

| | Finanzen | Haushalt | Organisation | Reisen |
|---|---|---|---|---|
| Marke | Lumiknot Finance | Lumiknot Home | Lumiknot Planner | Lumiknot Travel |
| Technische ID | `finance` | `household` | `organization` | `travel` |
| Vermittelt | Vertrauen, Kontrolle, Wachstum | Wärme, Geborgenheit, Alltag | Struktur, Klarheit, Produktivität | Freiheit, Entdeckung, Erlebnisse |
| Logo-Element | oben links, Grün `#13A274` | oben rechts, Orange `#F59A42` | unten rechts, Violett `#7864E7` | unten links (liegt oben), Blau `#2197BE` |
| Akzent (Text/Fläche) | `#0E7957` | `#955E28` | `#6A59CC` | `#197390` |
| Symbol | `finance` (Brieftasche) | `household` (Haus) | `calendar` | `travel` (Flugzeug) |
| Bildsprache | klare Zahlen, ruhige Kurven, Kategorie-Farben | Räume, Hände, Dinge des Alltags | Raster, Zeitachse, Häkchen | Wege, Orte, Bordkarte |
| Tonfall | nüchtern, genau, ohne Bewertung | freundlich, entlastend | knapp, ordnend | offen, vorfreudig |

**Wie sich der Charakter zeigt – und wie nicht:**

- *Finanzen* zeigt Kontrolle über **Klarheit**: tabellarische Ziffern, eine große Zahl pro Ansicht, Urteile in Worten
  („im Budget geblieben“) statt Ampelflächen. Kein Grün als „gut“ allein, kein Rot als Alarmfläche.
- *Haushalt* zeigt Wärme über **Inhalt und Sprache** (Räume, Personen, Zuständigkeit) und die warme Akzentfarbe auf
  kleinen Flächen – nicht über verspielte Formen.
- *Organisation* zeigt Struktur über **Raster und Rhythmus** (Tag, Woche, Zeitachse) – nicht über zusätzliche Linien
  oder Rahmen.
- *Reisen* zeigt Freiheit über **Orte und Wege** (Ziel, Route, Bordkarte) – nicht über Fotos als Hintergrund oder
  Verläufe.

## Was ein Bereich individualisieren darf

| Darf | Darf nicht |
|---|---|
| Akzentfarbe (`--area-accent`, `--area-soft`, `--area-fill`) für Symbole, aktive Markierungen, Balken, kleine Flächen | eigene Flächen-, Text- oder Linienfarben |
| fachliche Darstellungen: Diagramme, Kategorie-Farben, Bordkarte, Kalenderraster | eigene Schriften, Schriftgrößen-Skalen oder Gewichte |
| Bildsprache (Illustrationen, Symbole des Bereichs) | eigene Radien, Abstände, Schatten, Fokus-Stile |
| Texte und Beispiele im Tonfall des Bereichs | eigene Knopf-, Feld-, Karten- oder Dialog-Bausteine |
| das eigene Logo-Element hervorheben (`context`) | Logo umfärben, Elemente weglassen, eigenes Zeichen |

Gemeinsam bleiben: App-Shell, Navigation, Kopfkarte (`domain-layout.scss`), Bausteine aus `shared/ui`, Tokens,
Bewegung.

## Logo im Bereich

- Die **Hauptnavigation zeigt immer die vollständige Bildmarke** – alle vier Elemente. Im Bereich bleibt dessen
  Element voll, die anderen stehen auf 42 % Deckkraft (`<app-brand [context]>`; die App-Shell setzt den Kontext aus
  der URL). Die Marke bleibt eine; der Bereich ist nur betont.
- Auf der Startseite, in Einstellungen, Profil und öffentlichen Seiten: `global` (alle gleich).
- Kein bereichseigenes Logo, kein „Lumiknot Finance“-Schriftzug in der App; die englischen Bereichsnamen gelten für
  Marketing und Markenunterlagen.

## Technik in Kürze

```html
<div class="shell" data-area="travel">            <!-- setzt die App-Shell -->
  <app-brand context="travel" />                   <!-- Element Reisen voll, andere 42 % -->
  <span class="badge" style="color: var(--area-accent)">…</span>
</div>
```

- `data-area` und `context` haben dieselben Werte (`global` · `finance` · `household` · `organization` · `travel`),
  beide aus `brandAreaForUrl()` (`core/brand/brand.config.ts`).
- Komponenten, die sich dem Bereich anpassen sollen, verwenden `--area-*`; Komponenten mit fester Bedeutung
  (z. B. „Reise“-Marke auf der Startseite) verwenden weiter `--travel-accent` usw.
- Hell und dunkel funktionieren automatisch; Kontraste je Bereich: `docs/DESIGN_TOKENS.md` › Kontrast.

## Prüfung (28.11.2026)

| Punkt | Ergebnis |
|---|---|
| Wiedererkennbarkeit | alle vier Elemente immer sichtbar; Hervorhebung nur über Deckkraft, Form und Farbe gleich |
| Konsistenz | ein Logo-Baustein, eine Geometrie (`orbit.ts`), eine Registry; Shell, Navigation, Bausteine gemeinsam |
| Kontrast | Akzente ≥ 4,5:1 hell, ≥ 6,9:1 dunkel; die 42-%-Elemente sind Dekor (das Logo trägt den Namen als Text) |
| Barrierefreiheit | Bereich nie nur über Farbe: Name in Navigation und Seitentitel, aktiver Eintrag mit `aria-current` |
| Reduzierte Bewegung | Bereichswechsel ohne Übergang, Start-Moment ohne Zeichnen |
| Responsive | Logo ab 24 px Standard, darunter Kleinvariante; geprüft Desktop und 390 px, hell und dunkel |
