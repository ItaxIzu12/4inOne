# 4inOne — Vollständiger Testkatalog (Stand 15.11.2026)

Alle Testfälle, die vor einer öffentlichen Produktion sinnvoll sind — automatisiert und manuell. Erstellt nach einer
Bestandsaufnahme des Codes (80 Backend-Testdateien, 78 Unit-Spezifikationen, 43 E2E-Dateien, 1 Full-Stack-Datei).

**Priorität:** **P0** = Blocker vor Go-Live · **P1** = vor öffentlichem Start · **P2** = bald danach
**Stand:** ✅ automatisiert vorhanden (Datei genannt) · 🟡 teilweise / nur Demo / nur lokal · ❌ fehlt
**Art:** U = Unit · A = API/Backend · E = E2E-Browser · F = Full-Stack (echtes Django) · M = manuell · I = Infrastruktur

> „✅“ heißt: es gibt einen Test, der diesen Fall prüft. Es heißt nicht, dass jede Variante abgedeckt ist.

---

## 0. Infrastruktur, Deployment, Betrieb

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| INF-01 | Frischer Ubuntu-24.04-Server nach `deploy/ANLEITUNG.md` von null aufsetzen, ohne Abweichung | P0 | I/M | ❌ nie durchgespielt |
| INF-02 | `manage.py check --deploy` auf dem Server ohne Fehler und ohne Warnung | P0 | I | 🟡 lokal: nur Mail/Cache/Media offen (erwartbar) |
| INF-03 | nginx: `nginx -t`, Weiche `/` mit/ohne Cookie `4io_signed_in`, `Vary: Cookie` | P0 | I | 🟡 nur mit Node-Nachbau getestet |
| INF-04 | nginx: vorgerenderte Seiten (`/`, `/impressum`, …) liefern HTML, alle anderen `index.csr.html` | P0 | I | 🟡 Nachbau |
| INF-05 | Sicherheits-Header in **jeder** `location` (CSP, HSTS, nosniff, frame-ancestors, Referrer, Permissions, COOP) — mit securityheaders.com/observatory prüfen | P0 | I | 🟡 Build geprüft, echter nginx nicht |
| INF-06 | CSP: kein Verstoß in Konsole auf Landing, Login, App, Demo, Rechtsseiten, Dialogen, PDF-Download | P0 | E | ✅ `landing-journey.spec.ts` (Teil) |
| INF-07 | TLS: A/A+ bei SSL Labs, HTTP→HTTPS-Umleitung, HSTS-Preload bewusst entschieden | P0 | I | ❌ |
| INF-08 | gunicorn per systemd: Neustart nach Absturz, nach Reboot, Logs in journald | P0 | I | ❌ |
| INF-09 | `BEHIND_PROXY=True` + `X-Forwarded-For`: Rate-Limits zählen die echte IP, nicht nginx | P0 | I/A | ❌ nur Konfiguration |
| INF-10 | `RATE_LIMIT_CACHE=database` + `createcachetable`: Limits gelten über alle Worker | P0 | I | ❌ |
| INF-11 | `PRIVATE_MEDIA_ROOT` außerhalb des Codes, Rechte 700, nicht über nginx direkt abrufbar | P0 | I | ❌ |
| INF-12 | Uploads bis 12 MB gehen, 13 MB → saubere Fehlermeldung (nginx `client_max_body_size` + Django) | P1 | I/E | 🟡 |
| INF-13 | Update-Ablauf `deploy/scripts/update.sh`: Migration, Build, Neustart ohne Datenverlust; Rückweg getestet | P0 | I | ❌ |
| INF-14 | systemd-Timer: Backup täglich, `prune_website` täglich — laufen wirklich (Log prüfen) | P0 | I | ❌ |
| INF-15 | Zeitzone Server = Europe/Berlin bzw. UTC bewusst; Cron-Zeiten passen | P1 | I | ❌ |
| INF-16 | Speicherplatz voll / DB nicht erreichbar → 503 statt Stacktrace, Alarm | P1 | I | ❌ |
| INF-17 | Django-Admin unter eigenem Pfad, mit CSS (`STATIC_ROOT`/`collectstatic`), nur mit MFA/IP-Beschränkung | P1 | I | ❌ CSS fehlt |
| INF-18 | GitHub-Pages-Demo und `DEMO_ONLY` vor Go-Live entfernt (`GITHUB_PAGES_DEMO.md`) | P0 | I | ❌ |
| INF-19 | `npm run seo -- https://domain`: sitemap.xml, robots.txt, absolute OG-Bilder | P1 | I | ❌ |
| INF-20 | CI wieder aktiviert und auf `main` grün (Backend gegen PostgreSQL, Frontend, Browser, Full-Stack) | P0 | I | ❌ Workflows deaktiviert |

