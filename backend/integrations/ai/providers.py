"""Provider des AI Service Adapters (docs/AI_INTEGRATION.md § 2.2, gemeinsamer Standard).

Der Adapter (`integrations/ai/client.py`) spricht immer dieselbe Schnittstelle; welcher Provider dahinter antwortet,
legt `AI_PROVIDER` fest:

- `core` (Standard): der Personal AI Core über seine versionierte REST-API (`/v1/capabilities`, `/v1/tasks/…`,
  `/v1/health`). Welches Modell er nutzt, ist seine Sache – ein Modellwechsel ändert in Veyora nichts.
- `mock`: deterministische Antworten im Prozess, für die Entwicklung, solange der Core nicht verfügbar ist. Jede
  Fähigkeit bringt ihre Mock-Antwort selbst mit (`Capability.mock`). In Produktion verboten (`check --deploy`).

Veyora bindet nie selbst ein Modell ein.
"""

from __future__ import annotations

import json
import time
from typing import Protocol

import urllib3
from django.conf import settings
from rest_framework import serializers

from integrations.ai import capabilities, config
from integrations.ai.errors import AiInvalidResponse, AiTimeout, AiUnavailable


class Provider(Protocol):
    name: str

    def offered(self) -> dict[str, set[int]]:
        """Fähigkeiten, die der Provider gerade anbietet: Name → Versionen."""

    def send(self, capability: capabilities.Capability, body: bytes, envelope: dict, timeout: float) -> bytes:
        """Aufgabe ausführen, rohe JSON-Antwort zurück. Wirft AiTimeout/AiUnavailable/AiInvalidResponse."""

    def health(self) -> bool: ...


# ------------------------------------------------------------------ Personal AI Core (HTTP)
class _OfferedSerializer(serializers.Serializer):
    name = serializers.RegexField(r'^[a-z][a-z0-9_]{1,63}$')
    version = serializers.IntegerField(min_value=1, required=False)
    versions = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, max_length=20)


class _CapabilitiesSerializer(serializers.Serializer):
    capabilities = _OfferedSerializer(many=True, max_length=200)


class CoreProvider:
    name = 'core'

    def _pool(self, timeout: float) -> urllib3.PoolManager:
        kwargs = {'timeout': urllib3.Timeout(connect=min(3.0, timeout), read=timeout), 'retries': False}
        if settings.AI_CORE_CA_BUNDLE:
            kwargs['ca_certs'] = settings.AI_CORE_CA_BUNDLE
        return urllib3.PoolManager(**kwargs)

    def _headers(self, extra: dict | None = None) -> dict:
        return {'Authorization': f'Bearer {config.token()}', 'X-Client-App': settings.AI_APPLICATION_ID, **(extra or {})}

    @staticmethod
    def _read_limited(response) -> bytes:
        limit = settings.AI_MAX_RESPONSE_BYTES
        body = response.read(limit + 1, decode_content=True)
        if len(body) > limit:
            raise AiInvalidResponse('Antwort zu groß')
        return body

    def _call(self, method: str, path: str, timeout: float, body: bytes | None = None, headers: dict | None = None) -> bytes:
        try:
            response = self._pool(timeout).request(method, f'{settings.AI_CORE_URL}{path}', body=body, redirect=False,
                                                   preload_content=False, headers=self._headers(headers))
        except (urllib3.exceptions.TimeoutError, urllib3.exceptions.ReadTimeoutError):
            raise AiTimeout()
        except urllib3.exceptions.HTTPError:
            raise AiUnavailable('nicht erreichbar')
        try:
            if response.status in (401, 403):
                raise AiUnavailable(f'auth_{response.status}')
            if response.status != 200:
                raise AiUnavailable(f'http_{response.status}')
            try:
                return self._read_limited(response)
            except urllib3.exceptions.ReadTimeoutError:
                raise AiTimeout()
            except urllib3.exceptions.HTTPError:
                raise AiUnavailable('read_error')
        finally:
            response.release_conn()

    def offered(self) -> dict[str, set[int]]:
        raw = self._call('GET', '/v1/capabilities', timeout=min(3.0, settings.AI_TIMEOUT_SECONDS))
        try:
            data = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise AiInvalidResponse('Fähigkeitenliste ist kein JSON')
        checked = _CapabilitiesSerializer(data=data)
        if not isinstance(data, dict) or not checked.is_valid():
            raise AiInvalidResponse('Fähigkeitenliste ungültig')
        result: dict[str, set[int]] = {}
        for item in checked.validated_data['capabilities']:
            versions = set(item.get('versions') or []) | ({item['version']} if item.get('version') else set())
            if versions:
                result.setdefault(item['name'], set()).update(versions)
        return result

    def send(self, capability, body: bytes, envelope: dict, timeout: float) -> bytes:
        return self._call('POST', f'/v1/tasks/{capability.name}', timeout, body=body,
                          headers={'Content-Type': 'application/json', 'X-Request-Id': envelope['request_id']})

    def health(self) -> bool:
        try:
            return json.loads(self._call('GET', '/v1/health', timeout=3.0) or b'{}').get('status') == 'ok'
        except (AiUnavailable, AiInvalidResponse, ValueError):
            return False


# ------------------------------------------------------------------ Mock (Entwicklung)
class MockProvider:
    """Antwortet im Prozess mit der Mock-Antwort der Fähigkeit – gleicher Rahmen, gleiche Prüfungen wie beim Core."""

    name = 'mock'

    def offered(self) -> dict[str, set[int]]:
        return {c.name: {c.version} for c in capabilities.CAPABILITIES.values() if c.mock is not None}

    def send(self, capability, body: bytes, envelope: dict, timeout: float) -> bytes:
        started = time.monotonic()
        result = capability.mock(envelope['input'])
        return json.dumps({
            'schema_version': envelope['schema_version'],
            'request_id': envelope['request_id'],
            'status': 'ok',
            'result': result,
            'evidence': [],
            'confidence': {},
            'model': 'mock',
            'duration_ms': int((time.monotonic() - started) * 1000),
        }, default=str).encode('utf-8')

    def health(self) -> bool:
        return True


_PROVIDERS = {'core': CoreProvider, 'mock': MockProvider}


def current() -> Provider:
    return _PROVIDERS[settings.AI_PROVIDER]()
