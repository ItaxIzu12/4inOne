"""AI Service Adapter: einziger Zugang von Lumiknot zu KI (docs/AI_INTEGRATION.md § 2–5, gemeinsamer Standard).

- Fachlogik ruft nur `request(capability, payload, user=…, area=…)` auf. Welcher Provider antwortet (Personal AI Core
  oder Mock) und welches Modell dahinter steckt, bleibt hier verborgen (`providers.py`).
- Nur aus Services der Bereiche aufrufen, NACH der Rechteprüfung und nur mit Daten, die die Person sehen darf.
- Ergebnis ist immer nur ein Vorschlag. Dieses Modul schreibt nichts in die Datenbank und kennt keine Bereichsmodelle.
- Jeder Fehler wird zu einer `AiError`-Unterklasse; Aufrufer machen dann ohne Vorschlag weiter.
- Logs enthalten nur Request-ID, Fähigkeit, Dauer und Ergebnisart – nie Inhalte.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field

from django.conf import settings

from integrations.ai import capabilities, config, providers
from integrations.ai.errors import (
    AiDisabled,
    AiInvalidResponse,
    AiRefused,
    AiRequestTooLarge,
    AiUnavailable,
)
from integrations.ai.schemas import SCHEMA_VERSION, EnvelopeSerializer

logger = logging.getLogger(__name__)

# Sperre nach wiederholten Fehlern: kein Request soll auf Timeouts warten, wenn der Core gerade weg ist.
FAILURE_LIMIT = 3
FAILURE_WINDOW = 300  # Sekunden
COOLDOWN = 300  # Sekunden


@dataclass
class AiResult:
    request_id: str
    result: dict
    evidence: list = field(default_factory=list)
    confidence: dict = field(default_factory=dict)
    duration_ms: int | None = None


class _Breaker:
    """Einfach und je Prozess: nach FAILURE_LIMIT Fehlern in FAILURE_WINDOW Sekunden COOLDOWN Sekunden Pause."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._failures: list[float] = []
        self._open_until = 0.0

    def allow(self) -> bool:
        with self._lock:
            return time.monotonic() >= self._open_until

    def failure(self) -> None:
        now = time.monotonic()
        with self._lock:
            self._failures = [t for t in self._failures if now - t < FAILURE_WINDOW] + [now]
            if len(self._failures) >= FAILURE_LIMIT:
                self._open_until = now + COOLDOWN
                self._failures = []

    def success(self) -> None:
        with self._lock:
            self._failures = []

    def reset(self) -> None:
        with self._lock:
            self._failures = []
            self._open_until = 0.0


breaker = _Breaker()


def subject_for(user) -> str:
    """Pseudonym statt Konto-ID oder E-Mail (§ 4.1): gleich je Person und Anwendung, nicht zurückrechenbar ohne
    SECRET_KEY. Andere Anwendungen am selben Core bekommen für dieselbe Person ein anderes Pseudonym."""
    message = f'{settings.AI_APPLICATION_ID}:{user.pk}'.encode()
    digest = hmac.new(f'4inone-ai:{settings.SECRET_KEY}'.encode(), message, hashlib.sha256).hexdigest()
    return f'hmac:{digest[:32]}'


def _log(level, request_id: str, capability: str, started: float, outcome: str) -> None:
    logger.log(level, 'ai provider=%s request_id=%s capability=%s duration_ms=%d outcome=%s', settings.AI_PROVIDER,
               request_id, capability, int((time.monotonic() - started) * 1000), outcome)


def health() -> bool:
    """Ist der Provider erreichbar? Für Admin/Monitoring; ändert die Sperre nicht."""
    return config.configured() and providers.current().health()


def request(capability_name: str, payload: dict, *, user=None, area: str = '', locale: str = 'de-DE') -> AiResult:
    """Fähigkeit ausführen und den geprüften Vorschlag zurückgeben. Wirft AiError-Unterklassen.

    `area` (finanzen, haushalt, organisation, reisen) sagt dem Core, aus welchem Anwendungskontext die Anfrage kommt."""
    if not config.ai_available(capability_name):
        raise AiDisabled()
    capability = capabilities.get(capability_name)
    if not breaker.allow():
        raise AiUnavailable('Sperre nach wiederholten Fehlern')

    request_id = uuid.uuid4().hex
    envelope = {
        'schema_version': SCHEMA_VERSION,
        'application': settings.AI_APPLICATION_ID,
        'capability': capability.name,
        'capability_version': capability.version,
        'request_id': request_id,
        'locale': locale,
        'input': payload,
    }
    if area:
        envelope['context'] = {'area': area}
    if user is not None:
        envelope['subject'] = subject_for(user)
    body = json.dumps(envelope, ensure_ascii=False, default=str).encode('utf-8')
    if len(body) > settings.AI_MAX_REQUEST_BYTES:
        raise AiRequestTooLarge()

    started = time.monotonic()
    try:
        raw = providers.current().send(capability, body, envelope, capability.timeout or settings.AI_TIMEOUT_SECONDS)
    except (AiUnavailable, AiInvalidResponse) as error:
        breaker.failure()
        # 401/403 fallen auf (falsches oder abgelaufenes Token) – ans Monitoring, ohne Inhalte
        level = logging.ERROR if str(error).startswith('auth_') else logging.WARNING
        _log(level, request_id, capability.name, started, str(error) or error.code)
        raise

    try:
        data = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        _log(logging.WARNING, request_id, capability.name, started, 'invalid_json')
        raise AiInvalidResponse('kein JSON')
    frame = EnvelopeSerializer(data=data)
    if not isinstance(data, dict) or not frame.is_valid():
        _log(logging.WARNING, request_id, capability.name, started, 'invalid_envelope')
        raise AiInvalidResponse('Rahmen ungültig')
    checked = frame.validated_data
    if checked['request_id'] != request_id:
        _log(logging.WARNING, request_id, capability.name, started, 'request_id_mismatch')
        raise AiInvalidResponse('falsche Request-ID')
    breaker.success()
    if checked['status'] == 'refused':
        _log(logging.INFO, request_id, capability.name, started, 'refused')
        raise AiRefused()
    if checked['status'] == 'error':
        _log(logging.WARNING, request_id, capability.name, started, 'core_error')
        raise AiUnavailable('Fehler im Core')

    result = capability.result_serializer(data=checked['result'])
    if not result.is_valid():
        _log(logging.WARNING, request_id, capability.name, started, 'invalid_result')
        raise AiInvalidResponse('Ergebnis ungültig')
    if capability.validate_against_input is not None:
        try:
            capability.validate_against_input(payload, result.validated_data)
        except ValueError:
            _log(logging.WARNING, request_id, capability.name, started, 'result_not_in_input')
            raise AiInvalidResponse('Ergebnis passt nicht zur Anfrage')
    _log(logging.INFO, request_id, capability.name, started, 'ok')
    return AiResult(
        request_id=request_id,
        result=dict(result.validated_data),
        evidence=[dict(item) for item in checked['evidence']],
        confidence=dict(checked['confidence']),
        duration_ms=checked['duration_ms'],
    )