## 1. Datenbank, Migrationen, Backup

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| DB-01 | Alle Migrationen auf leerer PostgreSQL-16-DB | P0 | A | ✅ lokal (pytest auf PG, 15.11.) |
| DB-02 | `makemigrations --check` ohne Änderungen | P0 | A | ✅ |
| DB-03 | Datenmigrationen auf Bestandsdaten (0009, 0011, 0012 Reisen …) | P0 | A | ✅ `reisen/test_migration_00*.py`, `core/test_migrations.py` |
| DB-04 | Übernahme SQLite → PostgreSQL: Zeilenzahl je Tabelle gleich, weich gelöschte Zeilen dabei | P1 | I | ✅ `scripts/dev-db.sh import-sqlite` (365/365) |
| DB-05 | ID-Zähler nach Import: neuer Eintrag in jeder Tabelle bekommt freie ID | P1 | A | 🟡 2 Tabellen stichprobenartig |
| DB-06 | **Backup → Restore auf frischem Server**: App startet, Login geht, Anhänge öffnen sich | P0 | I/M | ❌ (lokal nur SQLite-Kopie geprüft) |
| DB-07 | Backup verschlüsselt (age), Schlüssel getrennt aufbewahrt, Backup außer Haus | P0 | I | 🟡 Skript da |
| DB-08 | Backup-Größe/Laufzeit bei 10×/100× Datenmenge | P2 | I | ❌ |
| DB-09 | Migration bei laufender App (kurze Sperren, keine 500er) | P1 | I | ❌ |
| DB-10 | Rückwärtsmigration der letzten Migration jeder App (`migrate app <vorher>`) | P1 | A | ❌ |
| DB-11 | Groß-/Kleinschreibung, Umlaute, Sortierung (Collation) gleich wie erwartet: „Äpfel“ vor „Bananen“, Suche „müll“ findet „Müll“ | P1 | A | 🟡 |
| DB-12 | Gleichzeitige Schreibzugriffe (zwei Personen haken dieselbe Aufgabe ab) ohne Fehler/Doppelung | P1 | A | ❌ |
| DB-13 | Datenintegrität: keine verwaisten Fremdschlüssel (PostgreSQL erzwingt das jetzt) | P1 | A | ✅ durch PG |
| DB-14 | Soft-Delete: gelöschte Transaktionen unsichtbar, aber in Backup/Export vorhanden | P1 | A | ✅ `finanzen/tests/test_soft_delete.py` |

## 2. Konto und Anmeldung

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| AUTH-01 | Registrieren mit gültiger E-Mail/Passwort → Bestätigungsmail | P0 | A/F | ✅ `core/test_auth*.py`, `e2e-fullstack/kernablauf` |
| AUTH-02 | Registrieren: E-Mail schon vergeben → neutrale Meldung (keine Konto-Aufzählung) | P0 | A | ✅ `test_auth_audit.py` |
| AUTH-03 | Schwaches/kurzes/häufiges Passwort, Passwort = E-Mail → abgelehnt mit Erklärung | P0 | A/E | ✅ |
| AUTH-04 | E-Mail-Bestätigung: gültiger Link, abgelaufener Link, zweimal benutzt, manipuliert | P0 | A | ✅ `test_email_verification.py` |
| AUTH-05 | Bestätigungsmail erneut senden (Rate-Limit) | P1 | A | ✅ |
| AUTH-06 | Login richtig / falsches Passwort / unbekannte E-Mail → gleiche Meldung, gleiche Antwortzeit | P0 | A | ✅ (Zeit 🟡) |
| AUTH-07 | Brute Force: Sperre nach N Fehlversuchen (axes), Entsperren nach Zeit | P0 | A | ✅ `test_auth_audit.py` |
| AUTH-08 | Login-Rate-Limit pro IP hinter Proxy (siehe INF-09) | P0 | I | ❌ |
| AUTH-09 | Refresh-Token: httpOnly, Secure, SameSite; Rotation; alter Token nach Rotation ungültig | P0 | A | ✅ `test_sessions.py` |
| AUTH-10 | Access-Token abgelaufen → stiller Refresh, Anfrage wird wiederholt, keine Doppelaktion | P0 | E | 🟡 |
| AUTH-11 | Abmelden: Token gesperrt, Cookie weg, Zurück-Taste zeigt keine Daten | P0 | A/E | ✅ |
| AUTH-12 | Sitzungen: Liste, eine andere beenden, alle beenden; beendete Sitzung kann nichts mehr | P0 | A | ✅ `test_sessions.py` |
| AUTH-13 | MFA einrichten (QR, Code), falscher Code, Code doppelt verwendet, Zeitverschiebung ±30 s | P0 | A | ✅ `test_mfa.py` |
| AUTH-14 | Login mit MFA: ohne zweiten Schritt kein Zugriff auf irgendeinen Endpunkt | P0 | A | ✅ |
| AUTH-15 | MFA-Wiederherstellung (Gerät verloren) — Ablauf existiert und ist dokumentiert | P0 | A/M | 🟡 `test_security_recovery.py` |
| AUTH-16 | Passwort vergessen: Mail nur bei existierender Adresse, Antwort immer gleich | P0 | A | ✅ |
| AUTH-17 | Reset-Link: einmalig, Ablauf, nach Passwortwechsel alle Sitzungen beendet | P0 | A | ✅ |
| AUTH-18 | E-Mail-Adresse ändern (mit Bestätigung an neue und Hinweis an alte Adresse) | P1 | A | ❌ E-Mail derzeit nur lesbar |
| AUTH-19 | Name ändern, leer, 200 Zeichen, Emoji, HTML-Zeichen | P1 | A/E | 🟡 |
| AUTH-20 | Konto löschen: Bestätigung, alle eigenen Daten weg, geteilte Daten korrekt übergeben/entfernt, Dateien auf Platte gelöscht | P0 | A | ✅ `test_delete_account.py` (Dateien 🟡) |
| AUTH-21 | Konto löschen als einzige:r Admin eines Haushalts mit weiteren Mitgliedern | P0 | A | 🟡 |
| AUTH-22 | Onboarding: erster Login → Profilfragen, überspringen, später ändern | P1 | E | ✅ `onboarding.spec.ts`, `core/test_onboarding.py` |
| AUTH-23 | Zwei Tabs: in Tab A abmelden → Tab B reagiert beim nächsten Klick sauber | P1 | E | ❌ |
| AUTH-24 | CSRF: schreibende Anfrage ohne Token → 403 | P0 | A | ✅ |

