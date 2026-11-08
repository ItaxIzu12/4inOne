# Prüfstand für 4inOne — Offline-KI mit Streamlit + Ollama + YOLO auf dem MacBook Air

**Stand:** 07.11.2026 · **Gerät:** MacBook Air M4 · **Zweck:** Nachschlage- und Arbeitsdokument zum Abspeichern. Ein eigenständiges Versuchslabor
(Streamlit-App) auf deinem MacBook Air, um offline KI-Spezialisten für 4inOne auszuprobieren, zu messen und erst dann
zu entscheiden, was davon in 4inOne kommt.

> **Wichtig vorab**
> - Der Prüfstand (früher „KI-Labor“) ist **getrennt von der 4inOne-App**. Smart Scan und alle KI-Phasen in 4inOne bleiben zurückgestellt,
>   bis du die App selbst gründlich getestet hast (deine Entscheidung vom 06.11.2026).
> - Alle Befehle unten sind **Vorschläge zum Selbst-Ausführen**. Sie laden Software und Modelle (teils mehrere GB) aus
>   dem Internet — danach läuft alles offline.
> - Zu „Sarah Temmel“ konnte ich keine überprüfbare Quelle finden. Ich beschreibe deshalb die üblichen, belegbaren Wege
>   (Ollama, YOLO/Ultralytics, MLX auf Apple Silicon). Vergleiche sie mit dem, was du bei ihr gesehen hast.

---

## 1. Ist deine Einschätzung gut? — Ehrliche Bewertung

| Deine Idee | Bewertung | Warum |
|---|---|---|
| „Jedes Modell hat seine eigene Spezialität“ | ✅ **Sehr gut** | Mehrere kleine, spezialisierte Modelle (plus ein „Verteiler“) sind auf einem Laptop schneller, günstiger und besser prüfbar als ein großes Allzweckmodell. So arbeiten auch professionelle Systeme. |
| Alles offline auf dem MacBook | ✅ **Gut**, mit Grenzen | Ollama läuft lokal, Daten verlassen den Mac nicht. Grenzen setzt der Arbeitsspeicher (RAM) — siehe Abschnitt 2. |
| „Ollama mit YOLO verbinden“ | ⚠️ **Teilweise** | Das sind zwei verschiedene Werkzeuge: **YOLO findet Objekte im Bild** (Kästchen um „Typenschild“, „Kassenbon“), **liest aber keinen Text**. **Ollama** führt Sprachmodelle aus (auch solche, die Bilder verstehen). Sinnvoll ist eine **Kette**: YOLO findet die Stelle → OCR liest den Text → Sprachmodell ordnet die Felder zu. Für Verträge (PDF/Fotos von Text) braucht man YOLO meist **gar nicht**. |
| „KIs offline trainieren“ | ⚠️ **Realistisch nur als Feintuning** | Ein Sprachmodell **von Grund auf** zu trainieren ist auf einem Laptop unmöglich (dafür braucht es Rechenzentren). Möglich ist: **YOLO feintunen** (eigene Bilder, z. B. Typenschilder) und **kleine Sprachmodelle mit LoRA feintunen** (über MLX auf Apple Silicon). Ollama selbst trainiert nicht — es **führt** fertige oder feingetunte Modelle aus. |
| Basierend auf 4inOne | ✅ **Sehr gut** | Klarer Rahmen, echte Aufgaben (Verträge, Geräte, Buchungen, Reisen), und mit den Demo-Daten (Sophie, Max, Lena) gibt es sofort fiktive Testdaten. |

**Die wichtigste Empfehlung:** Erst **ohne Training** anfangen — gute Anweisungen (Prompts), feste JSON-Formate,
Beispiele und eigene Prüfregeln. Dann **messen**. Nur wo die Messung zeigt, dass es nicht reicht, wird feingetunt.
Meistens reicht es — und Feintuning kann Modelle auch verschlechtern, wenn die Daten schlecht sind.

---

## 2. Was dein MacBook Air leisten kann

Entscheidend ist der **Arbeitsspeicher (RAM)**, weil Apple-Chips CPU und Grafik denselben Speicher teilen.
Prüfen: Apple-Menü › „Über diesen Mac“.

