from django.apps import apps


def test_integrations_app_is_registered():
    """Heimat externer Dienste (seit 24.11.2026: KI-Client in integrations/ai/), weiterhin ohne Models."""
    assert apps.is_installed('integrations')
