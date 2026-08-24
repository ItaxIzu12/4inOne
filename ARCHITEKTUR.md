# Architekturkonzept: All-in-One-Lebensmanagement-App
## Finanzen · Organisation · Haushalt

*Dieses Dokument ergänzt das `Gesamtkonzept_AllInOne_App.md` (Vision, Markt, Zielgruppen, Recht, Roadmap) um die technische Umsetzung: Tech-Stack, Architektur-Prinzipien, Security und Performance/Skalierung.*

*Version 5 — Django/Python-Backend (unverändert aus Version 4), ergänzt um einen systematischen Sicherheits-Check nach konkreten Anwendungsfällen (Abschnitt 3.9) sowie Verweise auf die konkreten Finanz-Differenzierungsfeatures aus dem Gesamtkonzept.*

---

## 0. Ehrliche Gesamteinschätzung

### 0.1 Entscheidung endgültig
Django/Python ist die finale Backend-Entscheidung für dieses Projekt — nicht die dritte Zwischenstation, sondern der Stand, auf dem aufgebaut wird. Siehe auch `Gesamtkonzept.md`, Abschnitt "Entscheidungen, die nicht mehr offen sind" für die vollständige Liste festgelegter Grundsatzentscheidungen.

### 0.2 SQLite vs. PostgreSQL — unverändert, hier nochmal klar gestellt
**SQLite ist ausschließlich für die lokale Einzelentwickler-Umgebung vorgesehen, nicht als Zwischenschritt in Produktion.** SQLite schreibt mit einem einzigen Writer-Lock — sobald mehr als eine Person gleichzeitig schreibend zugreift (Staging mit Testnutzern, Beta, Produktion), entstehen Fehler oder Wartezeiten. **PostgreSQL ist Pflicht ab dem Moment, in dem mehr als eine Person auf dieselbe Datenbank zugreift.** Details siehe Abschnitt 2.2.

### 0.3 Priorisierung
🔴 = MVP-Pflicht, 🟡 = bewusst später.

---

## 1. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Frontend | Angular (bestehend) | unverändert |
| Backend-Framework | 🔴 **Django** + Django REST Framework (DRF) | "batteries included": ORM, Auth-Grundgerüst, Admin-Oberfläche, Migrations |
| Sprache Backend | 🔴 Python | — |
| ORM | 🔴 Django-ORM (eingebaut) | parametrisierte Queries strukturell gegen SQL-Injection |
| Datenbank (lokal) | 🔴 SQLite | **nur** für die eigene lokale Entwicklung |
| Datenbank (Staging/Produktion) | 🔴 **PostgreSQL, ab dem ersten Mehrbenutzerzugriff verpflichtend** | siehe 2.2 |
| Auth | 🔴 `django-allauth` | Registrierung, Login, MFA-Erweiterung über `django-otp` |
| API-Layer | 🔴 Django REST Framework (DRF) | Grundlage für Autorisierung in 3.2 |
| JWT-Handling | 🔴 `djangorestframework-simplejwt` | Access-/Refresh-Token-Ausstellung, Rotation |
| Passwort-Hashing | 🔴 Argon2 über `PASSWORD_HASHERS` | nativ eingebaut |
| Rate-Limiting / Brute-Force | 🔴 `django-axes` | Account-Lockout, plus endpunktspezifische Regeln — siehe 3.9 |
| Security-Header | 🔴 Djangos `SECURE_*`-Settings + `django-csp` | siehe 3.4 |
| Caching / Sessions | 🔴 Redis | — |
| Hintergrundjobs | 🟡 Celery + Redis | erst bei konkretem Bedarf |
| Admin-Oberfläche | 🔴 Django-Admin (mitgeliefert) | absichern, siehe 3.4 |
| Testing | 🔴 `pytest-django` | — |
| Mobile App | 🔴 Angular + Capacitor | — |
| API-Dokumentation | 🔴 `drf-spectacular` + Swagger UI | mit Sicherheitsauflage, siehe 2.4 |
| E-Mail-Versand | 🔴 EU-basierter transaktionaler Dienst | für Passwort-Reset/Erinnerungen, DSGVO-Anspruch |