## 3. Berechtigungen und Privatsphäre (wichtigster Block)

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| PERM-01 | Jeder Listen-Endpunkt verrät keine fremden Daten (Sweep über alle Routen, 3 Personen) | P0 | A | ✅ `core/test_permission_matrix.py` |
| PERM-02 | Jeder Detail-Endpunkt: fremde ID → 403/404 für GET/PATCH/PUT/DELETE (IDOR) | P0 | A | ✅ Matrix + Abdeckungs-Test für neue Views |
| PERM-03 | Private Finanzen sind nie für Haushaltsmitglieder sichtbar | P0 | A | ✅ `finanzen/tests/test_permissions.py` |
| PERM-04 | Haushalt: Admin vs. Mitglied (einladen, entfernen, Rollen) | P0 | A | ✅ |
| PERM-05 | Reise: Besitzer / Bearbeiter / Betrachter / Fremd — lesen, schreiben, löschen, einladen | P0 | A | ✅ `reisen/test_reisen_v1.py`, `test_split.py` |
| PERM-06 | Aus Reise/Haushalt entfernt → offene Seite zeigt sofort „kein Zugriff“ | P0 | E | ✅ `reisen.spec.ts` |
| PERM-07 | Verknüpfung zeigt nie den Titel eines Ziels, das die Person nicht sehen darf | P0 | A | ✅ `connections/tests/test_connection_security.py` |
| PERM-08 | Suche findet nur Eigenes/Geteiltes | P0 | A | ✅ `finanzen/tests/test_search_and_categories.py` (Teil) |
| PERM-09 | Geteilte Kalender: nur freigegebene Termine, private nie | P0 | A | ✅ `organisation/test_shared_calendars.py`, `test_calendar_shares.py` |
| PERM-10 | Kontakte: Einträge gehören nur ihrem Besitzer | P0 | A | ✅ Matrix |
| PERM-11 | Einladung: fremde Einladung annehmen/ablehnen/stornieren unmöglich | P0 | A | ✅ `core/test_invitations.py` |
| PERM-12 | Massenzuweisung: `owner`, `household`, `created_by`, `trip` im Body werden ignoriert/abgelehnt | P0 | A | ✅ (Teil, Matrix „eve“) |
| PERM-13 | Datei-Download: fremde Datei-ID, geratene Pfade, `../` | P0 | A | ✅ Matrix `file_content` |
| PERM-14 | Benachrichtigungen enthalten keine Inhalte fremder privater Einträge | P0 | A | 🟡 |
| PERM-15 | Startseite „Heute“ zeigt geteilte, nie private Einträge anderer | P0 | A | ✅ `connections/tests/test_today.py` |
| PERM-16 | Admin-Oberfläche: nur Superuser, kein Zugriff auf entschlüsselbare Geheimnisse | P1 | M | ❌ |
| PERM-17 | Zahlen-Enumeration: fortlaufende IDs verraten Anzahl der Nutzer? (bewusst entscheiden) | P2 | M | ❌ |

## 4. Startseite (Heute)

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| HOME-01 | Leeres Konto: „Erste Schritte“ mit 3 Punkten, keine Demo-Daten | P0 | E | ✅ `dashboard-v1.spec.ts` |
| HOME-02 | Gruppen Überfällig / Als Nächstes / Später / Ohne Uhrzeit / Vorbei korrekt sortiert | P1 | A/E | ✅ `dashboard-today.spec.ts`, `test_today.py` |
| HOME-03 | Tageswechsel um Mitternacht, Sommer-/Winterzeit-Umstellung | P1 | U/A | 🟡 |
| HOME-04 | Mehrtägiger Termin erscheint an jedem Tag, letzter Tag inklusive | P1 | A | ✅ |
| HOME-05 | Budget-Zahl stimmt mit Finanzen überein | P1 | E | 🟡 |
| HOME-06 | Sehr viele Einträge (200 an einem Tag) → „Alle anzeigen“, keine Verzögerung | P2 | E | ❌ |

