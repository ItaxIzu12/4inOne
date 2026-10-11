# 4inOne – Complete Real User Journey Audit

Stand: 11. Oktober 2026 · geprüfter Commit: `51667ab` · ausschließlich Audit, keine Produktänderungen.

## EXECUTIVE SUMMARY

4inOne hat eine belastbare Grundlage: Die geprüften privaten Daten bleiben privat, Connections erweitern keine Berechtigungen, Finanzberechnungen sind nachvollziehbar und die Kernbereiche funktionieren unabhängig. Die Oberfläche ist ruhig und konsistent. Für eine externe Beta fehlt dennoch die Freigabe: vier bestätigte P1-Blocker bleiben offen. Kein P0 wurde in den durchgeführten Prüfungen nachgewiesen. Das ist keine Garantie, dass keine weitere Schwachstelle existiert.

## BETA READINESS: NO

### Methode und Grenzen

- Isolierte SQLite-Datenbank und synthetische Daten; keine Änderungen an der regulären Entwicklungsdatenbank oder Export realer Nutzerdaten.
- Sophie registrierte sich im echten Browser und absolvierte das Onboarding. Alex, Ben und Eve wurden über die tatsächlichen Registrierungs-/Login-Endpunkte angelegt. API-Prüfungen verwenden Django Request/Authentication/Authorization, nicht erzwungene Benutzeridentitäten.
- Lokaler Browser gegen tatsächliches isoliertes Backend. Wegen der fest eingebauten API-Adresse wurde ausschließlich im Test die Anfrageadresse auf den Auditserver umgeleitet. Dies beweist keine funktionierende öffentliche Bereitstellung.
- Alex erhielt für Berechtigungsprüfungen eine ausdrücklich gesetzte Test-Mitgliedschaft. Ein funktionierender Haushalts-Beitritt wurde damit **nicht** bewiesen. Kontakt-Einladungen wurden dagegen einschließlich Mail-Outbox und Annahme geprüft; echte externe Mailzustellung wurde nicht geprüft.
- 814 Backend-Tests bestanden; 382 Frontend-Tests bestanden; 243 bestehende Browser-Tests bestanden. Die bestehenden Tests enthalten isolierte/mocked Szenarien und sind nicht 243 vollständig reale Backend-Journeys.
- 170 zusätzliche Vier-Konten-API-Prüfungen: 169 bestanden, eine fehlgeschlagen (Haushalts-Einladung ohne Mailversand). Build erfolgreich, Django System Check ohne Befund, keine ausstehenden Model-Migrationen.
- Acht eingeloggte Seiten auf 360, 390, 430, 768, 1024, 1280, 1440, 1600 und 1920 Pixeln geprüft. Automatisierte axe-Prüfung auf 390 Pixeln ohne A/AA-Befunde auf diesen Seiten. Keine vollständige WCAG-Zertifizierung.
- Nicht lückenlos geprüft: jeder Create/Edit/Delete-Dialog über die reale Oberfläche, alle Abbruch-/Netzwerkfehler, echte externe Einladung, jeder Upload, echte Screenreader, 200-%-Zoom in allen Dialogen, physische Mobilgeräte, sämtliche Zeitzonen/Datumsgrenzen, Produktionslast, öffentliche Infrastruktur und vollständige Git-Historie auf Secrets. Diese Grenzen dürfen nicht als PASS interpretiert werden.

Nachweise: [API-Fälle](audits/real-user-journey/api-cases.json), [zusätzliche API-Fälle](audits/real-user-journey/additional-api-cases.json), [Browser-Fälle](audits/real-user-journey/browser-cases.json), [Detailprüfungen](audits/real-user-journey/detail-cases.json). Testprotokolle und Abhängigkeits-Scans liegen im selben Ordner.

## USER JOURNEY RESULT

Status bezieht sich auf die beschriebene Prüftiefe, nicht auf sämtliche theoretischen Varianten.