### 1.1 Repo-Struktur: getrennte Repos statt Monorepo
Zwei getrennte Repositories (`4inone-frontend`, `4inone-backend`), jeweils eigene CI/CD. Python und TypeScript teilen keine Typen — die dadurch fehlende "automatische Synchronität" wird über das OpenAPI-Schema aus Abschnitt 2.4 kompensiert (generierter TypeScript-Client), nicht über ein gemeinsames Repo.

---

## 2. Architektur-Prinzipien

### 2.1 Modularer Aufbau — Django-Apps, deutsch benannt
```
backend/
  core/           # User, Household/Familie, Rollen & Rechte, Notifications
  finanzen/       # Konten, Transaktionen, Budgets, Kategorien
  haushalt/       # Einkaufsliste, Aufgaben, Pläne
  organisation/   # Kalender, To-dos, Erinnerungen
  integrations/   # Banking-API-Anbindung (später), Kalender-Sync
```
Kein Event-Bus im MVP. Apps rufen sich über direkt importierte Service-Funktionen auf. Ein Signal-/Event-System erst einführen, wenn mehrere unabhängige Konsumenten pro Ereignis existieren.

**Hinweis zu den Finanz-Differenzierungsfeatures aus dem Gesamtkonzept** (Einkauf-zu-Ausgabe-Moment, Fairness-Anzeige, Abo-Radar): Diese laufen alle über bestehende Service-Aufrufe zwischen `haushalt` und `finanzen` — kein neues architektonisches Konzept nötig. Der Einkauf-zu-Ausgabe-Moment ruft z. B. `finanzen.services.create_transaction_from_shopping_list()` auf, sobald eine `ShoppingList` als erledigt markiert wird; die Fairness-Anzeige ist eine reine Aggregations-Abfrage über bestehende `Transaction`-Datensätze pro `HouseholdMembership`, kein zusätzliches Datenmodell.

### 2.2 PostgreSQL — die wichtigste technische Festlegung dieses Dokuments
- **Lokale Entwicklung (nur du):** SQLite ist in Ordnung.
- **Sobald eine zweite Person testet oder die App online erreichbar ist:** PostgreSQL ist Pflicht.
- **Praktischer Ausweg:** von Anfang an lokal mit PostgreSQL in Docker entwickeln, dann entfällt der Migrationsschritt komplett.

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
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, related_name="+", on_delete=models.SET_NULL)
    joined_at = models.DateTimeField(auto_now_add=True)

