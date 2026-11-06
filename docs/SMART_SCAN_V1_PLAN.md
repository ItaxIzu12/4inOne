# Smart Scan V1 — Umsetzungsplan (Entwicklungsplan Phase 6)

**Stand:** 04.11.2026 · **Status: vorbereitet, nicht begonnen.** Beginn erst, wenn das Qualitäts-Gate
(`docs/RELEASE_READINESS.md`) erfüllt und die Beta (Phase 5, `docs/beta/`) ausgewertet ist.
**Freigegebene Technik (Nutzerentscheidung 04.11.2026):** `pypdf` (PDF-Text), Tesseract + `pytesseract` (OCR, Deutsch),
Ollama mit lokalem Vision-Modell — alles lokal, nichts an externe Dienste. Installation erst beim Start der Phase.

## 1. Grundsatz

Scan → Vorschlag → **Person prüft und korrigiert** → Speichern über die **bestehenden** Formulare und APIs
(`haushalt/ordner/`) → Verbindungen werden erst danach **angeboten** (Connection Engine V2, wie beim Anlegen von Hand).
Ein Scan bucht nie, legt nie Stammdaten ohne Bestätigung an und erfindet keine Fristen.

## 2. Ablauf

| Schritt | Wo | Regel |
|---|---|---|
| 1. Hochladen | Vertrag/Gerät hinzufügen › „Aus Foto oder PDF ausfüllen“ | JPEG/PNG/HEIC/PDF, ≤ 10 MB, ≤ 10 Seiten; Prüfung wie `organisation/files.py prepare_upload` (Magic Bytes, EXIF/Standort entfernen) |
| 2. Text | Django, Hintergrund-Job | PDF mit Textebene → `pypdf`; sonst Seiten als Bild → Tesseract `deu+eng` |
| 3. Felder | Ollama, lokal | Prompt mit festem JSON-Schema; Antwort mit **Pydantic** prüfen; ungültig → Felder leer, nicht raten |
| 4. Abgleich | Django | Jedes Feld nur übernehmen, wenn es **wörtlich** im extrahierten Text belegt ist (Fundstelle gespeichert); sonst „unsicher“ |
| 5. Prüfen | bestehender Dialog, vorausgefüllt | unsichere/fehlende Felder markiert („Bitte prüfen“), Fundstelle als Zitat; nichts gespeichert, bis „Speichern“ |
| 6. Speichern | bestehende API | wie manuelles Anlegen; Datei nur als Anhang, wenn die Person es **ankreuzt** |
| 7. Verbindungen | `app-auto-links` | Schalter wie heute, standardmäßig **aus** |

## 3. Felder

**Vertrag:** Anbieter, Vertragsname/-art, Vertragsnummer, Abschlussdatum **und** Vertragsbeginn (getrennt), Betrag,
Zahlungsintervall, Währung, Mindestlaufzeit, Vertragsende, Kündigungsfrist (Zahl + Tage/Monate), angekündigte
Preisänderung (`next_cost`, `next_cost_from`) nur bei eindeutiger Angabe.
**Gerät:** Hersteller, Modell, Seriennummer (**getrennt**, `serial_number` gibt es seit 02.11.2026), aus Rechnung
optional Kaufdatum; Garantieende nur aus ausdrücklicher Angabe auf dem Beleg.

Regeln: Vertragsende und Kündigungsdatum nie berechnen, wenn sie nicht im Dokument stehen. `0/O`, `1/I/l`, `5/S`, `8/B`
in Modell-/Seriennummern als **mehrdeutig** markieren und beide Lesarten zeigen. Seriennummer nie aus einem
Produktfoto ohne lesbares Typenschild. Seriennummer ist kein eindeutiger Schlüssel (kein Unique-Constraint).

## 4. Datenschutz und Sicherheit

- Nur angemeldet, eigene Drosselung (z. B. 10 Scans/Stunde), Größen- und Seitenlimit, Zeitlimit je Job.
- Uploads in `PRIVATE_MEDIA_ROOT/scan-tmp/`, nie öffentlich ausgeliefert; Löschung nach Abschluss, spätestens nach
  24 h (`cleanup_expired`). Extrahierter Text nur bis zum Speichern, danach verworfen.
- Ollama nur auf `localhost`, kein Internetzugriff des Modells. Im SaaS-Betrieb Verarbeitungsort in der
  Datenschutzerklärung nennen (Server ≠ Gerät der Person).
- Logs ohne Dokumentinhalte (nur Job-ID, Dauer, Ergebnisart).

## 5. Tests und Abnahme (Definition of Done Phase 6)

- Testdokumente: 10 Verträge (PDF mit Text, Scan, Handyfoto schräg/unscharf) und 10 Typenschilder, **selbst
  erstellt/fiktiv**, im Repository unter `backend/scan/tests/fixtures/` mit erwarteten Feldern.
- Messung je Feld: richtig / falsch / leer gelassen. Ziel: **falsch = 0** bei Fristen, Datum und Beträgen
  (lieber leer als falsch); Bericht `docs/SMART_SCAN_V1_REPORT.md`.
- Unit: Schema-Validierung, Belegprüfung, Zeichenverwechslungen; Integration: Upload → Job → Vorschlag → Speichern;
  Rechte: fremder Job 404; E2E: ein Vertrags- und ein Geräte-Scan Ende-zu-Ende mit Korrektur.
