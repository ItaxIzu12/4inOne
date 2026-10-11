# 4inOne — Pre-Beta Readiness Audit

Datum: 11. Oktober 2026. Geprüfter Ausgangsstand: `502bda5`.

## Beta Ready: NO

Die lokale Anwendung hat eine belastbare funktionale Grundlage. Für externe Konten ist sie noch nicht freigegeben: Account-Recovery funktioniert nicht durchgängig, der ausgelieferte Frontend-Code verwendet eine lokale API-Adresse und die verlinkten Datenschutzinformationen sind Platzhalter. Bestehende Produktfunktionen wurden nicht verändert.

**P0: kein bestätigter Befund. P1: drei bestätigte Freigabeblocker.** Das bedeutet nicht, dass ein produktiver Server bereits sicher geprüft wurde. Es wurde kein öffentliches Beta-Deployment mit HTTPS, tatsächlichem Mailanbieter, Proxy und produktiver Datenbank untersucht.

## Prüfverfahren und Nachweise

- Django: **814 Tests bestanden**, 295,60 Sekunden.
- Angular: **382 Tests in 53 Dateien bestanden**.
- Bestehende Playwright-Suite: **242 bestanden, 1 fehlgeschlagen**. Der Fehler betrifft den Kontrast während des Einblendens auf der mobilen Startseite; siehe P3.
- Produktionsbuild erfolgreich; vier Warnungen zu überschrittenen Komponenten-CSS-Budgets. Initiale Dateien: **451,59 kB**, geschätzte Übertragung **120,50 kB**. Build-Schätzung, keine gemessene Ladezeit über Mobilfunk.
- Django System Check ohne Fehler; keine fehlenden Modellmigrationen.
- Zusätzliche Chromium-Prüfung mit neu registriertem Wegwerf-Konto und isolierter SQLite-Datenbank: echte HTTP-Antworten, keine simulierten Fachbereichsdaten. Die API-Adresse wurde ausschließlich im Audit-Browser an den isolierten Server weitergeleitet. Das ist keine Lösung für die produktive Konfiguration.
- Registrierung, vierstufiges Onboarding, leeres Dashboard, alle vier Bereiche, Profil und Einstellungen im echten Browser geprüft. Ein Testkonto enthält keine automatisch angelegten Demo-Transaktionen, Aufgaben oder Reisen.
- Reale API-Lebenszyklen: Budget, Sparziel, persönliche Aufgabe, persönlicher Termin, Haushaltsaufgabe und Reise jeweils anlegen (201), lesen (200), ändern (200), löschen (204), anschließend nicht mehr abrufbar (404). Connection anlegen/listen/entfernen erfolgreich. Vorschlagsabfrage erfolgreich.
- Profilname über Oberfläche gespeichert, nach Reload erhalten; Abmelden führt zur Anmeldung, erneutes Anmelden zum Dashboard.
- Backend- und Browser-Suiten prüfen zusätzlich negative Berechtigungen, ungültige Eingaben, Dialog-Abbruch, Fehlerzustände und Fachbereichsabläufe. Viele bestehende Browsertests verwenden Demo-Provider oder API-Mocks. Sie sind kein Nachweis für jeden vollständigen Fullstack-Formularablauf.

Die In-App-Browser-Verbindung war nicht erreichbar. Nach Zustimmung zum Fortfahren wurde der vorhandene Playwright-Browser verwendet. Echte vorhandene Benutzerkonten und deren Datenbank wurden nicht verändert.

Nachweise liegen unter [audits/prebeta-2026-10-11](audits/prebeta-2026-10-11/). Dort befinden sich aktuelle Screenshots und strukturierte Messergebnisse. Zugangsdaten und Session-Cookies sind nicht Teil dieser Nachweise.

## P0

