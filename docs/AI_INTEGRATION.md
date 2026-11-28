# Lumiknot — AI Readiness Layer und Anbindung an den Personal AI Core

**Stand:** 24.11.2026 · **Status:** Schritt A (Gerüst) umgesetzt am 24.11.2026: `backend/integrations/ai/` mit Konfiguration, Client,
Fehlerarten, Antwort-Schema, leerem Fähigkeiten-Register, Fake-Core und Deploy-Prüfung; 30 Tests
(`integrations/tests/test_ai.py`). Am 25.11.2026 an den **gemeinsamen Personal-AI-Integrationsstandard** (§ 0)
angepasst: Provider-Schicht (Core/Mock), dynamische Fähigkeiten-Abfrage, Anwendungskontext; jetzt 41 Tests. Keine
Fähigkeit und keine Oberfläche aktiv; jede weitere Stufe nach Freigabe. Solange der Personal AI Core nicht verfügbar
ist, bleibt `AI_ENABLED=False` (oder in der Entwicklung `AI_PROVIDER=mock`), und jede Grundfunktion von Lumiknot arbeitet
unabhängig davon.
**Bezug:** `docs/ARCHITECTURE.md` (§ 3, Phase 4), `docs/DECISIONS.md` (D15 „AI remains optional and subordinate“),
`docs/AI_FUTURE.md` (Richtung), `docs/SMART_SCAN_V1_PLAN.md` (erste mögliche Anwendung, zurückgestellt),
`docs/BORDKARTE_KONZEPT.md` (Schritt 2 „Buchung übernehmen“, nicht freigegeben).

**Nicht Teil von Lumiknot:** der Personal AI Core selbst (Modelle, OCR-Engine, eigene Datenbank, eigener Betrieb). Lumiknot
beschreibt hier nur, **wie es ihn nutzt**: über eine authentifizierte API, abschaltbar, ohne gemeinsame Datenbank.

---

## 0. Gemeinsamer Personal-AI-Integrationsstandard (verbindlich seit 25.11.2026)

Alle Anwendungen am Personal AI Core folgen demselben Standard. So erfüllt ihn Lumiknot:

| Anforderung des Standards | Umsetzung in Lumiknot |
|---|---|
| Standardisierte, versionierte REST-API | `/v1/capabilities`, `/v1/tasks/{fähigkeit}`, `/v1/health`; Anfrage/Antwort mit `schema_version` und `capability_version` (§ 4) |
| Zentraler AI Service Adapter im Backend | `integrations/ai/client.py › request()` ist der **einzige** Weg zu KI; Fachlogik ruft nichts anderes auf (§ 2) |
| Fachlogik getrennt von KI-Modellen | Bereiche liefern nur Eingabe und prüfen den Vorschlag; Modelle kennt nur der Core. Architekturtest: `integrations.ai` importiert keine Bereiche |
| Keine direkt eingebundenen Modelle | Lumiknot enthält kein Modell, keine OCR-Engine, kein Ollama. Auch Smart Scan läuft über den Core (§ 11, `SMART_SCAN_V1_PLAN.md`). Nicht KI und deshalb erlaubt: deterministisches Lesen standardisierter Codes (Bordkarte: zxing-cpp/BCBP) |
| Modelle austauschbar ohne App-Änderung | Antwortfeld `model` ist undurchsichtig und wird nur geloggt; Fähigkeiten sind über Name + Version definiert, nicht über ein Modell |
| Konfigurierbare Endpunkte, Auth, Timeouts, Fehler | `AI_CORE_URL`, `AI_CORE_TOKEN(_FILE)`, `AI_CORE_CA_BUNDLE`, `AI_TIMEOUT_SECONDS`, Fehlerarten und Sperre (§ 3, § 5) |
| Fähigkeiten dynamisch über eine Capability API | `integrations/ai/discovery.py`: genutzt wird eine Fähigkeit nur, wenn der Provider sie per `GET /v1/capabilities` in derselben Version anbietet (zwischengespeichert, § 4.1) |
| Benutzerdaten, Berechtigungen, Anwendungskontexte getrennt | Rechteprüfung und Datenauswahl im Bereichs-Service *vor* dem Aufruf (§ 7); Anfrage trägt `application` und `context.area`, Header `X-Client-App`; Person nur als Pseudonym je Anwendung (`subject`) |
| Mock-Provider in der Entwicklung | `AI_PROVIDER=mock` (`providers.py › MockProvider`): gleiche Prüfungen, feste Antworten je Fähigkeit; in Produktion durch `check --deploy` verboten. Für Tests zusätzlich `fake.py` (echter HTTP-Server) |
| Kernfunktionen ohne KI | `AI_ENABLED=False` ist Standard; jeder Fehler endet in „kein Vorschlag“ (§ 5) |
| Neue Fähigkeiten dokumentiert | Fähigkeiten-Katalog § 4.5: jede neue Fähigkeit wird dort beschrieben und als Erweiterung des **gemeinsamen** Core beantragt, nie als Insellösung in Lumiknot |

