# Lumiknot — Brand Governance

Stand 28.11.2026. Verbindlich für alle Menschen und Agenten, die an Oberfläche, Marke oder Texten von Lumiknot arbeiten.
Dieses Dokument regelt **wer was entscheidet und wo es steht**; die Inhalte stehen in den Fachdokumenten unten und
werden hier nicht wiederholt.

## 1. Welches Dokument entscheidet was

Jede Frage hat genau **ein** verbindliches Dokument. Andere Dokumente verweisen darauf und wiederholen keine Werte.

| Thema | Verbindlich | Ergänzend |
|---|---|---|
| Wofür die Marke steht: Purpose, Versprechen, Werte, Persönlichkeit, Zielgruppen, Ton, Architektur (Branded House), Entscheidungsprotokoll | `docs/BRAND_IDENTITY.md` | `PRODUCT.md`, `docs/PRODUCT_VISION.md` |
| Markenauftritt kompakt: Identität, Markenpalette, Schriften, Bild- und Iconsprache | `docs/BRAND_GUIDELINES.md` | — |
| Technische Markenquelle: `brand.config.ts`, Bereichs-Registry, abgeleitete Stellen, Prüfungen | `docs/BRAND_CONFIGURATION.md` | `backend/config/brand.py` |
| Logo: Konstruktion, Varianten, Schutzraum, Mindestgrößen, Komponente `<app-brand>`, Export | `docs/LOGO_USAGE.md` | `docs/brand/*.png` (Prüfblätter) |
| Design-Tokens: Ebenen, alle Werte, Kontraste, Typo-Skala, Bewegungs- und Breakpoint-Werte | `docs/DESIGN_TOKENS.md` | `frontend/src/app/shared/styles/tokens.css`, `frontend/src/styles.css` |
| Gestaltungsregeln, Bausteine, Layout, Zustände, Bereichsseiten, Änderungsverlauf | `docs/DESIGN_SYSTEM.md` | Kurzfassung `DESIGN.md` |
| Charakter der vier Bereiche, was ein Bereich individualisieren darf | `docs/SECTION_IDENTITY.md` | Bereichsdokus `docs/*_V1.md` |
| Bewegung: erlaubt, verboten, reduzierte Bewegung | `docs/MOTION_GUIDELINES.md` | — |
| Schreibweisen, technische Bezeichner, Kurzform, neue Variablen | `docs/NAMING_CONVENTIONS.md` | — |
| Umbenennung 4inOne → Lumiknot, beibehaltene Altbezeichner, Phasen 3–4, Rollback | `docs/REBRANDING_MIGRATION.md` | Audit `docs/audits/LUMIKNOT_MARKEN_AUDIT_2026-11-28.md` |
| Freigabe, Grenzen, Anti-Generic-Regeln | dieses Dokument | `AGENTS.md` § 6 |

**Historisch, nicht mehr maßgeblich:** `frontend/DESIGN_SYSTEM.md` (Kompass, Sept. 2026),
`design-system/4inone/MASTER.md` (Editorial, Okt. 2026), datierte Einträge in `DESIGN.md`/`docs/DESIGN_SYSTEM.md` und
alles unter `docs/audits`, `docs/qa`. Bei Widerspruch gilt die Tabelle oben.

Im Projekt insgesamt gilt die Rangfolge aus `AGENTS.md` (Abschnitt „Source-of-truth order“); die Markendokumente
stehen dort beim Designsystem.

## 2. Verbindliche Regeln (Kurzfassung mit Fundstelle)

