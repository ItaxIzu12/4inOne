"""Ist KI nutzbar? (docs/AI_INTEGRATION.md § 3)

Nur wenn ALLES stimmt: Hauptschalter an, Provider eingerichtet (Core: Adresse und Token; Mock: nur Entwicklung),
Fähigkeit im Code registriert, in der Erlaubt-Liste der Umgebung UND vom Provider gerade angeboten (Capability API).
Sonst gibt es keinen Aufruf.
"""

from __future__ import annotations

import ipaddress
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings

from integrations.ai import capabilities


def token() -> str:
    if settings.AI_CORE_TOKEN:
        return settings.AI_CORE_TOKEN
    if settings.AI_CORE_TOKEN_FILE:
        return _read_token_file(settings.AI_CORE_TOKEN_FILE)
    return ''


@lru_cache(maxsize=4)
def _read_token_file(path: str) -> str:
    try:
        return Path(path).read_text(encoding='utf-8').strip()
    except OSError:
        return ''


def is_internal_http(url: str) -> bool:
    """http ist nur erlaubt für 127.0.0.1/localhost/::1 und Docker-Dienstnamen ohne Punkt (internes Netz)."""
    parsed = urlparse(url)
    host = (parsed.hostname or '').lower()
    if not host:
        return False
    if host == 'localhost' or '.' not in host and ':' not in host:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def url_problem(url: str) -> str | None:
    """Warum diese Adresse nicht taugt – oder None."""
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        return 'AI_CORE_URL muss eine http(s)-Adresse sein.'
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        return 'AI_CORE_URL darf keine Zugangsdaten, Parameter oder Anker enthalten.'
    if parsed.scheme == 'http' and not is_internal_http(url):
        return 'http nur im internen Netz (Docker-Dienstname) oder auf 127.0.0.1 – sonst https verwenden.'
    return None


PROVIDERS = ('core', 'mock')


def configured() -> bool:
    if not settings.AI_ENABLED or settings.AI_PROVIDER not in PROVIDERS:
        return False
    if settings.AI_PROVIDER == 'mock':
        return True
    return bool(settings.AI_CORE_URL and token() and url_problem(settings.AI_CORE_URL) is None)


def ai_available(capability: str) -> bool:
    """Ohne Netz geprüft wird zuerst alles Lokale; erst dann fragt die (zwischengespeicherte) Capability API."""
    registered = capabilities.get(capability)
    if not (configured() and registered is not None and capability in settings.AI_CAPABILITIES):
        return False
    from integrations.ai import discovery

    return discovery.offers(registered.name, registered.version)