| Schritt | Ergebnis | Nachweis / Grenze |
|---|---|---|
| 1. Landing | PASS WITH ISSUES | Produkt, vier Bereiche und Startmöglichkeiten erkennbar; Rechtstexte unfertig. Kein echter 10-Sekunden-Nutzertest. |
| 2. Registration | PASS WITH ISSUES | Echter neuer Browser-Account und Required-Fehler geprüft; Zustimmung verlinkt auf unfertige Texte. |
| 3. Onboarding | PASS | Vier Schritte, persönliche Nutzung, Auswahl, Abschluss; keine Fake-Finanz-/Reise-/Aufgaben-Daten angelegt. |
| 4. Dashboard | PASS | Leerer und gefüllter Account, echte Zahlen und erklärter Vorschlag; keine automatische Verbindung. |
| 5. Finance | PASS | API-Finanzfälle einschließlich Planung, Sparen, Import und Zugriffsschutz; nicht jeder UI-Dialog manuell abgeschlossen. |
| 6. Household | FAIL | Kerndaten/Routinen/Einkauf funktionieren; Haushalts-Einladung/Annahme nicht als kompletter Flow funktionsfähig. |
| 7. Organisation | PASS | Termine, Aufgaben, Notizen per API; Aufgabe im Browser erstellt, Reload und Doppel-Submit geprüft. |
| 8. Travel | PASS WITH ISSUES | Reise, Packliste, Ausgabe und VIEWER-Rechte geprüft; reale Einladung/Zustellung und sämtliche Teilnehmerrollen nicht vollständig end-to-end. |
| 9. Connections | PASS | Sichtbarkeit, fremde Endpunkte, Selbstverknüpfung, Duplikate, Entfernen ohne Löschung der Objekte geprüft. |
| 10. Suggestions | PASS | Erklärung im UI; Annahme/Ablehnung/Persistenz/veraltete Ziele und Fremdzugriff per API geprüft. |
| 11. Search | PASS WITH ISSUES | Überblickssuche findet Aufgabe/Reise, nicht sämtliche vorhandenen Objekte. |
| 12. Profile | PASS WITH ISSUES | Oberfläche und persistente Heimatwährung geprüft; alle Profil-/Foto-/Löschvarianten nicht erneut live durchlaufen. |
| 13. Settings / Auth | FAIL | Seiten funktionieren, Regressionstests bestehen; angebotener Passwort-Reset ist kein vollständiger Recovery-Flow. |

## P0

Kein bestätigter P0 in den ausgeführten Prüfungen. Keine Freigabe für ungeprüfte Produktionskonfiguration oder alle ungetesteten Varianten.

## P1

| ID | Bereich | Problem / Reproduction | Expected | Actual | Security Impact | Recommended Fix |
|---|---|---|---|---|---|---|
| P1-01 | Auth | Passwort vergessen öffnen, gültige E-Mail absenden. | Tatsächlicher Recovery-Flow mit zugestelltem Link. | UI bestätigt nach Timer ohne API-Anfrage; Backend-Mailversand ebenfalls TODO. | Kontowiederherstellung nicht verlässlich; keine nachgewiesene Kontoübernahme. | Vor Beta vorhandenen Recovery-Flow vollständig anschließen und Zustellung/Token/Abbruch testen. |
| P1-02 | Deployment | Produktions-Build außerhalb Entwicklerrechner öffnen. | API unter erreichbarer konfigurierter Adresse. | `api.config.ts` verwendet fest `http://localhost:8000`; localhost wäre Rechner des Testers. | Auth/Datenflüsse außerhalb lokaler Umgebung nicht freigegeben. | API-Adresse für Zielumgebung konfigurieren, öffentlichen HTTPS-Flow prüfen. |
| P1-03 | Privacy / Copy | Datenschutz/Impressum aus Registrierung/Einstellungen öffnen. | Tatsächliche Angaben zur Anwendung und verantwortlichen Stelle. | Sichtbare Platzhalter. | Keine belastbare transparente Information; hier keine juristische Compliance-Bewertung. | Vor externen Konten tatsächliche Angaben und Verarbeitung beschreiben, keine erfundenen Versprechen. |
| P1-04 | Household | Haushalts-Einladung über vorhandenen Endpoint senden; Mail-Outbox und Annahmeroute prüfen. | Zustellbare Einladung und kontrollierte Annahme. | Erfolgsmeldung/201, aber keine Mail; Annahme-Flow fehlt. | Kein belegter Datenabfluss; gemeinsamer Haushalts-Flow bricht ab. | Bestehenden Beitrittsflow fertigstellen oder unfertiges Angebot ausdrücklich aus Beta-Scope nehmen. |