| RAM | Sprachmodelle (quantisiert, „q4“) | Bild-Sprachmodelle | YOLO |
|---|---|---|---|
| 8 GB | bis ca. 3–4 Mrd. Parameter (z. B. 3B) — knapp | kleine (z. B. ~2–4B) | Erkennen gut, Training nur „nano“-Modelle, langsam |
| 16 GB | bis ca. 7–8B flüssig | ~7B | Training kleiner Modelle machbar |
| 24–32 GB | bis ca. 14B, mehrere Modelle nacheinander | 7–11B | Training komfortabler |

### Dein Gerät: MacBook Air mit M4

Das MacBook Air mit M4 hat mindestens **16 GB** gemeinsamen Arbeitsspeicher; 24 oder 32 GB gab es als Option.
Deine Größe siehst du unter Apple-Menü › „Über diesen Mac“ › „Speicher“. Für den Prüfstand heißt das:

| Aufgabe | 16 GB (Grundausstattung M4) | 24 / 32 GB |
|---|---|---|
| Sprachmodelle ausführen (Ollama, q4) | 7–8B flüssig (Vertrags-Leser, Erklärer); 1,5–3B sehr schnell (Verteiler, Kategorien) | zusätzlich 12–14B |
| Bild-Sprachmodelle | ~7B möglich, aber langsamer als OCR + Sprachmodell | 7–11B |
| YOLO erkennen | schnell, über die Apple-Grafik (`device='mps'`) | schnell |
| YOLO trainieren | „nano“/„small“ mit einigen hundert Fotos: gut machbar | auch „medium“ |
| LoRA-Feintuning (MLX) | 1–3B gut; 7B nur als 4-Bit-Modell (QLoRA) mit kleiner Batch-Größe, knapp | 7–8B komfortabler |

- **Rechenwerke:** CPU, Grafik und Neural Engine teilen sich den Speicher. Ollama und MLX nutzen die Grafik (Metal),
  YOLO über PyTorch die Grafik per `mps`. Die Neural Engine nutzen diese Werkzeuge praktisch nicht. Apple Vision
  (OCR) dagegen schon, falls du es statt Tesseract ausprobierst.
- **Speicherbandbreite** bestimmt, wie schnell ein Sprachmodell Text ausgibt. Beim M4 reicht sie für ein 7–8B-Modell
  in q4 gut für interaktives Arbeiten. Genaue Zahlen hängen vom Modell ab; miss sie selbst, denn Ollama zeigt sie
  mit `ollama run <modell> --verbose` als „eval rate“ (Tokens pro Sekunde) an.
- **Faustregel bei 16 GB:** Modelle bis ca. 10 GB Größe, damit macOS, Browser und Streamlit Platz behalten. Nicht
  zwei große Modelle gleichzeitig laden.
- **Empfehlung für den Start mit 16 GB:** `qwen2.5:3b` für Verteiler/Kategorien/Haushalt, `qwen2.5:7b` oder
  `llama3.1:8b` für Verträge, YOLO `yolo11n` fürs Typenschild-Training, LoRA erst mit einem 1,5–3B-Modell.

**Hinweise zum MacBook Air:**
- Es hat **keinen Lüfter** → bei langem Training wird es heiß und **drosselt** die Leistung. Training also in
  kurzen Läufen, auf fester Unterlage, Netzteil angeschlossen.
- Faustregel Speicherbedarf: Modell mit 7–8 Mrd. Parametern in q4 ≈ 4,5–5,5 GB RAM, 3B ≈ 2 GB.
- Nur **ein großes Modell gleichzeitig** laden; Ollama entlädt ungenutzte Modelle nach einigen Minuten.
- Plattenplatz: pro Modell 2–8 GB, YOLO-Daten und Trainingsläufe zusätzlich einige GB.

---

## 3. Die Werkzeuge — wer macht was?

