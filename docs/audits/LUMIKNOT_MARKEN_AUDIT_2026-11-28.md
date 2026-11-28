# Lumiknot — Marken- und Bestandsaudit nach dem Rebranding

Stand 28.11.2026, Commit `988174f` (main). Nur Analyse: kein Anwendungscode, keine Datenbank und keine Infrastruktur
wurden geändert. Grundlage: `docs/REBRANDING_MIGRATION.md` (Plan und Klassen), `docs/BRAND_GUIDELINES.md`,
`docs/LOGO_USAGE.md`, `docs/NAMING_CONVENTIONS.md`.

**Kurzfazit:** Die sichtbare App ist sauber auf Lumiknot umgestellt und durch `npm run check:brand` abgesichert; das
Logo wird überall einheitlich über `<app-brand>` gezeichnet. Offen sind vor allem **Dokumentation** (rund 190 sichtbare
„4inOne“ in laufenden, nicht historischen Dokumenten), **Farbreste** der alten grünlichen Neutralpalette im hellen
Modus und **verstreute Farbwerte** in Komponenten. Kein offener Punkt ist für Nutzer sichtbar oder sicherheitsrelevant.

---

## 1. Aktuelle Projektarchitektur

| Teil | Ist-Stand |
|---|---|
| Frontend | Angular 22 (standalone, Signals), TypeScript 6; `core/` (Dienste, u. a. `brand/`, `seo/`, `offline/`, `theme/`), `features/<bereich>/`, `layout/`, `shared/{ui,features,styles,utils}`. SSR-Konfiguration vorhanden, Demo-Modus (`/demo`, GitHub Pages). |
| Backend | Django 6.1 als modularer Monolith: `core`, `finanzen`, `haushalt`, `organisation`, `reisen`, `connections`, `integrations`, `datenexport`, `monitoring`, `website`. |
| Datenbank | PostgreSQL 16 (Docker, Betrieb), SQLite für Tests/Entwicklung; Redis 7. |
| Docker | `deploy/docker/compose.yml` (postgres, redis, backend, web), Images `4inone-backend:local`/`4inone-web:local`, systemd-Timer `4inone-docker-*`; lokal `docker-compose.yml` (Projekt `4inone`). Alternativ nativ: `deploy/systemd`, `deploy/nginx`. |
| PWA | `ngsw-config.json` (Angular-Service-Worker), `manifest.webmanifest` (Lumiknot, Maskable-Icon, `?v=4`). |
| Auth | JWT mit Refresh-Cookie, Hinweis-Cookie `4io_signed_in`, TOTP (Aussteller „Lumiknot“), Social Login mit signierten Flows (`4inone.oauth.*`). |
| Connection Engine | `backend/connections` (Registry, Auto-Links, Vorschläge, Erinnerungen, Relevanz, Suche, Heute-Ansicht) – V2 implementiert und getestet (`docs/CONNECTION_ENGINE_V2_*`). |
| Personal AI Standard | `backend/integrations/ai` (Client mit HMAC `4inone-ai:`, Discovery, Capabilities, Provider `core`/`mock`); standardmäßig aus (`AI_ENABLED=False`). Der AI Core selbst ist nicht Teil des Projekts. |
| CI/CD | `.github/workflows/tests.yml` (backend, frontend inkl. `check:brand`, deploy, browser, fullstack), `pages.yml` (Demo). Lauf zu `988174f` beim Schreiben noch aktiv; der vorherige Lauf war grün. |
| Tests | 94 Backend-Testdateien (1370 Tests), 84 Unit-Spec-Dateien (566 Tests), 48 Playwright-Specs (445 bestanden, 2 übersprungen), 4 Full-Stack-Specs (15 Tests) – alle am 28.11.2026 lokal grün. |

## 2. Bestehende Markenimplementierung

**Gut gelöst**

- **Eine Quelle:** `core/brand/brand.config.ts` (Name, Claim, Bereiche, Farben, Schriften, Logo-Pfade, SEO);
  Geometrie in `shared/ui/brand/orbit.ts`; alle Logo-Dateien erzeugt `npm run brand:assets`.