---

## 1. Grundsätze

1. **Regeln zuerst, KI ergänzt.** Jede Funktion hat eine deterministische Grundlage, die ohne KI vollständig
   funktioniert (Connection Engine, Kategorie-Vorschlag aus der eigenen Historie, BCBP-Lesen, Wiederholungen). KI darf
   Lücken füllen, aber nie eine Regel ersetzen oder aushebeln.
2. **Nur Vorschläge.** KI-Ergebnisse werden als markierter Vorschlag angezeigt. Gespeichert wird erst nach Bestätigung,
   und zwar über die **bestehenden** Formulare und APIs mit ihren Validierungen und Rechten.
3. **Nie eigenständig:** keine Buchung, Überweisung, Löschung, Freigabe, Rechteänderung und keine Änderung sensibler
   Daten (Konten, Verträge, Gesundheitsdaten, Ausweise, Zugangsdaten) durch die KI. Es gibt keinen Codepfad, auf dem
   eine KI-Antwort direkt schreibt.
4. **Nur über das Backend.** Das Frontend spricht nie mit dem AI Core und kennt weder Adresse noch Token.
5. **Abschaltbar, Standard aus.** `AI_ENABLED=False` ist der Standard. Ohne KI-Dienst, oder wenn er ausfällt, läuft jede
   Funktion wie heute; die Oberfläche zeigt dann einfach keinen Vorschlag.
6. **Datensparsam.** Pro Fähigkeit wird nur das Nötigste gesendet; die Person schaltet KI je Fähigkeit selbst ein
   (Einstellungen), auch wenn der Dienst serverseitig aktiv ist.
7. **Erklärbar.** Jeder Vorschlag sagt, worauf er beruht (Fundstelle im Dokument, ähnliche frühere Buchungen),
   wie in `docs/AI_FUTURE.md › Explainability`.
8. **Anbieterunabhängig.** Lumiknot spricht ein eigenes, versioniertes JSON-Format. Welches Modell der AI Core nutzt
   (lokal, z. B. über Ollama, oder ausnahmsweise ein externer Anbieter), ist dessen Sache und für Lumiknot unsichtbar.

---

## 2. Architektur

```text
┌─────────────── Lumiknot ────────────────────────────────────────────────┐        ┌──── Personal AI Core ────┐
│ Angular                                                               │        │ (eigener Stack,          │
│   bestehender Dialog ── „Vorschlag holen“ ──▶ Bereichs-API            │        │  eigene Datenbank)       │
│                                               │                       │        │                          │
│ Django                                        ▼                       │        │                          │
│   Bereichs-Service (Rechte, Datenauswahl) ──▶ integrations/ai ────────┼─HTTPS─▶│ GET  /v1/capabilities    │
│        ▲                                       │ client.py (Adapter)  │ Token  │ POST /v1/tasks/<fähigk.> │
│        │ geprüfter Vorschlag                   │ discovery.py         │        │ GET  /v1/health          │
│        └─── Validierung gegen Schema ◀─────────┘ providers.py: core │ │◀───────│                          │
│                                                                mock │ │  JSON  │                          │
│   Speichern NUR über bestehende API nach Bestätigung                  │  JSON  │                          │
└───────────────────────────────────────────────────────────────────────┘        └──────────────────────────┘
```