| Werkzeug | Aufgabe | Läuft offline? | Lizenz (wichtig für später!) |
|---|---|---|---|
| **Ollama** | Sprach- und Bild-Sprachmodelle lokal ausführen, per HTTP-Schnittstelle (`http://localhost:11434`) | ✅ nach dem Herunterladen | MIT (Ollama selbst); **jedes Modell hat eigene Lizenz** (z. B. Llama-Lizenz, Apache-2.0 bei vielen Qwen-Modellen, Gemma-Bedingungen) — vor kommerzieller Nutzung prüfen |
| **YOLO (Ultralytics)** | Objekte im Bild finden und einrahmen; eigenes Training | ✅ | **AGPL-3.0** — für ein kommerzielles SaaS wie 4inOne heißt das: entweder eigenen Code offenlegen oder **Enterprise-Lizenz** kaufen. Für deinen privaten Prüfstand unproblematisch. |
| **OCR** (Tesseract, alternativ Apple Vision) | Text aus Bildern lesen | ✅ | Tesseract: Apache-2.0 |
| **pypdf** | Text aus PDFs mit Textebene lesen (ohne OCR) | ✅ | BSD |
| **Pydantic** | Antworten des Modells gegen ein festes Schema prüfen | ✅ | MIT |
| **MLX / mlx-lm** | Feintuning kleiner Sprachmodelle auf Apple Silicon (LoRA) | ✅ | MIT (Modelllizenz beachten) |
| **Streamlit** | Oberfläche deines Prüfstands | ✅ | Apache-2.0 |
| **Label Studio** (lokal) | Bilder/Texte beschriften für Training | ✅ lokal installiert | Apache-2.0 (Community) |

**Grundregel für 4inOne (aus dem Entwicklungsplan):** Zahlen, Summen, Fristen und Rechte berechnet **immer der
normale Code** (Python/Django) — das Sprachmodell hilft nur beim **Verstehen und Formulieren**. Kein Ergebnis wird ohne
Bestätigung durch den Menschen gespeichert.

---

## 4. Die Spezialisten für 4inOne

Jeder Spezialist hat **eine** Aufgabe, ein **festes Ausgabeformat** und **eigene Prüfregeln**. Ein Verteiler
(Router) entscheidet, wer zuständig ist.

| # | Spezialist | 4inOne-Bereich | Eingabe → Ausgabe | Technik | Modell-Vorschlag (Größe nach RAM) |
|---|---|---|---|---|---|
| 0 | **Verteiler** | alle | Text/Datei → „welcher Spezialist?“ | erst feste Regeln (Dateityp, Schlagwörter), dann kleines Modell | 1–3B (z. B. `qwen2.5:1.5b`, `llama3.2:3b`) |
| 1 | **Vertrags-Leser** | Haushalt › Verträge | PDF/Foto → Anbieter, Vertragsnummer, Beginn, Ende, Kündigungsfrist (Zahl + Tage/Monate), Betrag, Intervall, Preis ab Datum | pypdf bzw. OCR → Sprachmodell mit JSON-Schema → **Belegprüfung** | 7–8B (z. B. `qwen2.5:7b`, `llama3.1:8b`) |
| 2 | **Typenschild-Leser** | Haushalt › Geräte | Foto → Hersteller, Modell, Seriennummer (getrennt!) | **YOLO** findet das Typenschild → Ausschnitt → OCR → Regeln/Sprachmodell; `0/O`, `1/I/l` markieren | YOLO „nano/small“ + 3–7B |
| 3 | **Beleg-Leser** | Finanzen (Kassenbon) | Foto → Händler, Datum, Summe | OCR → Sprachmodell (JSON) → Summe gegen Positionen prüfen | 3–7B |
| 4 | **Kategorien-Helfer** | Finanzen › Transaktionen | Buchungstext („REWE Markt 1234“) → Kategorie-Vorschlag | Beispiele im Prompt (Few-Shot) aus den 4inOne-Kategorien; später ggf. LoRA | 1,5–3B |
| 5 | **Haushalts-Planer** | Haushalt › Aufgaben | Freitext → Aufgabe mit Raum, Wiederholung, Dauer | JSON-Schema mit den 4inOne-Werten (`recurrence_days`, Räume) | 3B |
| 6 | **Reise-Helfer** | Reisen | Ziel, Dauer, Jahreszeit → Packliste/To-dos als Vorschlag | Sprachmodell, nur Vorschläge, nichts automatisch anlegen | 3–7B |
| 7 | **Erklärer** | übergreifend | Frage + **von Python berechnete** Zahlen → verständlicher Satz | Retrieval/Kontext aus Testdaten; das Modell rechnet nie selbst | 7–8B |
| 8 | **Einbettungen (Suche)** | übergreifend | Texte → Vektoren für „ähnliche Einträge finden“ | `nomic-embed-text` o. ä. über Ollama | klein |