class HouseholdInvite(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    token = models.CharField(max_length=64, unique=True)  # kryptografisch zufällig, siehe 3.9
    email = models.EmailField()
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

class Account(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE)

class Transaction(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.ForeignKey("Category", on_delete=models.PROTECT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)  # für Fairness-Anzeige & Audit
    deleted_at = models.DateTimeField(null=True, blank=True)  # Soft-Delete
```

**Neu gegenüber Version 4:** `HouseholdInvite` als eigenes Model (schließt die Einladungs-Sicherheitslücke aus 3.9), `created_by` auf `Transaction` (Voraussetzung für die Fairness-Anzeige aus dem Gesamtkonzept — ohne dieses Feld lässt sich "wer hat wie viel eingebracht" nicht berechnen).

**Weiterhin gültig — Löschung vs. Aufbewahrungspflicht:** Das `deleted_at`-Feld bleibt Pflicht für Finanzdatensätze (§ 257 HGB, § 147 AO). Über einen custom `Manager` umgesetzt, der gelöschte Objekte standardmäßig ausblendet.

### 2.4 Interaktive API-Dokumentation (Swagger UI)
`drf-spectacular` generiert aus DRF-Code automatisch ein OpenAPI-3-Schema, daraus eine interaktive Swagger-UI-Seite mit Token-Autorisierung.

**🔴 Sicherheitsauflage:** Nur aktivieren, wenn `DEBUG=True`, oder zusätzlich hinter eigener Berechtigung/IP-Beschränkung verstecken. Niemals ungeschützt in Produktion.

**Zusatznutzen:** TypeScript-Client für Angular aus demselben Schema generierbar (`openapi-typescript-codegen`) — bringt Typsicherheit zurück, ohne Monorepo.

---

## 3. Cybersecurity-Konzept

### 3.1 Authentifizierung & Zugriff
- 🔴 `django-allauth` für Registrierung/Login.
- 🔴 MFA verpflichtend für Finanzfunktionen (`django-otp`, TOTP-basiert).
- 🟡 Passkeys/WebAuthn zusätzlich.
- 🔴 Token-Speicherung: JWTs nicht in `localStorage`. Access-Token im Speicher, Refresh-Token als `httpOnly`/`Secure`/`SameSite=Strict`-Cookie.
- 🔴 Cookie-/CORS-Domain-Konfiguration exakt auf die Deployment-Topologie abstimmen (`django-cors-headers`, kein Wildcard).
- 🔴 Refresh-Token-Rotation, Blacklist über Redis.
- 🔴 Rate-Limiting & Account-Lockout (`django-axes`) — **differenziert nach Endpunkt, siehe 3.9**, nicht nur global.
- 🔴 Passwort-Hashing mit Argon2.

### 3.2 Autorisierung — weiterhin die wichtigste Lücke, wenn sie fehlt
- 🔴 Object-Level-Authorization auf jedem Endpunkt mit ID-Parameter, über wiederverwendbare `HouseholdScopedPermission`.
- 🔴 Rollenmodell serverseitig durchsetzen, nicht nur im Frontend verstecken.
- 🔴 **Zugriffsentzug bei Mitglieder-Entfernung ist sofort wirksam**, weil `HouseholdScopedPermission` bei jedem Request live gegen die Datenbank prüft — kein zusätzlicher Mechanismus nötig, aber explizit testen (siehe 3.9).
- 🟡 Automatisierte Tests: "Nutzer aus fremdem Haushalt bekommt 403/404".

### 3.3 Datenschutz & Verschlüsselung
- 🔴 TLS 1.3, HSTS.
- 🔴 Field-Level-Encryption für Finanzdaten at rest.
- 🔴 Schlüsselmanagement getrennt vom DB-Zugang, mit Rotationsstrategie.
- 🔴 Datenminimierung, 🟡 Pseudonymisierung für Analytics.
- 🔴 Recht auf Löschung/Export — mit Soft-Delete-Ausnahme für Finanzdaten und **Rate-Limit auf dem Export-Endpunkt** (siehe 3.9).

### 3.4 Absicherung der Anwendung (OWASP-orientiert)
- 🔴 Django-ORM konsequent, keine Raw-SQL-Konkatenation.
- 🔴 CSRF-Schutz, CORS ohne Wildcard.
- 🔴 Content-Security-Policy konkret (`django-csp`).
- 🔴 Django-Hardening: `DEBUG=False`, `ALLOWED_HOSTS`, `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `X_FRAME_OPTIONS='DENY'`.
- 🔴 Django-Admin absichern: eigener Pfad, IP-Allowlist/VPN, eigenes MFA.
- 🔴 WAF/API-Gateway, Rate-Limiting auf allen schreibenden Endpunkten.
- 🔴 Dependency-Scanning (`pip-audit`).
- 🔴 Secrets nur über Umgebungsvariablen (`django-environ`).
- 🟡 Lieferketten-/CI-CD-Sicherheit.

### 3.5 Mobile-spezifisch (Capacitor) — unverändert
Keychain/Keystore-Speicherung, Certificate Pinning, WebView-Härtung.

### 3.6 Session-Management & Account-Recovery — unverändert
Aktive Sitzungen einsehbar/abmeldbar, enumerationssicherer Passwort-Reset, Benachrichtigung bei sicherheitsrelevanten Änderungen, dokumentierter Support-Weg für ältere Nutzer.

### 3.7 Betrieb & Reaktion
- 🔴 Logging/Monitoring (Sentry) ohne PII im Klartext.
- 🔴 Incident-Response-Plan, 72-Stunden-Meldepflicht.
- 🔴 Getestete Backups.
- 🔴 **Backup-Restore-Hygiene (neu):** Wird ein Produktions-Backup in eine Staging-/Dev-Umgebung eingespielt (z. B. zum Debuggen eines Fehlers), muss es vorher anonymisiert/pseudonymisiert werden — Staging-Umgebungen haben typischerweise schwächere Zugriffskontrollen als Produktion, ein unbedachter Restore ist ein realer, oft übersehener Datenleck-Vektor.
- 🟡 Externer Penetrationstest vor Banking-Anbindung.
- 🟡 SIEM erst bei nennenswertem Wachstum.

### 3.8 Teststrategie
- 🔴 `pytest-django` für Unit-/Integrationstests.
- 🔴 Unit-Tests für jede Finanzberechnung (inkl. Fairness-Anzeige-Berechnung — Rundungsfehler bei Prozentanzeigen sind ein reales, leicht übersehenes Bug-Risiko).
- 🔴 Integrationstests für Autorisierungsregeln aus 3.2.
- 🟡 End-to-End-Tests, 🟡 automatisierte Barrierefreiheits-Checks.

### 3.9 Sicherheitsabdeckung nach Anwendungsfall — systematischer Check

Diese Tabelle prüft nicht nach Themen, sondern nach **konkreten Situationen, die tatsächlich eintreten werden** — das deckt Lücken auf, die eine reine Kategorienliste übersieht.

| Anwendungsfall | Status vor diesem Check | Maßnahme |
|---|---|---|
| Login/Registrierung | 🔴 Abgedeckt | siehe 3.1 |
| Passwort-Reset | 🔴 Abgedeckt | siehe 3.6 |
| **Haushaltsmitglied einladen** | ⚠️ War nicht abgedeckt | **Neu:** `HouseholdInvite`-Token kryptografisch zufällig (`secrets.token_urlsafe(32)`), nicht erratbar, mit Ablaufzeit (z. B. 7 Tage) und Einmal-Nutzung. Die Einladungsseite darf **nicht** verraten, ob die eingeladene E-Mail bereits ein Konto hat (sonst Account-Enumeration über einen zweiten Weg). Rate-Limit auf das Versenden von Einladungen pro Haushalt/Zeitfenster, sonst Spam-Missbrauch. |
| **Haushaltsmitglied entfernen** | ⚠️ War nicht explizit getestet | Zugriffsentzug ist durch die live-DB-Prüfung in `HouseholdScopedPermission` sofort wirksam (kein Caching der Mitgliedschaft über die Anfrage hinaus) — **muss aber als expliziter Testfall existieren**, nicht nur implizit angenommen werden. Zusätzlich: bestehende Access-Tokens des entfernten Mitglieds proaktiv in die Redis-Blacklist aufnehmen, damit der Entzug nicht erst beim nächsten Token-Refresh greift. |
| MFA-Einrichtung | 🔴 Abgedeckt | siehe 3.1 |
| **MFA-Verifizierung — Brute-Force auf den OTP-Code** | ⚠️ War nicht abgedeckt | Eigenes, strengeres Rate-Limit auf dem TOTP-Verifizierungs-Endpunkt (z. B. 5 Versuche/5 Minuten), getrennt vom allgemeinen Login-Rate-Limit — ein 6-stelliger Code ist brute-forcebar, wenn er nicht separat geschützt ist. |
| **Registrierungs-Spam/Fake-Konten** | ⚠️ War nicht abgedeckt | E-Mail-Verifizierung vor vollem Funktionsumfang (Double-Opt-in), plus Rate-Limit auf den Registrierungs-Endpunkt pro IP. |
| API-Dokumentation (Swagger) | 🔴 Abgedeckt | siehe 2.4 |
| **Datenexport (DSGVO Art. 20)** | ⚠️ Nur beiläufig erwähnt | Eigener Export-Endpunkt (JSON/CSV) — **muss selbst rate-limitiert sein**, sonst lässt er sich zum wiederholten Bulk-Abgreifen aller Haushaltsdaten missbrauchen, auch mit gültigem Token. |
| **Wer hat eine Finanzbuchung geändert? (Audit-Trail)** | ⚠️ War nicht abgedeckt | 🟡 Für Mehrpersonenhaushalte relevant fürs Vertrauen ("wer hat diese Ausgabe bearbeitet"), nicht MVP-kritisch, aber `created_by`/`updated_by`-Felder jetzt schon im Datenmodell vorsehen (siehe 2.3), damit die Funktion später ohne Migration nachrüstbar ist. |
| **Zukünftige Banking-Webhooks (Phase 5)** | ⚠️ War nicht abgedeckt | 🟡 Signaturprüfung eingehender Webhooks von FinAPI/Tink zwingend vor Verarbeitung (Payload sonst gefälscht einspielbar) — jetzt dokumentieren, damit es in Phase 5 nicht vergessen wird. |
| **Gleichzeitige Bearbeitung derselben Einkaufsliste** | ⚠️ War nicht abgedeckt (kein Security-, aber Integritätsrisiko) | 🟡 Optimistic Locking (Versionsfeld) für gemeinsam bearbeitete Objekte, verhindert stille Überschreibungen bei zwei gleichzeitigen Bearbeitern — kein MVP-Blocker, aber vormerken. |
| Backup/Restore | 🔴 War abgedeckt, aber unvollständig | siehe 3.7, neu ergänzt um Staging-Anonymisierung |
| Admin-Panel-Zugriff | 🔴 Abgedeckt | siehe 3.4 |

**Kurz zusammengefasst:** Fünf echte Lücken neu geschlossen (Einladungs-Sicherheit, Mitglieder-Entzug als Testfall, MFA-Brute-Force, Registrierungs-Spam, Export-Rate-Limit), zwei als bewusst spätere Punkte vorgemerkt (Audit-Trail, Webhook-Signaturen), eine Dateninteritätsfrage ergänzt (Concurrent Editing).

---

## 4. Performance & Skalierung

- 🔴 Datenbank: Indizierung, Connection Pooling (PgBouncer).
- 🔴 Caching: Redis.
- 🟡 Celery erst bei Bedarf.
- 🔴 Angular: Lazy Loading, Signals/OnPush.
- 🟡 Angular Universal (SSR): weiterhin nicht für den MVP.
- 🔴 PWA-Fähigkeit, 🔴 Containerisierung (Docker), 🟡 CDN sobald nennenswerter Nutzerkreis besteht.

---

## 5. Versteckte Kosten — bevor sie überraschen

### 5.1 Laufende Infrastrukturkosten
| Position | Warum es leicht übersehen wird |
|---|---|
| Managed PostgreSQL-Hosting | Lokal kostenlos, in Produktion laufender Posten |
| Managed Redis-Hosting | Gleiches Muster |
| E-Mail-Versand (EU-basiert) | Wegen DSGVO-Anspruch eingeschränkte Anbieterauswahl |
| WAF/CDN | Free Tier anfangs, kostenpflichtig bei Wachstum |
| Backup-Speicher | Verschlüsselt, bei EU-Redundanz gespiegelt |
| Sentry/Error-Tracking | Kostenloses Kontingent schnell aufgebraucht |
| Banking-Aggregator (FinAPI/Tink) | Laufend pro Nutzer/Abfrage |

### 5.2 Einmalige, aber unterschätzte Kosten
| Position | Warum es leicht übersehen wird |
|---|---|
| Externe Rechtsberatung | Vorlagen reichen bei Finanzdaten-App nicht |
| BFSG-Audit | Automatisierte Tests decken nur Teil ab |
| Penetrationstest vor Banking-Anbindung | Mehrere tausend Euro realistisch |
| Übersetzung von Rechtstexten | Automatisch nicht vertretbar |
| Apple/Google-Entwicklerkonten | 99 $/Jahr + 25 $ einmalig |

### 5.3 Leicht übersehene Zeit-/Betriebskosten
| Position | Warum es leicht übersehen wird |
|---|---|
| Django-Admin absichern | Kommt kostenlos mit, Absicherung nicht |
| iOS-Build-Infrastruktur | Braucht macOS |
| Zero-Downtime-Migrationsplanung | Bei echten Nutzerdaten heikler als bei leerer Dev-DB |
| Python-Dependency-Pflege | `pip-audit` regelmäßig, nicht einmalig |

---

## 6. Offene Punkte vor Implementierungsstart

- Rollen-/Rechtemodell für Mehrpersonenhaushalte final klären.
- Vollständiges Django-Datenmodell ausarbeiten, inkl. `HouseholdInvite` und Soft-Delete-Manager.
- API-Vertrag (ViewSets vs. Function-Based-Views) und Versionierungsstrategie festlegen.
- Entscheidung Capacitor vs. native final treffen.
- Lokale Entwicklungsumgebung von Anfang an mit PostgreSQL in Docker aufsetzen.
- Kurzes Threat-Modeling (STRIDE) vor Implementierungsstart — jetzt mit den Anwendungsfällen aus 3.9 als konkreter Ausgangspunkt.
- Zwei GitHub-Repos anlegen.
- Rate-Limit-Konfiguration pro Endpunkt-Typ festlegen (Login, MFA-Verifizierung, Registrierung, Export, Einladungsversand — siehe 3.9), bevor der erste Endpunkt live geht.