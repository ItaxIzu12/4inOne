"""Feste, bedeutungsbezogene Farben für private Finanz-Kategorien.

Regeln:
- Die Farbe folgt der Kategorie, nie ihrer Position in einer Liste. Die
  Übersicht sortiert nach Betrag; eine Farbe nach Position würde bei jeder
  neuen Ausgabe umspringen.
- Die Farbe folgt der Bedeutung: „Reisen“ trägt genau das Blau des Bereichs
  Reisen, „Wohnen“ den Rosaton des Bereichs Haushalt (maßgeblich ist der
  letzte Block .travel/.household in frontend/src/app/layout/app-shell.scss).
  Wohnen ist dabei eine Stufe dunkler als das Navigations-Rosa #eb4b92: in
  voller Helligkeit ist es für Menschen mit Rot-Grün-Schwäche nicht von Grün
  und bei normalem Sehen kaum von Orange zu unterscheiden. Gleicher Farbton,
  andere Stufe — so wie es der dataviz-Skill vorsieht („snap to the nearest
  passing step“).
- Nur diese sieben Farben. Sie sind mit dem Palette-Prüfer des dataviz-Skills
  berechnet, nicht geschätzt, und zwar für ALLE Paare, weil die Liste sich
  umsortiert und jede Kategorie neben jeder anderen stehen kann:
    normales Sehen   ΔE ≥ 15,6 (Grenze 15)
    Rot-Grün-Schwäche ΔE ≥ 9,0 (Ziel 8)
  Gelb und Aqua liegen auf Weiß unter 3:1 — zulässig, weil der Name immer
  direkt neben der Farbe steht (Farbe ist nie die einzige Information).
- Rot kommt nicht vor: Es steht in der App für negative Beträge.
- Eine achte Farbe wird nicht erfunden. Unbekannte eigene Kategorien bekommen
  das neutrale Grau von „Sonstiges“, wie „Andere“ in einem Diagramm.
"""

WOHNEN = '#c2336f'        # Rosa = Bereich Haushalt (dunklere Stufe von #eb4b92)
LEBENSMITTEL = '#eb6834'  # Orange
MOBILITAET = '#4a3aa7'    # Indigo (bewusst nicht Organisation-Lila)
FREIZEIT = '#dca800'      # Gelb
GESUNDHEIT = '#1baf7a'    # Aqua-Grün
REISEN = '#2e8aef'        # Blau = Bereich Reisen (identisch)
NEUTRAL = '#8a93a3'       # Grau für Sonstiges und Unbekanntes

CATEGORY_PALETTE = [WOHNEN, LEBENSMITTEL, MOBILITAET, FREIZEIT, GESUNDHEIT, REISEN, NEUTRAL]

# Ausgaben ohne Kategorie erscheinen in der Übersicht als „Sonstiges“ —
# deshalb dieselbe Farbe.
UNCATEGORISED_COLOR = NEUTRAL

# Stichworte für selbst angelegte Kategorien. Reihenfolge = Priorität.
_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (REISEN, ('reise', 'urlaub', 'hotel', 'flug', 'ferien')),
    (WOHNEN, ('wohn', 'miete', 'nebenkosten', 'strom', 'heizung', 'möbel', 'haushalt')),
    (LEBENSMITTEL, ('lebensmittel', 'essen', 'supermarkt', 'einkauf', 'restaurant', 'lieferdienst', 'getränke')),
    (MOBILITAET, ('mobil', 'auto', 'tank', 'bahn', 'öpnv', 'fahrrad', 'taxi', 'parken')),
    (GESUNDHEIT, ('gesund', 'arzt', 'apotheke', 'medikament', 'zahn', 'therapie')),
    (FREIZEIT, ('freizeit', 'hobby', 'sport', 'fitness', 'kino', 'konzert', 'streaming', 'kultur')),
]


def color_for_name(name: str) -> str:
    """Farbe einer Kategorie anhand ihrer Bedeutung. Wird einmal beim Anlegen
    gespeichert und danach nicht mehr aus der Position abgeleitet."""
    lowered = name.strip().lower()
    for color, keywords in _KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return color
    return NEUTRAL
