"""AI Readiness Layer: abschaltbarer Zugang zum Personal AI Core (docs/AI_INTEGRATION.md).

Öffentlich: `ai_available(capability)`, `request(...)`, `AiResult`, die Fehler aus `errors`. Standardmäßig aus
(`AI_ENABLED=False`); ohne Core arbeitet jede Funktion von Veyora wie bisher.
"""

from integrations.ai.client import AiResult, health, request
from integrations.ai.config import ai_available
from integrations.ai.errors import (
    AiDisabled,
    AiError,
    AiInvalidResponse,
    AiRefused,
    AiRequestTooLarge,
    AiTimeout,
    AiUnavailable,
)

__all__ = [
    'AiDisabled', 'AiError', 'AiInvalidResponse', 'AiRefused', 'AiRequestTooLarge', 'AiResult', 'AiTimeout',
    'AiUnavailable', 'ai_available', 'health', 'request',
]