### 2.1 Bausteine (`backend/integrations/`, umgesetzt 24./25.11.2026)

| Datei | Aufgabe |
|---|---|
| `integrations/ai/config.py` | liest die Einstellungen; `ai_available(capability)`: Schalter, Provider eingerichtet, Fähigkeit registriert, erlaubt **und** vom Provider angeboten (später zusätzlich die Wahl der Person) |
| `integrations/ai/client.py` | **AI Service Adapter**: `request(capability, payload, *, user, area) -> AiResult` – Rahmen bauen, Größe prüfen, Provider aufrufen, Antwort prüfen, Sperre, Logs ohne Inhalte |
| `integrations/ai/providers.py` | `CoreProvider` (REST, urllib3, feste Basis-URL, keine Weiterleitungen, Größenlimit) und `MockProvider` (Entwicklung); Auswahl über `AI_PROVIDER` |
| `integrations/ai/discovery.py` | Capability API: `GET /v1/capabilities` je Prozess zwischengespeichert; bei Fehler eine Minute „nichts verfügbar“ |
| `integrations/ai/schemas.py` | Ein- und Ausgabeformate je Fähigkeit als DRF-Serializer (keine neue Abhängigkeit); unbekannte Felder werden verworfen |
| `integrations/ai/errors.py` | `AiDisabled`, `AiUnavailable`, `AiTimeout`, `AiInvalidResponse`, `AiRefused` (alle von `AiError`) |
| `integrations/ai/capabilities.py` | Register der Fähigkeiten, die Lumiknot nutzen kann: Name, Version, Ergebnis-Schema, Zeitlimit, Prüfung gegen die Anfrage, Mock-Antwort (heute leer) |
| `integrations/ai/fake.py` | Test-Doppel des AI Core für Unit-, Integrations- und E2E-Tests |
| `integrations/checks.py` | `manage.py check --deploy`: Provider (`mock` in Produktion verboten), URL, Token, unbekannte Fähigkeiten (nur wenn `AI_ENABLED=True`) |
| `integrations/models.py` | (erst bei Bedarf) `AiJob` für lange Aufgaben, `AiUsage` für Zählung/Drosselung ohne Inhalte |

**Die Bereiche** (`finanzen`, `haushalt`, `organisation`, `reisen`) rufen den Client nur aus ihren Services auf, nach
der Rechteprüfung und mit genau den Daten, die die Person sehen darf. `integrations/ai` kennt keine Bereichsmodelle.

---

## 3. Konfiguration (Umgebungsvariablen)