## 5. Finanzen

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| FIN-01 | Transaktion anlegen: Ausgabe/Einnahme, Betrag „1.234,56“, „1234.56“, „0“, negativ, 15 Stellen | P0 | A/E | ✅ `test_transaction_create.py` |
| FIN-02 | Datum: heute, Zukunft (= geplant), 29.02., Monatsende, sehr alt | P0 | A | ✅ `test_transaction_datum.py` |
| FIN-03 | Bearbeiten, löschen (weich), wiederherstellen? | P0 | A | ✅ `test_transaction_update.py`, `test_soft_delete.py` |
| FIN-04 | Doppelklick auf Speichern → genau eine Transaktion (Idempotenz-Schlüssel) | P0 | A/E | ✅ `core/test_idempotency.py` |
| FIN-05 | Kategorien: anlegen, umbenennen, Farbe, löschen mit/ohne Transaktionen | P0 | A | ✅ `test_category_*.py` |
| FIN-06 | Monatsbudget: verfügbar = Budget − ausgegeben − geplant − Sparbeiträge; über Budget | P0 | A | ✅ `test_monthly_formulas.py` |
| FIN-07 | Kategorie-Budgets: Warnstufen, Jahreswechsel, Budgetjahr | P1 | A/E | ✅ `budget-year.spec.ts` |
| FIN-08 | Sparziele: Beitrag, Ziel erreicht, Ziel ohne Datum, Beitrag löschen | P1 | A | ✅ |
| FIN-09 | Wiederkehrend/geplant: monatlich am 31. → Februar, Ende, Pause | P0 | A | ✅ `test_recurring_planned.py` |
| FIN-10 | Zeiträume: Monat/Quartal/Jahr, vor/zurück, Grenzen | P1 | E | ✅ `finance-periods.spec.ts` |
| FIN-11 | Kontoauszug-Import CSV: Sparkasse/ING/DKB/N26-Format, Umlaute, Semikolon/Komma, Dubletten, 5.000 Zeilen, kaputte Datei | P0 | A/E | ✅ `test_private_import.py`, `finance-import.spec.ts` (Banken 🟡) |
| FIN-12 | Berichte (PDF/Jahresübersicht): Zahlen = Summen der Liste, Umlaute im PDF, leeres Jahr | P1 | A | ✅ `test_reports.py`, `test_year_summary.py` |
| FIN-13 | Rundung: 0,1 + 0,2, Cent-Summen über 1.000 Buchungen exakt (Decimal) | P0 | A | 🟡 |
| FIN-14 | Limits: Anzahl/Größe (Schutz vor Missbrauch) | P1 | A | ✅ `test_private_limits.py` |
| FIN-15 | Suche über Transaktionen (Text, Betrag, Kategorie) | P1 | A | ✅ |
| FIN-16 | Analysen/Ausgabenkurve: letzter Tag im Monat, Monat ohne Daten | P1 | A | ✅ `test_analysen.py` |
| FIN-17 | Alte Haushaltsfinanzen bleiben eingefroren (nur lesbar) | P1 | A | ✅ `test_legacy_frozen.py` |
| FIN-18 | Reiseausgaben erzeugen nie eine Finanztransaktion | P0 | A | ✅ `reisen/test_reisen_v1.py` |

## 6. Haushalt

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| HH-01 | Aufgabe anlegen, zuweisen, erledigen, rückgängig | P0 | A/E | ✅ `test_aufgaben.py`, `haushalt-aufgaben.spec.ts` |
| HH-02 | Wiederkehrend: täglich/wöchentlich/monatlich, nächster Termin nach Erledigen, überfällig erledigt | P0 | A | ✅ `test_routinen_geraete_listen.py` |
| HH-03 | Räume: Aufgaben je Raum, Raum löschen mit Aufgaben | P1 | A | 🟡 |
| HH-04 | Einkaufsliste: hinzufügen, abhaken, Einkauf abschließen → Finanz-Ausgabe (genau eine) | P0 | A/E | ✅ `test_einkauf.py` |
| HH-05 | Einkaufsmodus offline/schlechtes Netz im Laden (Handy) | P1 | M | ❌ |
| HH-06 | Zwei Personen bearbeiten gleichzeitig dieselbe Liste | P1 | A/M | ❌ |
| HH-07 | Ordner Vertrag: Kündigungsfrist, Verlängerung, neuer Preis ab Datum → Finanzen geplant | P0 | A | ✅ `test_ordner.py`, Connections |
| HH-08 | Ordner Gerät: Wartungsintervall, nächste Wartung, Garantie | P1 | A | ✅ |
| HH-09 | Anhänge: PDF/JPG/PNG/WEBP, 10 MB, 0 Byte, falsche Endung (exe als .pdf), HEIC abgelehnt, Löschen löscht Datei auf Platte | P0 | A | ✅ `test_ordner_anhaenge.py` (gleiche Prüfung wie `organisation/files.py`) |
| HH-10 | Personen im Haushalt, Fairness nur ab 2 Mitgliedern | P1 | A/E | ✅ `test_fairness_and_defaults.py`, `household-people.spec.ts` |
| HH-11 | Haushalt verlassen / Mitglied entfernen → Daten bleiben beim Haushalt | P0 | A | 🟡 |

