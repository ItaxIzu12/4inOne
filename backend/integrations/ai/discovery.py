"""Dynamische Fähigkeiten-Abfrage (docs/AI_INTEGRATION.md § 4.1, gemeinsamer Standard).

Veyora nutzt eine Fähigkeit nur, wenn der Provider sie gerade in der passenden Version anbietet (`GET /v1/capabilities`).
Das Ergebnis wird je Prozess kurz zwischengespeichert (AI_CAPABILITY_CACHE_SECONDS). Schlägt die Abfrage fehl, gilt
für eine Minute „nichts verfügbar“ – dann gibt es keine Aufgaben-Aufrufe und keine Vorschläge, aber auch keine
Wartezeit für die Person.
"""

from __future__ import annotations

import logging
import threading
import time

from django.conf import settings

from integrations.ai.errors import AiError

logger = logging.getLogger(__name__)
FAILURE_CACHE_SECONDS = 60

_lock = threading.Lock()
_cache: dict = {'key': None, 'until': 0.0, 'offered': {}}


def _key() -> tuple:
    return (settings.AI_PROVIDER, settings.AI_CORE_URL)


def offered() -> dict[str, set[int]]:
    """Name → angebotene Versionen; {} wenn der Provider nichts anbietet oder nicht erreichbar ist."""
    from integrations.ai import client, providers

    now = time.monotonic()
    with _lock:
        if _cache['key'] == _key() and now < _cache['until']:
            return _cache['offered']
    if not client.breaker.allow():
        return {}
    try:
        result = providers.current().offered()
        until = now + settings.AI_CAPABILITY_CACHE_SECONDS
        client.breaker.success()
    except AiError as error:
        logger.warning('ai capabilities provider=%s outcome=%s', settings.AI_PROVIDER, error.code)
        client.breaker.failure()
        result, until = {}, now + FAILURE_CACHE_SECONDS
    with _lock:
        _cache.update(key=_key(), until=until, offered=result)
    return result


def offers(name: str, version: int) -> bool:
    return version in offered().get(name, set())


def reset() -> None:
    with _lock:
        _cache.update(key=None, until=0.0, offered={})