**Kein bestätigter Zugriff auf fremde Daten, Datenverlust oder abstürzender Kernbetrieb in den ausgeführten Prüfungen.** Kein pauschaler Nachweis der Abwesenheit sämtlicher Schwachstellen. Abhängigkeiten und produktive Infrastruktur brauchen die unten aufgeführten Freigabeprüfungen.

## P1

### P1-01 — Passwort vergessen vermittelt Erfolg ohne funktionierende Zustellung

Quelle: `frontend/src/app/features/passwort-vergessen/passwort-vergessen.ts`, `backend/core/auth_views.py`, `frontend/src/app/app.routes.ts`.

Die Oberfläche setzt nach einem Timer einen Erfolgszustand, statt die Recovery-API aufzurufen. Das Backend erzeugt bei bekannten E-Mail-Adressen einen Reset-Token, versendet aber keinen Reset-Link. Eine durchgängige öffentliche Oberfläche zum Abschließen des Resets ist ebenfalls nicht eingerichtet. Die getestete serverseitige Tokenprüfung und Passwortänderung ersetzen diesen fehlenden Benutzerweg nicht.

Auswirkung: Wer sein Passwort verliert, kommt über den angebotenen Weg nicht in sein Konto zurück. Vor Freigabe muss die bestehende Recovery-Funktion end-to-end einschließlich Zustellung, ungültigem/abgelaufenem/verbrauchtem Link und erneuter Anmeldung bestehen. Keine neue Produktfunktion: Reparatur eines bereits angebotenen Kernablaufs.

### P1-02 — Frontend adressiert das Backend auf localhost

Quelle: `frontend/src/app/core/api.config.ts`, `frontend/angular.json`.

Die API-Origin ist fest `http://localhost:8000`. Eine passende Ersetzung für den Produktionsbuild ist nicht eingerichtet. Bei externen Nutzern bezeichnet localhost ihren eigenen Rechner; auf einer HTTPS-Seite kommen außerdem Einschränkungen für HTTP-Anfragen hinzu.

Auswirkung: Anmeldung und echte Fachbereichsdaten sind durch bloßes Bereitstellen des aktuellen Frontend-Builds nicht extern nutzbar. Vor Freigabe muss die tatsächliche Deployment-Adresse einschließlich Auth-Cookies, CSRF/CORS und Reload getestet werden. Der Browser-Umweg im Audit darf nicht als bestandene Produktionskonfiguration gewertet werden.

### P1-03 — Registrierung verweist auf unvollständige Anbieter- und Datenschutzinformationen

Quelle: `frontend/src/app/features/datenschutz/datenschutz.html`, `frontend/src/app/features/impressum/impressum.html`; weitere rechtliche Seiten ebenfalls prüfen.

Die Datenschutzerklärung enthält Platzhalter für verantwortliche Stelle, Verarbeitungszwecke und Betroffenenrechte. Die Registrierung verlangt trotzdem Zustimmung zur dort verlinkten Erklärung. Auch die Anbieterinformationen sind nicht fertig.

Auswirkung: Externe Nutzer bekommen keine konkrete Auskunft darüber, wer ihre Daten verarbeitet und wie. Freigabeblocker aus Sicht von Transparenz und Datenschutzvorbereitung; keine pauschale juristische Compliance-Bewertung. Texte müssen den tatsächlichen Beta-Betrieb beschreiben und dürfen keine unimplementierten Datenschutzversprechen enthalten.

## P2

### P2-01 — Finanz-Empty-State enthält Null-Kennzahlen und ein leeres Diagramm

Bei einem neuen echten Konto erscheinen zwar „Budget erstellen“ und hilfreiche Texte, zugleich aber Einnahmen/Ausgaben/Gespart jeweils `0 €` und ein leeres Monatsdiagramm mit Skala. Das widerspricht der ausdrücklich verlangten Darstellung ohne scheinbare Statistiken bei fehlenden Daten.

Nachweis: [Finanzen, neues Konto](audits/prebeta-2026-10-11/finanzen.png). Erwartung: fehlende Daten erklären und eine erste Aktion priorisieren; Nullbeträge erst anzeigen, wenn sie tatsächlich eine vorhandene Auswertung beschreiben.

