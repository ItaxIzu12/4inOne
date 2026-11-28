# Lumiknot — Markenrichtlinien

> Teil der Brand Governance (`docs/BRAND_GOVERNANCE.md`): verbindlich für den kompakten Markenauftritt, Markenpalette, Bild- und Iconsprache.

Verbindlich für alle neuen Entwicklungen seit 28.11.2026. Vorher hieß das Produkt **4inOne**; was technisch noch so
heißt und warum, steht in `docs/REBRANDING_MIGRATION.md`. Zuständigkeiten und Freigabe: `docs/BRAND_GOVERNANCE.md`.
Markenstrategie und Tonalität: `docs/BRAND_IDENTITY.md`. Logo-Regeln: `docs/LOGO_USAGE.md`. Namen und Bezeichner:
`docs/NAMING_CONVENTIONS.md`. Gestaltung im Detail: `docs/DESIGN_SYSTEM.md`, Kurzfassung `DESIGN.md`.

## Identität

| | |
|---|---|
| Produktname | **Lumiknot** (so geschrieben; kein ®, solange keine Eintragung nachgewiesen ist) |
| Claim | *Life, connected.* |
| Leitsatz in der App (de) | Dein Alltag. Alles verbunden. |
| Bereiche in der App | Finanzen · Haushalt · Organisation · Reisen |
| Bereichsnamen der Marke | Lumiknot Finance · Lumiknot Home · Lumiknot Planner · Lumiknot Travel |
| Werte | Verbindung, persönliche Unabhängigkeit, Intelligenz, Vertrauen, Einfachheit, Ordnung, ruhige Qualität, langfristiger Wert |

Lumiknot ist ein datenschutzorientiertes, modulares, persönliches Ökosystem, das Finanzen, Haushalt, Organisation und
Reisen verbindet. Jeder Bereich funktioniert allein; besonders wird Lumiknot durch Verknüpfungen zwischen Bereichen.

**Sprache:** Die App ist deutsch und nennt die Bereiche deutsch. Die englischen Bereichsnamen („Lumiknot Home“) gelten
für Marketing, Markenunterlagen und künftige internationale Auftritte – in der App nur, wo sie einen klaren Mehrwert
haben. Global spricht die Marke als „Lumiknot“.

## Tonalität

Ruhig, klar, ehrlich, Du-Form – verbindlich mit Regeln und Beispielen in `docs/BRAND_IDENTITY.md` › 7.

## Farben

| Rolle | Wert | Verwendung |
|---|---|---|
| Finanzen | `#13A274` | Logo, Farbpunkte, Dekor |
| Haushalt | `#F59A42` | Logo, Farbpunkte, Dekor |
| Organisation | `#7864E7` | Logo, Farbpunkte, Dekor |
| Reisen | `#2197BE` | Logo, Farbpunkte, Dekor |
| Midnight | `#101820` | Text, Knöpfe, dunkle Bänder, Theme-Farbe |
| Graphite | `#29323B` | Hover, sekundäre dunkle Flächen |
| Ivory | `#F7F6F2` | Seitenhintergrund, Icon-Hintergrund |
| White | `#FFFFFF` | Karten |

Die reinen Bereichsfarben erreichen auf Weiß nur 2,2–4,4:1 und sind deshalb **nie Textfarbe** und nie allein
bedeutungstragend. Für Text, Symbole, Balken und Flächen gibt es kontrastgeprüfte Ableitungen (hell und dunkel);
ihre Werte, die neutralen Abstufungen (Papier, Schiefer, Nacht) und alle Kontraste stehen verbindlich in
`docs/DESIGN_TOKENS.md` › Farben.

## Schrift

- **Manrope** für Marke, Logo und Überschriften; **Inter** für Oberfläche, Formulare und Fließtext.
- Beide SIL Open Font License, selbst gehostet (`public/fonts`), keine Kursive.
- Größen, Gewichte, Zeilenhöhen und Ziffern: `docs/DESIGN_TOKENS.md` › Typografie.

## Bildsprache

- **Echte Produktansichten** zuerst: Screenshots aus der Demo (Besetzung Sophie, Max, Lena, Jonas), mit ehrlichen
  Daten. Keine erfundenen Kennzahlen, Bewertungen oder Stimmen.
- **Illustrationen** nur flach, ruhig und in Token-Farben, für Leerzustände, Onboarding und Markenmomente – nie als
  Füllung in Alltagsansichten.
