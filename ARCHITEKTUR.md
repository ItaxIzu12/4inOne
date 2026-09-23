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
  reisen/         # Reiseziel, Reisebudget, Packliste, Dokumente, Buchungen — NEU, vierter gleichrangiger Bereich
  connections/    # Connection Engine — verknüpft Datensätze modulübergreifend, siehe 2.1b
  integrations/   # Banking-API-Anbindung (später), Kalender-Sync
```
Kein Event-Bus im MVP für die drei bestehenden Kernmodule (Finanzen/Haushalt/Organisation). Apps rufen sich über direkt importierte Service-Funktionen auf. **Für Reisen und die Connection Engine gilt das erweitert** — siehe 2.1b, da hier mehrere unabhängige Konsumenten pro Ereignis existieren (eine Reise erzeugt gleichzeitig Budget, Kalendertermine, Packliste, Haushaltsaufgaben-Anpassung), was laut eigener Regel genau der Schwellenwert ist, ab dem ein Signal-/Event-System gerechtfertigt ist.

**Hinweis zu den Finanz-Differenzierungsfeatures aus dem Gesamtkonzept** (Einkauf-zu-Ausgabe-Moment, Fairness-Anzeige, Abo-Radar): Diese laufen alle über bestehende Service-Aufrufe zwischen `haushalt` und `finanzen` — kein neues architektonisches Konzept nötig. Der Einkauf-zu-Ausgabe-Moment ruft z. B. `finanzen.services.create_transaction_from_shopping_list()` auf, sobald eine `ShoppingList` als erledigt markiert wird; die Fairness-Anzeige ist eine reine Aggregations-Abfrage über bestehende `Transaction`-Datensätze pro `HouseholdMembership`, kein zusätzliches Datenmodell.

### 2.1b Connection Engine — neues, zentrales Architekturprinzip für 4inOne

**Kernidee (aus der Produktbeschreibung):** Eine Information wird einmal eingegeben und ist danach über mehrere Module hinweg sichtbar/verknüpft, ohne Duplizierung. Beispiel: Ein Reisebudget gehört gleichzeitig zu `reisen` UND `finanzen` — es wird nicht zweimal angelegt.

**Technischer Ansatz:** Ein zentrales `Connection`-Model (in der neuen `connections`-App), das lose zwei beliebige Objekte über Content-Types verknüpft:

```python
class Connection(models.Model):
    household = models.ForeignKey('core.Household', on_delete=models.CASCADE)
    von_content_type = models.ForeignKey(ContentType, related_name='+', on_delete=models.CASCADE)
    von_object_id = models.PositiveIntegerField()
    von_objekt = GenericForeignKey('von_content_type', 'von_object_id')
    zu_content_type = models.ForeignKey(ContentType, related_name='+', on_delete=models.CASCADE)
    zu_object_id = models.PositiveIntegerField()
    zu_objekt = GenericForeignKey('zu_content_type', 'zu_object_id')
    beziehungstyp = models.CharField(max_length=50)  # z. B. "reise_budget", "reise_kalendereintrag"
    erstellt_am = models.DateTimeField(auto_now_add=True)
