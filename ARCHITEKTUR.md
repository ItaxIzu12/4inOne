# Architekturkonzept: All-in-One-Lebensmanagement-App
## Finanzen · Organisation · Haushalt

*Dieses Dokument ergänzt das `Gesamtkonzept_AllInOne_App.md` (Vision, Markt, Zielgruppen, Recht, Roadmap) um die technische Umsetzung: Tech-Stack, Architektur-Prinzipien, Security und Performance/Skalierung.*

*Version 4 — Rückkehr zu Django/Python als Backend. Die zwischenzeitliche Node.js/NestJS-Fassung (Version 3) ist damit abgelöst. Alle sprachunabhängigen Entscheidungen (PostgreSQL-Pflicht, Rollenmodell, Autorisierungsprinzip, Soft-Delete) gelten unverändert weiter.*

---

## 0. Ehrliche Gesamteinschätzung

### 0.1 Zum wiederholten Framework-Wechsel
Django ist eine technisch vollständig solide Wahl für dieses Projekt — das war sie in Version 2 und ist sie hier wieder. Der einzige Kritikpunkt ist nicht die Wahl selbst, sondern die Häufigkeit des Wechsels: Jeder erneute Architekturwechsel kostet Zeit ohne Fortschritt am eigentlichen Produkt. Diese Fassung sollte als endgültige Grundlage behandelt werden, nicht als weitere Zwischenstation.

### 0.2 SQLite vs. PostgreSQL — unverändert, hier nochmal klar gestellt
**SQLite ist ausschließlich für die lokale Einzelentwickler-Umgebung vorgesehen, nicht als Zwischenschritt in Produktion.** Grund: SQLite schreibt mit einem einzigen Writer-Lock — sobald mehr als eine Person gleichzeitig schreibend zugreift (Staging mit Testnutzern, Beta, Produktion), entstehen Fehler oder Wartezeiten. "Später umstellen" bedeutet eine echte Datenmigration mit echten Nutzerdaten, kein triviales Config-Flag. **PostgreSQL ist Pflicht ab dem Moment, in dem mehr als eine Person auf dieselbe Datenbank zugreift** — das ist keine spätere Option, sondern eine technische Grenze. Details siehe Abschnitt 2.2.

### 0.3 Priorisierung
🔴 = MVP-Pflicht, 🟡 = bewusst später. Unverändert gegenüber den Vorversionen.

---

## 1. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Frontend | Angular (bestehend) | unverändert |
| Backend-Framework | 🔴 **Django** + Django REST Framework (DRF) | "batteries included": ORM, Auth-Grundgerüst, Admin-Oberfläche, Migrations — wenige Einzelentscheidungen nötig, das reduziert Sicherheitsrisiko für einen Solo-Entwickler |
| Sprache Backend | 🔴 Python | — |
| ORM | 🔴 Django-ORM (eingebaut) | extrem ausgereift, viele Jahre Produktionshärtung, parametrisierte Queries strukturell gegen SQL-Injection |
| Datenbank (lokal) | 🔴 SQLite | **nur** für die eigene lokale Entwicklung, solange ausschließlich du allein testest — siehe 0.2 |
| Datenbank (Staging/Produktion) | 🔴 **PostgreSQL, ab dem ersten Mehrbenutzerzugriff verpflichtend** | siehe 2.2 |
| Auth | 🔴 `django-allauth` | Registrierung, Login, Session-/Token-Handling, MFA-Erweiterung über `django-allauth`-MFA-Plugin oder `django-otp` |
| API-Layer | 🔴 Django REST Framework (DRF) | Serializer, ViewSets, Permission-Klassen — direkte Grundlage für die Autorisierung in Abschnitt 3.2 |
| JWT-Handling | 🔴 `djangorestframework-simplejwt` | Access-/Refresh-Token-Ausstellung, Rotation |
| Passwort-Hashing | 🔴 Argon2 über Djangos `PASSWORD_HASHERS` (`Argon2PasswordHasher`) | nativ eingebaut, keine Zusatzpakete nötig — Vorteil gegenüber dem Node-Stack, wo das native Bindings brauchte |
| Rate-Limiting / Brute-Force-Schutz | 🔴 `django-axes` | Account-Lockout nach fehlgeschlagenen Login-Versuchen |
| Security-Header/Hardening | 🔴 Djangos eingebaute `SECURE_*`-Settings + `django-csp` für Content-Security-Policy | siehe 3.4 |
| Caching / Sessions / Rate-Limit-Speicher | 🔴 Redis | unverändert aus allen Vorversionen |
| Hintergrundjobs | 🟡 **Celery** + Redis als Broker | **Später, nicht im MVP** — erst einführen, wenn ein Feature es zwingend braucht (z. B. Banking-Sync in Phase 5); für den Start reichen Django-Management-Commands + Cron |
| Admin-Oberfläche | 🔴 **Django-Admin (automatisch mitgeliefert)** | echter struktureller Vorteil gegenüber dem Node-Stack — für Support/Debugging in der Frühphase sofort nutzbar, muss aber trotzdem abgesichert werden (siehe 3.4) |
| Testing | 🔴 `pytest-django` | reifes, gut dokumentiertes Test-Ökosystem |
| Mobile App | 🔴 Angular + Capacitor (unverändert) | betrifft nicht die Backend-Entscheidung |
| API-Dokumentation/Testing | 🔴 `drf-spectacular` + Swagger UI | automatisch aus DRF-Code generiertes OpenAPI-Schema, interaktive Test-Oberfläche mit Token-Autorisierung — siehe Abschnitt 2.4 |

