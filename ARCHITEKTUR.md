# Architekturkonzept: All-in-One-Lebensmanagement-App
## Finanzen · Organisation · Haushalt

*Dieses Dokument ergänzt das `Gesamtkonzept_AllInOne_App.md` (Vision, Markt, Zielgruppen, Recht, Roadmap) um die technische Umsetzung: Tech-Stack, Architektur-Prinzipien, Security und Performance/Skalierung.*

*Version 6 — ergänzt um Abschnitt 3.10 "Solo-Betrieb & Self-Hosting": sechs Schwachstellen, die spezifisch auftreten, wenn das Projekt zunächst nur für den persönlichen Gebrauch (kein Mehrbenutzer-SaaS-Betrieb) läuft. Vorherige Abschnitte (Django-Backend, Sicherheits-Anwendungsfall-Check) unverändert aus Version 5.*

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

### 3.10 Solo-Betrieb & Self-Hosting — Schwachstellen bei rein persönlicher Nutzung

Alle bisherigen Abschnitte gingen von einem wachsenden Mehrbenutzer-Produkt aus. Wird die App zunächst **nur für den eigenen Gebrauch** betrieben (kein SaaS, kein Team, kein Support), ändert sich das Risikoprofil an sechs konkreten Stellen — teils entstehen neue Lücken, teils werden bestehende Anforderungen wichtiger statt überflüssig. **Ausdrücklich nicht vereinfachen:** Autorisierung, Passwort-Hashing, JWT-Handling und Soft-Delete bleiben unverändert Pflicht, auch bei einem einzigen Nutzer — eine Berechtigungsprüfung, die "vertraut, weil eh nur du zugreifst", ist falsch gebaut, sobald sie einmal gebraucht wird (Bug, versehentlicher Mitzugriff, spätere Erweiterung um Haushaltsmitglieder).

1. 🔴 **MFA-Wiederherstellung ohne Support-Team.** Bei SaaS mit Team gibt es einen Menschen, der bei Geräteverlust hilft. Als alleiniger Nutzer und Betreiber gibt es niemanden — Verlust des MFA-Geräts kann zum Selbst-Aussperren aus den eigenen Finanzdaten führen. **Maßnahme:** Einmalige TOTP-Backup-Codes bei MFA-Einrichtung generieren (Standard-Django-OTP-Funktion), verschlüsselt speichern, dem Nutzer zum Ausdrucken/Offline-Aufbewahren anzeigen — genau einmal, danach nicht erneut abrufbar.

2. 🔴 **Fernzugriff-Architektur fehlte komplett — dringend vor dem ersten Deployment klären.** Drei Optionen mit sehr unterschiedlichem Risiko:
   - ❌ Port-Forwarding am Heimrouter direkt zum Django-Server: höchstes Risiko — ungepatchte Consumer-Router-Firmware, öffentliche IP wird von automatisierten Scannern gefunden, die gezielt nach offenen Django-/Postgres-Ports suchen.
   - 🟡 Echter VPS (Hetzner, DigitalOcean o. ä.): sicherer, aber laufende Kosten (siehe 5.1) und eigene Verantwortung für OS-Patches.
   - ✅ **Empfohlen für den Solo-Anwendungsfall: VPN-Tunnel zum Heimnetz (Tailscale/WireGuard).** Kein offener Port im öffentlichen Internet, trotzdem von unterwegs erreichbar, deutlich kleinere Angriffsfläche als beide anderen Optionen.

3. 🔴 **Geräte-Sicherheit war nirgends dokumentiert, ist jetzt das eigentlich schwächste Glied.** Die gesamte bisherige Architektur behandelt Server-/App-Sicherheit — bei einem einzigen Nutzer verlagert sich das größte Risiko auf das genutzte Endgerät selbst (gestohlener/ungesperrter Laptop oder Handy mit aktiver "Angemeldet bleiben"-Sitzung). Bei SaaS mit vielen Nutzern verteilt sich dieses Risiko, hier trägt ein einzelnes Gerät die gesamte Last. **Maßnahme:** Voraussetzung dokumentieren, dass jedes genutzte Endgerät selbst verschlüsselt (Festplattenverschlüsselung) und mit Sperrcode/biometrischer Sperre gesichert sein muss — das ist keine reine Formsache, sondern eine explizite Betriebsvoraussetzung.

4. 🔴 **Monitoring/Login-Benachrichtigung — Begründung verschiebt sich, Pflicht bleibt bestehen.** In Abschnitt 3.7 ursprünglich für professionellen Betrieb vorgesehen. Für Solo-Nutzung ist die eigentliche Begründung: **Niemand außer dir bemerkt einen ungewöhnlichen Login-Versuch.** Ohne mindestens eine einfache Benachrichtigung (E-Mail bei Login von neuem Gerät/unbekannter IP) bleibt ein Einbruchsversuch möglicherweise unbemerkt, bis Schaden entsteht.

5. 🟡 **Repository-Sichtbarkeit.** Trivial, aber real: Solo-/Hobby-Repos landen leicht versehentlich öffentlich statt privat auf GitHub. Bei einer Finanz-App das Repository konsequent **privat** halten — nicht weil der Code selbst geheim sein muss, sondern weil öffentlicher Code kombiniert mit einem einzigen vergessenen `.env`-Commit das Gesamtrisiko unnötig erhöht.

6. 🟡 **Patch-Disziplin ohne äußeren Zwang.** Bei einer SaaS mit Nutzern erzwingt der Betrieb selbst eine Update-Kadenz. Bei Solo-Betrieb besteht die reale Gefahr, dass `pip-audit` einmal eingerichtet, aber nie wieder ausgeführt wird. **Maßnahme:** Dependabot so konfigurieren, dass Sicherheits-Updates automatisch als PR erstellt und nach grünem CI-Lauf automatisch gemerged werden, statt auf manuelle Ausführung zu vertrauen.

**Was bewusst NICHT als Schwachstelle gilt:** Die `HouseholdInvite`-Logik, das Rollenmodell und die Mehrpersonen-Rate-Limits aus 3.9 jetzt zu entfernen, weil aktuell nur eine Person die App nutzt. Diese Architektur kostet im Ruhezustand nichts und erspart einen späteren Umbau, falls doch einmal ein Haushaltsmitglied dazukommt — nicht ausbauen, aber stehen lassen.

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
| VPS oder VPN-Dienst für Fernzugriff (Solo-Betrieb, siehe 3.10) | Auch ohne Nutzerwachstum nötig, sobald Zugriff von unterwegs gewünscht ist |

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
- Fernzugriffs-Architektur für den Solo-Betrieb festlegen (empfohlen: VPN-Tunnel via Tailscale/WireGuard, siehe 3.10) — vor dem ersten Deployment außerhalb des eigenen lokalen Netzwerks.
- MFA-Backup-Codes-Generierung implementieren, bevor MFA aktiv genutzt wird (siehe 3.10).
- GitHub-Repository-Sichtbarkeit auf privat prüfen/setzen (siehe 3.10).