### P2-02 — Required-Fehler erscheinen bei Registrierung bereits nach Blur

Quelle: `frontend/src/app/features/login/login.html`.

Reproduktion: leeres Namensfeld fokussieren, Tab drücken, ohne Submit. `aria-invalid` wird `true`. Die Sichtbarkeit hängt an `touched`, nicht am ersten Submit. Das verletzt die vorgegebene globale Create-Regel. Nach dem ersten Submit soll die Live-Aktualisierung bestehen bleiben.

### P2-03 — Gleichzeitiger Session-Ablauf löst mehrere Refreshes aus

Quelle: `frontend/src/app/core/auth/auth.interceptor.ts`, `auth.service.ts`.

Gezielter Fehlertest: Bei sechs ersten Finanz-Anfragen wurde ein abgelaufenes Access-Token durch 401 simuliert; die anschließenden Refresh-Aufrufe liefen gegen das echte Backend. Es entstanden sechs Refresh-Aufrufe zusätzlich zur Initialisierung. Alle lieferten in dieser Ausführung 200; ein erzwungener Logout wurde **nicht** nachgewiesen.

Die Rotation wird dennoch unnötig parallel angestoßen. Eine gemeinsame laufende Refresh-Anfrage und ein Regressionstest für konkurrierende 401 sowie fehlschlagenden Refresh fehlen. Das ist ein bestätigter Koordinations-/Request-Befund, kein nachgewiesener Account-Takeover.

## P3

- Vier Komponenten überschreiten ihre CSS-Warnbudgets: Finanzen 17,21 kB, Landing 16,43 kB, Reisen 15,34 kB, Einkaufs-Tab 12,37 kB bei jeweils 12-kB-Warnschwelle. Build funktioniert; keine vorschnelle Mikrooptimierung nötig.
- Der mobile Landing-Kontrasttest läuft teilweise während der Opacity-Animation. Nach Sichtbarmachen der Abschnitte mit reduzierter Bewegung meldet axe keine A/AA-Verstöße. Test auf stabilen sichtbaren Zustand synchronisieren und Animation separat prüfen. Ein dauerhafter Kontrastmangel ist damit nicht bestätigt.

## Security

Die Sicherheitsprüfung erfolgte anhand des Cybersecurity-Analyst-Workflows, des aktuellen Codes, negativer Backendtests, Browserabläufe und Paket-Scans.

| Fläche | Ergebnis / Grenze |
| --- | --- |
| Authentifizierung | Registrierung/Login/Logout tatsächlich ausgeführt; Passwortvalidierung, Lockout, CSRF und Token-Widerruf zusätzlich durch Tests. Recovery-Benutzerweg bleibt P1. |
| Authorization / IDOR / BOLA | Bestehende negative Tests prüfen fremde private Objekte, Finanzen, Reisen, persönliche Dateien, Connections und Vorschläge; alle bestanden. |
| Haushalt / Reisen teilen | Rollen- und Scope-Prüfungen serverseitig vorhanden und getestet. Mitgliedschaft allein darf nicht private Finanz-/Organisationsobjekte freigeben. |
| Einladungen | Regressionen für verifizierte E-Mail bzw. geheimen Einladungsnachweis und ADMIN-Berechtigung bestanden. |
| Connections | Eigene Objekte erforderlich; Connection ist keine Freigabe. Anlegen und Entfernen zusätzlich am echten Testserver ausgeführt. |
| Suggestions | Backendtests prüfen Ablehnung, manipulierte Kennungen, fremde Objekte und Persistenz. Tatsächliche Vorschlagsabfrage ausgeführt; kein vollständiger neuer Browser-Dismissal-Flow mit echtem Backend behauptet. |
| CSRF / CORS | Negative Tests für fehlendes CSRF und fremde Origin bestanden. Produktive Host-/Origin-Konfiguration wegen P1-02 noch nicht abgenommen. |
| Uploads | Private Zugriffskontrolle, Typ-/Größenprüfung und Löschung einschließlich Konto-Cascade im Code und Tests. Kein externer Malware-/AV-Test und kein produktiver Storage-Test. |
| Secrets | Keine `.env`, privaten Schlüssel oder SQLite-Datenbank in den geprüften getrackten Dateinamen. Keine vollständige historische Git-Secret-Suche oder Prüfung externer Secret-Stores. |
| Logs / Fehler | Keine uncaught Browserfehler in der frischen echten Kontosequenz. Tests decken generische Fehler bei DEBUG=False ab. Produktionslogs wurden nicht eingesehen. |
| Rate limiting | Auth-Throttles und Lockout getestet. Cache-/Worker-Konfiguration und Lastgrenzen des echten Deployments offen. |