### 1.1 Repo-Struktur: getrennte Repos statt Monorepo
**Korrektur gegenüber der Node.js-Zwischenversion:** Der damalige Monorepo-Vorschlag war mit geteilten TypeScript-Typen zwischen Angular und NestJS begründet. Mit der Rückkehr zu Django (Python) entfällt dieser Vorteil vollständig — Python und TypeScript können keinen Code/keine Typen teilen. **Empfehlung: zwei getrennte Repositories** (`4inone-frontend`, `4inone-backend`), jeweils mit eigener CI/CD-Pipeline und eigenem Deployment-Ziel. Die dadurch verlorene "automatische Synchronität" zwischen Frontend und Backend-API wird über das OpenAPI-Schema aus Abschnitt 2.4 kompensiert, nicht über ein gemeinsames Repo.

---

## 2. Architektur-Prinzipien

### 2.1 Modularer Aufbau — Django-Apps, deutsch benannt
Konsistent zum bestehenden Angular-Frontend (das bereits `finanzen`, `haushalt`, `organisation`, `login` als Feature-Ordner nutzt) heißen auch die Django-Apps auf Deutsch, nicht Englisch:

```
backend/
  core/           # User, Household/Familie, Rollen & Rechte, Notifications
  finanzen/       # Konten, Transaktionen, Budgets, Kategorien
  haushalt/       # Einkaufsliste, Aufgaben, Pläne
  organisation/   # Kalender, To-dos, Erinnerungen
  integrations/   # Banking-API-Anbindung (später), Kalender-Sync
```

**Weiterhin gültig, unverändert aus den Vorversionen:** Kein Event-Bus zwischen Apps im MVP. Apps rufen sich über direkt importierte Service-Funktionen auf (`haushalt.services.create_shopping_expense()` ruft `finanzen.services.add_planned_expense()` auf), nicht über Django Signals + Celery-Tasks. Begründung unverändert: korrekt implementierte Event-Verarbeitung (Reihenfolge, Idempotenz, Fehlerbehandlung) ist selbst nicht-trivial — synchrone Aufrufe sind für den Start einfacher zu debuggen und zu testen. Ein Signal-/Event-System erst einführen, wenn mehrere unabhängige Konsumenten pro Ereignis existieren.

### 2.2 PostgreSQL — die wichtigste technische Festlegung dieses Dokuments
- **Lokale Entwicklung (nur du, ein Rechner):** SQLite ist völlig in Ordnung, schnell einzurichten, kein Server nötig.
- **Sobald eine zweite Person testet (Staging, Beta, ein Familienmitglied probiert die App aus) oder die App online erreichbar ist:** PostgreSQL ist Pflicht, keine Ausnahme.
- **Praktische Konsequenz für die Umsetzung:** Django macht den Wechsel über die Datenbank-Konfiguration (`DATABASES`-Setting) technisch einfach — aber nur für neue, leere Datenbanken. Sobald in SQLite bereits echte Nutzerdaten liegen, ist der Wechsel eine Migration mit Exportieren/Importieren, nicht nur ein Config-Flag. Der einfachste Weg, dieses Risiko zu vermeiden: **von Anfang an lokal mit PostgreSQL in Docker entwickeln** (ein `docker-compose.yml` mit einem Postgres-Container ist in fünf Minuten aufgesetzt) — dann gibt es gar keinen Migrationsschritt, weil es nie zwei verschiedene Datenbanken gab.