Quellen: `frontend/src/app/features/passwort-vergessen/passwort-vergessen.ts`, `frontend/src/app/core/api.config.ts`, `frontend/src/app/features/datenschutz/datenschutz.html`, `frontend/src/app/features/impressum/impressum.html`, `backend/core/auth_views.py`, `backend/core/household_views.py`, `backend/core/household_urls.py`.

## P2

| ID | Bereich | Problem / Reproduction | Expected | Actual | Security Impact | Recommended Fix |
|---|---|---|---|---|---|---|
| P2-01 | Search | Eigene Notiz „Berlin Ideen“ anlegen, Überblickssuche „Berlin“. | Nutzer versteht den eingeschränkten Suchumfang. | Aufgabe und nächste Reise erscheinen; Notiz nicht. UI nennt korrekt „Im Überblick suchen“. | Kein Fremddatenfund. | Suchumfang klar erläutern; nicht als vollständige globale Suche bewerben. |
| P2-02 | Mobile | Finanzübersicht bei 360 Pixeln. | Schnell sichtbare Kennzahlen und verständliche Geldbeträge. | Header/Unterreiter/Zeitraum benötigen viel Höhe; langer Betrag bricht vor dem Eurozeichen um. | Keiner. | Layout/Typografie der kleinen Kennzahlen behutsam straffen, Betrag zusammenhalten. |

Nicht als bestätigte Findings: einmalige Overflow-Messung direkt nach Resize (stabil 360/360 Pixel, kein überlaufendes Element); Escape-Schließprüfung ohne Wartezeit (nicht belastbar). Ein späterer erneuter Browserstart für Escape war durch lokale Browser-Prozessberechtigungen blockiert. Daher keine erfundene Escape-Regression.

## P3

| ID | Bereich | Problem / Reproduction | Expected | Actual | Security Impact | Recommended Fix |
|---|---|---|---|---|---|---|
| P3-01 | Build | Production Build. | Styles innerhalb vereinbarter Budgets. | Vier CSS-Budgetwarnungen: Einkauf 12,37 KB, Reisen 15,34 KB, Finanzen 17,21 KB, Landing 16,43 KB. | Keiner nachgewiesen. | Duplikate prüfen; Budgets bewusst begründen statt blind erhöhen. |
| P3-02 | Dashboard | Leerer Account im Desktop-Layout. | Erste Aktion vollständig lesbar. | Lange Finanzkarten-Copy wird stellenweise gekürzt. | Keiner. | Kürzere Copy bzw. sinnvoller Umbruch. |

## SECURITY REVIEW