| Bereich | Regel | Details |
|---|---|---|
| **Produktname** | „Lumiknot“, so geschrieben; nie „LUMIKNOT“ im Fließtext, kein ®/™ ohne Eintragung; Bereiche in der App deutsch, Markennamen „Lumiknot Finance/Home/Planner/Travel“ nur für Marketing | `NAMING_CONVENTIONS.md`, `BRAND_IDENTITY.md` › 9 |
| **Wortmarke** | Manrope 700, Laufweite −0,032 em; keine eigenen Glyphen ohne Freigabe | `LOGO_USAGE.md` › 2 |
| **Bildmarke** | Orbit-Zeichen aus `orbit.ts`; vier Elemente, Reihenfolge, Farben und Überlagerung fest; flach; rechtlich noch ungeprüft | `LOGO_USAGE.md` › 1 |
| **Logo-Varianten** | nur die erzeugten Dateien (`npm run brand:assets`) und `<app-brand>` mit den dokumentierten Zuständen | `LOGO_USAGE.md` › 5–6 |
| **Farben** | Markenfarben nur für Logo und Dekor; Text und Flächen nur über semantische Tokens; Farbe nie allein bedeutungstragend | `DESIGN_TOKENS.md` › 2 |
| **Typografie** | Inter für Oberfläche, Manrope für Marke und Überschriften; vier Gewichte; keine Kursive; tabellarische Ziffern für Beträge | `DESIGN_TOKENS.md` › 3 |
| **Design-Tokens** | Primitive → Semantik → Komponenten → Bereich; keine Hex-Werte in neuen Komponenten | `DESIGN_TOKENS.md` › 1 |
| **Komponenten** | erst wiederverwenden (`shared/ui`, `shared/features`), dann erweitern, dann neu – immer mit Tokens; keine Bereichs-Designsysteme | `DESIGN_SYSTEM.md`, `AGENTS.md` § 2.2 |
| **Bereichsidentitäten** | ein System; ein Bereich individualisiert nur Akzent, Bildsprache und fachliche Darstellungen | `SECTION_IDENTITY.md` |
| **Bildsprache** | echte Produktansichten (Demo-Screenshots), ruhige flache Illustrationen in Token-Farben nur für Leerzustände und Onboarding; keine Stockfotos, keine generischen KI-Bilder, keine Screenshots als App-Hintergrund | `BRAND_GUIDELINES.md` › Bildsprache |
| **Iconsprache** | eine Familie: `app-icon` (24er-Raster, Linie 1,8, runde Enden – passend zum Orbit); feste Bereichssymbole; keine zweite Icon-Bibliothek, keine 3D-Icons in Alltagsansichten | `BRAND_GUIDELINES.md` › Iconsprache |
| **Motion** | Bewegung erklärt, schmückt nicht; keine Dauerbewegung; reduzierte Bewegung respektieren | `MOTION_GUIDELINES.md` |
| **Tone of Voice** | ruhig, klar, ehrlich, Du-Form; Tatsachen statt Versprechen; keine Superlative und Buzzwords | `BRAND_IDENTITY.md` › 7 |
| **Barrierefreiheit** | WCAG 2.2 AA (Kontrast berechnet, axe in Playwright hell und dunkel), Tastatur vollständig, Klickflächen 44 px, Fokus sichtbar | `DESIGN_TOKENS.md` › 2, 8; `DESIGN_SYSTEM.md` |
| **Responsive** | Handy zuerst; geprüft bei 320, 390, Tablet, Desktop; kein seitliches Scrollen; Breakpoints 480 · 760 · 1024 · 1280 | `DESIGN_TOKENS.md` › 6, `DESIGN_SYSTEM.md` › Layout |
| **Neue Produktbereiche** | Registry, Tokens, Symbol, Kontrast, Doku – und für die Bildmarke eine neue Konstruktion nur mit Design-Freigabe | `BRAND_CONFIGURATION.md` › 6, `DESIGN_TOKENS.md` › 10 |

## 3. Anti-Generic-Regeln

Lumiknot soll aussehen wie ein bewusst gestaltetes Produkt, nicht wie eine Vorlage. **Vermeiden:**

- austauschbare SaaS-Ästhetik (Hero mit Verlauf, drei Feature-Karten, Logo-Wand, „Get started“);
- Glassmorphism, Verläufe, Neon, Glow, schwebende Deko-Objekte;
- übertriebene Rundungen (App: Radien 8 · 12 · 16, Pille nur für kleine Chips);
- willkürliche Bento-Raster; Karten in Karten; jedes Element als Karte;
- Badges ohne echten Status; Zähler, die niemand braucht;
- generische Illustrationen, Stockfotos, KI-Bilder;
- Animationen ohne Aussage;
- Marketingtexte, die auf jedes Produkt passen („nahtlos“, „smart“, „revolutionär“).