> Modellnamen sind **Beispiele**; das Angebot ändert sich. Aktuelle Auswahl: <https://ollama.com/library>.
> Für Bilder geeignete Modelle erkennst du dort am Hinweis „vision“ (z. B. Varianten von Qwen-VL, Gemma, LLaVA,
> MiniCPM-V, Moondream). Bild-Sprachmodelle sind für Text auf Fotos oft **schlechter als OCR + Sprachmodell** —
> unbedingt beides messen.

---

## 5. Aufbau des Prüfstands

```
ki-labor/                      ← eigener Ordner, NICHT im 4inOne-Repository
├── app.py                     Streamlit-Startseite
├── pages/
│   ├── 1_Vertrag.py           Spezialist 1
│   ├── 2_Typenschild.py       Spezialist 2 (YOLO)
│   ├── 3_Kategorien.py        Spezialist 4
│   └── 9_Auswertung.py        Messung aller Spezialisten
├── specialists/
│   ├── llm.py                 Verbindung zu Ollama (strukturierte Antworten)
│   ├── ocr.py                 PDF-Text und OCR
│   ├── contract.py            Vertrags-Leser inkl. Belegprüfung
│   ├── nameplate.py           YOLO + OCR für Typenschilder
│   └── categories.py          Kategorien-Helfer
├── schemas.py                 Pydantic-Schemas (die festen Ausgabeformate)
├── data/
│   ├── test/contracts/        fiktive Test-PDFs + erwartete Felder (*.json)
│   ├── test/nameplates/       fiktive Fotos + erwartete Felder
│   ├── test/transactions.csv  Buchungstexte + richtige Kategorie
│   └── yolo/                  Trainingsbilder + Beschriftungen (YOLO-Format)
├── eval/run_eval.py           Messskript (Trefferquote je Feld)
└── requirements.txt
```

**Ablauf einer Anfrage:**

```
Datei/Text ─▶ Verteiler ─▶ Spezialist
                              │
          (Bild) YOLO ─▶ Ausschnitt ─▶ OCR ─┐
          (PDF)  pypdf ─────────────────────┤
                                            ▼
                         Sprachmodell (Ollama, JSON-Schema)
                                            ▼
                Pydantic-Prüfung + Belegprüfung (steht das Feld wirklich im Text?)
                                            ▼
          Streamlit zeigt Vorschlag: sicher ✓ / unsicher ⚠ / fehlt — Mensch korrigiert
```

---

## 6. Einrichtung Schritt für Schritt (selbst ausführen)

> Alles in einem **eigenen Ordner** außerhalb von 4inOne. Downloads: Python-Pakete (~1–2 GB mit PyTorch für YOLO),
> Modelle (je 1–8 GB), Tesseract (~30 MB).

**6.1 Grundlagen**

```bash
# Homebrew-Pakete (falls nicht vorhanden): OCR mit deutscher Sprache
brew install tesseract tesseract-lang

# Eigener Ordner + virtuelle Umgebung
mkdir -p ~/ki-labor && cd ~/ki-labor
python3 -m venv .venv
source .venv/bin/activate

# Pakete
pip install streamlit ollama pydantic pypdf pytesseract pillow ultralytics
```

**6.2 Modelle laden** (Auswahl nach RAM, siehe Abschnitt 2)

```bash
ollama pull qwen2.5:3b          # Verteiler, Kategorien, Haushalt (klein, schnell)
ollama pull qwen2.5:7b          # Vertrags-Leser, Erklärer (ab 16 GB RAM)
ollama pull nomic-embed-text    # Suche/Ähnlichkeit
# optional ein Bild-Sprachmodell zum Vergleich mit OCR, z. B. eines mit „vision“-Hinweis aus der Ollama-Bibliothek
ollama list                     # was ist installiert?
```

**6.3 Prüfen, ob Ollama läuft**

```bash
curl http://localhost:11434/api/tags
```

---

## 7. Beispiel-Code (Kern)

### 7.1 Feste Ausgabeformate — `schemas.py`

