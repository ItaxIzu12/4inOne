# Architekturkonzept: All-in-One-Lebensmanagement-App
## Finanzen · Organisation · Haushalt

*Dieses Dokument ergänzt das `Gesamtkonzept_AllInOne_App.md` (Vision, Markt, Zielgruppen, Recht, Roadmap) um die technische Umsetzung: Tech-Stack, Architektur-Prinzipien, Security und Performance/Skalierung.*

*Version 2 – überarbeitet nach kritischem Security-/Engineering-Review (siehe Abschnitt 0).*

---

## 0. Ehrliche Gesamteinschätzung

Das ursprüngliche Konzept war solide für Markt/UX, hatte aber im technischen Teil **eine kritische Sicherheitslücke** (fehlende Autorisierungs-Ebene), mehrere **kleinere, aber reale Lücken** (Token-Speicherung, Schlüsselmanagement, Account-Recovery, Django-Hardening) und war an einigen Stellen **komplexer geplant, als ein Solo-Nebenprojekt sauber umsetzen und betreiben kann**. Dieses Dokument korrigiert beides: Es schließt die Lücken und markiert gleichzeitig, was für den MVP wirklich nötig ist (🔴 Muss) und was bewusst später kommen sollte (🟡 Später), damit der Umfang nicht zur Überforderung wird.

---

## 1. Tech-Stack-Bewertung

Ausgangsvorschlag: Angular + SQLite + Django, später PostgreSQL.

**Bewertung:**
- **Django** 🔴 solide Wahl: "batteries included", gutes Auth-System, Django REST Framework, gute DSGVO-taugliche Ökosystem-Pakete.
- **Angular** 🔴 geeignet für ein typisiertes Multi-Modul-Interface, aber schwerer/komplexer als nötig für Solo-Arbeit. Bleib dabei, wenn du Erfahrung hast – sonst ist React/Vue eine ernsthafte Alternative.
- **SQLite → PostgreSQL** 🔴 PostgreSQL direkt für jede Umgebung mit mehr als einem gleichzeitigen Nutzer (siehe 2.2). SQLite nur lokal/Tests.
- **Mobile App** 🔴 Angular + Capacitor für den Start (eine Codebasis), native später bei Bedarf.
- **Redis** 🔴 für Caching, Sessions/Token-Blacklist, Rate-Limiting – das brauchst du auch für Security (siehe Abschnitt 3), nicht nur für Performance.
- **Celery + Message-Broker** 🟡 **Später, nicht im MVP.** Für den Start reichen Django-Management-Commands + ein einfacher Cron-Job (z. B. für Erinnerungen). Ein Broker (Redis/RabbitMQ) + Worker-Prozess bedeutet zusätzliche Infrastruktur, die du als Einzelperson betreiben und absichern musst (Monitoring, Neustart bei Absturz, Zugriffskontrolle auf die Queue). Führe Celery erst ein, wenn ein konkretes Feature es zwingend braucht (z. B. Banking-Sync in Phase 5).
- **Docker** 🔴 von Anfang an, auch lokal – erleichtert später Deployment und Onboarding, falls doch mal jemand mitarbeitet.

---

## 2. Architektur-Prinzipien

### 2.1 Modularer Aufbau – aber pragmatisch starten
Klare Modul-/Domänengrenzen im Code sind richtig (eigene Django-Apps: `finance`, `household`, `organization`, `core`). **Korrektur gegenüber Version 1:** Ein eigenes Event-System zwischen den Modulen ist für den Start **zu viel Komplexität für zu wenig Nutzen** – korrekt implementierte Event-Verarbeitung (Reihenfolge, Idempotenz, Fehlerbehandlung bei fehlgeschlagenen Listenern) ist selbst eine nicht-triviale Aufgabe, die leicht zu stillen Dateninkonsistenzen führt, wenn sie unter Zeitdruck gebaut wird.

**Pragmatischere Empfehlung für den MVP:** Module rufen sich über klar definierte Service-Funktionen/-Klassen direkt auf (z. B. `household.services.create_shopping_expense()` ruft intern `finance.services.add_planned_expense()` auf), gekapselt hinter definierten Interfaces, aber **synchron und ohne Event-Bus**. Das ist einfacher zu debuggen, zu testen und nachzuvollziehen. Einen echten Event-Bus (z. B. Django Signals + Celery-Tasks) führst du erst ein, wenn du mehrere unabhängige Konsumenten pro Ereignis hast oder Entkopplung über Prozessgrenzen brauchst.

```
core/          # User, Household/Familie, Rollen & Rechte, Notifications
finance/       # Konten, Transaktionen, Budgets, Kategorien
household/     # Einkaufsliste, Aufgaben, Pläne
organization/  # Kalender, To-dos, Erinnerungen
integrations/  # Banking-API-Anbindung (später), Kalender-Sync
```