| Bereich | Ergebnis und verbleibende Grenze |
|---|---|
| Authentication | Login mit vier Konten geprüft, Regressionstests bestehen; Recovery P1-01. Öffentliche HTTPS-/Cookie-Konfiguration nicht live geprüft. |
| Authorization | Private Finance/Organisation serverseitig geschützt; Haushalt nur explizite Mitgliedschaft, Reise VIEWER nur Lesen. |
| IDOR/BOLA | Bekannte fremde Budget-/Transaktions-/Sparziel-/Aufgaben-IDs in Lese-/Schreib-/Löschfällen blockiert. Kein pauschaler Beweis für jeden Endpoint. |
| CSRF | Cookie-basierter Auth-Request ohne CSRF mit erzwungener Prüfung: 403. Keine Aussage, dass jeder Token-authentifizierte Endpoint CSRF benötigen müsste. |
| CORS | Fremder Origin erhält keine Freigabe. Öffentliche Proxy-/Origin-Konfiguration separat freigeben. |
| Input Validation | Buchstabenbeträge, fremde Kategorie, ungültige Termin-/Reisedaten und fehlerhafter Import abgewiesen. Ownership-Mass-Assignment ohne Wirkung. |
| XSS | Script-Strings in Aufgaben/Reisen/Geräten gespeichert; in geprüften UI-Ansichten als Text, keine JavaScript-Dialoge. Nicht jeder HTML-/Upload-Kontext geprüft. |
| File Upload | Vorhandene Backend-Regressionssuite bestanden; neue Live-Prüfung aller Typen/Größen/privaten Downloads nicht vollständig durchgeführt. |
| Rate Limiting | Regressionstests bestanden; echte verteilte Last und gemeinsam genutzter Produktions-Throttle-Cache nicht nachgewiesen. LocMem im Audit ist kein verteiltes Limit. |
| Sensitive Logging | Audit nutzt synthetische Daten; Cookie-/Token-Dateien nicht in Bericht kopiert. Keine vollständige Freigabe aller Produktionslogs. |
| Serializer Exposure | Geprüfte private Objekte nicht über fremde IDs erreichbar; private Sparziel-Metadaten nicht über Haushalts-Connection ausgegeben. |
| Connections | Beide Endpunkte müssen zugänglich sein; Connection gewährt keine Rechte. Duplikat-/Selbstverknüpfungsschutz geprüft. |
| Suggestions | Nur erlaubte Objekte; fremde Annahme blockiert, veraltetes Ziel führt nicht zur Connection. Ablehnung persistiert. |
| Household Sharing | Lesen mit expliziter Testmitgliedschaft funktioniert; nicht berechtigte Benutzer ausgeschlossen. MEMBER darf keine Admin-Einladung ausführen. Beitritt P1-04. |
| Travel Sharing | Ben VIEWER kann Berlin lesen, nicht bearbeiten; Alex/Eve erhalten keine Triprechte durch bloßen Kontakt/Haushalt. Andere Rollen nicht komplett neu durchgespielt. |
| Dependencies / Secrets | npm meldet 6 Advisories (2 critical, 4 high), Python 18 in Django/PyJWT/urllib3. Scannergrad ist nicht automatisch ein ausnutzbarer P0 der App. Vollständige History-Secrets-/Deployment-Prüfung bleibt offen. |

Abhängigkeitsdetails sind in `npm-audit.json` und `python-audit.json` gespeichert. Anwendbarkeit separat prüfen: Router-SSR-Advisory betrifft nicht automatisch die aktuelle SPA; GeoDjango-Geometriepfade sind nicht als Produktpfad nachgewiesen; JWKS-/Proxy-spezifische Bibliothekspfade dürfen nicht mit dem festen lokalen JWT-Setup gleichgesetzt werden. Daraus folgt ausdrücklich **keine** allgemeine Unbedenklichkeitsfreigabe. Vor Veröffentlichung sichere kompatible Versionen bzw. dokumentierte Nicht-Anwendbarkeit pro Advisory festhalten.

## FINANCE REVIEW

| Thema | Frischer Nachweis |
|---|---|
| Budget Calculation | Limit 2.000 €, Ausgabe 42 €, Sparbetrag 100 € → 1.858 € Rest. Einnahme 2.500 € erhöht Limit nicht. |
| Category Budgets | Freizeit 300 €, Ausgabe 42 € → 258 € verfügbar; fremde Kategorie abgewiesen. |
| Planned Expenses | Künftige Ausgabe zunächst geplant; Monat/Kategorie geändert; auf heute verschoben und genau einmal in tatsächlichen Ausgaben berücksichtigt. |
| Double Counting | 42 € + 29,99 € nach Verschiebung = 71,99 € tatsächliche Ausgaben, geplante Summe anschließend null; Plan gelöscht. |
| Savings | 100 € bereits gespart reduzieren Restbudget wie spezifiziert. Keine Gleichsetzung mit Einkommen. Alle komplexen Rückdatierungs-/Umbuchungsvarianten sind nicht separat live geprüft. |
| Import | Dry-run ohne Inserts; Duplikat erkannt; Commit einmal; Wiederimport ohne zusätzliche Buchung; leere Datei, Buchstaben und 2.001 Zeilen abgewiesen. |
| Decimal / Currency | Backend-Regressionssuite besteht; explizite CHF-Reise und CHF-Ausgabe behalten Originalbetrag. |
| FX | Absichtlich deaktivierte Kursquelle: keine erfundene EUR-Umrechnung; Wechsel Heimatwährung verändert Originalbetrag/Snapshot nicht. Live ECB-Ausfall-/Kursdatum-Kette nicht vollständig geprüft. |
| Ownership | Alex/Ben/Eve können Sophies Budgets/Transaktionen/Sparziele nicht lesen oder verändern. |