```

**Warum Generic Relations statt fester Fremdschlüssel pro Modul-Paar:** Ohne dieses Muster bräuchte jede neue Verknüpfungsart (Reise↔Budget, Reise↔Kalender, Reise↔Haushaltsaufgabe, später vielleicht Haushalt↔Kalender) ein eigenes Zwischenmodell — bei vier Modulen mit wachsenden Kreuzverbindungen skaliert das schlecht. Eine generische Connection-Tabelle wächst nicht mit der Anzahl der Modul-Paare, sondern bleibt eine einzige Tabelle.

**Sicherheitskonsequenz:** `HouseholdScopedPermission` muss beim Auflösen einer Connection **beide** verknüpften Objekte prüfen, nicht nur eines — sonst könnte über eine Connection ein Objekt aus einem fremden Haushalt sichtbar werden, selbst wenn das direkt angefragte Objekt korrekt zum eigenen Haushalt gehört.

### 2.1c Automation Engine — Vorschläge vor Automatisierung (MVP-Abgrenzung)

Aus der Produktbeschreibung: kontextbezogene Vorschläge ("Deine Reise beginnt in 5 Tagen, Packliste öffnen?"), die der Nutzer bestätigt oder ablehnt — **keine automatische Ausführung ohne Zustimmung im MVP.** Technisch: eine `Suggestion`-Tabelle (Regel-Trigger, kein LLM-Aufruf, konsistent mit dem bereits an anderer Stelle festgelegten "keine eingebaute KI"-Prinzip aus dem Analysen-Insights-Ansatz), die bei bestimmten Ereignissen (Reise angelegt, Reise-Startdatum nähert sich) einen Vorschlag-Datensatz erzeugt, den das Frontend anzeigt. **Echte Automatisierungen (mehrstufige automatische Aktionsketten) sind ausdrücklich Post-MVP** — die Produktbeschreibung selbst sagt "Automatisierungen sollen transparent und jederzeit deaktivierbar sein", was ein eigenes Regelwerk und eine eigene Sicherheitsprüfung braucht, nicht im MVP-Rahmen.

### 2.1d Notification Engine

Baut auf dem bereits vorhandenen `core`-App-Notifications-Grundgerüst auf, erweitert um Trigger aus der Automation Engine (2.1c). Kein neues Architekturprinzip, sondern eine Erweiterung des Bestehenden.

### 2.1e Granulare Berechtigungen (Sharing & Permissions) — Erweiterung des bestehenden Rollenmodells

Die Produktbeschreibung verlangt granulare, pro-Bereich vergebbare Rechte (Beispiel: "Kind" hat keinen Finanzen-Zugriff, aber Organisation bearbeiten). Das bestehende `HouseholdMembership.role`-Feld (ADMIN/MEMBER/CHILD_ACCOUNT) reicht dafür NICHT aus — es ist eine einzige Rolle pro Person, keine Pro-Modul-Matrix. Erweiterung nötig:

```python
class ModulBerechtigung(models.Model):
    membership = models.ForeignKey('core.HouseholdMembership', on_delete=models.CASCADE)
    modul = models.CharField(max_length=20, choices=[('finanzen','Finanzen'),('haushalt','Haushalt'),('organisation','Organisation'),('reisen','Reisen')])
    stufe = models.CharField(max_length=20, choices=[('kein_zugriff','Kein Zugriff'),('ansehen','Ansehen'),('bearbeiten','Bearbeiten')])
```
`HouseholdScopedPermission` muss um eine zweite Prüfschicht erweitert werden: nicht nur "gehört zum Haushalt", sondern zusätzlich "hat für dieses Modul mindestens Ansehen/Bearbeiten-Rechte". Das ist eine **echte, nicht triviale Erweiterung** der bestehenden Sicherheitsarchitektur, kein kosmetischer Zusatz — verdient eigene, gründliche Tests (siehe Sicherheits-Anwendungsfall-Muster aus 3.9).

**Lücke im `ModulBerechtigung`-Modell, beim Integrieren der Produktbeschreibung entdeckt — objektbezogene statt modulweite Freigabe:** Die Produktbeschreibung nennt das Beispiel "Freund: Nur Zugriff auf eine gemeinsame Reise." `ModulBerechtigung` regelt Zugriff pro **Modul** (ganz Reisen ja/nein), nicht pro **einzelnem Datensatz** (nur genau diese eine Reise, nicht alle Reisen des Haushalts). Das ist ein struktureller Unterschied — ein "Freund" ist außerdem gar kein vollwertiges `HouseholdMembership`-Mitglied, sondern hätte nur punktuellen Zugriff auf ein einzelnes Reise-Objekt, ohne dem Haushalt selbst beizutreten. **Benötigte Erweiterung, noch nicht im Detail ausgearbeitet:**

```python
class ObjektFreigabe(models.Model):
    # Gibt einer Person punktuellen Zugriff auf EIN Objekt, unabhängig von
    # Haushaltsmitgliedschaft — z. B. "Freund X darf Reise Y ansehen"
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    objekt = GenericForeignKey('content_type', 'object_id')
    stufe = models.CharField(max_length=20, choices=[('ansehen','Ansehen'),('bearbeiten','Bearbeiten')])