## 7. Organisation

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| ORG-01 | Termin: ganztägig, mit Uhrzeit, über Mitternacht, mehrtägig, Ende vor Beginn | P0 | A/E | ✅ `organisation.spec.ts`, `test_private_api.py` |
| ORG-02 | Wiederholung (falls vorhanden), Ausnahme, Ende der Serie | P1 | A | 🟡 |
| ORG-03 | Kalender-Monatsansicht: Balken über Wochen-/Monatsgrenze, Klick auf jeden Tag | P1 | E | ✅ |
| ORG-04 | ICS-Import: Google/Apple/Outlook-Datei, Zeitzonen, Umlaute, Dubletten, 2.000 Termine, kaputte Datei | P0 | A/E | ✅ `test_event_import.py`, `organisation-import.spec.ts` |
| ORG-05 | Aufgaben: Fälligkeit, Uhrzeit, überfällig, erledigt | P0 | A | ✅ |
| ORG-06 | Notizen: Text, Anhänge | P1 | A/E | ✅ `test_notizen_dateien.py`, `note-attachments.spec.ts` |
| ORG-07 | Dateien: Upload, Download (Content-Disposition), Vorschau, fremde Datei | P0 | A | ✅ |
| ORG-08 | Geteilte Kalender: freigeben, entziehen, Rechte | P0 | A/E | ✅ `shared-calendars.spec.ts` |
| ORG-09 | Zeitzone: Termin um 00:30 erscheint am richtigen Tag (Browser in anderer Zone) | P1 | E | ❌ |

## 8. Reisen

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| TRIP-01 | Reise anlegen/bearbeiten/absagen/löschen, Datum Ende vor Beginn, Überschneidung | P0 | E/A | ✅ `reisen.spec.ts`, `test_reisen_v1.py` |
| TRIP-02 | Teilnehmer einladen, Rolle ändern, entfernen; Rechte je Rolle | P0 | A/E | ✅ |
| TRIP-03 | Ablauf (Tagesprogramm), im Kalender sichtbar, Zeiten über Mitternacht | P1 | A/E | ✅ |
| TRIP-04 | Planung (Aufgaben), Packliste, Vorschläge übernehmen | P1 | E | ✅ |
| TRIP-05 | Budget: Gesamt- und Kategorie-Budget, über Budget | P0 | E/A | ✅ |
| TRIP-06 | Währungen: Ausgabe in JPY, Reise in EUR, Heimat CHF; Kurs fehlt → wird nachgerechnet | P0 | A/E | ✅ `test_reisen_fx.py` |
| TRIP-07 | Wer schuldet wem: 2/3/5 Personen, Teil-Aufteilung, Cent-Reste, ohne Zahler, beglichen, zurücknehmen | P0 | A/U/E | ✅ `test_split.py`, `trip-split.spec.ts`, e2e |
| TRIP-08 | Wer schuldet wem: Person verlässt die Reise mit offenem Saldo | P1 | A | ❌ |
| TRIP-09 | Stornofrist: nicht vor heute, Erinnerung im Kalender, abgelaufen | P1 | A/E | ✅ |
| TRIP-10 | Reisezeitraum im Kalender an/aus, Reise verschoben → Kalender folgt | P1 | A | ✅ Connections |

## 9. Verknüpfungen (Connection Engine)

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| CON-01 | Alle 12 erlaubten Paare in beide Richtungen anlegen/entfernen | P0 | A | ✅ `connections/tests/test_matrix.py` |
| CON-02 | Unerlaubte Paare → abgelehnt | P0 | A | ✅ |
| CON-03 | „Passt dazu“-Filter (Relevanz) gleich in Demo und Backend | P1 | A/U | ✅ `test_relevance.py`, `test_demo_mirror.py` |
| CON-04 | Vorschläge: annehmen, „nicht relevant“, kommt nicht wieder | P1 | A/E | ✅ `test_suggestions.py` |
| CON-05 | Auto-Links (Vertrag→Finanzen, Gerät→Wartung, Reise→Kalender …): an, pausieren, aufheben ohne Datenverlust | P0 | A | ✅ `test_auto_links.py` |
| CON-06 | Ziel gelöscht → Verknüpfung verschwindet überall, nichts bricht | P0 | A | ✅ |
| CON-07 | Aufräumen sehr vieler Verknüpfungen (Batch) | P2 | A | ✅ |

