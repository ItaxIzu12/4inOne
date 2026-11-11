"""Feste, bedeutungsbezogene Farben für private Finanz-Kategorien.

Regeln:
- Die Farbe folgt der Kategorie, nie ihrer Position in einer Liste. Die
  Übersicht sortiert nach Betrag; eine Farbe nach Position würde bei jeder
  neuen Ausgabe umspringen.
- Die Farbe folgt der Bedeutung: „Reisen“ trägt die Füllfarbe des Bereichs
  Reisen (--travel-fill), „Wohnen“ das Rosa des Bereichs Haushalt
  (--household-accent) – maßgeblich sind die Design-Tokens in
  frontend/src/styles.css. Für Reisen bewusst die Füll- statt der
  Akzentfarbe: Das dunklere Akzentblau #36608b läge bei Rot-Grün-Schwäche
  zu nah am Mobilität-Indigo (ΔE 7,9 < 8).
- Nur diese sieben Farben. Sie sind mit dem Palette-Prüfer des dataviz-Skills
  berechnet, nicht geschätzt, und zwar für ALLE Paare, weil die Liste sich
  umsortiert und jede Kategorie neben jeder anderen stehen kann:
    normales Sehen   ΔE2000 ≥ 17,7 (Grenze 15)
    Rot-Grün-Schwäche ΔE2000 ≥ 8,9 (Ziel 8; Deuteranopie/Protanopie nach Machado 2009)
  Nachgerechnet am 11.11.2026, als die Bereichsfarben auf Tokens umgestellt wurden.
  Gelb und Aqua liegen auf Weiß unter 3:1 — zulässig, weil der Name immer
  direkt neben der Farbe steht (Farbe ist nie die einzige Information).
- Rot kommt nicht vor: Es steht in der App für negative Beträge.
- Eine achte Farbe wird nicht erfunden. Unbekannte eigene Kategorien bekommen
  das neutrale Grau von „Sonstiges“, wie „Andere“ in einem Diagramm.
"""

WOHNEN = '#ab445f'        # Rosa = Bereich Haushalt (--household-accent)
LEBENSMITTEL = '#eb6834'  # Orange
MOBILITAET = '#4a3aa7'    # Indigo (bewusst nicht Organisation-Lila)
FREIZEIT = '#dca800'      # Gelb
GESUNDHEIT = '#1baf7a'    # Aqua-Grün
REISEN = '#3d6b9a'        # Blau = Bereich Reisen (--travel-fill)
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
