from django.apps import apps


def test_integrations_app_is_registered():
    """Platzhalter: die App existiert nur als Grundgerüst für die spätere
    Banking-Anbindung (ARCHITEKTUR.md §7.1/Phase 5), noch ohne Models."""
    assert apps.is_installed('integrations')