## 10. Personen, Familie, Einladungen, Benachrichtigungen

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| PPL-01 | Kontakt einladen per E-Mail, annehmen, ablehnen, abgelaufen, an sich selbst | P0 | A/E | ✅ `invitations.spec.ts`, `test_invitations.py` |
| PPL-02 | Einladung an noch nicht registrierte Adresse → nach Registrierung sichtbar | P0 | F | 🟡 |
| PPL-03 | Gruppen anlegen, Mitglieder, löschen | P1 | E | ✅ `familie.spec.ts`, `people-sync.spec.ts` |
| PPL-04 | Benachrichtigung erscheint, gelesen, Link führt zum Eintrag, Eintrag inzwischen gelöscht | P1 | A/E | 🟡 |
| PPL-05 | Einladungs-Rate-Limit | P1 | A | ✅ |

## 11. Öffentliche Seiten, Demo, SEO

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| PUB-01 | Landing: lädt ohne JS-Fehler, CTA führt zur Demo, Login/Registrieren erreichbar | P0 | E | ✅ `landing.spec.ts`, `landing-journey.spec.ts` |
| PUB-02 | Rechtsseiten mit **echtem** Impressum/Datenschutz/AGB, kein Platzhalter-Hinweis | P0 | M/E | ❌ Platzhalter |
| PUB-03 | Demo: alle Bereiche, keine Anfrage an echte API, Daten nur im Speicher | P0 | E | ✅ `demo-pages.spec.ts`, `demo-dashboard.spec.ts` |
| PUB-04 | Demo-Besetzung überall gleich (Sophie/Max/Lena/Jonas) | P2 | E | 🟡 |
| PUB-05 | 404-Seite mit `noindex` | P1 | E | ✅ `public-pages.spec.ts` |
| PUB-06 | Meta-Titel, Beschreibung, OG-Bild je öffentlicher Seite | P1 | E | ✅ |
| PUB-07 | Besucherzählung: keine Cookies, keine IP, DNT/GPC beachtet, Löschung nach Frist | P0 | A | ✅ `website/tests.py` |
| PUB-08 | Lighthouse: Performance ≥ 90 mobil, SEO 100, Best Practices 100 | P1 | M | ❌ |

## 12. Sicherheit (OWASP Top 10 & Co.)

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| SEC-01 | XSS: `<script>`, `<img onerror>`, `javascript:`-Links in jedem Textfeld → nur als Text sichtbar | P0 | E/A | 🟡 Angular escapt, kein `innerHTML`/`bypassSecurityTrust` im Code (15.11.); gezielter Test fehlt |
| SEC-02 | XSS über Dateinamen, ICS-/CSV-Import, PDF-Bericht | P0 | A | 🟡 |
| SEC-03 | SQL-Injection in Suche/Filtern (`' OR 1=1--`) | P0 | A | ✅ ORM, Stichprobe 🟡 |
| SEC-04 | CSV-Injection im Finanz-Export: Beschreibung „=HYPERLINK(…)“, „+“, „-“, „@“ wird als Text exportiert | P1 | A | ✅ behoben 15.11.: `finanzen/reports.py` `_text_cell`, Test `test_csv_cells_from_users_never_become_spreadsheet_formulas` |
| SEC-05 | Uploads: Inhalt statt Endung prüfen, SVG mit Skript, Polyglot-Dateien, Pixel-Bombe, EXIF/GPS in Fotos | P0 | A | ✅ `organisation/files.py` (Inhaltserkennung, Neukodierung ohne Fotodaten, 10 MB) — Pixel-Bombe 🟡 |
| SEC-06 | Datei-Auslieferung mit `Content-Disposition: attachment` + `nosniff` (kein Ausführen im Browser) | P0 | A | 🟡 |
| SEC-07 | SSRF über Ortssuche (`PLACES_PROVIDER_URL` fest, keine Nutzer-URL) | P1 | A | ✅ `core/test_places.py` |
| SEC-08 | Offene Weiterleitung über `?next=`/Login-Redirect | P1 | A/E | ❌ |
| SEC-09 | Clickjacking (`frame-ancestors 'none'`) | P1 | I | 🟡 |
| SEC-10 | Fehlerseiten verraten keine Stacktraces/Pfade (DEBUG=False) | P0 | A | ✅ `test_exception_handler.py` |
| SEC-11 | Abhängigkeiten: `pip-audit`, `npm audit` ohne Befund; Dependabot/Renovate aktiv | P0 | I | ✅ ohne Befund (15.11.); Automatik ❌ |
| SEC-12 | Geheimnisse nie im Repo (Historie geprüft), Server-`.env` Rechte 600 | P0 | I | ✅ Historie sauber (15.11.) |
| SEC-13 | Passwort-Hashing Argon2, Parameter angemessen | P0 | A | ✅ |
| SEC-14 | JWT: Algorithmus fest, `none` abgelehnt, Signaturschlüssel ≠ SECRET_KEY-Leak-Szenario | P0 | A | ✅ `test_security_hardening.py` (Teil) |
| SEC-15 | Rate-Limits auf allen sensiblen Endpunkten (Login, MFA, Register, Reset, Einladung, Feedback) | P0 | A | ✅ |
| SEC-16 | Externer Penetrationstest oder mindestens OWASP-ZAP-Baseline-Scan gegen Staging | P1 | I | ❌ |
| SEC-17 | Sensible Felder verschlüsselt ruhend (Vertragsnummern, Notizen?) — bewusste Entscheidung + Festplattenverschlüsselung | P1 | M | ❌ `django-cryptography` installiert, nicht benutzt |

