# Veyora — Marke

Verbindlich für alle neuen Entwicklungen seit 28.11.2026. Vorher hieß das Produkt **4inOne**. Was technisch noch so
heißt und warum, steht in `docs/REBRANDING_MIGRATION.md`. Gestaltung im Detail: `docs/DESIGN_SYSTEM.md`, Kurzfassung
`DESIGN.md`.

## Identität

| | |
|---|---|
| Produktname | **Veyora** (immer so geschrieben, nie „VEYORA“ im Fließtext, kein ®) |
| Leitsatz in der App (de) | Dein Alltag. Alles verbunden. |
| Claim (international) | Life, connected. |
| Bereiche in der App | Finanzen · Haushalt · Organisation · Reisen |
| Bereichsnamen der Marke (Marketing, später) | Veyora Finance · Veyora Home · Veyora Planner · Veyora Travel |
| Werte | Verbindung, Unabhängigkeit, Vertrauen, Einfachheit, Ordnung, ruhige Qualität, langfristiger Wert |

Die App ist deutsch. Die englischen Bereichsnamen werden erst sichtbar, wenn der Nutzer das entscheidet (Phase 2).

## Single Source of Truth

- **Frontend:** `frontend/src/app/core/brand/brand.config.ts` (`BRAND`, `BRAND_DEFAULT_TITLE`, `brandTitle()`).
  Seitentitel immer `brandTitle('Seite')` → „Seite | Veyora“; der Schriftzug in `<app-brand>` liest `BRAND.name`.
- **Farben** sind Design-Tokens (`styles.css`, `shared/styles`), nicht Teil der Konfiguration, damit es keine zweite
  Farbquelle gibt.
- **Fließtexte** (Landing, Rechtsseiten, Hinweise, Tests) schreiben „Veyora“ direkt. `npm run check:brand` (auch in
  CI) schlägt fehl, sobald der alte Name im Frontend wieder auftaucht; erlaubte technische Ausnahmen stehen im Skript
  mit Grund.
- **Backend:** sichtbare Texte (E-Mails, Export-README, Finanzbericht, Zwei-Faktor-Name `OTP_TOTP_ISSUER`,
  Absendername) schreiben „Veyora“ direkt.

## Schreibweise und neue Bezeichner

- Sichtbar: „Veyora“, zusammengesetzt mit Bindestrich („Veyora-Konto“).
- Neue technische Namen: `veyora` (klein), neue Umgebungsvariablen `VEYORA_…`, Downloads `veyora-…`
  (z. B. `veyora-daten-2026-11-28.zip`, `veyora-backup-codes.txt`).
- Bestehende technische Namen (`4inone…`) **nicht** nebenbei umbenennen, nur nach `docs/REBRANDING_MIGRATION.md`.

## Logo

- **Stand Phase 1:** `<app-brand>` zeigt weiter das Vier-Felder-Zeichen mit dem Schriftzug „Veyora“; Favicon und
  App-Icons sind das Zeichen ohne Schrift und bleiben vorerst.
- **Geplant:** das Veyora-Orbit-Logo (vier verschlungene, abgerundete Elemente; Grün = Finanzen, Orange = Haushalt,
  Violett = Organisation, Blau = Reisen; die gemeinsame Mitte = Verbindung). Wird nach der Vorlage des Nutzers als SVG
  gebaut; Varianten: Primär, horizontal, vertikal, nur Zeichen, einfarbig hell/dunkel, App-Icon, Favicon, PWA- und
  Maskable-Icon. Flach als Hauptvariante, keine Verläufe, Neon-Effekte oder Schatten.
- Bereichskontext (später): im Bereich darf das passende Element dezent hervorgehoben werden; kurze Übergänge, keine
  Dauerrotation oder Pulsieren, `prefers-reduced-motion` beachten.

## Phasen

1. **Sichtbare Marke** (28.11.2026, erledigt bis auf das Logo): Name, Titel, Manifest, Teilen-Bild, Texte, E-Mails.
2. **Logo** nach Vorlage, danach Landing-Screenshots neu erzeugen.
3. **Farben und Schrift** (Orbit-Farben, Manrope/Inter) nur nach Vorschau und Freigabe.
4. **Infrastruktur und Domain** erst mit Veyora-Domain, eigener Migrationsplan (`docs/REBRANDING_MIGRATION.md`).

Offen vor der Veröffentlichung: Prüfung, ob „Veyora“ als Marke (DPMA/EUIPO) und als Domain frei ist.
