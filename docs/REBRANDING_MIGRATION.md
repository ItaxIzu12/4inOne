# Rebranding 4inOne → Lumiknot — Migration

Am 28.11.2026 zuerst als „Veyora“ umgesetzt (Phase 1–2), am selben Tag wegen Marken- und Domainlage in **Lumiknot**
umbenannt (`docs/BRAND_GUIDELINES.md` › Namensprüfung). Logo, Farben und Schrift blieben; `Veyora` gilt seitdem wie
`4inOne` als alter Name (`npm run check:brand`). Die Migrationsdateien `core/0022_…_veyora` und
`finanzen/0024_…_veyora` behalten ihren Namen, weil Migrationen nach dem Einspielen nicht umbenannt werden;
`core/0023` setzt den Auswahltext auf Lumiknot.

Stand 28.11.2026. Markenregeln: `docs/BRAND_GUIDELINES.md` · Logo: `docs/LOGO_USAGE.md` · Namen:
`docs/NAMING_CONVENTIONS.md`.

## Grundsatz

Die **sichtbare Marke** heißt überall Lumiknot. **Technische Namen** bleiben, solange ihre Umbenennung Daten,
Sitzungen, Verschlüsselung, Verträge mit anderen Diensten oder laufende Server berühren würde. Kein globales Suchen
und Ersetzen; jede Gruppe unten ist einzeln entschieden.

## Bestandsaufnahme (28.11.2026)

Vor Phase 1 rund 750 Treffer in rund 190 Dateien. Varianten: `4inOne` (sichtbar, Doku), `4inone` (Pfade, Dateien,
Docker, systemd, Domain), `fourinone` (nginx-Variablen), `4io` (Cookie, Browser-Speicher). `4InOne`, `4INONE`,
`4-in-One`, `4_in_one` kommen nicht vor.

| Klasse | Beispiele | Entscheidung |
|---|---|---|
| 1 Sichtbare Marke | Seitentitel, Texte, Aria-Labels, Manifest, Open Graph, E-Mails, Export, Finanzbericht, Logo, Icons | umgestellt (Phase 1–2) |
| 2 Intern technisch | Kommentare, Docstrings, Testnamen, Prüf-IDs `4inone.E001`, `scripts/4inone.sh` | Kommentare umgestellt; Prüf-IDs und Skriptname bleiben |
| 3 Persistente Daten | Browser-Speicher `4io-*`/`4io_*` (Darstellung, Einkaufsansicht, **Offline-Warteschlange**, Offline-Bordkarten; kurzlebig im Sitzungsspeicher `4io_reloaded_for_app`, `4io_chunk_reload_at`), Cookie `4io_signed_in`, Volume `4inone_postgres_data`, Datenbank-Name und -Nutzer `fourinone` (Docker), Backups `4inone_*.tar.age` | bleiben (sonst Verlust von Einstellungen und noch nicht gesendeten Offline-Änderungen) |
| 4 Infrastruktur | Compose-Projekte `4inone-prod`/`4inone-monitoring`, Images `4inone-backend:local`/`4inone-web:local`, `/srv/4inone`, `/srv/4inone-data`, `4inone.service`, `4inone-docker@…`, nginx `4inone*.conf`, `$fourinone_home`, Domain `4inone.de`, Repository `ItaxIzu12/4inOne`, Pages-Pfad `/4inOne/` | bleiben bis Phase 4 (eigene Freigabe) |
| 5 Historisch | datierte Einträge in `docs/` (Changelogs, Audits, Notizen), Git-Historie | bleiben unverändert |
| 6 Sicherheitskritisch | Schlüsselableitung `4inone-bordkarte:`, HMAC `4inone-ai:`, Signatur-Salz `4inone.oauth.*`, `AI_APPLICATION_ID=4inone`, Backup-Schlüssel `4inone-backup.key` | **nie** nebenbei ändern |

Django-Apps, Tabellen, Migrationen und API-Pfade tragen den alten Namen nicht (`finanzen`, `haushalt`, …).
LocalStorage ja; IndexedDB und Cache-API werden nicht direkt genutzt (der Angular-Service-Worker verwaltet seinen
Cache selbst und bleibt kompatibel).

## Phase 1 — sichtbarer Name (28.11.2026, erledigt)

| Bereich | Was | Risiko |
|---|---|---|
| Frontend | Seitentitel (`brandTitle()`), `index.html`, Manifest `name`/`short_name`, `robots.txt`, alle Texte, Aria-Labels, Copyright, Downloads `lumiknot-…` | keins; Manifest ohne `id`, `start_url` unverändert → installierte Apps bleiben dieselbe App |
| Backend | E-Mails, Export-README und `lumiknot-daten-JJJJ-MM-TT.zip`, Finanzbericht, Hinweistexte, Kommentare, `User-Agent` | keins |
| Backend | `OTP_TOTP_ISSUER = 'Lumiknot'` | nur die Beschriftung neuer Einträge in Authenticator-Apps; bestehende heißen weiter „4inOne“, Codes gelten |
| Backend | Standard-Absender `Lumiknot <no-reply@lumiknot.local>` (nur Entwicklung) | Betrieb: `DEFAULT_FROM_EMAIL` in der Server-`.env` selbst anpassen |
| Backend | Auswahltext Beta-Feedback T5 → Migrationen `core/0022` (Veyora) und `core/0023` (Lumiknot) | reine Zustandsänderung, kein SQL; Wert `T5` bleibt |
| CI | `npm run check:brand` | — |