## 13. Datenschutz / DSGVO

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| GDPR-01 | Datenschutzerklärung vollständig und korrekt (GO_LIVE.md §1) | P0 | M | ❌ |
| GDPR-02 | **Auskunft/Datenexport (Art. 15/20)**: alle eigenen Daten als Datei (JSON/CSV + Anhänge) | P0 | A/E | ❌ kein Endpunkt (nur Rate-Limit-Einstellung) |
| GDPR-03 | Löschung (Art. 17): Konto löschen entfernt alles inkl. Dateien, Backups laufen nach Frist aus | P0 | A/I | 🟡 |
| GDPR-04 | Auftragsverarbeitung (AVV) mit Hoster und Mail-Anbieter, Server in der EU | P0 | M | ❌ |
| GDPR-05 | Verzeichnis der Verarbeitungstätigkeiten, TOM-Dokument | P1 | M | ❌ |
| GDPR-06 | Keine Drittanbieter-Anfragen beim Laden (Schriften selbst gehostet, keine CDNs) | P0 | E | ✅ CSP `connect-src 'self'` |
| GDPR-07 | Beta-Feedback: Einwilligung, Löschung nach 180 Tagen | P1 | A | ✅ `test_beta_feedback.py` |
| GDPR-08 | Logs ohne personenbezogene Inhalte (keine Beträge/Titel in Logs), Aufbewahrungsfrist | P1 | I | ❌ |

## 14. E-Mail

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| MAIL-01 | Echter EU-Mailversand (SMTP/TLS) für Bestätigung, Reset, Einladung | P0 | I | ❌ nur Konsole |
| MAIL-02 | SPF, DKIM, DMARC für die Domain; Mails landen nicht im Spam (Gmail, Outlook, GMX, Web.de) | P0 | I | ❌ |
| MAIL-03 | Mailserver nicht erreichbar → Registrierung bricht nicht mit 500 ab, Hinweis + erneut senden | P1 | A | 🟡 |
| MAIL-04 | Mail-Inhalte: Umlaute, Links mit richtiger Domain, Text- und HTML-Teil, Abmelden-Hinweis falls nötig | P1 | M | ❌ |

## 15. Barrierefreiheit (WCAG 2.1 AA / BFSG)

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| A11Y-01 | axe ohne Befund auf allen Seiten und geöffneten Dialogen | P0 | E | ✅ `accessibility.spec.ts` + je Bereich |
| A11Y-02 | Komplette Bedienung nur mit Tastatur (Dialoge, Datumsauswahl, Menüs, Chips) | P0 | M/E | 🟡 |
| A11Y-03 | VoiceOver (iOS/macOS) und NVDA: Kernabläufe vorlesbar | P1 | M | ❌ |
| A11Y-04 | 200 % Zoom und große Systemschrift ohne abgeschnittenen Text | P1 | M | ❌ |
| A11Y-05 | `prefers-reduced-motion` respektiert | P2 | E | 🟡 |
| A11Y-06 | Erklärung zur Barrierefreiheit aktuell | P1 | M | ✅ Seite vorhanden |

## 16. Geräte, Browser, Darstellung

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| UI-01 | 360 / 390 / 430 / 768 / 1024 / 1440 / 1920 px ohne Querscrollen | P0 | E | ✅ (Reisen u. a.) |
| UI-02 | Echtes iPhone (Safari) und Android (Chrome): Login, Erfassen, Dialoge, Tastatur verdeckt nichts | P0 | M | ❌ nur Emulation |
| UI-03 | Firefox, Safari macOS, Edge | P1 | M/E | 🟡 WebKit teilweise |
| UI-04 | Langsames Netz (3G-Profil), Offline → verständliche Meldung, nichts geht verloren | P1 | E/M | 🟡 `error-notice.spec.ts` |
| UI-05 | Lange Texte/Wörter (60 Zeichen ohne Leerzeichen) in Karten, Listen, Dialogen | P1 | E | 🟡 |
| UI-06 | Scroll-Sperre bei Dialogen, Fokus zurück, Seite springt nicht | P1 | E | ✅ `scroll-lock.spec.ts` |
| UI-07 | Speichern-Rückmeldung überall gleich | P2 | E | ✅ `save-feedback.spec.ts` |