```python
from datetime import date
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ContractFields(BaseModel):
    """Felder wie im 4inOne-Vertragsformular. Fehlendes bleibt None — nie raten."""
    provider: Optional[str] = None
    name: Optional[str] = None
    contract_number: Optional[str] = None
    signed_date: Optional[date] = None          # Abschlussdatum (≠ Beginn!)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notice_value: Optional[int] = Field(None, ge=0, le=1095)
    notice_unit: Optional[Literal['DAYS', 'MONTHS']] = None
    cost: Optional[Decimal] = Field(None, gt=0, le=Decimal('99999.99'))
    currency: Optional[str] = None
    billing_cycle: Optional[Literal['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']] = None
    next_cost: Optional[Decimal] = None          # angekündigter Preis …
    next_cost_from: Optional[date] = None        # … ab diesem Tag
    evidence: dict[str, str] = {}                # Feld → wörtliches Zitat aus dem Dokument


class NameplateFields(BaseModel):
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    ambiguous: list[str] = []                    # z. B. ["serial_number: 0/O an Stelle 4"]


class CategorySuggestion(BaseModel):
    category: str
    confidence: Literal['hoch', 'mittel', 'niedrig']
```

### 7.2 Verbindung zu Ollama mit festem Format — `specialists/llm.py`

```python
import ollama
from pydantic import BaseModel


def ask_structured(model: str, system: str, user: str, schema: type[BaseModel], images: list[bytes] | None = None):
    """Fragt ein lokales Modell und erzwingt das JSON-Schema. temperature=0 → möglichst gleichbleibende Antworten."""
    message = {'role': 'user', 'content': user}
    if images:
        message['images'] = images
    response = ollama.chat(
        model=model,
        messages=[{'role': 'system', 'content': system}, message],
        format=schema.model_json_schema(),   # Ollama „structured outputs“
        options={'temperature': 0},
    )
    return schema.model_validate_json(response.message.content)  # ungültig → Fehler statt Unsinn
```

### 7.3 Text aus PDF oder Foto — `specialists/ocr.py`

```python
import io
import pytesseract
from PIL import Image
from pypdf import PdfReader


def pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return '\n'.join(page.extract_text() or '' for page in reader.pages[:10])


def image_text(data: bytes) -> str:
    return pytesseract.image_to_string(Image.open(io.BytesIO(data)), lang='deu+eng')
```

### 7.4 Vertrags-Leser mit Belegprüfung — `specialists/contract.py`

```python
from schemas import ContractFields
from specialists.llm import ask_structured

SYSTEM = (
    'Du liest deutsche Verträge und füllst NUR Felder, die wörtlich im Text stehen. '
    'Abschlussdatum und Vertragsbeginn unterscheiden. Kündigungsfrist als Zahl + Einheit (DAYS oder MONTHS). '
    'Berechne nichts (kein Vertragsende, keine Kündigungsfrist ausrechnen). '
    'Für jedes gefüllte Feld ein wörtliches Zitat in "evidence". Unsicher oder nicht vorhanden → null.'
)


def read_contract(text: str, model: str = 'qwen2.5:7b') -> tuple[ContractFields, dict[str, str]]:
    fields = ask_structured(model, SYSTEM, text[:12000], ContractFields)
    status = {}
    for name, value in fields.model_dump(exclude={'evidence'}).items():
        if value is None:
            status[name] = 'fehlt'
        elif fields.evidence.get(name) and fields.evidence[name] in text:
            status[name] = 'sicher'      # Zitat steht wirklich im Dokument
        else:
            status[name] = 'prüfen'      # kein Beleg → Mensch muss bestätigen
    return fields, status
```

### 7.5 YOLO: Typenschild finden — `specialists/nameplate.py`

```python
from ultralytics import YOLO

# Nach eigenem Training (Abschnitt 8.1): runs/detect/train/weights/best.pt
detector = YOLO('runs/detect/train/weights/best.pt')


def find_nameplate(image_path: str):
    result = detector.predict(image_path, conf=0.5, device='mps', verbose=False)[0]
    if not len(result.boxes):
        return None                                  # nichts gefunden → Mensch tippt ab
    x1, y1, x2, y2 = map(int, result.boxes.xyxy[0].tolist())
    return result.orig_img[y1:y2, x1:x2]             # Ausschnitt für die OCR


CONFUSABLE = {'0': 'O', 'O': '0', '1': 'I', 'I': '1', 'l': '1', '5': 'S', 'S': '5', '8': 'B', 'B': '8'}

def ambiguous_positions(serial: str) -> list[int]:
    """Stellen, an denen OCR oft verwechselt — werden in der Oberfläche markiert, nie still korrigiert."""
    return [i for i, ch in enumerate(serial) if ch in CONFUSABLE]
```