**Stattdessen:** funktionale Klarheit (eine Hauptaktion pro Ansicht), visuelle Hierarchie über Größe, Gewicht und
Abstand, bewusste Freiflächen, hochwertige Typografie, echte Daten und echte Bedürfnisse (die Startseite beantwortet
„Was steht heute an?“).

## 4. Architekturgrenzen

Marken- und Gestaltungsänderungen dürfen **nicht** nebenbei ändern: Backend-Architektur, Datenmodelle,
Authentifizierung, Berechtigungen, REST-Schnittstellen, Connection Engine, Personal AI Integration Standard,
fachliche Geschäftslogik, persistente Daten (inklusive Browser-Speicher-Schlüssel und Cookies) und Infrastruktur.
Wo eine Markenänderung so etwas berührt (z. B. eine Farbmigration wie `finanzen/0024`), ist sie ein eigener, freigegebener
Schritt mit Test und Rollback. Sicherheitskritische Altbezeichner (`docs/REBRANDING_MIGRATION.md`) bleiben unverändert.

## 5. Freigabeprozess

| Stufe | Beispiele | Freigabe |
|---|---|---|
| **A – Anwenden** | neue Seite oder Komponente mit vorhandenen Tokens, Bausteinen und Regeln; Texte im festgelegten Ton; Fehlerbehebung ohne sichtbare Markenänderung | keine eigene; im Rahmen des Auftrags |
| **B – System erweitern** | neues Komponenten-Token, neue Variante eines Bausteins, neues Symbol im bestehenden Stil, neue Bewegung nach den Richtlinien | im Auftrag nennen, nachher dokumentieren (`DESIGN_SYSTEM.md`, `DESIGN.md`, ggf. `DESIGN_TOKENS.md`) |
| **C – Identität ändern** | Name, Claim, Leitsatz, Bildmarke, Wortmarke, Markenfarben, Primitive, Schriften, Bereichsnamen, neuer Produktbereich, Ton-Regeln, Bewegungsprinzipien | **ausdrückliche Freigabe der Produktverantwortung vorab** |
| **D – Technik umbenennen** | Repository, Domain, Docker/systemd, Speicher-Schlüssel (Phasen 3–4) | eigene Freigabe nach `REBRANDING_MIGRATION.md` |

**Ablauf für Stufe C:**

1. **Vorschlag** mit Begründung, Vorher/Nachher (Screenshots oder Prüfblatt), betroffenen Stellen und Risiken.
2. **Prüfung:** Kontrast (hell und dunkel), Größen (16–512 px beim Logo), 320 px bis Desktop, reduzierte Bewegung;
   bei Namen zusätzlich Marken- und Domainrecherche (`BRAND_GUIDELINES.md` › Namensprüfung).
3. **Freigabe** durch die Produktverantwortung, ausdrücklich und für genau diesen Vorschlag.
4. **Umsetzung** über die Quellen (`brand.config.ts`, `orbit.ts`, `tokens.css`), dann `npm run brand:assets`,
   `npm run check:brand`, Unit-, Playwright- und Backend-Tests.
5. **Dokumentation** im verbindlichen Dokument (Tabelle in 1), Eintrag im Entscheidungsprotokoll
   (`BRAND_IDENTITY.md` › 12) und im Verlauf `DESIGN_SYSTEM.md`.

## 6. Pflege

- Eine Aussage, ein Ort: Werte stehen nur im verbindlichen Dokument, andere verweisen.
- Änderungen an Tokens, gemeinsamen Komponenten oder Bereichsfarben im selben Schritt in `docs/DESIGN_SYSTEM.md` und
  `DESIGN.md` nachtragen (`AGENTS.md` § 6).
- `npm run check:brand` (CI) sichert Name, Logo-Farben, Manifest, `index.html` und Backend gegen die Konfiguration.
- `npm run check:docs` (CI) prüft, dass alle Dateiverweise in den Steuer- und Markendokumenten (`AGENTS.md`,
  `CLAUDE.md`, `README.md`, `DESIGN.md` und die Dokumente aus 1) auf existierende Dateien zeigen. Ausgenommen ist der
  Verlauf in `docs/DESIGN_SYSTEM.md`, der bereichsbezogene Kurzpfade nutzt.