```
Nutzt dasselbe Generic-Relation-Muster wie die Connection Engine (2.1b) — bewusst konsistent, nicht zwei unterschiedliche Verknüpfungsansätze im selben System. `HouseholdScopedPermission` bräuchte einen dritten Prüfpfad: "gehört nicht zum Haushalt, aber hat eine explizite `ObjektFreigabe` für genau dieses Objekt". **Als offener Punkt vermerkt (Abschnitt 6), nicht für den MVP-Umfang der vier Kernmodule — relevant erst, wenn "Familie & Freunde" als eigener Bereich ausgearbeitet wird.**

**Randfall Solo-Haushalt (neu, beim Erstellen der Verifikations-Checkliste entdeckt):** Die Fairness-Anzeige setzt mindestens zwei aktive `HouseholdMembership`-Einträge voraus, um überhaupt eine sinnvolle Aussage zu treffen. Bei genau einem Mitglied (`HouseholdMembership.objects.filter(household=household).count() < 2`) zeigt sie zwangsläufig 100 %/0 % oder müsste einen Sonderfall abfangen — beides verwirrend statt hilfreich. **Regel:** Die Fairness-Sektion wird im Frontend komplett ausgeblendet, solange der Haushalt weniger als zwei Mitglieder hat, nicht mit einem Platzhalterwert gefüllt. Das Backend muss diese Zahl trotzdem mitliefern (z. B. als `member_count` im API-Response), damit das Frontend die Entscheidung treffen kann, ohne einen zusätzlichen Request zu brauchen.

**Dieselbe Bedingung, zweite Anwendung — Personen-Zuordnung bei Transaktionen:** In der Übersicht zeigt jede Transaktionszeile zusätzlich zur Kategorie, WER sie eingetragen hat (`created_by`, das Feld existiert bereits für die Fairness-Berechnung — kein neues Backend-Feld nötig). **Regel, identisch zur Fairness-Bedingung:** Bei `member_count < 2` wird die Personen-Angabe weggelassen ("Haushalt" statt "Haushalt · Anna", redundant bei nur einer Person). Ab `member_count >= 2` wird sie angezeigt ("Haushalt · Jonas"). Beide Regeln (Fairness-Sichtbarkeit UND Personen-Anzeige bei Transaktionen) sollten im Frontend auf dieselbe `member_count`-Prüfung zurückgreifen, nicht zwei unabhängige Bedingungen — sonst könnten sie bei einem Bug auseinanderlaufen (z. B. Fairness korrekt ausgeblendet, Personen-Tag versehentlich trotzdem sichtbar).

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
    monthly_income = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # Individuelles monatliches Einkommen — NUR für die Person selbst sichtbar
    # (siehe HouseholdScopedPermission-Erweiterung unten), fließt aber in die
    # Haushalts-Gesamtsumme für "Verfügbares Einkommen" ein (Gesamtkonzept 5.3).

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

class Category(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#5b3fd6")  # Hex-Wert, datengetrieben
    icon_key = models.CharField(max_length=30, default="sonstiges")  # referenziert Frontend-Icon-Komponente
    monthly_goal = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_default = models.BooleanField(default=False)  # verhindert Umbenennen/Löschen der 3 Standard-Kategorien
    # Einfaches Budgetziel, bleibt automatisch von Monat zu Monat bestehen (kein
    # separates Period-Model nötig) — "ausgegeben" wird wie bei Transaction immer
    # live aus der Summe der Transaktionen des laufenden Monats berechnet, nie
    # gespeichert.

class RecurringDeduction(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)  # "Miete", "Netflix", "Fitnessstudio"
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    active = models.BooleanField(default=True)
    # Bewusst KEINE einzelnen Transaction-Datensätze pro Monat — wird live in
    # die "Verfügbares Einkommen"-Berechnung einbezogen (Gesamtkonzept 5.3),
    # kein Cron/Celery-Job nötig, der monatlich neue Buchungen erzeugt.

class Household(models.Model):
    name = models.CharField(max_length=100)
    monthly_buffer = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Frei wählbarer Puffer-Betrag (Sparen/Sonstiges), fließt in "Verfügbares
    # Einkommen" ein — siehe Gesamtkonzept 5.3.
```

**Neu für Einkommen/Analyse (Gesamtkonzept 5.3):** `HouseholdMembership.monthly_income`, `RecurringDeduction`, `Household.monthly_buffer`.

**Korrektur — beide Berechnungen waren zunächst unverbunden, jetzt zusammengeführt:** Ursprünglich zog "Verfügbares Einkommen" nur feste Abzüge ab, ohne einzeln erfasste Transaktionen zu berücksichtigen — das führte dazu, dass eine erfasste Ausgabe das verfügbare Einkommen gar nicht verändert hätte, was keinen Sinn ergibt. Korrigierte Formeln:

- **Kategorie "ausgegeben"** (Übersicht) = `SUM(Transaction.amount dieser Kategorie im laufenden Monat) + SUM(RecurringDeduction.amount dieser Kategorie, wo active=True)` — feste Abzüge zählen automatisch als "ausgegeben", ohne manuell als Transaktion erfasst zu werden.
- **"Verfügbares Einkommen"** (Analysen) = `SUM(monthly_income aller Mitglieder) − SUM(RecurringDeduction.amount wo active=True) − SUM(Transaction.amount aller Kategorien im laufenden Monat) − monthly_buffer`

Beide Werte immer live berechnet, nie zwischengespeichert. **Wichtige Konsequenz:** Feste Kosten wie Miete gehören ausschließlich in `RecurringDeduction`, nicht zusätzlich als manuelle `Transaction` — sonst würden sie doppelt gezählt (einmal als fester Abzug, einmal als Transaktion). Das widerspricht einem früheren Mockup, in dem "Miete" fälschlich als einzelne Transaktion dargestellt wurde — das war ein Konzeptfehler, korrigiert.

