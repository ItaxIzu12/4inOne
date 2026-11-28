# Rebranding 4inOne → Lumiknot — Migration

Stand 28.11.2026. Markenstrategie: `docs/BRAND_IDENTITY.md` · Markenregeln: `docs/BRAND_GUIDELINES.md` · Logo:
`docs/LOGO_USAGE.md` · Namen: `docs/NAMING_CONVENTIONS.md` · Bestandsaudit:
`docs/audits/LUMIKNOT_MARKEN_AUDIT_2026-11-28.md`.

Am 28.11.2026 zuerst als „Veyora“ umgesetzt (Phase 1–2), am selben Tag wegen Marken- und Domainlage in **Lumiknot**
umbenannt (`docs/BRAND_GUIDELINES.md` › Namensprüfung). Logo, Farben und Schrift blieben; `Veyora` gilt seitdem wie
`4inOne` als alter Name (`npm run check:brand`).

## Grundsatz

Die **sichtbare Marke** heißt überall Lumiknot. **Technische Namen** bleiben, solange ihre Umbenennung Daten,
Sitzungen, Verschlüsselung, Verträge mit anderen Diensten oder laufende Server berühren würde. Kein globales Suchen
und Ersetzen; jede Gruppe unten ist einzeln entschieden und jede Änderung einzeln geprüft.

**Namenskonventionen** (`docs/NAMING_CONVENTIONS.md`): sichtbar `Lumiknot`, neue technische Bezeichner `lumiknot`,
neue Umgebungsvariablen `LUMIKNOT_…`, Claim *Life, connected.* Bis heute war keine neue Umgebungsvariable nötig;
bestehende Variablen behalten ihren Namen.

## Ablauf und geänderte Dateien

| Schritt | Commit | Umfang | Inhalt |
|---|---|---|---|
| Phase 1 – sichtbarer Name | `b78502b` | 128 Dateien | Texte, Titel, Manifest, E-Mails, Export, Bericht, 2FA-Aussteller, `check:brand`, Doku |
| Phase 2 – Logo, Farben, Schrift | `28181c6` | 108 Dateien | Orbit-Zeichen, `<app-brand>`, Generator, Icons, Tokens, Manrope/Inter, Kategoriefarben-Migration |
| Name Lumiknot, Risiken | `988174f` | 163 Dateien | Veyora → Lumiknot überall, Lockups messen die Textbreite, Full-Stack-Test-DB im tmpdir, `?v=4` |
| Identität, Logo-System, Audit | `30fca37` | 78 Dateien | `BRAND_IDENTITY.md`, Wortmarke, robuste SVGs, laufende Doku, `BRAND.a11y.homeLink`, Demo-Kategoriefarben |
| Nacharbeit Produkt-Rebranding | (dieser Stand) | ≈ 35 Dateien | Django-Admin mit Marke, Kommentare und Unit-Beschreibungen der Betriebsdateien, diese Doku |

Die genaue Dateiliste je Schritt: `git show --stat <commit>`.

**Geprüfte Oberflächen** (sichtbar Lumiknot): Landing, Login, Registrierung, Onboarding, Dashboard, Kopfzeile,
Seitenleiste, Fußzeile, Profil, Einstellungen, Browser-Titel (`brandTitle()`), Benachrichtigungen, E-Mails
(Bestätigung, Passwort, Kontakt, Erinnerungen), Demo-Daten, Hilfetexte, SEO (`index.html`, Open Graph, `robots.txt`),
PWA-Manifest, Favicons, App-Icons, Django-Admin. Übersetzungsdateien gibt es nicht (App einsprachig deutsch).
**Nicht vorhanden** und daher ohne Änderung: OpenAPI-Dokumentation, eigene `LOGGING`-Konfiguration, E-Mail-
Vorlagendateien (Texte stehen im Code).

## Umbenannte Identifikatoren