| Variable | Standard | Bedeutung |
|---|---|---|
| `AI_ENABLED` | `False` | Hauptschalter. `False` ⇒ kein einziger Aufruf, keine Oberflächen-Hinweise |
| `AI_PROVIDER` | `core` | `core` = Personal AI Core (REST); `mock` = feste Antworten für die Entwicklung, solange der Core fehlt (in Produktion verboten). Keine anderen Werte – kein fest verdrahteter Anbieter |
| `AI_APPLICATION_ID` | `4inone` | Kennung dieser Anwendung am gemeinsamen Core (`application`, `X-Client-App`, Pseudonym je Anwendung) |
| `AI_CAPABILITY_CACHE_SECONDS` | `300` | Wie lange die Antwort von `GET /v1/capabilities` je Prozess gilt |
| `AI_CORE_URL` | leer | Basis-URL, z. B. `http://ai-core:8080` im internen Docker-Netz oder `https://127.0.0.1:8443`. Nur `http` im internen Netz bzw. auf `127.0.0.1`, sonst `https` |
| `AI_CORE_TOKEN` | leer | Dienst-Token (zufällig, ≥ 32 Byte). Alternativ `AI_CORE_TOKEN_FILE` (Docker-Secret). Nie im Repository, nie im Frontend, nie in Logs |
| `AI_CORE_CA_BUNDLE` | leer | eigenes Zertifikat des AI Core (selbst signiert im Heimnetz) |
| `AI_CAPABILITIES` | leer | Erlaubt-Liste, z. B. `categorize_expense,extract_document`. Alles andere wird abgelehnt, auch wenn der Core es kann. Umgekehrt nutzt Lumiknot eine erlaubte Fähigkeit nur, wenn der Core sie anbietet |
| `AI_TIMEOUT_SECONDS` | `8` | Zeitlimit für synchrone Aufrufe (unter dem gunicorn-Timeout von 30 s) |
| `AI_JOB_TIMEOUT_SECONDS` | `120` | Zeitlimit für lange Aufgaben (nur mit Warteschlange, § 6) |
| `AI_MAX_REQUEST_BYTES` | `2_000_000` | Größte Anfrage (Dokumente vorher verkleinern/aufteilen) |
| `AI_MAX_RESPONSE_BYTES` | `256_000` | Größte Antwort; mehr ⇒ `AiInvalidResponse` |
| `RATE_LIMIT_AI` | `30` | Anfragen pro Stunde und Person |

Die Einträge stehen in `.env.example` (seit 24.11.2026). `manage.py check --deploy` prüft: Ist `AI_ENABLED` an, müssen
URL und Token gesetzt sein, und `http` ist nur für `127.0.0.1`/`localhost` und Docker-Dienstnamen ohne Punkt erlaubt
(Heimnetz-Adressen wie `192.168.…` brauchen `https`). `RATE_LIMIT_AI` und `AI_JOB_TIMEOUT_SECONDS` kommen mit der
ersten Fähigkeit bzw. mit langen Aufgaben.

---

## 4. Schnittstellenvertrag Lumiknot ↔ Personal AI Core