### 2.2 SQLite ist keine Produktionsdatenbank für Mehrbenutzerbetrieb
SQLite schreibt mit einem einzigen Writer-Lock; bei gleichzeitigem Schreibzugriff mehrerer Nutzer (z. B. gemeinsamer Kalender) entstehen Wartezeiten/Fehler. Nutze SQLite nur lokal/für Tests, PostgreSQL ab dem ersten Server-Deployment – der spätere Umstieg kostet unnötigen Migrationsaufwand mit echten Nutzerdaten.

### 2.3 Datenmodell-Skizze (Startpunkt, kein finales Schema)
- `User` ↔ `Household` (n:m, mit Rolle: Admin/Mitglied/Kind-Konto) – Rollen-/Rechtemodell vor dem Bau final klären (siehe Abschnitt 5).
- `Account` (Finanzkonto) ↔ `Transaction`
- `Budget` ↔ `Category`
- `ShoppingList` ↔ `ShoppingItem`
- `Task` (Haushaltsaufgabe) ↔ optional `CalendarEvent`
- `CalendarEvent` ↔ `Household`/`User`

**Neu – Löschung vs. Aufbewahrungspflicht:** Plane von Anfang an ein **Soft-Delete-/Archivierungskonzept** statt hartem Löschen für Finanzdatensätze (`deleted_at`-Feld statt `DELETE`). Grund: DSGVO-Recht auf Löschung steht in Spannung zu handelsrechtlichen Aufbewahrungspflichten für buchhaltungsrelevante Belege (§ 257 HGB, § 147 AO: 6–10 Jahre), falls dein Finanzmodul so genutzt wird. Ob das bei einer privaten Haushaltskasse tatsächlich greift, ist im Einzelfall unklar – kläre das früh mit einer Rechtsberatung, aber baue technisch so, dass "als gelöscht markieren, aber referenzierbar aufbewahren" möglich ist. Hartes Löschen lässt sich immer noch nachrüsten, das Gegenteil (Daten sind weg, obwohl sie hätten aufbewahrt werden müssen) nicht.

Dieses Modell sollte vor der Implementierung als vollständiges ER-Diagramm ausgearbeitet werden.

---

## 3. Cybersecurity-Konzept

### 3.1 Authentifizierung & Zugriff
- 🔴 OAuth2/OpenID Connect statt Eigenbau; Django + `django-allauth` oder `djangorestframework-simplejwt`
- 🔴 **Multi-Faktor-Authentifizierung (MFA)** verpflichtend zumindest für Finanzfunktionen
- 🟡 Passkeys/WebAuthn zusätzlich zum Passwort (guter Zusatz, aber kein MVP-Blocker)
- 🔴 **Token-Speicherung – korrigiert:** JWTs **nicht** in `localStorage`/`sessionStorage` speichern (XSS liest sie sofort aus). Stattdessen: Access-Token kurzlebig (10–15 Min.) im Speicher (JS-Variable, nicht persistiert) halten, Refresh-Token als **`httpOnly`, `Secure`, `SameSite=Strict`-Cookie** vom Backend gesetzt. Damit kann clientseitiges JavaScript den Refresh-Token gar nicht erst auslesen, selbst bei einer XSS-Lücke. Für die Mobile-App (Capacitor) gilt dasselbe Prinzip über die native Secure-Storage-Schicht statt Cookie.
- 🔴 Refresh-Token-Rotation, alte Refresh-Tokens serverseitig invalidierbar (Blacklist in Redis)
- 🔴 Rate-Limiting & Account-Lockout gegen Brute-Force (`django-axes`), inkl. Schutz gegen **Credential Stuffing** (bekannte Passwort-Listen abgleichen, z. B. via Have-I-Been-Pwned-API beim Registrieren)
- 🔴 Passwort-Hashing mit Argon2

### 3.2 Autorisierung – die bisher größte Lücke
- 🔴 **Object-Level-Authorization auf jedem Endpunkt, der eine ID entgegennimmt.** Nicht nur prüfen "ist der Nutzer eingeloggt", sondern immer zusätzlich "gehört diese Transaktion/Aufgabe/dieser Kalendereintrag zu einem Haushalt, in dem dieser Nutzer Mitglied ist". In Django REST Framework über eigene `permission_classes` pro Modul umsetzen, nicht implizit über Queryset-Filterung allein (leicht vergessen bei neuen Endpunkten) – am besten als wiederverwendbare Basisklasse `HouseholdScopedPermission`, die jedes neue Modul automatisch erbt, damit es nicht bei jedem neuen Feature erneut vergessen werden kann.
- 🔴 Rollenmodell technisch durchsetzen, nicht nur im Frontend verstecken: Ein "Kind-Konto" darf z. B. keine Finanz-Endpunkte erreichen, auch wenn die UI den Menüpunkt nur ausblendet – serverseitige Durchsetzung ist Pflicht, UI-Ausblendung ist nur Komfort.
- 🟡 Automatisierte Tests speziell für Autorisierung: Für jeden Endpunkt mindestens einen Test "Nutzer aus fremdem Haushalt bekommt 403/404", das verhindert Regressionen.