### 2.3 Datenmodell-Skizze (Django-Models)
```python
class Household(models.Model):
    name = models.CharField(max_length=100)

class HouseholdMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "ADMIN"
        MEMBER = "MEMBER"
        CHILD_ACCOUNT = "CHILD_ACCOUNT"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices)

class Account(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE)

class Transaction(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.ForeignKey("Category", on_delete=models.PROTECT)
    deleted_at = models.DateTimeField(null=True, blank=True)  # Soft-Delete, siehe unten
```

**Weiterhin gültig, unverändert aus allen Vorversionen — Löschung vs. Aufbewahrungspflicht:** Das `deleted_at`-Feld (Soft-Delete) bleibt Pflicht für Finanzdatensätze. Grund: DSGVO-Recht auf Löschung steht potenziell in Spannung zu handelsrechtlichen Aufbewahrungspflichten (§ 257 HGB, § 147 AO). In Django lässt sich das sauber über einen custom `Manager` umsetzen, der gelöschte Objekte standardmäßig aus Abfragen ausblendet, ohne sie tatsächlich aus der Datenbank zu entfernen.

**Rollen-/Rechtemodell für Mehrpersonenhaushalte** weiterhin vor der Implementierung final klären — siehe Abschnitt 6.

### 2.4 Interaktive API-Dokumentation (Swagger UI) — Entwicklungskomfort mit Sicherheitsauflage
`drf-spectacular` generiert aus den bestehenden DRF-Serializers/ViewSets automatisch ein OpenAPI-3-Schema, daraus eine interaktive Swagger-UI-Seite mit "Authorize"-Button für JWT-Bearer-Token — nach einmaliger Token-Eingabe lassen sich alle Endpunkte per GET/POST direkt im Browser testen, inklusive Daten anlegen ("füttern").

**🔴 Sicherheitsauflage, nicht optional:** Diese Oberfläche zeigt die komplette API-Struktur inkl. aller Felder offen und lädt zum Ausprobieren von Endpunkten ein — das ist ein Informationsleck, wenn es öffentlich in Produktion erreichbar ist. Nur aktivieren, wenn `DEBUG=True` (lokal/Staging), oder zusätzlich hinter eigener Berechtigung/IP-Beschränkung verstecken. Niemals unter einer öffentlichen Produktions-URL ungeschützt stehen lassen.

**Zusatznutzen — Typsicherheit trotz getrennter Sprachen und Repos:** Aus demselben OpenAPI-Schema lässt sich mit `openapi-typescript-codegen` ein TypeScript-Client für Angular generieren (Build-Schritt im Frontend-Repo). Das bringt einen Großteil des Vorteils "geteilte Typen zwischen Frontend und Backend" zurück, den die Node.js-Zwischenversion durch gemeinsames TypeScript hatte — ohne dass beide Seiten in derselben Sprache oder demselben Repo liegen müssen.

**Kostenloser Bonus ohne Zusatzpaket:** DRFs eingebaute "Browsable API" bietet bereits eine einfache HTML-Testoberfläche für jeden Endpunkt direkt im Browser — weniger komfortabel als Swagger UI, aber ab Tag 1 ohne jede Einrichtung vorhanden.

---

## 3. Cybersecurity-Konzept