Nach Import einer weiteren Ausgabe 12,50 € beträgt der Rest 1.845,50 €. Die früheren Screenshots mit 1.858 € stammen bewusst vor diesem Import; kein Berechnungsfehler.

## UX REVIEW

- Navigation: konsistente vier Bereiche und bestehende Sidebar; kein Umbau notwendig.
- Hierarchie: Dashboard priorisiert Heute; Finance zeigt Restbudget und zentrale Kennzahlen. Bei Mobilgeräten ist der Weg zum Inhalt relativ lang.
- Copy: Privatsphäre bei persönlichen Aufgaben und Personen-Kontakten klar erklärt. Falsche Versandbestätigungen sind gravierender als visuelle Details.
- Forms/Feedback: Required-Fehler nach leerem Submit und persistentes Speichern einer Aufgabe beobachtet; Doppel-Submit erzeugte nur eine UI-Aufgabe. Nicht jede Formularregel in jedem Modal frisch bestätigt.
- Empty States: neues Dashboard ohne ungefragte Domain-Demodaten; klare erste Aktionen. Der leere aktuelle Kalender ist korrekt, obwohl ein Termin im Folgemonat existiert.
- Errors/Loading: keine ungefangenen Browserfehler im aufgezeichneten Pfad. Alle langsamen/abgebrochenen Requests und abgelaufenen Sessions sind nicht vollständig neu mit realem Backend simuliert.
- Connections: gegenseitiger Kontext wird beschrieben, Objekte bleiben erhalten; technisch überzeugend. Verständnis mit echten unerfahrenen Testern noch offen.
- Suggestions: konkrete Begründung und Zustimmung/Ablehnung vorhanden. Häufigkeit, Nutzen und Ablehnungsquoten wurden nicht erfunden.

## ACCESSIBILITY REVIEW

| Kriterium | Bewertung |
|---|---|
| Keyboard | Aufgabe per Tastatur/Enter gespeichert und nach Reload gefunden; kein vollständiger Keyboard-only-Durchlauf aller Seiten. |
| Focus | Sichtbarer Fokus im geprüften Aufgaben-/Finanzdialog. Vollständige Fokusfalle/Rückgabe und Escape-Warteprüfung nicht abschließend neu bestätigt. |
| Contrast / Semantic HTML / Labels | axe A/AA ohne Findings auf acht eingeloggten Seiten bei 390 px; Dialogscreens visuell geprüft. Keine Screenreader-Zertifizierung. |
| Forms | Labels und optional markierte Angaben sichtbar; Fehler-Submit getestet. Vollständige Live-Validierungsregel aller Forms bleibt Prüflücke. |
| Touch Targets | Visuelle Mobile-Prüfung, keine vollständige Messung jedes Targets/physische Geräteprüfung. |
| Zoom | Keine vollständige frische 200-%-Matrix; nicht als bestanden darstellen. |
| Reduced Motion | Vorhandene Regressionstests bestanden; nicht alle Animationen erneut unter Systemeinstellung geprüft. |

## PERFORMANCE REVIEW

- Initial Production Bundle: 451,59 KB roh, geschätzte Übertragung 120,50 KB. Bereichsseiten lazy geladen.
- Vier CSS-Budgetwarnungen, Build ansonsten erfolgreich. Kein Anlass für Architekturumbau.
- Reise-Listenabfrage: vier SQL-Abfragen vor und nach zehn zusätzlichen Reisen; kein N+1 in diesem konkreten Pfad.
- Im aufgezeichneten Browserpfad keine ungefangenen Fehler oder wiederholten 401-Fehlschleifen. Wiederholte Auth-/CSRF-Aufrufe entstanden auch durch absichtliche vollständige Seitennavigation im Test; nicht blind als SPA-Duplikat klassifizieren.
- Payloads, große Produktionsdatenmengen, reale Netzlatenz, LCP/INP/CLS und alle Assets sind nicht vollständig gebenchmarkt. Kein pauschales Performance-PASS.