### 3.3 Datenschutz & Verschlüsselung
- 🔴 TLS 1.3 überall, HSTS aktiviert
- 🔴 Field-Level-Encryption für Finanzdaten **at rest**
- 🔴 **Schlüsselmanagement – korrigiert:** Verschlüsselungsschlüssel niemals in derselben Umgebung/demselben Secret-Store wie die Datenbank-Zugangsdaten ablegen. Nutze einen dedizierten Secret-/Key-Manager (z. B. Cloud-KMS des Hosters, oder für den Start `django-environ` mit striktem Zugriffskonzept), definiere eine Rotationsstrategie (mindestens jährlich, sofort bei Verdacht auf Kompromittierung), und trenne, wer Zugriff auf Schlüssel vs. auf verschlüsselte Daten hat.
- 🔴 Datenminimierung: nur erheben, was ein Feature wirklich braucht
- 🟡 Anonymisierung/Pseudonymisierung für Analytics
- 🔴 Recht auf Löschung/Export technisch umsetzen – **mit Soft-Delete-Ausnahme für aufbewahrungspflichtige Finanzdaten** (siehe 2.3)

### 3.4 Absicherung der Anwendung (OWASP-orientiert)
- 🔴 Django-ORM konsequent, keine Raw-SQL-Konkatenation
- 🔴 CSRF-Schutz aktiv, CORS ohne Wildcard in Produktion
- 🔴 Content-Security-Policy: **konkret**, nicht nur "aktivieren" – `script-src 'self'` ohne `unsafe-inline`/`unsafe-eval`, sonst hebelt eine unsaubere CSP-Konfiguration den Schutz wieder aus. Angular baut standardmäßig sicher (Auto-Escaping), aber Vorsicht bei `bypassSecurityTrustHtml`/`innerHTML`-Bindings – jede Nutzung ist ein potenzielles XSS-Einfallstor und sollte im Code-Review besonders geprüft werden.
- 🔴 **Django-Hardening für Produktion (bisher gefehlt):** `DEBUG = False`, `ALLOWED_HOSTS` strikt gesetzt, `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `X_FRAME_OPTIONS = 'DENY'`. Das **Admin-Panel** (`/admin/`) ist ein Standardziel für automatisierte Scanner – Pfad umbenennen, per IP-Allowlist oder VPN einschränken, eigenes MFA fürs Admin-Konto.
- 🔴 **WAF/API-Gateway (bisher gefehlt):** Rate-Limiting nicht nur auf Login, sondern auf alle schreibenden Endpunkte, plus grundlegende WAF-Regeln (z. B. Cloudflare kostenlos/günstig als erste Schicht) gegen automatisierten Scan- und Bot-Traffic.
- 🔴 Dependency-Scanning (Dependabot/Snyk), regelmäßige Updates
- 🔴 Secrets ausschließlich über Umgebungsvariablen/Secret-Manager, nie im Repository
- 🟡 **Lieferketten-/CI-CD-Sicherheit:** Lockfiles committen (`package-lock.json`) gegen unbemerkte Versionsänderungen, CI-Pipeline-Secrets nur mit minimal nötigen Rechten, geschützte Branches mit Pflicht-Review vor Merge in `main`.

### 3.5 Mobile-spezifisch (Capacitor)
- 🔴 Sichere lokale Speicherung via Keychain (iOS)/Keystore (Android), niemals Klartext
- 🔴 Certificate Pinning
- 🟡 Jailbreak-/Root-Erkennung als Zusatzwarnung
- 🔴 **Capacitor-WebView-Härtung (bisher gefehlt):** Die native Bridge, über die JS mit nativen APIs (Keychain, Kamera) spricht, ist selbst eine Angriffsfläche, falls eine XSS-Lücke im Web-Code steckt – Angreifer-JS könnte sonst native Funktionen missbrauchen. Nur die tatsächlich benötigten Capacitor-Plugins einbinden, `allowNavigation` auf die eigene Domain beschränken, keine beliebigen externen URLs in der WebView laden.

### 3.6 Session-Management & Account-Recovery (bisher komplett gefehlt)
- 🔴 Übersicht aktiver Sitzungen/Geräte im Profil, mit Möglichkeit einzelne Sitzungen remote abzumelden ("Ich habe mein Handy verloren")
- 🔴 Passwort-Reset-Flow **ohne Account-Enumeration**: identische Antwort/Zeitverhalten, egal ob die E-Mail existiert oder nicht; Reset-Token kryptographisch zufällig, einmalig nutzbar, kurze Ablaufzeit (z. B. 30 Min.)
- 🔴 Bei sicherheitsrelevanten Änderungen (E-Mail, Passwort, MFA) automatische Benachrichtigung an die alte E-Mail-Adresse
- 🟡 Für ältere Nutzer: ein definierter, dokumentierter Support-Weg für Account-Wiederherstellung, der nicht rein self-service ist (Telefon/E-Mail-Support), da MFA-Verlust bei dieser Zielgruppe häufiger vorkommt als bei jüngeren

### 3.7 Betrieb & Reaktion
- 🔴 Zentrales Logging/Monitoring (Sentry, einfaches Server-Monitoring) – ohne PII im Klartext in Logs
- 🔴 Dokumentierter Incident-Response-Plan; DSGVO verlangt Meldung binnen 72 Stunden bei einer Datenpanne
- 🔴 Regelmäßige, **getestete** Backups (Restore tatsächlich einmal durchspielen, nicht nur Backup-Job laufen lassen)
- 🟡 Externer Penetrationstest **vor** Anbindung echter Bankdaten (Phase 5) – nicht vorher zwingend nötig, aber dann nicht verhandelbar
- 🟡 SIEM/erweiterte Anomalie-Erkennung: für ein Nebenprojekt realistisch erst bei nennenswertem Nutzerwachstum, nicht im MVP

### 3.8 Teststrategie (bisher komplett gefehlt)
- 🔴 Unit-Tests für jede Finanzberechnung (Budgetsummen, Kategorisierung, wiederkehrende Ausgaben) – Rechenfehler bei Geld sind ein Vertrauens- und Haftungsproblem, kein normaler Bug
- 🔴 Integrationstests für die Autorisierungsregeln aus 3.2 (fremder Haushalt darf nicht zugreifen)
- 🟡 End-to-End-Tests für die Kernflows (Registrierung, Ausgabe erfassen, Aufgabe erledigen) mit Playwright/Cypress
- 🟡 Automatisierte Barrierefreiheits-Checks (axe-core) in der CI-Pipeline, ergänzt um mindestens einen manuellen Screenreader-Test vor dem Launch – automatisierte Tools finden erfahrungsgemäß nur einen Teil der WCAG-Probleme

---

## 4. Performance & Skalierung

- 🔴 Datenbank: Indizierung häufig gefilterter Felder, Connection Pooling (PgBouncer)
- 🔴 Caching: Redis für häufige, wenig volatile Abfragen
- 🟡 Asynchrone Verarbeitung (Celery) erst, wenn ein konkretes Feature es braucht (siehe Abschnitt 1)
- 🔴 Angular: Lazy Loading pro Modul, OnPush Change Detection (bzw. Angular Signals, falls Angular-Version ≥ 17)
- 🟡 **Angular Universal (SSR) – korrigiert:** Für den MVP nicht nötig. SSR bringt vor allem SEO-Vorteile für öffentlich indexierbare Seiten – deine App läuft aber größtenteils hinter einem Login, wo SEO irrelevant ist. Ein eigener SSR-Node-Prozess bedeutet zusätzliche Infrastruktur und Angriffsfläche (u. a. SSRF-Risiko bei serverseitigen Fetches). Für die öffentliche Landingpage reicht eine einfache statische Seite oder vorgerendertes HTML (Angular Prerendering für die paar öffentlichen Routen) – SSR für die ganze App erst einführen, wenn organische Suchreichweite tatsächlich eine Rolle spielt.
- 🔴 PWA-Fähigkeit für Offline-Zugriff auf zuletzt geladene Daten
- 🔴 Containerisierung (Docker) von Anfang an
- 🟡 CDN für statische Assets, sobald es einen nennenswerten Nutzerkreis gibt

---

## 5. Offene Punkte vor Implementierungsstart

- Rollen-/Rechtemodell für Mehrpersonenhaushalte final klären (siehe 2.3) – **das ist jetzt auch Voraussetzung für die Autorisierungsregeln aus 3.2**
- ER-Diagramm auf Basis der Skizze in 2.3 ausarbeiten, inkl. Soft-Delete-Feldern für Finanzdaten
- API-Vertrag (REST vs. GraphQL, Versionierungsstrategie) festlegen
- Entscheidung Capacitor vs. native final treffen
- Kurzes, informelles Threat-Modeling (z. B. STRIDE auf die drei wichtigsten Flows: Login, Haushaltsdaten teilen, spätere Banking-Anbindung) vor Implementierungsstart – deckt oft Lücken auf, die eine Feature-Liste allein nicht zeigt