- **Logo einheitlich:** 14 Stellen nutzen `<app-brand>`, keine einzige bindet eine Logo-Datei als `<img>` ein. Der
  Bereichskontext kommt zentral aus der App-Shell.
- **Seitentitel:** alle Routen über `brandTitle()`/`BRAND_DEFAULT_TITLE` und die `SeoTitleStrategy`.
- **Farbprüfung:** `check:brand` vergleicht die `--logo-*`-Tokens mit der Konfiguration und verhindert alte Namen im
  Frontend.
- **Schrift:** Manrope/Inter selbst gehostet; keine Komponente setzt eine eigene Schriftfamilie, Schibsted Grotesk ist
  aus dem Code verschwunden.
- **Kontrast:** dokumentierte, berechnete Varianten für Text/Flächen (WCAG AA), durch axe-Tests abgesichert.

**Schwächen**

- Der Name „Lumiknot“ steht 115-mal fest in 58 Template-/TS-Dateien (Fließtexte). Das ist bei deutschen Sätzen
  vertretbar (so entschieden in `BRAND_GUIDELINES.md`), macht aber jeden künftigen Namenswechsel zu einer
  Suchen-und-Ersetzen-Aktion.
- `BRAND.a11y.homeLink` ist definiert, wird aber nicht genutzt; die Startseiten-Links haben drei Schreibweisen:
  „Lumiknot – Startseite“ (Shell, Fuß, Landing, Public), „Lumiknot – zur Startseite“ (Login), „Lumiknot — zum Start“
  (Header).
- Die helle Neutralpalette ist noch die alte, grünstichige („Porcelain/Sage“): `--text-secondary #52615b`,
  `--surface-hover #f1f3ef`, `--surface-pressed #ecefea`, `--border-* #e6e9e3/#dde1da/#b9c0b6/#879189`. Der
  Dunkelmodus wurde auf Blaugrau (passend zu Midnight `#101820`) umgestellt, der helle Modus nicht – die beiden Modi
  haben dadurch unterschiedliche Grundtemperaturen.

## 3. Betroffene Dateien (verbleibende alte Namen)

133 Dateien, 735 Treffer für `4inOne`/`4inone`/`fourinone`/`4io-`/`Veyora` (ohne Abhängigkeiten, Builds, Testausgaben).

