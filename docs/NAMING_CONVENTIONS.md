# Lumiknot — Namenskonventionen

> Teil der Brand Governance (`docs/BRAND_GOVERNANCE.md`): verbindlich für Schreibweisen und technische Bezeichner.

Stand 28.11.2026. Gilt für alles Neue; Bestehendes wird nur nach `docs/REBRANDING_MIGRATION.md` umbenannt.

## Marke

| Wo | Schreibweise | Beispiel |
|---|---|---|
| Sichtbarer Text | `Lumiknot` | „Willkommen bei Lumiknot“, „Lumiknot-Konto“ |
| Bereich (Marketing) | `Lumiknot <Bereich>` | Lumiknot Finance · Home · Planner · Travel |
| Bereich (App, deutsch) | Finanzen · Haushalt · Organisation · Reisen | Seitentitel „Haushalt \| Lumiknot“ |
| Seitentitel | `brandTitle('Seite')` | „Anmelden \| Lumiknot“ |

Nie „LUMIKNOT“ im Fließtext, nie mit ®.

## Technisch

| Was | Konvention | Beispiel |
|---|---|---|
| Kurzform (Slug) | `lumiknot` | `BRAND.slug` |
| Neue Umgebungsvariablen | `LUMIKNOT_…` | `LUMIKNOT_EXPORT_DIR` |
| Downloads | `lumiknot-<inhalt>[-JJJJ-MM-TT].<endung>` | `lumiknot-daten-2026-11-28.zip`, `lumiknot-backup-codes.txt` |
| User-Agent nach außen | `Lumiknot/<version> (+zweck)` | `Lumiknot/1 (+exchange rates)` |
| Neue Docker-/systemd-/Pfad-Namen | `lumiknot-…` | erst mit Phase 4 (Infrastruktur), siehe Migration |
| Neue Speicherschlüssel im Browser | `lumiknot.<bereich>.<name>` | `lumiknot.finance.reviewHidden` |

## Bereiche im Code

Die bestehenden technischen Bereichsnamen bleiben, weil sie in Django-Apps, Tabellen, API-Pfaden und Routen stecken:

| Bereich | Frontend-Ordner / Typ | Backend-App | URL | Marke |
|---|---|---|---|---|
| Finanzen | `finance` | `finanzen` | `/finanzen` | Finance |
| Haushalt | `household` | `haushalt` | `/haushalt` | Home |
| Organisation | `organization` | `organisation` | `/organisation` | Planner |
| Reisen | `travel` | `reisen` | `/reisen` | Travel |

Neue Bezeichner folgen der Spalte „Frontend-Ordner / Typ“ (`BrandSection` in `brand.config.ts`). Die Markennamen
`home`/`planner` werden nicht als technische Bezeichner eingeführt, solange die Bereiche technisch anders heißen –
sonst gäbe es zwei Namen für dasselbe.

## Alte Namen

`4inOne`/`4inone`/`fourinone` nur dort, wo `docs/REBRANDING_MIGRATION.md` sie als bewusst beibehalten führt. Neue
Vorkommen im Frontend lässt `npm run check:brand` scheitern.
