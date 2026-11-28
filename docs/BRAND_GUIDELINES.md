# Lumiknot — Markenrichtlinien

Verbindlich für alle neuen Entwicklungen seit 28.11.2026. Vorher hieß das Produkt **4inOne**; was technisch noch so
heißt und warum, steht in `docs/REBRANDING_MIGRATION.md`. Markenstrategie und Tonalität: `docs/BRAND_IDENTITY.md`. Logo-Regeln: `docs/LOGO_USAGE.md`. Namen und Bezeichner:
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

Ruhig, klar, ehrlich. Kurze Sätze, keine Superlative, keine Versprechen ohne Beleg. Datenschutz als Tatsache
formulieren („Geteilt wird nur, was du teilst.“), nicht als Werbebotschaft.

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
bedeutungstragend. Für Text, Symbole, Balken und Flächen gibt es kontrastgeprüfte Varianten (WCAG 2.2 AA):

| Bereich | Text / Fläche | Tönung | Dunkelmodus |
|---|---|---|---|
| Finanzen | `#0E7957` | `#E3F4EE` | `#5CC79C` |
| Haushalt | `#955E28` | `#FEF3E8` | `#F2A35C` |
| Organisation | `#6A59CC` | `#EFECFC` | `#A99BF2` |
| Reisen | `#197390` | `#E4F3F7` | `#6CC3E0` |

Text/Fläche ≥ 4,6:1 auf Weiß, Ivory und Sage; weißer Text darauf ≥ 5,3:1; Akzent auf Tönung ≥ 4,6:1;
Dunkelmodus ≥ 6,3:1 auf den Karten. Tokens: `--logo-*`, `--*-accent`, `--*-fill`, `--*-soft` (styles.css).

## Schrift

- **Manrope** (Marke, Logo, Überschriften; 700 für den Namen, 650–700 für Überschriften).
- **Inter** (Oberfläche, Formulare, Fließtext; 400–600).
- Beide OFL, selbst gehostet (`public/fonts`), keine Kursive.

## Single Source of Truth

Ausführlich mit Typen, Registry, Prüfungen und Erweiterungsregeln: `docs/BRAND_CONFIGURATION.md`.


- `frontend/src/app/core/brand/brand.config.ts` (`BRAND`): Name, Kurzform, Claim, Leitsatz, Beschreibung, Bereiche
  (deutscher Name, Markenname, Logo-Farbe), neutrale Farben, Schriften, Logo-Dateien, SEO-Angaben (Teilen-Bild,
  Theme- und Hintergrundfarbe), Beschriftungen. Seitentitel immer `brandTitle('Seite')`.
- `frontend/src/app/shared/ui/brand/orbit.ts`: Geometrie des Zeichens.
- `frontend/src/styles.css`: Design-Tokens; `--logo-*` müssen `brand.config.ts` entsprechen (`npm run check:brand`).
- `npm run brand:assets` erzeugt alle Logo-Dateien aus diesen Quellen; nie von Hand nachbearbeiten.
- Fließtexte nennen „Lumiknot“ direkt; `npm run check:brand` (auch in CI) verhindert den alten Namen im Frontend.

## Erweiterungsregeln

- Neue Seiten: Titel über `brandTitle()`, Logo nur über `<app-brand>`, Farben nur über Tokens.
- Neuer Bereich oder neue Markenfarbe: zuerst `brand.config.ts` und `orbit.ts`/`styles.css`, dann
  `npm run brand:assets`, Kontrast prüfen, Doku hier und in `docs/DESIGN_SYSTEM.md` nachtragen.
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