| Klasse | Wo | Bewertung |
|---|---|---|
| **1 Sichtbare Marke – App** | keine (Frontend-Quellcode, `public/`, E-Mails, Export) | erledigt, durch CI geschützt |
| **1 Sichtbare Marke – Doku** | laufende Dokumente mit „4inOne“ als Produktname, u. a. `docs/AI_INTEGRATION.md` (23), `docs/PRUEFSTAND_ANLEITUNG.md` (22), `docs/ARCHITECTURE.md` (8), `docs/BORDKARTE_KONZEPT.md` (7), `docs/DEMO_AND_ONBOARDING.md`, `docs/COMPETITIVE_POSITIONING.md`, `docs/BETA_TEST_PLAN.md`, `docs/beta/*` (Interviewleitfaden, Einwilligung, Aufgaben – **gehen an Testpersonen**), `docs/PRODUCT_VISION.md`, `docs/SECURITY.md`, `PRODUCT.md`, `ARCHITEKTUR.md`, `MANIFEST.json` | offen – in Phase 1 bewusst nicht angefasst, gehört aber umgestellt (außer datierten Einträgen) |
| **1b Veraltete Markenbeschreibung** | `PRODUCT.md:47` beschreibt das alte Zeichen („vier weiche Felder“); `design-system/4inone/MASTER.md` nennt Schibsted Grotesk, Porcelain, Deep Forest und die alten Bereichsfarben; `DESIGN.md:35` listet alte Akzentwerte (`#0B6E4B`, `#A8325A`, `#8A5800`, `#2453B4`); `docs/REBRANDING_MIGRATION.md` nennt `?v=3` statt `?v=4` | offen – widerspricht der gültigen Marke |
| **2 Intern technisch** | Prüf-IDs `4inone.E001/W001/W002` (`core/checks.py`), `scripts/4inone.sh`, Ordner `design-system/4inone/`, Kommentar `_editorial.scss:1`, `.gitignore:103`, Testdaten (`de.4inone.web`, GlitchTip-Org `4inone`), CI-Datenbankname `fourinone` | unkritisch; Umbenennung möglich, aber ohne Nutzen für Nutzer |
| **3 Persistente Daten** | Browser-Speicher `4io-darstellung`, `4io-einkauf-ansicht`, `4io-org-aufgaben-gruppe`, `4io-finanzen-rueckblick-ausgeblendet`, `4io-offline-einkauf(-warteschlange)`, `4io-offline-bordkarten`; Session-Speicher `4io_reloaded_for_app`, `4io_chunk_reload_at` (**nicht** in der Bestandsaufnahme der Migration aufgeführt, kurzlebig und unkritisch); Cookie `4io_signed_in`; Volumes/DB `fourinone`, Backups `4inone_*.tar.age` | bleiben (Begründung in der Migration) |
| **4 Infrastruktur** | `deploy/**` (Compose `4inone-prod`, Images, `/srv/4inone`, 17 systemd-Units, nginx `4inone.conf` + `$fourinone_home`), lokales `docker-compose.yml` (`name: 4inone`), Domain `4inone.de`, Repository `ItaxIzu12/4inOne`, Pages `/4inOne/`, `DEMO_FEEDBACK_URL` | bleiben bis Phase 3/4 |
| **5 Historisch** | `docs/audits/*`, `docs/qa/*`, `docs/NOTIZ_*`, `CHANGELOG_V2.md`, datierte Einträge in `DESIGN.md`/`docs/DESIGN_SYSTEM.md`, Migrationen `core/0017`, `core/0022_…_veyora`, `finanzen/0024_…_veyora` | bleiben unverändert |
| **6 Sicherheitskritisch** | `4inone-bordkarte:` (Fernet-Schlüssel, `reisen/boarding.py:54`), `4inone-ai:` (HMAC, `integrations/ai/client.py:88`), `4inone.oauth.*` (Signatur-Salz, `core/social_views.py`), `AI_APPLICATION_ID=4inone` (Vertrag mit dem AI Core), Backup-Schlüsseldatei | **nie** nebenbei ändern |

**Fehlplatzierte Datei:** `frontend/src/app/shared/ui/icons/4inOne.code-workspace` ist eine VS-Code-Arbeitsbereichsdatei
im Icon-Ordner (seit Commit `4db4cea`, vermutlich versehentlich). Sie gehört nicht in den Quellcode.

**Entwicklungswerkzeug:** `.claude/launch.json` verweist auf Scratchpad-Pfade einer alten Sitzung; funktionslos, aber
harmlos.

## 4. Technische Abhängigkeiten

- **`brand.config.ts` → Generator:** `scripts/brand-assets.mts` liest die Datei direkt; sie darf deshalb nichts
  importieren. Lockup-Breiten werden gemessen, ein Namenswechsel braucht keine Handarbeit mehr.
- **Logo-Farben → Tokens:** `--logo-*` in `styles.css` müssen `BRAND.sections.*.logoColor` entsprechen
  (`check:brand`). Bereichs-Akzente (`--*-accent/-fill/-soft`) sind unabhängig, aber aus den Logo-Farben abgeleitet.
- **Finanz-Kategoriefarben:** `backend/finanzen/category_colors.py` muss zu den Bereichstokens passen (Backend-Test).
  Die **Demo-Daten** (`features/finance/data/demo-private-finance-api.ts`) nutzen dagegen noch eigene, ältere Werte
  (z. B. Wohnen `#164c49`, Lebensmittel `#8a5a23`, Mobilität `#2f5aa8`) – die Demo zeigt also andere
  Kategoriefarben als ein neues echtes Konto (Wohnen `#ab632b`, Lebensmittel `#a8326e`, Mobilität `#4a3aa7`).