### 3.1 Authentifizierung & Zugriff
- 🔴 `django-allauth` für Registrierung/Login statt Eigenbau.
- 🔴 **Multi-Faktor-Authentifizierung (MFA)** verpflichtend für Finanzfunktionen — über `django-allauth`-MFA-Erweiterung oder `django-otp` (TOTP-basiert).
- 🟡 Passkeys/WebAuthn zusätzlich — kein MVP-Blocker.
- 🔴 **Token-Speicherung — unverändert, sprachunabhängig:** JWTs nicht in `localStorage` (XSS-Risiko). Access-Token kurzlebig im Speicher halten, Refresh-Token als `httpOnly`, `Secure`, `SameSite=Strict`-Cookie, gesetzt über `djangorestframework-simplejwt` in Kombination mit einem eigenen Cookie-Handling in der View.
- 🔴 **Cookie-/CORS-Domain-Konfiguration:** Frontend (Angular) und Backend (Django) laufen typischerweise auf unterschiedlichen Subdomains. `django-cors-headers` korrekt konfigurieren (`CORS_ALLOWED_ORIGINS`, kein Wildcard), `SESSION_COOKIE_SAMESITE`/`CSRF_COOKIE_SAMESITE` und `CORS_ALLOW_CREDENTIALS=True` exakt auf die reale Deployment-Topologie abstimmen — das früh im Deployment-Konzept festlegen, nicht erst beim ersten "geht lokal, aber nicht in Produktion"-Bug entdecken.
- 🔴 Refresh-Token-Rotation, alte Tokens serverseitig invalidierbar (Blacklist-Funktion von `simplejwt`, gestützt auf Redis).
- 🔴 Rate-Limiting & Account-Lockout gegen Brute-Force (`django-axes`), zusätzlich Credential-Stuffing-Schutz (Have-I-Been-Pwned-API-Abgleich bei Registrierung).
- 🔴 Passwort-Hashing mit Argon2 — nativ über Djangos `PASSWORD_HASHERS`.

### 3.2 Autorisierung — weiterhin die wichtigste Lücke, wenn sie fehlt
- 🔴 **Object-Level-Authorization auf jedem Endpunkt, der eine ID entgegennimmt.** Nicht nur prüfen "ist der Nutzer eingeloggt", sondern zusätzlich "gehört diese Transaktion/Aufgabe/dieser Kalendereintrag zu einem Haushalt, in dem dieser Nutzer Mitglied ist". In DRF über eine wiederverwendbare `permission_classes`-Basisklasse `HouseholdScopedPermission` umsetzen, die jede neue App automatisch erbt — nicht implizit über Queryset-Filterung allein, die bei neuen Endpunkten leicht vergessen wird.
- 🔴 Rollenmodell serverseitig durchsetzen (Kind-Konto darf keine Finanz-Endpunkte erreichen), nicht nur im Angular-Frontend über Routen-Guards verstecken — Frontend-Guards sind Komfort, die DRF-Permission ist die eigentliche Sicherheitsgrenze.
- 🟡 Automatisierte Tests pro Endpunkt: "Nutzer aus fremdem Haushalt bekommt 403/404" — mit `pytest-django` umsetzbar.

### 3.3 Datenschutz & Verschlüsselung
- 🔴 TLS 1.3 überall, HSTS aktiviert (`SECURE_HSTS_SECONDS`).
- 🔴 Field-Level-Encryption für Finanzdaten at rest (z. B. über `django-cryptography` oder eigene Verschlüsselungs-Middleware auf Feldebene).
- 🔴 **Schlüsselmanagement — unverändert, sprachunabhängig:** Verschlüsselungsschlüssel getrennt vom Datenbank-Zugang verwalten, dedizierter Secret-/Key-Manager, Rotationsstrategie definieren.
- 🔴 Datenminimierung, 🟡 Pseudonymisierung für Analytics.
- 🔴 Recht auf Löschung/Export technisch umsetzen — mit Soft-Delete-Ausnahme für aufbewahrungspflichtige Finanzdaten (siehe 2.3).