## Phase 2 — Logo, Farben, Schrift (28.11.2026, erledigt)

| Was | Wie | Risiko |
|---|---|---|
| Orbit-Logo | `shared/ui/brand/orbit.ts` (Geometrie), `<app-brand>` mit `context`, `npm run brand:assets` für alle Dateien | keins |
| Icons, Manifest | Favicon SVG/ICO, Apple-Touch, 192/512, **Maskable** neu; Theme Midnight, Hintergrund Ivory; Icon-Links mit `?v=4` (seit dem Namen Lumiknot) | Browser und installierte PWAs übernehmen neue Icons verzögert (Cache) |
| Farben | Bereichsfarben aus den Logo-Farben (Haushalt Rosé → Orange/Karamell, Organisation Amber → Violett), Midnight statt Deep Forest, Ivory statt Porcelain, Dunkelmodus-Neutrale bläulich | rein visuell; Kontraste berechnet (`docs/BRAND_GUIDELINES.md`) und durch axe-Tests abgesichert |
| Schrift | Manrope + Inter selbst gehostet, Schibsted Grotesk entfernt | erster Besuch lädt bis ~170 KB statt ~68 KB Schrift; vorgeladen nur die zwei Latin-Dateien (~73 KB) |
| Teilen-Bild, Landing-Screenshots | neu erzeugt | Teilen-Vorschauen bei Diensten aktualisieren sich verzögert |
| Finanz-Kategoriefarben | Reisen `#197390`, Wohnen `#ab632b`, Lebensmittel `#a8326e`; Migration `finanzen/0024` färbt nur private Kategorien mit genau der alten Automatikfarbe um | Datenänderung, aber nur Farbwerte, umkehrbar (`migrate finanzen 0023`); selbst gewählte Farben und Haushalts-Kategorien bleiben |
| Brand Config | Logo-Dateien, Farben, Schriften, SEO, Bereiche mit Markennamen | — |

## Phase 3 — Repository (vorbereitet, Freigabe nötig)

1. Auf GitHub `ItaxIzu12/4inOne` → `Lumiknot` umbenennen (GitHub leitet alte URLs und Git-Remotes weiter; die
   Historie bleibt vollständig).
2. Danach im Code: `DEMO_FEEDBACK_URL` (`layout/legal-page/demo-contact.ts`), Standard `PAGES_BASE` in
   `frontend/scripts/build-pages.mjs` und `chunk-load-recovery.spec.ts` auf `/Lumiknot/`, Ausnahmen in
   `frontend/scripts/check-brand.mjs` entfernen, lokale Remote-URL mit `git remote set-url origin …`.
3. Die GitHub-Pages-Adresse ändert sich (`…github.io/Lumiknot/`); alte Demo-Links brechen, weil Pages nicht
   weiterleitet.

## Phase 4 — Infrastruktur und Domain (nur mit eigener Freigabe)

Voraussetzung: Markenprüfung und die Lumiknot-Domain (am 28.11.2026 noch frei, siehe
`docs/BRAND_GUIDELINES.md` › Namensprüfung). Reihenfolge, je Schritt mit Rollback:

1. **Backup** (`4inone-docker@backup`) und Wiederherstellungstest in einem Container.
2. **Domain:** neue Domain zusätzlich in nginx und TLS; die alte leitet per 301 weiter. Rollback: Weiterleitung
   entfernen.
3. **Compose:** `name: 4inone-prod` beibehalten **oder** die Volumes in `compose.yml` als `external: true` mit dem
   alten Namen eintragen, bevor der Projektname wechselt – sonst legt Docker **leere neue Volumes** an. Rollback:
   alter Projektname.
4. **Pfade/Units:** `/srv/lumiknot` als Symlink auf `/srv/4inone`, neue Units parallel anlegen, alte erst nach einem
   Tag Betrieb deaktivieren. Rollback: alte Units starten.
5. **Backups:** das Aufräumen in `run-task.sh` auf beide Muster (`4inone_*` und `lumiknot_*`) erweitern, erst dann den
   Dateinamen ändern; Schlüssel unverändert lassen.
6. **Browser-Speicher/Cookie** (optional): beim Start einmalig `4io-*` nach `lumiknot.*` kopieren und das Alte erst
   nach erfolgreichem Lesen löschen; den Cookie-Namen in Backend und nginx gleichzeitig ändern und eine Übergangszeit
   lang beide lesen. Ohne klaren Nutzen besser lassen.

Sicherheitskritische Namen (Klasse 6) bleiben auch in Phase 4. Eine Änderung von `4inone-bordkarte:` bräuchte eine
Datenmigration, die alle gespeicherten Bordkarten-Codes entschlüsselt und neu verschlüsselt.

## Rollback Phase 1–2

- Code, Bilder, Schriften: `git revert <commit>` (alles liegt im Repository; Schibsted Grotesk kommt mit zurück).
- Migrationen `core/0022`–`0023`: können bleiben oder mit `manage.py migrate core 0021` zurückgenommen werden; kein SQL.
- Migration `finanzen/0024`: `manage.py migrate finanzen 0023` färbt genau zurück.
- Sonst keine Datenbank-, Volume-, Secret-, Speicher- oder Serveränderung zu bedenken.