| Vorher | Nachher | Wo | Kompatibilität |
|---|---|---|---|
| Seitentitel „… · 4inOne“ | `brandTitle()` → „… \| Lumiknot“ | Frontend-Routen | — |
| Manifest `name`/`short_name` | `Lumiknot` | `manifest.webmanifest` | ohne `id`, `start_url` gleich → installierte App bleibt dieselbe |
| Logo-Dateien `4inone-*`/`veyora-*` | `public/brand/lumiknot-*` | Frontend | alte Dateien entfernt, nichts verweist mehr darauf |
| Icon-Version | `?v=4` | `index.html`, Manifest | erzwingt neue Icons im Browser-Cache |
| Export `4inone-daten-…zip` | `lumiknot-daten-JJJJ-MM-TT.zip` | `datenexport` | nur Dateiname des Downloads |
| Backup-Codes `4inone-backup-codes.txt` | `lumiknot-backup-codes.txt` | Frontend | nur Dateiname des Downloads |
| `OTP_TOTP_ISSUER` | `Lumiknot` | Settings | nur Beschriftung neuer Authenticator-Einträge; bestehende Codes gelten |
| `DEFAULT_FROM_EMAIL` (Standard) | `Lumiknot <no-reply@lumiknot.local>` | Settings | nur Entwicklung; Betrieb über `.env` |
| `User-Agent` | `Lumiknot/1 (+…)` | Wechselkurse, Orte | — |
| Auswahltext Beta-Feedback T5 | „Den Vorteil von Lumiknot erklären“ | `core/0022`, `core/0023` | reine Zustandsmigration, kein SQL, Wert `T5` bleibt |
| Kategoriefarben (3 Automatikfarben) | neue Palette | `finanzen/0024` | nur private Kategorien mit genau der alten Automatikfarbe, umkehrbar |
| Django-Admin „Django-Administration“ | „Lumiknot – Verwaltung“ | `core/admin.py` | nur Beschriftung; Pfad `ADMIN_URL_PATH` und Rechte gleich |
| Full-Stack-Test-DB | `tmpdir/lumiknot-fullstack-tests.sqlite3` | `playwright.fullstack.config.ts` | nur Testlauf |

## Bewusst beibehaltene Identifikatoren

Vor Phase 1 rund 750 Treffer in rund 190 Dateien; am 28.11.2026 nach allen Schritten 133 Dateien, fast alle in den
Klassen unten. Varianten: `4inOne` (Doku, historisch), `4inone` (Pfade, Dateien, Docker, systemd, Domain),
`fourinone` (Datenbank, nginx), `4io` (Cookie, Browser-Speicher).

| Klasse | Identifikatoren | Warum beibehalten |
|---|---|---|
| **Sicherheitskritisch** | Schlüsselableitung `4inone-bordkarte:` (`reisen/boarding.py`), HMAC `4inone-ai:` (`integrations/ai/client.py`), Signatur-Salz `4inone.oauth.*` (`core/social_views.py`), `AI_APPLICATION_ID=4inone`, Backup-Schlüssel `4inone-backup.key` | Änderung macht gespeicherte Bordkarten unlesbar, AI-Anfragen ungültig (Vertrag mit dem Personal AI Core), laufende Logins ungültig bzw. Backups nicht mehr entschlüsselbar. **Nie nebenbei ändern.** |
| **Persistente Daten** | Browser-Speicher `4io-darstellung`, `4io-einkauf-ansicht`, `4io-org-aufgaben-gruppe`, `4io-finanzen-rueckblick-ausgeblendet`, `4io-offline-einkauf`, `4io-offline-einkauf-warteschlange`, `4io-offline-bordkarten`; Sitzungsspeicher `4io_reloaded_for_app`, `4io_chunk_reload_at`; Cookie `4io_signed_in`; Datenbank-Name und -Nutzer `fourinone`; lokale Volumes `4inone_postgres_data`/`4inone_redis_data`; GlitchTip-Volumes `4inone-monitoring_*`; Backups `4inone_*.tar.age` | Umbenennen verlöre Einstellungen und **noch nicht gesendete Offline-Änderungen**, meldete Nutzer ab (Cookie in Backend und nginx), legte leere Volumes an oder fände alte Backups beim Aufräumen nicht |
| **Infrastruktur** | Compose-Projekte `4inone` (lokal), `4inone-prod`, `4inone-monitoring`; Images `4inone-backend:local`, `4inone-web:local`; `/srv/4inone`, `/srv/4inone-data`, `/srv/4inone-secrets`; Units `4inone*.service/.timer`, `4inone-docker@…`; nginx `4inone.conf(.template)`, `$fourinone_home`; Domain `4inone.de`; Repository `ItaxIzu12/4inOne`; Pages-Pfad `/4inOne/`; `scripts/4inone.sh` | berührt laufende Server, Pfade in Units und Skripten, TLS und Links; nur mit Phase 3/4 und eigener Freigabe |
| **Intern technisch** | Prüf-IDs `4inone.E001/W001/W002`; Ordner `design-system/4inone/`; Testdaten (`de.4inone.web`, GlitchTip-Org `4inone`, `https://4inone.de/…`); CI-Datenbank `fourinone` | ohne Nutzen für Nutzer; Prüf-IDs können in Abschaltlisten (`SILENCED_SYSTEM_CHECKS`) stehen |
| **Historisch** | datierte Doku (`docs/audits`, `docs/qa`, Notizen, Testkatalog, Readiness-Audits, Changelogs), Titel der Ausgangs-Prompts, Git-Historie, Migrationen `core/0017`, `core/0022_…_veyora`, `finanzen/0024_…_veyora` | Geschichte nicht umschreiben; Migrationen werden nach dem Einspielen nie umbenannt |