### 7.6 Streamlit-Seite — `pages/1_Vertrag.py`

```python
import streamlit as st
from specialists.ocr import pdf_text, image_text
from specialists.contract import read_contract

st.title('Vertrags-Leser (offline)')
st.caption('Nur fiktive oder eigene Testdokumente verwenden. Nichts verlässt diesen Mac.')
upload = st.file_uploader('Vertrag (PDF oder Foto)', type=['pdf', 'png', 'jpg', 'jpeg'])
if upload:
    data = upload.read()
    text = pdf_text(data) if upload.type == 'application/pdf' else image_text(data)
    with st.spinner('Lokales Modell liest …'):
        fields, status = read_contract(text)
    icon = {'sicher': '✅', 'prüfen': '⚠️', 'fehlt': '—'}
    for name, value in fields.model_dump(exclude={'evidence'}).items():
        st.text_input(f'{icon[status[name]]} {name}', value='' if value is None else str(value))
    with st.expander('Belege (Zitate aus dem Dokument)'):
        st.json(fields.evidence)
```

Starten: `streamlit run app.py` → Browser öffnet `http://localhost:8501`.

---

## 8. Trainieren — was geht offline wirklich?

### 8.1 YOLO feintunen (Typenschild finden) — **gut machbar**

1. **Bilder sammeln:** 100–300 Fotos von Typenschildern (eigene Geräte, verschiedene Winkel/Licht). Keine fremden
   Personen/Wohnungen im Bild.
2. **Beschriften** (offline): Label Studio lokal (`pip install label-studio && label-studio start`) oder labelImg —
   ein Kästchen pro Typenschild, Klasse `nameplate`. Export im **YOLO-Format**.
3. **Ordner + Beschreibung** `data/yolo/nameplate.yaml`:
   ```yaml
   path: data/yolo
   train: images/train
   val: images/val
   names:
     0: nameplate
   ```
4. **Training auf dem Mac (Apple-Grafik „mps“):**
   ```python
   from ultralytics import YOLO
   model = YOLO('yolo11n.pt')            # kleinstes vortrainiertes Modell (Download einmalig)
   model.train(data='data/yolo/nameplate.yaml', epochs=50, imgsz=640, batch=8, device='mps')
   ```
   Dauer auf einem MacBook Air: grob Minuten bis wenige Stunden je nach Bildzahl; Pausen gegen Überhitzung.
5. **Bewerten:** Ultralytics gibt mAP (Trefferqualität) aus; zusätzlich 20 **neue** Fotos testen, die nie im Training waren.

### 8.2 Sprachmodell feintunen (z. B. Kategorien-Helfer) — **machbar, aber erst wenn nötig**

Weg auf Apple Silicon: **MLX** (von Apple) → LoRA-Adapter trainieren → zu Ollama bringen.

1. **Daten** als JSONL (eine Zeile pro Beispiel), mind. einige hundert gute Beispiele aus **fiktiven/eigenen** Daten:
   ```json
   {"messages": [{"role": "user", "content": "Buchungstext: REWE Markt 1234"}, {"role": "assistant", "content": "{\"category\": \"Lebensmittel\", \"confidence\": \"hoch\"}"}]}
   ```
   Aufteilen in `data/lora/train.jsonl`, `valid.jsonl`, `test.jsonl`.
2. **Training** (kleines Modell, z. B. 1–3B, aus Hugging Face):
   ```bash
   pip install mlx-lm
   mlx_lm.lora --model <hf-modellname> --train --data data/lora --iters 600 --batch-size 1
   ```
