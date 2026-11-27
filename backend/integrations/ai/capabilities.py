"""Fähigkeiten, die Veyora beim Personal AI Core anfragen darf (docs/AI_INTEGRATION.md § 4.4).

Seit 24.11.2026 ist **keine** Fähigkeit eingetragen: das Gerüst steht, aktiv ist nichts. Eine Fähigkeit kommt erst mit
ihrer eigenen Freigabe hinzu – vorher im Katalog in docs/AI_INTEGRATION.md § 4.5 beschrieben (gemeinsamer Standard:
neue Fähigkeiten sind Erweiterungen des Personal AI Core, keine Insellösung in Veyora) –, zusammen mit Ergebnis-Schema
(DRF-Serializer), Mock-Antwort, Tests und Oberfläche. Nutzbar ist sie nur, wenn sie in AI_CAPABILITIES steht UND der
Provider sie über GET /v1/capabilities in derselben Version anbietet.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from rest_framework import serializers


@dataclass(frozen=True)
class Capability:
    name: str
    version: int
    # Prüft `result` der Antwort; unbekannte Felder verwirft der Serializer, fehlende/falsche lassen den Vorschlag fallen.
    result_serializer: type[serializers.Serializer]
    # Höchstens so lange (Sekunden); None = AI_TIMEOUT_SECONDS.
    timeout: float | None = None
    # Zusätzliche Prüfung gegen die Anfrage, z. B. „Kategorie-ID muss aus der gesendeten Liste stammen“.
    validate_against_input: Callable[[dict, dict], None] | None = None
    # Feste Antwort für den Mock-Provider (Entwicklung ohne Core): input → result. Ohne Mock bietet der Mock die
    # Fähigkeit nicht an.
    mock: Callable[[dict], dict] | None = None


CAPABILITIES: dict[str, Capability] = {}


def register(capability: Capability) -> None:
    CAPABILITIES[capability.name] = capability


def unregister(name: str) -> None:
    CAPABILITIES.pop(name, None)


def get(name: str) -> Capability | None:
    return CAPABILITIES.get(name)