- **Cache-Versionen:** `?v=4` in `index.html` und `manifest.webmanifest` muss bei jeder Icon-Änderung von Hand
  erhöht werden; `seo.mjs` und `build-pages.mjs` erhalten die Version.
- **Pages-Pfad:** Repository-Name = Pfad der Demo (`/4inOne/`); hängt an Phase 3.
- **Infrastruktur:** Compose-Projektname bestimmt die Volume-Namen – Umbenennung ohne `external: true` erzeugt leere
  Volumes (siehe Migration Phase 4).

## 5. Risiken einer (weiteren) Umbenennung

| Risiko | Wo | Schwere | Gegenmittel |
|---|---|---|---|
| Datenverlust (leere Volumes) | Compose-Projektname | hoch | Volumes `external: true` oder Projektname behalten |
| Bordkarten nicht mehr entschlüsselbar | `4inone-bordkarte:` | hoch | nie ändern ohne Neuverschlüsselungs-Migration |
| AI-Anfragen abgelehnt | `4inone-ai:`, `AI_APPLICATION_ID` | mittel | nur gemeinsam mit dem AI Core ändern |
| Laufende Social-Logins brechen ab | `4inone.oauth.*` | gering (10-Minuten-Fenster) | lassen |
| Verlust unsynchronisierter Offline-Änderungen | `4io-offline-einkauf-warteschlange` | mittel | lassen oder kopieren-dann-löschen |
| Nutzer-Einstellungen zurückgesetzt | übrige `4io-*` | gering | lassen |
| Demo-Links brechen | Pages-Pfad bei Repository-Umbenennung | gering | Links aktualisieren |
| Testpersonen sehen alten Namen | `docs/beta/*` | gering, aber peinlich | vor der nächsten Beta-Runde umstellen |
| Rechtliche Kollision | Klangnähe „Luminote“ | offen | DPMA/TMview-Prüfung (Nutzerschritt) |

## 6. Wiederverwendbare Bestandteile

- `brand.config.ts` + `brandTitle()` + `SeoTitleStrategy` – vollständig, nur ungenutzte Felder (`a11y.homeLink`).
- `<app-brand>` mit `context`/`wordmark` – deckt alle bisherigen Logo-Fälle ab.
- `brand-assets.mts` – erzeugt jede Variante reproduzierbar, auch nach Namens- oder Farbwechsel.
- `check-brand.mjs` – lässt sich leicht um weitere Prüfungen erweitern (siehe 7).
- Token-System (`styles.css`, `theme-dark.css`) mit Bereichsvarianten und Kontrastdokumentation.
- Die Klassen und Phasen in `docs/REBRANDING_MIGRATION.md` als Vorlage für Phase 3/4.

## 7. Verbesserungspotenziale

Nach Nutzen sortiert; alles außer A1 berührt Code oder Design und braucht deine Freigabe.

**A – Dokumentation (kein Code)**

1. Laufende Dokumente auf „Lumiknot“ umstellen (Klasse 1 – Doku), datierte Einträge unverändert lassen; zuerst
   `docs/beta/*`, `PRODUCT.md`, `docs/PRODUCT_VISION.md`, `docs/AI_INTEGRATION.md`, `docs/ARCHITECTURE.md`.
2. Veraltete Markenbeschreibungen korrigieren: `PRODUCT.md:47`, `DESIGN.md:35` (alte Akzentwerte),
   `REBRANDING_MIGRATION.md` (`?v=4`); `design-system/4inone/MASTER.md` als historisch kennzeichnen oder in
   `docs/DESIGN_SYSTEM.md` aufgehen lassen; Session-Speicherschlüssel in Klasse 3 der Migration nachtragen.

**B – Konsistenz (kleiner Code)**

3. Startseiten-Links einheitlich über `BRAND.a11y.homeLink` (drei Schreibweisen → eine).
4. Demo-Kategoriefarben an `category_colors.py` angleichen, damit Demo und echtes Konto gleich aussehen.
5. `4inOne.code-workspace` aus `shared/ui/icons/` entfernen.

**C – Design-Tokens (sichtbar, Design-Entscheid)**