3. **Zusammenführen und exportieren:** `mlx_lm.fuse` (Adapter in das Modell einbauen); für Ollama wird ein **GGUF**
   gebraucht — je nach Modellarchitektur direkt über `mlx_lm.fuse … --export-gguf` oder mit dem Umwandlungsskript aus
   llama.cpp. *Genaue Optionen vor dem Einsatz in der aktuellen mlx-lm-Dokumentation nachsehen.*
4. **In Ollama einbinden** — Datei `Modelfile`:
   ```
   FROM ./kategorien-helfer.gguf
   PARAMETER temperature 0
   SYSTEM "Du ordnest Buchungstexte genau einer 4inOne-Kategorie zu."
   ```
   ```bash
   ollama create kategorien-helfer -f Modelfile
   ollama run kategorien-helfer
   ```
5. **Vorher/Nachher messen** (Abschnitt 9). Wird es nicht messbar besser → beim Prompt-Ansatz bleiben.

> **Warum nicht gleich feintunen?** Ohne gute, ausreichend viele Beispiele lernt das Modell Fehler mit; außerdem kann
> es Fähigkeiten verlieren. Few-Shot-Beispiele im Prompt + festes JSON-Schema bringen oft 80–90 % des Nutzens.

### 8.3 Was **nicht** geht

- Ein eigenes großes Sprachmodell von Grund auf trainieren (braucht Rechenzentren, Monate, Millionen Euro).
- Große Modelle (> ~14B) auf einem MacBook Air sinnvoll feintunen.
- „Ollama trainieren lassen“ — Ollama führt Modelle aus; trainiert wird mit MLX/Ultralytics.

---

## 9. Prüfen und Messen — damit du es überprüfen kannst

**Testdaten (nur fiktiv oder eigene, nie echte fremde Daten):**
- 10 Verträge: Telekom-Beispiel aus der 4inOne-QA (39,99 €, 01.01.–31.12.2027, 1 Monat Frist, 34,99 € ab 01.03.2027),
  Strom 75 €, plus Varianten: Scan, schräges Handyfoto, ohne Kündigungsfrist, mit Preisänderung.
- 10 Typenschilder: Samsung TEST-WM-100 / TEST-ABC-123 und eigene Geräte.
- 100 Buchungstexte mit richtiger Kategorie (aus den 4inOne-Demo-Kategorien).
- Zu jeder Datei eine `*.json` mit den **erwarteten** Feldern.

**Messskript-Idee** (`eval/run_eval.py`): Für jedes Dokument jeden Feldwert vergleichen und zählen:

| Ergebnis | Bedeutung | Ziel |
|---|---|---|
| richtig | Wert stimmt | möglichst hoch |
| leer gelassen | Modell war unsicher | ok — lieber leer als falsch |
| **falsch** | Wert stimmt nicht | **bei Datum, Fristen, Beträgen: 0** |

Zusätzlich messen: Dauer pro Dokument (Sekunden), RAM-Verbrauch (Aktivitätsanzeige), Ergebnis bei Wiederholung gleich?

**Prüfliste für dich:**
- [ ] Läuft alles mit **WLAN aus**? (echter Offline-Test)
- [ ] Erfindet das Modell Felder, die nicht im Dokument stehen? (Belegprüfung zeigt ⚠️)
- [ ] Werden Abschlussdatum und Vertragsbeginn unterschieden?
- [ ] Wird „1 Monat“ als `1 + MONTHS` erkannt (nicht 30 Tage)?
- [ ] Werden `0/O`, `1/I` in Seriennummern markiert statt still „korrigiert“?
- [ ] Ist „falsch“ bei Beträgen/Fristen wirklich 0?
- [ ] Wie lange dauert ein Dokument? Wird der Mac heiß?

---

## 10. Datenschutz und Sicherheit

- Ollama nur auf `localhost` lassen (Standard). Nicht ins Netz freigeben.
- Für Training und Tests **nur fiktive oder eigene Dokumente**. Keine Online-Beschriftungsdienste mit echten
  Verträgen/Ausweisen.
- Testdaten **nicht** ins 4inOne-Repository legen (die `.gitignore` von 4inOne schließt u. a. Datenbanken, Uploads,
  `*.har` und Beta-Auswertungen aus; ein eigener Ordner `~/ki-labor` ist sicherer).
- Modelle und Pakete nur aus offiziellen Quellen (ollama.com, Hugging Face, PyPI).

---