- Nicht: Stockfotos, generische KI-Bilder, 3D-Objekte, Verläufe, Fotos oder Screenshots als App-Hintergrund.
- Bereiche zeigen ihren Charakter über Inhalte (Räume, Orte, Zeitachsen, Zahlen), siehe `docs/SECTION_IDENTITY.md`.

## Iconsprache

- **Eine Familie:** `app-icon` (`frontend/src/app/shared/ui/icons`), 24er-Raster, Linie 1,8 px, runde Enden und
  Ecken – dieselbe Formsprache wie die runden Enden des Orbit-Zeichens. Keine zweite Icon-Bibliothek.
- **Feste Bereichssymbole:** Finanzen Brieftasche (`finance`), Haushalt Haus (`household`), Organisation Kalender
  (`calendar`), Reisen Flugzeug (`travel`); in der Brand-Registry hinterlegt, nie je Ansicht wechseln.
- Größen: 16 (Hilfe, im Text) · 18–20 (Listen) · 22–24 (Navigation) · bis 32 (Kopfbereiche); Farbe über
  `currentColor`, im Bereich `--area-accent`.
- Keine 3D-Icons in Alltagsansichten; Symbole tragen nie allein Bedeutung (Beschriftung oder `aria-label`).

## Single Source of Truth

Technisch ist `frontend/src/app/core/brand/brand.config.ts` die eine Quelle (Name, Claim, Bereiche, Markenfarben,
Logo-Pfade, SEO); Geometrie in `shared/ui/brand/orbit.ts`, Primitive in `shared/styles/tokens.css`. Alles Abgeleitete
(Logo-Dateien, Manifest, `index.html`, Backend) wird erzeugt oder von `npm run check:brand` geprüft – Einzelheiten in
`docs/BRAND_CONFIGURATION.md`.

## Erweiterungsregeln

- Neue Seiten: Titel über `brandTitle()`, Logo nur über `<app-brand>`, Farben nur über Tokens.
- Neuer Bereich oder neue Markenfarbe: Identitätsänderung mit Freigabe (`docs/BRAND_GOVERNANCE.md` › 5); Ablauf in
  `docs/BRAND_CONFIGURATION.md` › 6 und `docs/DESIGN_TOKENS.md` › 10.
- Keine Verläufe, Neon-Effekte oder Schatten am Logo; die räumliche Variante gibt es nur für ausgewählte
  Markenpräsentationen, nie in der App.
- Vor einer Veröffentlichung: Marken- (DPMA/EUIPO) und Domainprüfung für „Lumiknot“ durch eine Fachperson (siehe
  unten).

## Namensprüfung (Vorab-Recherche 28.11.2026, keine Rechtsberatung)

**Lumiknot** (gewählt am 28.11.2026):

- **Domains** (direkt bei den Registern abgefragt): `lumiknot.de` (DENIC „free“), `.com`, `.net`, `.app`, `.io`,
  `.eu` waren nicht registriert. Sichern, bevor der Name öffentlich wird.
- **Gleicher Name:** keine Marke, Firma oder App „Lumiknot“ gefunden. „Lumi Knot“ ist Produktname für Taschen,
  Sportkleidung und Deko (andere Waren, geringes Risiko).
- **Klangnähe:** Gesprochen „Luminot“ ähnelt **Luminote** – mehrere Notiz-Apps (Luminotes AI, luminote.ai,
  luminote.io) und US-Anmeldungen (u. a. Serial 99433903, Newsletter zu Finanzen/Technik). Weil Lumiknot Notizen
  enthält, ist das der Punkt, den eine Fachperson prüfen sollte; Schreibweise und Bedeutung unterscheiden sich klar.
- **Empfehlung:** Domains `.de` und `.com` registrieren; in DPMAregister und TMview nach „Lumiknot“ und „Luminote“
  in den Klassen 9 (Software), 36 (Finanzen) und 42 (SaaS) suchen bzw. suchen lassen.

**Verworfen – Veyora** (Zwischenname am 28.11.2026): US-Anmeldung „VEYORA“ der Veyora Inc. (Serial 99493030,
Klasse 9, Brillen), `veyora.de/.com/.eu/.app/.net` vergeben, viele ähnliche Kunstnamen (Velora, Vyora, Veyra).
