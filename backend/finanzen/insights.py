"""Regelbasierte Finanz-Hinweise für den Analysen-Tab (finanzen/views.py
AnalysenView).

AUSDRÜCKLICH KEIN KI-/LLM-Aufruf: reine Python-Funktion mit festen
Schwellenwert-Regeln auf bereits berechneten Prozentsätzen (if/else), kein
externer API-Aufruf, kein laufender Kostenpunkt, keine neue Sicherheitsfläche
durch Prompt-Injection — siehe Chat-Verlauf."""

from decimal import Decimal


def berechne_insights(gesamteinkommen: Decimal, fixe_abzuege: Decimal, puffer: Decimal) -> list[dict]:
    """Erwartet bereits aggregierte Werte (Haushalts-Gesamteinkommen, Summe
    der AKTIVEN festen Abzüge, monatlicher Puffer) — die Funktion selbst
    liest nichts aus der Datenbank, damit sie unabhängig testbar bleibt."""
    insights: list[dict] = []
    if gesamteinkommen <= 0:
        return insights

    fixkosten_anteil = fixe_abzuege / gesamteinkommen
    puffer_anteil = puffer / gesamteinkommen

    if fixkosten_anteil > Decimal('0.5'):
        insights.append(
            {
                'typ': 'warnung',
                'text': (
                    'Eure festen Abzüge liegen bei über 50 % des Einkommens — eine gängige '
                    'Faustregel empfiehlt, darunter zu bleiben.'
                ),
            }
        )

    if puffer_anteil < Decimal('0.10'):
        insights.append(
            {
                'typ': 'hinweis',
                'text': (
                    'Euer Puffer liegt unter 10 % des Einkommens — etwas mehr Rücklage kann für '
                    'unerwartete Ausgaben helfen.'
                ),
            }
        )

    if fixkosten_anteil <= Decimal('0.5') and puffer_anteil >= Decimal('0.10'):
        insights.append(
            {
                'typ': 'positiv',
                'text': 'Fixkosten und Rücklage wirken in einem gesunden Verhältnis zueinander.',
            }
        )

    return insights