## PERMISSION MATRIX

Alle Angaben beziehen sich auf **Sophies** Objekte, nicht auf jeweils eigene Benutzerobjekte.

| Daten | Sophie | Alex | Ben | Eve |
|---|---|---|---|---|
| Private Finance | Eigentümerin, Lesen/Ändern | Nein | Nein | Nein |
| Shared Household | Eigentümerin | Lesen mit expliziter Testmitgliedschaft; keine Admin-Einladung | Nein | Nein |
| Private Organisation | Eigentümerin | Nein | Nein | Nein |
| Shared Berlin Trip | Eigentümerin | Nein | VIEWER: Lesen, kein Bearbeiten | Nein |
| Connections | Nur mit zugänglichen Endpunkten | Keine privaten Finanz-/Organisations-Metadaten | Nur soweit beide Endpunkte erlaubt | Keine fremden Endpunkte |
| Suggestions | Eigene erlaubte Vorschläge | Kein Zugriff auf Sophies private Vorschläge | Kein Zugriff auf Sophies private Vorschläge | Fremde Annahme blockiert |

Kontaktannahme allein teilt keine Domain-Daten. Haushaltsmitgliedschaft verleiht keine privaten Finanz-/Organisationsrechte. Reisebeteiligung verleiht keine Haushaltsrechte. Connection ersetzt keine Freigabe.

## DATA INTEGRITY

- Duplicates: Connection-Duplikat abgewiesen; erneuter CSV-Import ohne zusätzliche Buchung; UI-Doppelklick eine Aufgabe.
- Orphans: SQLite Foreign-Key-Check ohne Befund; geprüfte Connection-Endpunkte auflösbar.
- Incorrect Aggregations: geprüfte Finance- und Reisebeträge korrekt, kein Double Counting beim Plan→Ist-Wechsel.
- Ownership Problems: Fremdzugriffe und Ownership-Manipulation in geprüften Fällen verhindert.
- Remove Connection: verknüpfte Reise/Aufgabe bleiben erhalten.
- Persistence: Domain-Daten tatsächlich in isolierter SQLite; Aufgabe nach Browser-Reload, Suggestion-Ablehnung und Heimatwährung nach API-Neuabfrage erhalten. Nicht sämtliche Objekte/Settings nach Logout/Login in jedem Account frisch UI-geprüft.
- Keine vollständige Mehrprozess-/Race-/Deadlock-Prüfung, kein Restore aus Produktionsbackup. Produktionsdatenverlustfreiheit wird nicht behauptet.

## TOP 10 FIXES BEFORE BETA

Nur sechs bestätigte Probleme; keine zehn künstlichen Findings:

1. P1-02: öffentliche API-Konfiguration und tatsächlichen Deployment-Flow freigeben.
2. P1-01: angebotene Kontowiederherstellung vervollständigen.
3. P1-03: tatsächliche Datenschutz-/Anbieterinformationen bereitstellen.
4. P1-04: Haushalts-Beitritt vervollständigen oder ausdrücklich aus begrenzter Beta herausnehmen.
5. P2-02: mobile Finanzkennzahlen/vertikale Dichte verbessern.
6. P2-01: Überblickssuche hinsichtlich Umfang verständlich abgrenzen.

Zusätzliche Freigabe-Nachweise, keine erfundenen Bugs: Abhängigkeits-Advisories einzeln auflösen/bewerten, öffentliches HTTPS und Mailzustellung, reale Logout/Login-/Recovery-Kette, Sharing-End-to-End, Uploadgrenzen, Sessionablauf, Netzwerkabbruch, Fokus/Zoom/Screenreader. P3 kann warten.

## WHAT IS ALREADY STRONG

