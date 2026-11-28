# Lumiknot — Brand Configuration

Stand 28.11.2026. Wie die Marke technisch an **einer** Stelle definiert ist und wie alle anderen Stellen davon
abgeleitet oder dagegen geprüft werden. Was die Marke bedeutet: `docs/BRAND_IDENTITY.md`; wie sie aussieht:
`docs/BRAND_GUIDELINES.md`, `docs/LOGO_USAGE.md`; Namen: `docs/NAMING_CONVENTIONS.md`.

## 1. Grundsatz: eine Quelle, abgeleitet oder geprüft

```text
                frontend/src/app/core/brand/brand.config.ts   ← verbindlich
                 │                │                 │
     direkt importiert     erzeugt aus      geprüft gegen (npm run check:brand, CI)
                 │                │                 │
  Angular-Komponenten   scripts/brand-assets.mts   styles.css (--logo-*, Theme-Tokens)
  (Shell, Navigation,   → Logos, Icons,            public/manifest.webmanifest
   Landing, Auth, Logo,   Favicon, Teilen-Bild     src/index.html (Titel, Meta, Theme-Farbe)
   Titel, SEO-Meta)                                backend/config/brand.py (Django)
```

- **Direkt importiert:** alles, was zur Laufzeit im Browser entsteht.
- **Erzeugt:** Logo-Dateien und Icons (`npm run brand:assets`) – nie von Hand bearbeiten.
- **Geprüft:** Stellen, die technisch getrennt sein müssen (CSS, Manifest, statisches HTML für Crawler, Python).
  `npm run check:brand` vergleicht sie mit der Konfiguration und bricht in CI bei jeder Abweichung ab.

Warum nicht alles erzeugen? `index.html` und das Manifest werden von Crawlern, Messengern und dem Browser ohne
JavaScript gelesen, und das Backend ist Python. Prüfen statt erzeugen hält diese Dateien lesbar und ohne Build-Schritt,
verhindert aber Widersprüche genauso.

## 2. Struktur und Typen (`brand.config.ts`)

Die Datei hat **keine Importe** (der Generator und die Prüfung laden sie direkt mit Node) und nur Syntax, die Node
ohne Übersetzung versteht (keine `enum`s).

| Typ / Export | Inhalt |
|---|---|
| `BrandSection` | `'finance' \| 'household' \| 'organization' \| 'travel'` – stabile IDs der Fachbereiche |
| `BrandContext` | `'global' \| BrandSection` – zusätzlich die Startseite; auch Logo-Kontext |
| `BrandIcon` | Teilmenge von `IconName` (`'home' \| 'finance' \| 'household' \| 'calendar' \| 'travel'`); weicht sie ab, meldet der Typprüfer es dort, wo das Symbol verwendet wird |
| `BrandAreaInfo` | ein Eintrag der Bereichs-Registry (siehe 3) |
| `BrandSectionInfo` | `BrandAreaInfo` mit `id: BrandSection` |
| `BrandConfig` | die ganze Konfiguration (siehe unten) |
| `BRAND` | die Werte |
| `BRAND_SECTIONS` | die vier Fachbereiche in Navigationsreihenfolge |
| `brandAreaForUrl(url)` | Bereich zu einer URL (`/finanzen`, `/demo/reisen?…`), sonst `'global'` |
| `BRAND_DEFAULT_TITLE`, `brandTitle(seite)` | „Lumiknot — Dein Alltag. Alles verbunden.“, „Seite \| Lumiknot“ |

`BrandConfig`:

| Feld | Bedeutung |
|---|---|
| `name`, `slug` | Produktname „Lumiknot“, technische Kurzform `lumiknot` (Dateinamen, neue `LUMIKNOT_…`-Variablen) |
| `tagline`, `claim`, `description` | Leitsatz (de), Claim (en), Beschreibung (SEO, Manifest) |
| `areas` | Bereichs-Registry (Startseite + vier Fachbereiche) |
| `neutrals` | Midnight, Graphite, Ivory, White |
| `fonts` | `brand: 'Manrope'`, `ui: 'Inter'` (Dateien in `public/fonts`, Tokens in `styles.css`) |
| `logo` | Pfade aller Logo-Varianten (Zeichen, einfarbig, Lockups, Wortmarke, Favicon, App-/Maskable-Icon) |
| `seo` | Teilen-Bild, `themeColor` (Browserleiste, Ivory), `backgroundColor` (Startbildschirm, Ivory) |
| `pwa` | `themeColor` der installierten App (Midnight) |
| `a11y` | `homeLink` („Lumiknot – Startseite“), `logo` (Name des Zeichens für Bildschirmleser) |