Django-Apps, Tabellen, Migrationen, API-Routen (`/api/v1/…`) und App-Labels tragen den alten Namen nicht und
bleiben unverändert. Benutzerkonten, Authentifizierung, Berechtigungen, Connection Engine, AI-Standard und
Fachlogik wurden nicht verändert.

## Infrastruktur-Analyse (28.11.2026)

| Teil | Befund | Folge bei Umbenennung |
|---|---|---|
| Produktion (`deploy/docker/compose.yml`) | Daten als **Bind-Mounts** unter `DATA_DIR` (`postgres`, `private_media`, `certs`), keine benannten Volumes | Projektname änderbar ohne Datenverlust; es ändern sich nur Container- und Netznamen (`4inone-prod-…`) – Units, Skripte und Backups suchen diese Namen und müssten mitziehen |
| Lokal (`docker-compose.yml`, `name: 4inone`) | benannte Volumes `postgres_data`, `redis_data` → `4inone_postgres_data` | neuer Projektname legt **leere** Volumes an; vorher `external: true` mit altem Namen oder Projektname behalten |
| Monitoring (`monitoring/compose.yml`, `4inone-monitoring`) | benannte Volumes `pg-data`, `uploads` (GlitchTip) | wie lokal – Fehlerberichte gingen verloren (entbehrlich, aber unnötig) |
| Netze | `internal`, `edge` (Projektpräfix) | entstehen neu, unkritisch |
| Images | `4inone-backend:local`, `4inone-web:local` | lokal gebaut; neuer Name = Neubau, unkritisch, aber Skripte verweisen darauf |
| Umgebungsvariablen | keine Variable trägt den alten Namen (außer dem Wert `AI_APPLICATION_ID=4inone`) | nichts umzubenennen |
| GitHub Actions | Jobs ohne Markennamen; CI-Datenbank `fourinone`; `check:brand` im Frontend-Job | nur kosmetisch |
| systemd | Unit-Namen `4inone*`; Beschreibungen jetzt „Lumiknot …“ | Beschreibung wirkt erst nach erneutem Kopieren der Units auf den Server; Namen bleiben |

## Risiken

| Risiko | Stand |
|---|---|
| Datenverlust durch neue Volumes | ausgeschlossen: kein Projekt- oder Volume-Name geändert |
| Abmeldung, verlorene Offline-Änderungen | ausgeschlossen: Cookie und Browser-Speicher unverändert |
| Bordkarten, AI, Logins, Backups unlesbar | ausgeschlossen: Klasse „sicherheitskritisch“ unverändert |
| Alte Icons und Teilen-Bilder im Cache | gering; `?v=4` erzwingt neue, Messenger aktualisieren verzögert |
| Authenticator zeigt alten Namen | gering; bestehende Einträge heißen weiter „4inOne“, Codes gelten |
| Absender im Betrieb noch alt | offen bis `DEFAULT_FROM_EMAIL` in der Server-`.env` geändert ist (nicht im Repository, kein Secret angefasst) |
| Name rechtlich ungeprüft | offen; Prüfung vor öffentlicher Einführung (`docs/BRAND_IDENTITY.md`) |

## Kompatibilitätsentscheidungen

1. **Sichtbares zuerst, Technisches nur mit Nutzen und Freigabe.** Kein Nutzer sieht `4io_signed_in` oder
   `/srv/4inone`; ihr Risiko überwiegt.
2. **Migrationen nur additiv** (`docs/DECISIONS.md` D19): neue Zustandsmigration statt Umbenennung alter Dateien.
3. **Kein Manifest-`id`**: installierte PWAs bleiben dieselbe App.
4. **Alte Namen im Frontend verboten** (`npm run check:brand` in CI) – mit einer kurzen, begründeten Ausnahmeliste.
5. **Eine Quelle**: Name, Farben, Logo-Pfade in `brand.config.ts`; Logo-Dateien nur aus dem Generator.

## Phase 3 — Repository (vorbereitet, Freigabe nötig)

1. Auf GitHub `ItaxIzu12/4inOne` → `Lumiknot` umbenennen (GitHub leitet alte URLs und Git-Remotes weiter; die
   Historie bleibt vollständig).
2. Danach im Code: `DEMO_FEEDBACK_URL` (`layout/legal-page/demo-contact.ts`), Standard `PAGES_BASE` in
   `frontend/scripts/build-pages.mjs` und `chunk-load-recovery.spec.ts` auf `/Lumiknot/`, Ausnahmen in
   `frontend/scripts/check-brand.mjs` entfernen, lokale Remote-URL mit `git remote set-url origin …`.