### Abhängigkeiten: Befunde nicht mit ausnutzbaren App-Lücken gleichsetzen

- `npm audit`: **6 betroffene Paket-Einträge**, davon 2 critical und 4 high; teilweise vererbte Toolchain-Befunde. Kein Update im Audit durchgeführt.
- `pip-audit`: **18 Advisory-Einträge in 3 Paketen**: Django 6.1 (1), PyJWT 2.13.0 (14), urllib3 2.7.0 (3). Auch hier ist die Anzahl kein Nachweis von 18 erreichbaren Angriffspfaden.
- Angular Router: Die [SSR-DoS-Advisory](https://github.com/advisories/GHSA-ff3f-86qr-9cv3) betrifft Server-Rendering auf Node. Das Projekt baut eine clientseitige SPA ohne eingerichtetes SSR; dieser Server-Angriffspfad ist hier nicht vorhanden.
- [Piscina](https://github.com/advisories/GHSA-67c8-pqhq-4rmx) betrifft einen Prototype-Pollution-Gadget im Threadpool. Im Projekt liegt das Paket in der Build-Toolchain; ein öffentlich erreichbarer Produktpfad wurde nicht nachgewiesen. Build-/CI-Umgebung bleibt Teil der Sicherheitsbewertung.
- Django: Die [GeoDjango-Advisory](https://github.com/advisories/GHSA-q238-5cxm-5c9h) betrifft Geometrie-Parsing. Im geprüften Fachbereichscode ist kein GeoDjango-Eingabepfad eingerichtet.
- Zahlreiche PyJWT-Einträge benötigen JWKS, gemischte asymmetrische/HMAC-Verifikation oder besondere Schlüsselkonfiguration. Diese Nutzung wurde im App-Code nicht gefunden. Die [Options-Mutation](https://github.com/advisories/GHSA-gvp8-978c-rx2q) benötigt wiederverwendete Optionen mit vorher deaktivierter Signaturprüfung; nicht pauschal als Authentication-Bypass der App gewertet.
- Ein kleiner gezielter Test für einen tief verschachtelten ungültigen JWT-Header am tatsächlichen Refresh-Endpunkt lieferte 401 statt 500. Das deckt nicht sämtliche Varianten der [Parser-Advisory](https://github.com/advisories/GHSA-8wjv-2p76-3863) ab.
- urllib3-Befunde betreffen u. a. Streaming und HTTPS-Proxy-Konfiguration. Der sichtbare FX-Code verwendet `urllib.request` mit fester ECB-HTTPS-Adresse, nicht die gemeldete urllib3-Streaming-API. Weitere Paket-Verwendungen, insbesondere Entwicklungswerkzeuge, sind vor Freigabe abschließend einzuordnen.

**Vor Beta:** Paketbefunde vollständig auf Erreichbarkeit prüfen bzw. sichere kompatible Patchstände einsetzen und erneut testen. Nicht ohne konkrete Erreichbarkeit als P0 einstufen, aber auch nicht aufgrund bestandener Funktionstests pauschal schließen. Die JSON-Scans sind als Nachweis beigefügt.

Der lokale `check --deploy` meldet Console-Mailer und fehlende HTTPS-/Cookie-Härtung bei DEBUG=True. Die Settings aktivieren Härtung bei DEBUG=False. Das lokale Resultat beweist keine produktive Fehlkonfiguration, ersetzt aber auch keinen Check auf dem tatsächlichen Beta-System.

## Accessibility

- Dashboard, Finanzen, Haushalt, Organisation, Reisen, Profil und Einstellungen: frische axe-WCAG-A/AA-Prüfung bei 390 px ohne gemeldete Verstöße.
- Auf allen sieben Seiten bei **360 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920 px** keine horizontalen Page-Scrollbars gemessen. Aussage gilt für die geprüften leeren Kontoansichten; nicht automatisch für alle gefüllten Tabellen, Dialoge und extrem langen Inhalte.
- Bestehende Browsertests prüfen unter anderem Tastaturbedienung, Escape, Dialogverhalten, mobile Controls und Fokus. Keine Behauptung einer vollständigen WCAG-Zertifizierung.
- Reduced-motion auf der Startseite geprüft; sichtbare Inhalte und keine gemeldeten axe-Verstöße.
- **Offen:** tatsächliche Screenreader-Nutzung (z. B. VoiceOver), vollständiger Keyboard-only-Durchlauf jedes CRUD-Dialogs, echter Browser-Zoom auf 200 % für sämtliche Dialogzustände. Schmale Viewports ersetzen diese Prüfung nicht.
- Fehler müssen neben Popups am betroffenen Feld erkennbar und programmatisch zugeordnet bleiben; reine zeitgesteuerte Meldungen sind keine vollständige Fehlerkommunikation. Registrierung verletzt derzeit die gewünschte Submit-Reihenfolge (P2-02).

## Performance

Lazy Loading der Fachbereiche ist vorhanden. Initiales geschätztes Transferbudget ist mit 120,50 kB vernünftig; die größeren Haushalts-/Finanz-/Reise-Chunks werden separat geladen. Öffentliche Assets sind insgesamt etwa 772 kB, Landing-Bilder etwa 664 kB; kein riesiges Screenshot-/Videoasset im initialen Bundle gefunden.

Die echte leere Kontosequenz hatte 43 erfolgreiche API-Antworten, keine fehlgeschlagenen API-Antworten und keine uncaught Browserfehler. Die erwartete einmalige 401-Antwort eines unangemeldeten Session-Checks ist kein 401-Loop. Doppelte Onboarding-Statusabfragen und parallele Refreshes sind Ansatzpunkte für gezielte Bereinigung, kein Anlass für einen Architekturumbau.

Reise-Listen verwenden vorberechnete Counts und Prefetch statt offensichtlicher Schleifenabfragen je Reise. Eine Lastmessung mit großen Konten, SQL-Query-Budgets, Lighthouse auf echtem HTTPS-Deployment oder Mobilfunkmessung wurde nicht durchgeführt. Ein pauschales „kein N+1“ wäre daher nicht belegt.

## Complete User Journey / Prüfumfang

| Schritt | Tatsächliche Prüfung und Einschränkung |
| --- | --- |
| 1 Landing | Frischer Browser, Produkttexte, vier Bereiche, Connection-Beispiel, Demo-CTA, reduced motion; 10-Sekunden-Verständnis nicht mit echten Testpersonen gemessen. |
| 2 Registrierung | Echtes neues Konto über UI; Validierungs-/Auth-Negativfälle zusätzlich bestehende Tests. Required-Fehler vor Submit reproduziert. |
| 3 Onboarding | Echte vier Schritte, explizite persönliche Nutzung und Bereichswahl, Abschluss ohne Demo-Seeding. Auswahlpflicht funktioniert; ein zunächst unvollständiger Auditversuch wurde korrekt aufgehalten. |
| 4 Dashboard | Eigene leere Daten, Orientierung/erste Aktion, echte API; Screenshot und Breitenprüfung. |
| 5 Finanzen | Echter Empty State, Budget/Sparziel-API-Lebenszyklen. Transaktions-/Kategorie-/Import-/Budgetfehlerfälle über bestehende Tests. Nicht jeden Create/Edit-Dialog neu gegen echtes Backend durchgeklickt. |
| 6 Haushalt | Echter Empty State und Aufgaben-API-Lebenszyklus. Weitere Listen/Geräte/Verträge/Routinen und Rollen durch bestehende Tests. |
| 7 Organisation | Echter Kalender-Empty-State; Aufgaben-/Termin-API-Lebenszyklen; private Dateien/Import/Notizen durch bestehende Tests. |
| 8 Reisen | Echter Empty State und Reise-API-Lebenszyklus; weitere Packliste/Budget/Teilnehmer-/Abbruchfälle durch bestehende Tests. |
| 9 Connection | Echtes Anlegen, Lesen, Entfernen. Fremdobjekt- und Rollenfälle durch negative Tests. |
| 10 Suggestion | Echte Abfrage; Acceptance/Dismissal/Persistenz/Berechtigungen durch bestehende Backendtests. |
| 11 Profil | UI-Speichern, Reload und persistierter Name tatsächlich geprüft. Konto-Cascade/Dateilöschung durch Backendtests. |
| 12 Einstellungen | Echte Seite und Unterseiten-Links; Sitzungen/MFA durch bestehende Tests. Nicht jede Einstellung neu auf einem zweiten realen Gerät geprüft. |
| 13 Logout → Login | Tatsächlich ausgeführt; direkter geschützter Finanz-Link ohne Login führt zur Anmeldung. |

## Datenschutz und Destructive Actions

Private Finanzdaten und persönliche Organisation bleiben getrennt von Haushalt-/Reise-Mitgliedschaft. Connections verleihen keine Berechtigungen. Das neue echte Konto hat keine Demo-Daten erhalten. Das Profil verwendet Initialen; ein erfundenes öffentliches Profilfoto wurde nicht eingefügt.

Delete/Connection-Remove sind am echten Testserver überprüft; die bestehenden UI-Tests prüfen unter anderem Bestätigung, Escape und Budget-Löschhinweise. Konto-Löschung ist in der Oberfläche ausdrücklich als endgültig beschrieben und serverseitig getestet. Ein neues End-to-end-Löschen eines kompletten Testkontos über die Oberfläche sowie Restore aus produktivem Backup wurde nicht vorgenommen. Diese Grenzen werden nicht mit „kein Datenverlust möglich“ überspielt.

## Recommended Beta Scope

**Jetzt:** keine externe Beta mit echten Kontodaten freigeben. Die öffentliche Demo kann für betreute Produktvorstellungen genutzt werden, wenn die Demo klar beschriftet bleibt und keine produktive Account-Freigabe suggeriert wird.

**Nach Schließen der drei P1-Befunde und der offenen Sicherheits-/Deployment-Freigabeprüfungen:** kleine, ausdrücklich eingeladene Testgruppe; vier eigenständige Bereiche und vorhandene manuelle Connections/Suggestions. Keine Bankanbindung, KI oder nicht vorhandene Automationen bewerben. Die Landing erklärt diese Abgrenzung bereits sinnvoll.

Vor Freigabe auf dem tatsächlichen Beta-Deployment erneut prüfen: Registrierung → Recovery-Mail → Onboarding → CRUD/Reload → private Sharing-Grenzen → Profil → Logout/Login, Cookies/CSRF/CORS unter HTTPS, Paketbefunde und vollständige Accessibility-Kernabläufe. Das sind Freigabechecks und Reparaturen vorhandener Abläufe, keine Vorschläge für neue Produktfeatures.

Audit beendet. Keine Produktänderungen oder Dependency-Upgrades vorgenommen.