**Datenschutz zwischen Haushaltsmitgliedern (neue Erweiterung von `HouseholdScopedPermission`):** `monthly_income` ist eine Ausnahme von der sonstigen "alle Haushaltsmitglieder sehen alle Haushaltsdaten"-Regel — ein API-Response darf das `monthly_income`-Feld anderer Mitglieder NIEMALS an einen anfragenden Nutzer ausliefern, nur die eigene Zahl und die bereits verrechnete Haushalts-Gesamtsumme. Das ist eine gezielte Feldfilterung im Serializer, nicht durch `HouseholdScopedPermission` allein abgedeckt (die prüft nur Haushalts-Zugehörigkeit, nicht Feld-Sichtbarkeit innerhalb desselben Haushalts).

**"Analyse"-Regeln (Gesamtkonzept 5.3) — ausdrücklich ohne LLM-Aufruf:** Feste Schwellenwerte in Python, z. B. Fixkosten-Anteil > 50 % des Einkommens, Puffer < 10 % des Einkommens. Kein API-Call, keine laufenden Kosten, konsistent mit dem Era-Prinzip aus dem Backlog.

**Korrektur gegenüber der vorherigen Fassung:** Das zunächst entworfene Envelope-System (`CategoryGroup`, `BudgetPeriod`, `BudgetAllocation`) wurde wieder verworfen — die geforderte Einfachheit für alle Nutzergruppen wiegt hier schwerer als ein vollständiges Zuweisungssystem. `Category.monthly_goal` ist ein einzelnes, optionales Feld statt vier zusätzlicher Models — deutlich weniger Implementierungsaufwand und kein monatliches Zuweisungs-Ritual, das Nutzer zum Tippen zwingt.

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
- 🔴 Refresh-Token-Rotation, Blacklist über Redis. **Konkrete Gültigkeitsdauer (Marktvergleich 2026, siehe Chat-Recherche):** ohne "Angemeldet bleiben" reines Session-Cookie (endet beim Browser-Schließen); mit "Angemeldet bleiben" 14 Tage, bewusst kürzer als der bei Consumer-Apps üblichere 30-Tage-Wert, weil echte Finanzdaten sichtbar sind — Banking-Apps schalten "Angemeldet bleiben" laut Marktbeobachtung teils komplett ab, was für Kompass aufgrund fehlender Bankanbindung und vorhandenem MFA nicht nötig ist, aber die kürzere Dauer als bewusster Mittelweg.
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
| **Transaktions-Suche/Pagination (Historie-Modal)** | ⚠️ War nicht abgedeckt | Der Such-Query-Parameter (`?q=...`) darf niemals Transaktionen außerhalb des eigenen Haushalts zurückgeben — `HouseholdScopedPermission` muss auf dem Such-/Pagination-Endpunkt genauso greifen wie auf dem normalen Transaktions-Endpunkt, nicht nur auf der ungefilterten Liste. |
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
- ~~API-Vertrag und Versionierungsstrategie festlegen~~ — **entschieden:** alle Endpunkte unter `/api/v1/...`, DRF-ViewSets (siehe `master-prompt-finanzen.txt`, Teil 2).
- Entscheidung Capacitor vs. native final treffen.
- Lokale Entwicklungsumgebung von Anfang an mit PostgreSQL in Docker aufsetzen.
- Kurzes Threat-Modeling (STRIDE) vor Implementierungsstart — jetzt mit den Anwendungsfällen aus 3.9 als konkreter Ausgangspunkt.
- ~~Zwei GitHub-Repos anlegen~~ — **überholt, siehe Abschnitt 1.1**: ein Repo mit `frontend/`/`backend/`-Trennung jetzt, spätere Aufteilung möglich, nicht sofort nötig.
- Rate-Limit-Konfiguration pro Endpunkt-Typ festlegen (Login, MFA-Verifizierung, Registrierung, Export, Einladungsversand — siehe 3.9), bevor der erste Endpunkt live geht.
- Fernzugriffs-Architektur für den Solo-Betrieb festlegen (empfohlen: VPN-Tunnel via Tailscale/WireGuard, siehe 3.10) — vor dem ersten Deployment außerhalb des eigenen lokalen Netzwerks.
- MFA-Backup-Codes-Generierung implementieren, bevor MFA aktiv genutzt wird (siehe 3.10).
- GitHub-Repository-Sichtbarkeit auf privat prüfen/setzen (siehe 3.10).
- Generische `<app-modal>`-Basis-Komponente einführen, bevor ein zweites Modal (Transaktions-Historie, siehe `master-prompt-finanzen.txt` Teil 3) das Hilfe-Overlay-Muster dupliziert.