3. Die GitHub-Pages-Adresse ändert sich (`…github.io/Lumiknot/`); alte Demo-Links brechen, weil Pages nicht
   weiterleitet.

## Phase 4 — Infrastruktur und Domain (nur mit eigener Freigabe)

Voraussetzung: Markenprüfung und die Lumiknot-Domain. Reihenfolge, je Schritt mit Rollback:

1. **Backup** (`4inone-docker@backup`) und Wiederherstellungstest in einem Container.
2. **Domain:** neue Domain zusätzlich in nginx und TLS; die alte leitet per 301 weiter. Rollback: Weiterleitung
   entfernen.
3. **Compose Produktion:** Projektname kann wechseln (Bind-Mounts), dabei Container-Namen in Units, `run-task.sh`
   und Backup-Skript mitziehen. **Lokal und Monitoring:** Volumes vorher als `external: true` mit altem Namen
   eintragen, sonst leere Volumes. Rollback: alter Projektname.
4. **Pfade/Units:** `/srv/lumiknot` als Symlink auf `/srv/4inone`, neue Units parallel anlegen, alte erst nach einem
   Tag Betrieb deaktivieren. Rollback: alte Units starten.
5. **Backups:** das Aufräumen in `run-task.sh` auf beide Muster (`4inone_*` und `lumiknot_*`) erweitern, erst dann den
   Dateinamen ändern; Schlüssel unverändert lassen.
6. **Browser-Speicher/Cookie** (optional): beim Start einmalig `4io-*` nach `lumiknot.*` kopieren und das Alte erst
   nach erfolgreichem Lesen löschen; den Cookie-Namen in Backend und nginx gleichzeitig ändern und eine Übergangszeit
   lang beide lesen. Ohne klaren Nutzen besser lassen.

Sicherheitskritische Namen bleiben auch in Phase 4. Eine Änderung von `4inone-bordkarte:` bräuchte eine
Datenmigration, die alle gespeicherten Bordkarten-Codes entschlüsselt und neu verschlüsselt.

## Testergebnisse

| Stand | Prüfung | Ergebnis |
|---|---|---|
| `988174f` (lokal) | `check:brand`, `check:architecture` | sauber |
| | Unit (Vitest) | 566 bestanden |
| | Playwright chromium | 445 bestanden, 2 übersprungen |
| | Full-Stack | 15 bestanden |
| | pytest / `manage.py check` / `makemigrations --check` | 1370 bestanden / keine Befunde / keine offenen Migrationen |
| `988174f` (GitHub CI) | backend, frontend, fullstack, deploy | grün |
| | browser | **1 Fehler** (auch bei `30fca37`): Finanzen › Transaktionen bei 320 px 3 px zu breit, nur unter Linux. Ursache: das Suchfeld durfte nicht schmaler als die schriftabhängige Grundbreite seines Eingabefelds werden (Linux-Chromium setzt Text etwas breiter). Behoben in `finance-transactions-tab.scss` (`min-width: 0`, Eingabefeld `width: 0`); im offiziellen Playwright-Linux-Image nachgestellt und danach 29/29 grün |
| `30fca37` (lokal) | Unit, Build, `check:*` | 566 bestanden, Build ok, sauber |
| | Playwright chromium | 440 bestanden, 5 Zeitüberschreitungen unter Last; die betroffenen Specs einzeln 65/65 |
| dieser Stand (lokal) | pytest / `manage.py check` / `makemigrations --check` | 1371 bestanden (neu: Admin-Marke) / keine Befunde / keine offenen Migrationen |
| | `check-deploy.sh nginx compose`, `bash -n` der Skripte, `check:brand` | bestanden; `shell systemd` laufen nur unter Linux (CI-Job `deploy`) |

## Rollback

- **Code, Bilder, Schriften, Doku:** `git revert <commit>` je Schritt in umgekehrter Reihenfolge (alles liegt im
  Repository; Schibsted Grotesk und alte Logos kommen mit zurück).
- **Migrationen `core/0022`–`0023`:** können bleiben oder mit `manage.py migrate core 0021` zurückgenommen werden;
  kein SQL.
- **Migration `finanzen/0024`:** `manage.py migrate finanzen 0023` färbt genau zurück.
- **Server:** Unit-Beschreibungen sind nur Text; bis zum nächsten Kopieren der Units bleibt dort alles beim Alten.
- Sonst keine Datenbank-, Volume-, Secret-, Speicher- oder Serveränderung zu bedenken.