## 11. Vom Prüfstand zu 4inOne — später, nach deiner Freigabe

Der Plan dafür steht bereits in `docs/SMART_SCAN_V1_PLAN.md` (zurückgestellt). Wenn der Prüfstand gute Messwerte liefert:

1. Spezialisten mit den besten Werten auswählen (Messbericht aus Abschnitt 9).
2. In 4inOne als Django-Dienst einbauen: Upload → Job → Vorschlag → **bestehender Dialog** zum Prüfen → Speichern über
   die bestehende API → Verbindungen erst danach anbieten (Connection Engine V2, Schalter standardmäßig aus).
3. Lizenzen klären (YOLO: AGPL → Enterprise-Lizenz oder Alternative; Modell-Lizenzen).
4. Im SaaS-Betrieb: Verarbeitungsort transparent machen — Ollama auf einem Server ist **nicht** offline auf dem Gerät
   der Nutzer.

---

## 12. Fahrplan

| Woche | Ziel | Fertig, wenn … |
|---|---|---|
| 1 | Prüfstand einrichten, Ollama + Streamlit, Spezialist 4 (Kategorien) nur mit Prompt | 100 Buchungstexte gemessen |
| 2 | Spezialist 1 (Vertrag) mit pypdf/OCR + Belegprüfung | 10 Testverträge gemessen, „falsch“ bei Fristen = 0 |
| 3 | YOLO für Typenschilder: 100–300 Fotos beschriften, trainieren | erkennt Typenschild auf neuen Fotos zuverlässig |
| 4 | Spezialist 2 (Typenschild) komplett, Verwechslungen markiert | 10 Testfotos gemessen |
| 5 | Nur wo nötig: LoRA-Feintuning (z. B. Kategorien) | messbar besser als der Prompt-Ansatz |
| 6 | Messbericht schreiben → Entscheidung über Übernahme in 4inOne | du hast alles selbst geprüft |

---

## 13. Begriffe kurz erklärt

| Begriff | Bedeutung |
|---|---|
| **LLM / Sprachmodell** | KI, die Text versteht und erzeugt (z. B. Llama, Qwen, Gemma) |
| **Bild-Sprachmodell (VLM)** | Sprachmodell, das zusätzlich Bilder versteht |
| **YOLO** | „You Only Look Once“ — schnelle Objekterkennung im Bild (Kästchen + Klasse), liest keinen Text |
| **OCR** | Texterkennung aus Bildern |
| **Quantisierung (q4, q8)** | Modell verkleinert → weniger RAM, etwas weniger Genauigkeit |
| **Few-Shot** | Ein paar Beispiele im Prompt zeigen, was erwartet wird — ohne Training |
| **LoRA** | Sparsames Feintuning: nur kleine Zusatzgewichte werden trainiert |
| **GGUF** | Dateiformat für Modelle, das Ollama/llama.cpp lesen |
| **Modelfile** | Rezept, mit dem Ollama ein eigenes Modell zusammenstellt |
| **JSON-Schema / Structured Outputs** | Das Modell muss in einem festen Format antworten — maschinell prüfbar |
| **RAG** | Passende Textstellen werden gesucht und dem Modell mitgegeben (statt es zu trainieren) |
| **mAP** | Qualitätsmaß für Objekterkennung (YOLO) |

---

## 14. Quellen und Dokumentation (zum Nachlesen, Stand jeweils prüfen)

- Ollama: <https://ollama.com> · Modellbibliothek: <https://ollama.com/library> · API/Structured Outputs: Ollama-Dokumentation auf GitHub (`ollama/ollama`, Ordner `docs`)
- Ultralytics YOLO (Training, MPS, Lizenz): <https://docs.ultralytics.com>
- MLX und mlx-lm (LoRA auf Apple Silicon): <https://github.com/ml-explore/mlx-examples> bzw. `ml-explore/mlx-lm`
- Streamlit: <https://docs.streamlit.io>
- Tesseract OCR: <https://github.com/tesseract-ocr/tesseract>
- Label Studio: <https://labelstud.io>
- 4inOne intern: `docs/SMART_SCAN_V1_PLAN.md`, `4inOne_Entwicklungsplan_Connections_V2_Testing_SmartScan.md` (Phase 6/8)