### 3.4 Absicherung der Anwendung (OWASP-orientiert)
- 🔴 Django-ORM konsequent, keine Raw-SQL-Konkatenation.
- 🔴 CSRF-Schutz aktiv (Django-Standard), CORS ohne Wildcard in Produktion (siehe 3.1).
- 🔴 Content-Security-Policy konkret konfiguriert (`django-csp`, `script-src 'self'` ohne `unsafe-inline`), nicht nur pauschal aktiviert.
- 🔴 **Django-Hardening für Produktion:** `DEBUG = False`, `ALLOWED_HOSTS` strikt gesetzt, `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `X_FRAME_OPTIONS = 'DENY'`. Ohne `DEBUG = False` legt Django Stacktraces inklusive Secrets offen.
- 🔴 **Django-Admin absichern, nicht nur nutzen.** Der strukturelle Vorteil aus Abschnitt 1 (Admin kommt kostenlos mit) bedeutet nicht, dass er sicher ist, sobald er läuft: Pfad umbenennen (nicht `/admin/`), per IP-Allowlist oder VPN einschränken, eigenes MFA fürs Admin-Konto — das Standardziel für automatisierte Scanner bleibt sonst offen.
- 🔴 WAF/API-Gateway: Rate-Limiting auf alle schreibenden Endpunkte, plus grundlegende WAF-Regeln (z. B. Cloudflare) als erste Schicht.
- 🔴 Dependency-Scanning (Dependabot/`pip-audit`), regelmäßige Updates.
- 🔴 Secrets ausschließlich über Umgebungsvariablen/Secret-Manager (`django-environ`), nie im Repository.
- 🟡 Lieferketten-/CI-CD-Sicherheit: Lockfiles (`requirements.txt` mit gepinnten Versionen bzw. `poetry.lock`) committen, CI-Secrets mit minimalen Rechten, geschützte Branches mit Pflicht-Review.

### 3.5 Mobile-spezifisch (Capacitor) — unverändert, sprachunabhängig
Keychain/Keystore-Speicherung, Certificate Pinning, Capacitor-WebView-Härtung (nur benötigte Plugins, `allowNavigation` auf eigene Domain beschränkt) — betrifft ausschließlich die Angular/Capacitor-Seite, nicht das Backend.

### 3.6 Session-Management & Account-Recovery — unverändert, sprachunabhängig
- 🔴 Übersicht aktiver Sitzungen/Geräte im Profil, mit Möglichkeit, einzelne Sitzungen remote abzumelden.
- 🔴 Passwort-Reset-Flow ohne Account-Enumeration: identische Antwort/Zeitverhalten unabhängig davon, ob die E-Mail existiert; Reset-Token kryptografisch zufällig, einmalig nutzbar, kurze Ablaufzeit.
- 🔴 Benachrichtigung an die alte E-Mail-Adresse bei sicherheitsrelevanten Änderungen (E-Mail, Passwort, MFA).
- 🟡 Für ältere Nutzer: dokumentierter, nicht rein self-service basierter Support-Weg für Account-Wiederherstellung.

### 3.7 Betrieb & Reaktion
- 🔴 Zentrales Logging/Monitoring (Sentry), ohne PII im Klartext in Logs.
- 🔴 Dokumentierter Incident-Response-Plan, 72-Stunden-Meldepflicht bei Datenpanne.
- 🔴 Regelmäßige, getestete Backups (Restore tatsächlich einmal durchspielen).
- 🟡 Externer Penetrationstest vor Anbindung echter Bankdaten (Phase 5).
- 🟡 SIEM/erweiterte Anomalie-Erkennung erst bei nennenswertem Nutzerwachstum.

### 3.8 Teststrategie
- 🔴 `pytest-django` für Unit- und Integrationstests.
- 🔴 Unit-Tests für jede Finanzberechnung (Budgetsummen, Kategorisierung, wiederkehrende Ausgaben).
- 🔴 Integrationstests für die Autorisierungsregeln aus 3.2 (fremder Haushalt darf nicht zugreifen).
- 🟡 End-to-End-Tests (Playwright/Cypress) für Kernflows, 🟡 automatisierte Barrierefreiheits-Checks (axe-core).

---

## 4. Performance & Skalierung

- 🔴 Datenbank: Indizierung häufig gefilterter Felder, Connection Pooling (PgBouncer) sobald PostgreSQL im Einsatz ist.
- 🔴 Caching: Redis für häufige, wenig volatile Abfragen.
- 🟡 Celery erst, wenn ein konkretes Feature es zwingend braucht (siehe Abschnitt 1).
- 🔴 Angular: Lazy Loading pro Modul, Signals/OnPush.
- 🟡 Angular Universal (SSR): weiterhin nicht für den MVP — SEO-Vorteil betrifft nur die öffentliche Landingpage, nicht die login-pflichtige App; zusätzliche Infrastruktur/SSRF-Risiko.
- 🔴 PWA-Fähigkeit für Offline-Zugriff, 🔴 Containerisierung (Docker) von Anfang an, 🟡 CDN sobald nennenswerter Nutzerkreis besteht.

---

## 5. Versteckte Kosten — bevor sie überraschen

### 5.1 Laufende Infrastrukturkosten
| Position | Warum es leicht übersehen wird |
|---|---|
| Managed PostgreSQL-Hosting | Lokal kostenlos (auch schon in der Dev-Phase via Docker), in Produktion ein laufender monatlicher Posten |
| Managed Redis-Hosting | Gleiches Muster |
| E-Mail-Versand (Passwort-Reset, Erinnerungen) | Braucht einen transaktionalen E-Mail-Dienst — wegen DSGVO/EU-Hosting-Anspruch aus dem Gesamtkonzept sollte das ein EU-basierter Anbieter sein, was die Auswahl einschränkt |
| WAF/CDN (Cloudflare o. ä.) | Free Tier reicht anfangs, wird bei Wachstum kostenpflichtig |
| Backup-Speicher | Verschlüsselte Backups brauchen eigenen Speicherplatz, bei EU-Redundanz ggf. gespiegelt |
| Sentry/Error-Tracking | Kostenloses Kontingent ist schnell aufgebraucht bei mehreren Umgebungen |
| Banking-Aggregator (FinAPI/Tink) | Laufende Kosten pro Nutzer/Abfrage, nicht einmalig |

### 5.2 Einmalige, aber unterschätzte Kosten
| Position | Warum es leicht übersehen wird |
|---|---|
| Externe Rechtsberatung (AGB, Datenschutzerklärung, Impressum) | Vorlagen reichen bei Finanzdaten-App nicht aus |
| BFSG-Barrierefreiheitserklärung + externer WCAG-Audit | Automatisierte Tests decken nur einen Teil ab |
| Penetrationstest vor Banking-Anbindung | Mehrere tausend Euro realistisch |
| Professionelle Übersetzung von Rechtstexten | Automatische Übersetzung für rechtlich bindende Dokumente nicht vertretbar |
| Apple-Entwicklerkonto (99 $/Jahr) + Google-Play-Gebühr (25 $ einmalig) | — |

### 5.3 Leicht übersehene Zeit-/Betriebskosten
| Position | Warum es leicht übersehen wird |
|---|---|
| Django-Admin anpassen/absichern | Kommt kostenlos mit, aber "absichern und sinnvoll konfigurieren" ist trotzdem Aufwand, nicht null |
| iOS-Build-Infrastruktur | Xcode-Builds brauchen macOS — ohne eigenen Mac braucht es einen Mac-Cloud-Dienst |
| Zero-Downtime-Migrationsplanung | Django-Migrationen gegen eine Produktionsdatenbank mit echten Nutzerdaten brauchen mehr Sorgfalt als gegen eine leere Dev-DB |
| Python-Dependency-Pflege | Geringeres, aber nicht null Risiko — `pip-audit` regelmäßig laufen lassen, nicht nur einmalig einrichten |

---

## 6. Offene Punkte vor Implementierungsstart

- Rollen-/Rechtemodell für Mehrpersonenhaushalte final klären (siehe 2.3) — Voraussetzung für die `HouseholdScopedPermission` aus 3.2.
- Vollständiges Django-Datenmodell auf Basis der Skizze in 2.3 ausarbeiten, inkl. Soft-Delete-Manager.
- API-Vertrag (DRF-ViewSets vs. reine Function-Based-Views) und Versionierungsstrategie festlegen.
- Entscheidung Capacitor vs. native final treffen — unverändert.
- Lokale Entwicklungsumgebung von Anfang an mit PostgreSQL in Docker aufsetzen, um den in 2.2 beschriebenen Migrationsschritt komplett zu vermeiden.
- Kurzes Threat-Modeling (STRIDE) vor Implementierungsstart.
- Zwei GitHub-Repos anlegen (`4inone-frontend`, `4inone-backend`) statt Monorepo — siehe Abschnitt 1.1.
- Entscheiden, ob Swagger UI (Abschnitt 2.4) über eine reine `DEBUG`-Prüfung oder zusätzlich über eine eigene Berechtigungsklasse abgesichert wird, bevor die erste Staging-Umgebung öffentlich erreichbar ist.