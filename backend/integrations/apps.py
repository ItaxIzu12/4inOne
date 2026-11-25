from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    """Externe Dienste, seit 24.11.2026 zuerst der abschaltbare KI-Client (integrations/ai/, docs/AI_INTEGRATION.md)."""

    name = 'integrations'

    def ready(self):
        from integrations import checks  # noqa: F401 — registriert die Deploy-Prüfung