## 17. Robustheit und Fehlerfälle

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| ERR-01 | Server antwortet 500/502/504 → Hinweis, „Erneut versuchen“, keine kaputte Seite | P0 | E | ✅ `error-notice.spec.ts` |
| ERR-02 | Doppelklick/zweimal Enter auf jedem Speichern-Knopf | P0 | E/A | ✅ Idempotenz (Teil) |
| ERR-03 | Seite neu laden mitten im Dialog; Zurück-Taste; Deep-Link auf gelöschten Eintrag | P1 | E | ✅ `persistence-audit.spec.ts` (Teil) |
| ERR-04 | Ungültige Eingaben direkt an die API (fehlende Felder, falsche Typen, riesige Strings, 10.000 Elemente) → 400, nie 500 | P0 | A | 🟡 |
| ERR-05 | Uhr des Geräts falsch eingestellt (±1 Tag) | P2 | M | ❌ |
| ERR-06 | Wechselkursdienst (EZB) nicht erreichbar → nichts geraten, nachgerechnet | P1 | A | ✅ `test_reisen_fx.py` |
| ERR-07 | Ortssuche (Photon) langsam/aus → Eingabe geht trotzdem | P2 | A | ✅ |

## 18. Performance und Last

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| PERF-01 | Konto mit 10.000 Transaktionen, 2.000 Terminen, 500 Aufgaben: Seiten < 1 s | P1 | A/I | ❌ |
| PERF-02 | Keine N+1-Abfragen auf Listen (`assertNumQueries` für Haupt-Endpunkte) | P1 | A | 🟡 |
| PERF-03 | 50 gleichzeitige Nutzer (Locust/k6) gegen Staging: p95 < 500 ms, keine Fehler | P1 | I | ❌ |
| PERF-04 | Bundle-Größe: Startseite initial < 250 kB, Lazy-Chunks; Lighthouse mobil | P1 | I | 🟡 initial 241 kB |
| PERF-05 | Datenbank-Indizes für Filter nach Datum/Besitzer/Haushalt | P1 | A | 🟡 |

## 19. Zeit, Datum, Sprache

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| TIME-01 | Sommerzeit-Umstellung (letzter Sonntag März/Oktober): Termine, Erinnerungen, „heute“ | P0 | U/A | 🟡 |
| TIME-02 | Jahreswechsel: Budgetjahr, Berichte, wiederkehrende Einträge | P0 | A | 🟡 |
| TIME-03 | Schaltjahr 29.02. bei Wiederholungen und Fristen | P1 | A | 🟡 |
| TIME-04 | Server in UTC, Browser in Europe/Berlin und z. B. America/New_York | P1 | E | ❌ |
| TIME-05 | Zahlen-/Datumsformat durchgehend deutsch, Währungen nach ISO | P1 | U | ✅ |
| TIME-06 | Tests sind nicht vom heutigen Datum abhängig (fester Testtag) | P1 | A | 🟡 (ein zeitabhängiger Test bereits behoben) |

## 20. Betrieb, Monitoring, Notfall

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| OPS-01 | Fehler-Monitoring (Sentry o. ä., EU-Region) im Backend **und** Frontend, ohne personenbezogene Daten | P0 | I | ❌ `SENTRY_DSN` wird nicht benutzt |
| OPS-02 | Uptime-Überwachung mit Alarm (Mail/Push) | P0 | I | ❌ |
| OPS-03 | Strukturierte Logs mit Aufbewahrung; Login-Fehlschläge nachvollziehbar | P1 | I | ❌ kein `LOGGING` konfiguriert |
| OPS-04 | Notfallplan: Server weg → Restore aus Backup in < 4 h, einmal geübt | P0 | M | ❌ |
| OPS-05 | Vorfall-Ablauf bei Datenpanne (72-h-Meldepflicht), Kontakt der Aufsichtsbehörde | P1 | M | ❌ |
| OPS-06 | Wartungsseite bei Updates | P2 | I | ❌ |

## 21. Produkt und echte Nutzer (Beta)

| ID | Fall | Prio | Art | Stand |
|---|---|---|---|---|
| BETA-01 | 5–10 echte Personen nutzen 2–4 Wochen (`docs/beta/`), Aufgaben werden ohne Hilfe gelöst | P0 | M | ❌ vorbereitet, nicht durchgeführt |
| BETA-02 | Erste Erfassung in < 2 Minuten nach Registrierung | P1 | M | ❌ |
| BETA-03 | Verknüpfungen werden verstanden (ohne Erklärung), Vorschläge als hilfreich bewertet | P1 | M | ❌ |
| BETA-04 | Wiederkehr: Nutzer kommen in Woche 2 und 3 zurück (`beta_usage_report`) | P1 | M | ❌ |
| BETA-05 | Feedback-Funktion an, Auswertung nach Vorlage | P1 | M | ✅ vorbereitet |

---

## Die Blocker auf einen Blick (P0 mit ❌)

INF-01, INF-07, INF-08, INF-09/AUTH-08, INF-10, INF-11, INF-13, INF-14, INF-18, INF-20 · DB-06 · PUB-02 ·
GDPR-01, GDPR-02, GDPR-04 · MAIL-01, MAIL-02 · UI-02 · OPS-01, OPS-02, OPS-04 · BETA-01

Fast alle davon sind **Betrieb und Recht**, nicht Code. Der Anwendungscode selbst ist für seinen Umfang sehr gut getestet.