Design-Tokens (Farben für Text und Flächen, Abstände, Radien) bleiben in `styles.css` und `theme-dark.css`; die
Konfiguration verweist mit `theme` auf ihr Präfix und hält nur die reinen Markenfarben.

## 3. Bereichs-Registry (`BRAND.areas`)

| ID | Anzeige (App) | Marke | Route | Symbol | Theme-Präfix | Logo-Kontext |
|---|---|---|---|---|---|---|
| `global` | Startseite | Lumiknot | `''` | `home` | `global` | `global` |
| `finance` | Finanzen | Lumiknot Finance | `finanzen` | `finance` | `finance` | `finance` |
| `household` | Haushalt | Lumiknot Home | `haushalt` | `household` | `household` | `household` |
| `organization` | Organisation | Lumiknot Planner | `organisation` | `calendar` | `organization` | `organization` |
| `travel` | Reisen | Lumiknot Travel | `reisen` | `travel` | `travel` | `travel` |

Jeder Eintrag hat zusätzlich `description` (ein Satz) und `logoColor` (reine Markenfarbe).

**Stabile IDs vs. Anzeigenamen:** Die IDs sind technische Schlüssel (CSS-Tokens `--finance-accent`, Logo-Kontext,
Speicher, Tests) und werden nie lokalisiert oder umbenannt. „Home“ und „Planner“ sind Markennamen (`brandName`),
keine IDs – es gibt bewusst keine IDs `home`/`planner`, sonst hätte derselbe Bereich zwei technische Namen
(`docs/NAMING_CONVENTIONS.md`). Routen sind deutsch und ebenfalls stabil (Lesezeichen, Links).

## 4. Zuständigkeiten

| Stelle | Liest aus der Konfiguration |
|---|---|
| `shared/ui/brand/brand.ts` (`<app-brand>`) | Name, Logo-Farben der Bereiche, Logo-Kontext |
| `shared/ui/brand/orbit.ts` | nur Geometrie (Reihenfolge der Elemente = `BrandSection`) |
| `layout/app-shell.ts` (Seitenleiste, Handy-Navigation, Logo-Link) | Bereiche (Name, Symbol, Route), `brandAreaForUrl` für den Logo-Kontext, `a11y.homeLink` |
| `layout/header`, `layout/public-shell`, `layout/tile-footer` | `a11y.homeLink`, Name (Copyright), Bereiche (Fußzeile) |
| `layout/bottom-nav` | Namen und Routen der Bereiche |
| `features/landing` | Name in Texten und FAQ, Bereichs-Identität (Schlüssel, Name, Symbol, Demo-Link) |
| `features/login`, `onboarding`, Passwort-/E-Mail-Seiten | Name, `a11y.homeLink` |
| `app.routes.ts`, `demo.routes.ts`, `app-area.routes.ts` | `brandTitle()`, `BRAND_DEFAULT_TITLE` |
| `core/seo/seo-title-strategy.ts` | Standardtitel und -beschreibung |
| `scripts/brand-assets.mts` | Name, Claim, Farben, Bereiche, Logo-Pfade |
| `scripts/check-brand.mjs` | alles, was geprüft wird (siehe 5) |
| `backend/config/brand.py` | gespiegelt: `PRODUCT_NAME`, `PRODUCT_SLUG` → `OTP_TOTP_ISSUER`, Standard-`DEFAULT_FROM_EMAIL`, Django-Admin |

**Bewusst nicht aus der Konfiguration:** Fließtexte mit vielen Sätzen in Fachbereichen, E-Mail-Texte im Backend und
die Bereichsseiten selbst nennen „Lumiknot“ direkt (`docs/BRAND_GUIDELINES.md`). `check:brand` verhindert dort alte
Namen; ein künftiger Namenswechsel ist an diesen Stellen ein geprüftes Suchen und Ersetzen. Fachlogik (Routen-
Guards, Daten, Berechtigungen) liest die Konfiguration nicht.