6. Helle Neutralpalette von Grünstich auf das Blaugrau des Dunkelmodus und von Midnight ziehen
   (`--text-secondary`, `--surface-hover/-pressed/-sunken`, `--border-*`), Kontraste neu berechnen.
7. `_editorial.scss` (öffentliche Seiten) definiert die Bereichsfarben ein zweites Mal als feste Werte; zusätzlich sind
   `--x` und `--x-deep` identisch und der Bereich heißt dort `organisation` statt `organization`. Besser:
   `--finance: var(--finance-accent)` usw., die doppelten `-deep` streichen.
8. Feste Farben in Komponenten abbauen: 757 Hex-Werte in Komponenten-Dateien, 407 verschiedene Werte im Frontend
   (ohne Tokens grob 300). Am häufigsten: `#101820` (42×, = `--text-primary`), `#8a93a3` (24×), `#0e7957` (19×, =
   `--finance-accent`), `#955e28` (13×). Schwerpunkte: Reisen (`travel-late.scss`, `travel.scss`,
   `trip-common.scss`), `org-common.scss`, `shopping-tab.scss`, `home-tab.scss`, `finance-blocks.scss`. Viele davon
   sind `var(--token, #fallback)`-Rückfallwerte – die gehen nicht kaputt, verdoppeln aber jede Farbe.
9. `check:brand` erweitern: warnen, wenn eine Komponente einen Hex-Wert nutzt, der einem Token entspricht (verhindert
   neue Duplikate, ohne Bestand zu brechen).

## 8. Empfohlene Migrationsstrategie

1. **Jetzt (ohne Risiko):** A1–A2 als reine Doku-Runde. Danach B3–B5 als kleiner Code-Schritt mit vollem Testlauf.
2. **Design-Runde (eigene Freigabe):** C6–C7 zusammen, weil beide die Grundfarben betreffen; Vorher/Nachher im
   Browser (hell/dunkel, 390 px), axe-Tests, `DESIGN.md`/`docs/DESIGN_SYSTEM.md` nachziehen.
3. **Schrittweise:** C8 bereichsweise bei ohnehin anstehenden Änderungen (nicht als Großumbau), abgesichert durch C9.
4. **Phase 3 (Repository):** sobald die Domain gesichert ist; Ablauf steht in der Migration.
5. **Phase 4 (Infrastruktur):** erst mit Backup-Wiederherstellungstest und eigener Freigabe; Klasse 3 und 6 bleiben.

## Umsetzungsstand

**28.11.2026 – A1–A2 und B3–B5 umgesetzt** (freigegeben vom Nutzer):

- A1: rund 40 laufende Dokumente nennen das Produkt jetzt „Lumiknot“. Unverändert bleiben bewusst: datierte
  Berichte (`COMPLETE_REAL_USER_JOURNEY_AUDIT`, `PRE_BETA_READINESS_AUDIT`, `TESTKATALOG`, `docs/audits`,
  `docs/qa`, Notizen), Titel der Ausgangs-Prompts („4inOne – … MASTER PROMPT“), Dateinamen, die
  Repository- und Pages-Adressen (`ItaxIzu12/4inOne`, `/4inOne/`) und alle technischen Kleinschreibungen
  (`4inone`, `fourinone`). Hinweis `docs/SOCIAL_LOGIN.md`: Neue Einrichtungen nennen die App bei Google „Lumiknot“;
  eine bestehende Google-Konsole wurde nicht geändert.
- A2: `PRODUCT.md` (Markenzusagen), `DESIGN.md` (Akzentwerte), `REBRANDING_MIGRATION.md` (`?v=4`, Sitzungsschlüssel),
  `design-system/4inone/MASTER.md` als historisch gekennzeichnet.
- B3: alle Logo-Links über `BRAND.a11y.homeLink` („Lumiknot – Startseite“), 9 Komponenten.
- B4: Demo-Kategoriefarben = `category_colors.py`.
- B5: `shared/ui/icons/4inOne.code-workspace` entfernt.

Offen: C6–C9 (Design-Entscheid), Phase 3 und 4.