### 4.1 Endpunkte (vom AI Core bereitzustellen)

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/v1/health` | Erreichbarkeit; Antwort `{"status": "ok"}` |
| `GET` | `/v1/capabilities` | Angebotene Fähigkeiten: `{"capabilities": [{"name": "categorize_expense", "version": 1}]}` oder mit mehreren Versionen `"versions": [1, 2]`. Namen: Kleinbuchstaben, Ziffern, `_` |
| `POST` | `/v1/tasks/{capability}` | Aufgabe synchron ausführen |
| `POST` | `/v1/jobs/{capability}` · `GET /v1/jobs/{id}` | lange Aufgabe anlegen bzw. abfragen (erst bei Bedarf, § 6) |

Authentifizierung: `Authorization: Bearer <AI_CORE_TOKEN>` (je Anwendung ein eigenes Token); dazu `X-Client-App`
(`AI_APPLICATION_ID`) und bei Aufgaben `X-Request-Id` (UUID je Aufruf, für Logs auf beiden Seiten). Optional später
mTLS. **Fähigkeiten-Abfrage:** Vor der ersten Nutzung und danach alle `AI_CAPABILITY_CACHE_SECONDS` fragt Lumiknot
`/v1/capabilities`; eine Fähigkeit wird nur genutzt, wenn Name und Version passen. Ist die Liste nicht erreichbar oder
ungültig, gilt eine Minute lang „nichts verfügbar“. Lumiknot sendet **keine** Konto-IDs, E-Mail-Adressen oder Namen anderer Personen,
nur eine pseudonyme `subject` (HMAC aus Nutzer-ID und einem Geheimnis), falls der Core je Person zwischenspeichern will.

### 4.2 Anfrage (gemeinsamer Rahmen)

```json
{
  "schema_version": 1,
  "application": "4inone",
  "context": { "area": "finanzen" },
  "capability": "categorize_expense",
  "capability_version": 1,
  "request_id": "6f1c…",
  "subject": "hmac:3b9a…",
  "locale": "de-DE",
  "input": { "...": "je Fähigkeit, siehe 4.4" }
}
```

### 4.3 Antwort (gemeinsamer Rahmen)

```json
{
  "schema_version": 1,
  "request_id": "6f1c…",
  "status": "ok",
  "result": { "...": "je Fähigkeit" },
  "evidence": [ { "field": "amount", "source": "Seite 1", "quote": "Gesamt 49,90 €" } ],
  "confidence": { "category": 0.82 },
  "model": "opaque-string",
  "duration_ms": 640
}
```

`status` ist `ok`, `refused` (Core lehnt ab, z. B. unpassender Inhalt) oder `error`. Bei `error` gibt es nur
`{"code": "...", "message": "..."}`, keine Interna. Lumiknot zeigt `model` nirgends an und speichert es höchstens für
die Fehlersuche.

### 4.4 Fähigkeiten (Beispiele, Version 1)

| Fähigkeit | Eingabe (nur das Nötigste) | Ergebnis | Regel in Lumiknot |
|---|---|---|---|
| `categorize_expense` | `text` (Verwendungszweck/Händler), `amount`, `currency`, `categories` (id + Name der eigenen Kategorien) | `category_id` aus der übergebenen Liste, `reason` | Nur IDs aus der gesendeten Liste werden akzeptiert. Die deterministische Historien-Regel hat Vorrang; KI nur, wenn sie nichts findet |
| `extract_document` | Text aus PDF-Textebene oder OCR (vorher in Lumiknot oder im Core), `kind` (`contract`, `device`, `receipt`, `booking`) | Felder nach festem Schema je `kind`, jeweils mit `evidence` | Ein Feld wird nur vorausgefüllt, wenn seine Fundstelle wörtlich im Text steht (`SMART_SCAN_V1_PLAN.md` § 2 Schritt 4); sonst „Bitte prüfen“ |
| `ocr` | Bild/PDF-Seite (verkleinert, ohne EXIF/Standort) | Text mit Seitenangabe | Nur als Vorstufe von `extract_document`; Text wird nach dem Speichern verworfen |
| `classify_image` | Bild (verkleinert) | Art (`receipt`, `nameplate`, `boarding_pass`, `other`) | Nur zur Auswahl des passenden Formulars |
| `suggest_packing` | Reiseart, Dauer, Klima, Gepäck, vorhandene Packstücke (Titel) | Liste von Titeln mit Kategorie | Gleiche Oberfläche wie die heutigen Vorschläge (`trip-suggestions`), Übernahme nur angehakt |
| `extract_tasks` | freier Text der Person (Notiz) | Aufgaben/Termine mit Datum, jeweils mit Zitat | Vorschlagsliste; angelegt wird über die bestehenden Dialoge |
| `summarize_today` | bereits berechnete „Heute“-Daten (Titel, Zeiten) | 1–3 Sätze | Reine Anzeige; die Zahlen kommen weiter aus `connections/today.py` |

Assistenten (Reise-, Haushalts-, Organisations-, Finanzassistent) sind **keine** eigene Fähigkeit mit freiem
Datenzugriff, sondern eine Folge dieser Bausteine, angestoßen aus dem Bereich. Ein Chat mit Lesezugriff auf alle Daten
ist ausdrücklich nicht geplant (Datenschutz, schwer prüfbar, `AGENTS.md` › „AI as a novelty tab“).

### 4.5 Fähigkeiten-Katalog (neu benötigte Fähigkeiten)

Neue KI-Funktionen nutzen zuerst vorhandene Fähigkeiten. Wird eine neue gebraucht, wird sie hier beschrieben und als
**Erweiterung des gemeinsamen Personal AI Core** vorgesehen (andere Anwendungen sollen sie mitnutzen können), nicht
als eigene KI-Lösung in Lumiknot. Ablauf:

1. Eintrag in der Tabelle unten (Status „vorgeschlagen“) mit dem Steckbrief.
2. Freigabe durch den Nutzer; Abstimmung von Name, Version und Schema mit dem Core.
3. Umsetzung in Lumiknot: `Capability` registrieren (Ergebnis-Serializer, Prüfung gegen die Anfrage, **Mock-Antwort**),
   Aufruf aus dem Bereichs-Service, Tests mit Mock und Fake-Core, Oberfläche nach § 8, Eintrag in `AI_CAPABILITIES`.
4. Status auf „aktiv“ erst, wenn der Core sie über `/v1/capabilities` anbietet.

**Steckbrief je Fähigkeit:** Name + Version · Zweck (welche deterministische Grundlage ergänzt sie?) · aufrufender
Bereich (`context.area`) · Eingabe (nur das Nötigste, welche personenbezogenen Daten?) · Ergebnis-Schema · Prüfungen in
Lumiknot (z. B. „nur IDs aus der Anfrage“, „Fundstelle wörtlich im Text“) · synchron/asynchron, Zeitlimit · Mock-Antwort
· Datenschutz (was der Core speichern darf: standardmäßig nichts).

| Fähigkeit | Version | Bereich | Status | Steckbrief |
|---|---|---|---|---|
| `categorize_expense` | 1 | finanzen | vorgeschlagen | § 4.4; Basis: Kategorie-Vorschlag aus der eigenen Historie (`finance/shared/category-suggestion.ts`) |
| `extract_document` | 1 | haushalt, reisen | vorgeschlagen (Smart Scan und Bordkarte Schritt 2 zurückgestellt) | § 4.4, `SMART_SCAN_V1_PLAN.md`, `BORDKARTE_KONZEPT.md` |
| `ocr` | 1 | haushalt, reisen | vorgeschlagen, nur als Vorstufe von `extract_document` | § 4.4 |
| `classify_image` | 1 | haushalt | vorgeschlagen | § 4.4 |
| `suggest_packing` | 1 | reisen | vorgeschlagen; Basis: `travel/shared/trip-suggestions.ts` | § 4.4 |
| `extract_tasks` | 1 | organisation | vorgeschlagen | § 4.4 |
| `summarize_today` | 1 | alle (Startseite) | vorgeschlagen | § 4.4 |

Aktiv ist heute **keine** Fähigkeit.

---

## 5. Fehlerbehandlung und Ausfallverhalten

| Fall | Erkennung | Verhalten |
|---|---|---|
| KI abgeschaltet oder Fähigkeit nicht erlaubt | `ai_available()` ist `False` | Kein Aufruf. API antwortet `{"suggestion": null, "reason": "disabled"}`, Oberfläche zeigt nichts |
| Core nicht erreichbar | Verbindungsfehler | `AiUnavailable`. Wie oben, Oberfläche optional „Vorschlag gerade nicht verfügbar“. **Sperre:** nach 3 Fehlern in 5 Minuten 5 Minuten lang keine Versuche (Cache-Schlüssel wie in `core/fx.py`), damit kein Request auf Timeouts wartet |
| Zeitüberschreitung | `AI_TIMEOUT_SECONDS` | `AiTimeout`, Behandlung wie „nicht erreichbar“ |
| Ungültige Antwort | Schema-Prüfung schlägt fehl, Antwort zu groß, unbekannte Kategorie-ID | `AiInvalidResponse`. Vorschlag verworfen, nichts vorausgefüllt, Log ohne Inhalt |
| Core lehnt ab | `status: refused` | `AiRefused`. Hinweis „Kein Vorschlag möglich“ |
| HTTP 401/403 | falsches oder abgelaufenes Token | `AiUnavailable` + Fehler an das Monitoring (GlitchTip), damit es auffällt |

Keine automatischen Wiederholungen im Request (Wartezeit wäre spürbar); höchstens eine Wiederholung bei asynchronen
Jobs. Alle Fehler enden in einem definierten Zustand „kein Vorschlag“. **Keiner** blockiert das normale Speichern.

---

## 6. Synchron oder asynchron

- **Synchron (≤ 8 s):** Kategorisieren, Bild klassifizieren, kurze Textextraktion. Direkter Aufruf im Request mit
  Zeitlimit; die Oberfläche zeigt währenddessen „Vorschlag wird geholt …“ und bleibt bedienbar.
- **Asynchron (OCR mehrseitiger PDFs, große Dokumente):** erst wenn eine solche Fähigkeit freigegeben wird. Dann eine
  schlanke Warteschlange in PostgreSQL (`integrations.AiJob`: Status, Fähigkeit, Eigentümer, Ablaufzeit, Ergebnis
  verschlüsselt wie die Bordkarten) und ein Management-Befehl `run_ai_jobs` als dauerhafter systemd-/Compose-Dienst.
  Kein Celery, kein zusätzlicher Broker (`docs/DECISIONS.md`: Warteschlange erst bei konkretem Bedarf). Ergebnisse und
  hochgeladene Dateien werden nach Abschluss, spätestens nach 24 Stunden gelöscht (`cleanup_expired`).

---

## 7. Sicherheit und Datenschutz

- **Rechte vor KI:** Der Bereichs-Service prüft die Rechte und wählt die Daten aus, *bevor* der Client aufgerufen wird.
  Der Core bekommt nie Daten, die die anfragende Person nicht sehen darf (z. B. keine Vertragsbeträge anderer
  Haushaltsmitglieder, `haushalt.services.can_see_cost`).
- **Ausgabe ist Daten, keine Anweisung:** Modell-Ausgaben werden nur gegen das Schema geprüft und als Formularwerte
  angeboten. Sie werden nie als Befehl, Filter, URL, HTML oder SQL ausgeführt. Damit verpuffen Prompt-Injections aus
  Dokumenten („ignoriere alle Regeln …“).
- **Kein Schreibpfad:** Der Client hat keine Abhängigkeit zu Bereichsmodellen. Ein Architekturtest
  (`docs/ARCHITECTURE.md` Phase 1) stellt sicher, dass `integrations.ai` nur von Services importiert wird und selbst
  keine Modelle der Bereiche importiert.
- **Finanzen:** KI darf Kategorie und Beschreibung *vorschlagen*. Betrag, Konto, Datum einer Buchung, Budgets und
  Sparziele ändert sie nie; eine Buchung entsteht nur durch die Person.
- **Transport:** nur internes Docker-Netz oder `127.0.0.1`; sonst HTTPS mit geprüftem Zertifikat. Token rotierbar
  (`AI_CORE_TOKEN` neu setzen, Core akzeptiert übergangsweise zwei Token).
- **Logs und Monitoring:** nur Request-ID, Fähigkeit, Dauer, Ergebnisart (`ok`/`refused`/Fehlercode). Keine Inhalte,
  keine Dokumente, keine Beträge; GlitchTip-Events ohne Request-Body.
- **Einwilligung:** Einstellungen › „Vorschläge mit KI“ je Fähigkeit, standardmäßig aus (kommt mit der ersten
  Fähigkeit in Schritt B; `ai_available()` prüft dann zusätzlich die Wahl der Person). Datenschutzerklärung nennt den
  Verarbeitungsort (eigener Mini-PC, kein Dritter), sobald eine Fähigkeit aktiv ist.
- **Externe Anbieter:** nur, wenn der Personal AI Core das selbst so konfiguriert. Lumiknot erzwingt nichts und braucht
  keinen externen Schlüssel. Bei mehreren Nutzerinnen und Nutzern (später) gilt: externe Verarbeitung nur mit
  ausdrücklicher Zustimmung.

---

## 8. Oberfläche

- Kein KI-Reiter. Vorschläge erscheinen im bestehenden Dialog: Feld vorausgefüllt, dezent markiert („Vorschlag – bitte
  prüfen“), daneben die Begründung bzw. Fundstelle; ein Klick verwirft den Vorschlag.
- Ohne KI ist die Oberfläche identisch mit heute (keine leeren Platzhalter, keine ausgegrauten KI-Knöpfe).
- Barrierefrei: Markierung nicht nur über Farbe (Text „Vorschlag“), Fokus bleibt beim Feld, Status über `role="status"`.
- Gestaltung nach `DESIGN.md`: keine Funkel-Symbole, keine Farbverläufe, kein Lila.

---

## 9. Tests

| Ebene | Was |
|---|---|
| Unit | Schemas (gültig, fehlende Felder, Zusatzfelder, falsche Typen, unbekannte Kategorie-ID), `ai_available()`, Sperre nach Fehlern, Größenlimits, Pseudonym je Anwendung |
| Capability API | angeboten/nicht angeboten/andere Version/Versionsliste, Zwischenspeicher, Liste nicht erreichbar → nichts verfügbar und kein Aufgaben-Aufruf |
| Mock-Provider | Antwort ohne Netz, gleiche Prüfungen wie beim Core, nur Fähigkeiten mit Mock, in Produktion verboten |
| Client | gegen `integrations/ai/fake.py` bzw. einen lokalen Test-HTTP-Server: Erfolg, Timeout, 500, 401, ungültiges JSON, zu große Antwort, `refused` |
| Regeln | Fundstellen-Prüfung (`extract_document`), Vorrang der deterministischen Kategorie-Regel, Finanzen werden nie geschrieben |
| Rechte | Daten anderer Personen erscheinen nie in der Anfrage (Fake zeichnet Anfragen auf) |
| Ausfall | Mit `AI_ENABLED=False` und mit unerreichbarem Core laufen alle bestehenden Tests unverändert grün |
| E2E | ein Dialog mit Vorschlag (Fake-Core im Fullstack-Aufbau), einer ohne KI |

---

## 10. Umsetzungsschritte

| Schritt | Inhalt | Voraussetzung |
|---|---|---|
| A — Gerüst ✅ 24.11.2026 | `integrations/ai/` mit Konfiguration, Client, Fehlern, Fake, Tests; `check --deploy`-Regeln; **keine** Fähigkeit aktiv, keine Oberfläche | erledigt |
| A2 — gemeinsamer Standard ✅ 25.11.2026 | Provider-Schicht (Core/Mock), Capability API, Anwendungskontext, Fähigkeiten-Katalog § 4.5 | erledigt |
| B — erste Fähigkeit | eine Fähigkeit aus dem Katalog § 4.5 Ende-zu-Ende (zuerst mit `AI_PROVIDER=mock`), empfohlen `categorize_expense` (klein, gut messbar, deterministische Basis existiert) **oder** `extract_document` für Smart Scan bzw. Bordkarte Schritt 2 | eigene Freigabe; Personal AI Core liefert `/v1/health`, `/v1/capabilities` und die Fähigkeit |
| C — lange Aufgaben | `AiJob` + `run_ai_jobs`, erst für mehrseitige Dokumente | Bedarf aus B nachgewiesen |
| D — Assistenten | weitere Fähigkeiten aus § 4.4, jeweils einzeln | je eigene Freigabe |

## 11. Offene Entscheidungen

- ~~Wo läuft OCR?~~ **Entschieden 25.11.2026 (gemeinsamer Standard):** im Personal AI Core als Fähigkeit `ocr`;
  Lumiknot bindet keine OCR-Engine und kein Modell ein.
- Erste Fähigkeit: `categorize_expense` oder `extract_document`?
- Soll der Core je Person lernen dürfen (pseudonymes `subject`) oder strikt zustandslos bleiben (empfohlen für den Start)?