Serverseitiger Ownership-Schutz; private Organisation trotz Haushalt; granularer Trip-VIEWER; Connections ohne implizite Rechte; erklärbare Vorschläge mit bewusster Zustimmung; keine ungefragten Demo-Finanzdaten; korrekte geprüfte Finanzrechnung; Import-Duplikatschutz; robuste negative API-Fälle; umfangreiche bestehende Regressionstests; ruhige Farben und konsistente Icons.

## FINAL VERDICT

1. **Bereit für 3–5 externe Tester?** Noch nicht freigegeben. Nach P1-Behebung und Deployment-Nachweisen zunächst kleine betreute Beta.
2. **Security Blocker?** Kein bestätigter ausnutzbarer P0 im getesteten Codepfad. Dependencies, öffentliche Konfiguration und noch ungeprüfte Oberflächen verhindern eine umfassende Sicherheitsfreigabe.
3. **Datenverlust-Risiken?** Kein Verlust in geprüften Fällen. Nicht alle Lösch-/Race-/Backup-Szenarien nachgewiesen.
4. **Connections verständlich?** UI beschreibt Kontext und unveränderte Objekte; tatsächliches Nutzerverständnis erst in Beta beobachten.
5. **Suggestions verständlich?** Konkreter Grund und freiwillige Zustimmung vorhanden; realer Nutzen noch nicht empirisch belegt.
6. **Finance nachvollziehbar?** Ja im geprüften Modell: Ausgabenlimit minus tatsächliche Ausgaben minus zugeordnetes Sparen; Einnahmen separat.
7. **Sharing-Grenzen sicher?** Geprüfte Grenzen funktionieren. Haushalts-Beitrittsprozess unvollständig; keine umfassende Aussage über alle Rollenvarianten.
8. **Mobile ausreichend?** Grundlayout in geprüften Breiten nutzbar; Finanzdichte und Betragumbruch verbessern, Accessibility-Prüflücken schließen.
9. **Drei größte Produktprobleme?** Nicht fertige externe Bereitstellung, nicht fertige Kontowiederherstellung, nicht fertiger Haushalts-Beitritt. Rechtstexte zusätzlich zwingendes Freigabethema.
10. **Noch nicht bauen?** Automations V1, zusätzliche Großfeatures, neue Navigation, Architekturumbau oder KI. Erst vorhandene Flows abschließen und Beta-Beobachtungen sammeln.

## Visuelle Nachweise – nummerierter Ablauf

Alle verlinkten Screenshots wurden frisch aufgenommen und visuell gesichtet. Script-Strings und E-Mail-Adressen sind ausdrücklich synthetische Sicherheits-Testdaten.

1. [Landing](audits/real-user-journey/01-landing.png)
2. [Registration Errors](audits/real-user-journey/02-register-errors.png)
3. [Onboarding](audits/real-user-journey/03-onboarding.png)
4. [Empty Dashboard](audits/real-user-journey/04-dashboard-empty.png)
5. [Finance](audits/real-user-journey/05-finanzen.png)
6. [Household](audits/real-user-journey/06-haushalt.png)
7. [Organisation](audits/real-user-journey/07-organisation.png)
8. [Travel](audits/real-user-journey/08-reisen.png)
9. [Contacts](audits/real-user-journey/09-familie.png)
10. [Profile](audits/real-user-journey/10-einstellungen-profil.png)
11. [Settings](audits/real-user-journey/11-einstellungen.png)
12. [Filled Dashboard](audits/real-user-journey/12-dashboard-filled.png)
13. [Task Dialog](audits/real-user-journey/13-task-dialog.png)
14. [Saved Task](audits/real-user-journey/14-task-created.png)
15. [Overview Search](audits/real-user-journey/15-search.png)
16. [Finance 360 px](audits/real-user-journey/16-finance-360.png)
17. [Connections / Suggestions Dialog](audits/real-user-journey/17-connections-suggestions.png)
18. [Finance Dialog](audits/real-user-journey/18-finance-dialog.png)

**STOP:** Keine Findings behoben, keine Produktfeatures implementiert. Entscheidung über nächste Änderungen liegt beim Nutzer.