## 5. Prüfungen (`npm run check:brand`, CI-Job `frontend`)

1. Kein alter Name (`4inOne`, `Veyora`) in `src`, `public`, `e2e`, `e2e-fullstack` – mit kurzer, begründeter
   Ausnahmeliste.
2. Registry: Schlüssel = `id`; Fachbereich-Routen eindeutig und nicht leer; für jedes Theme gibt es
   `--<theme>-accent` in `styles.css`; `--logo-<id>` = `logoColor`.
3. Manifest: `name`, `short_name` = Name; `description` = Leitsatz; `background_color`, `theme_color` = `seo.backgroundColor`,
   `pwa.themeColor`.
4. `index.html`: `<title>` und `og:title` = Standardtitel; `og:site_name` = Name; `description` = Beschreibung;
   `theme-color` = `seo.themeColor`.
5. Backend: `PRODUCT_NAME`, `PRODUCT_SLUG` in `backend/config/brand.py` = Name, Kurzform.

Zusätzlich: Unit-Tests der Registry (`core/brand/brand.config.spec.ts`), des Logos (`shared/ui/brand/brand.spec.ts`)
und der Admin-Marke (`backend/core/test_admin_brand.py`); der Typprüfer sichert `BrandIcon ⊂ IconName`.

## 6. Erweiterung

**Neues Markenmerkmal** (z. B. ein weiterer Text oder Pfad): Feld in `BrandConfig` und `BRAND` ergänzen, an der
verwendenden Stelle importieren. Muss es auch außerhalb des Browsers stimmen (Manifest, HTML, Backend), eine Prüfung in
`check-brand.mjs` ergänzen.

**Namens- oder Farbwechsel:** `brand.config.ts` ändern → `npm run brand:assets` → `npm run check:brand` zeigt jede
abgeleitete Stelle, die nachgezogen werden muss (Manifest, `index.html`, `styles.css`, `backend/config/brand.py`) →
`?v=` der Icons erhöhen (`docs/LOGO_USAGE.md`).

### Regeln für einen neuen Produktbereich

1. **ID** englisch, klein, stabil (`BrandSection` erweitern); **Route** deutsch; **Markenname** „Lumiknot <Gattung>“.
2. Eintrag in `BRAND.areas` mit allen Feldern; Position in `BRAND_SECTIONS` = Platz in der Navigation.
3. **Tokens** `--<id>-accent/-fill/-soft/-on` und `--logo-<id>` in `styles.css` und `theme-dark.css`, Kontrast nach
   `docs/BRAND_GUIDELINES.md` prüfen.
4. **Symbol** in `app-icon.ts` ergänzen, dann in `BrandIcon` aufnehmen.
5. **Bildmarke**: Das Orbit-Zeichen hat genau vier Elemente. Ein fünfter Bereich braucht eine neue Konstruktion in
   `orbit.ts` – nur mit Design-Freigabe; bis dahin bekommt der Bereich keinen eigenen Logo-Kontext (`logoContext:
   'global'`).
6. App-Bereich, Routen und Backend-App nach `docs/ARCHITECTURE.md` § 9 anlegen; die Registry beschreibt nur die
   Identität, nicht die Fachlogik.
7. `npm run check:brand`, Unit-Tests, Doku hier und in `docs/DESIGN_SYSTEM.md` nachziehen.

## 7. Kompatibilität

- Bisheriges `BRAND.sections` heißt jetzt `BRAND.areas` und enthält zusätzlich `global`; alle Verwender sind
  umgestellt. IDs, Routen, CSS-Tokens und Logo-Kontexte sind unverändert.
- Die Browser-Theme-Farbe war schon Ivory (`index.html`), das Manifest Midnight; die Konfiguration hielt fälschlich
  einen Wert für beides. Jetzt sind es zwei benannte Werte (`seo.themeColor`, `pwa.themeColor`), sichtbar ändert sich
  nichts.
- Backend: Werte unverändert, jetzt aus `config/brand.py` statt dreifach geschrieben.
