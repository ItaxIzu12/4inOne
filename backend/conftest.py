import pytest
from django.core.cache import caches


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """DRFs Rate-Limit-Zustand (core/auth_views.py) liegt bewusst NICHT in
    der Datenbank, sondern im 'throttle'-Cache (settings.py) — pytest-django
    setzt zwischen Tests automatisch nur die DB zurück, nicht diesen Cache.
    Ohne diesen Fixture würde ein Test, der ein Rate-Limit absichtlich
    ausreizt (z. B. test_register_rate_limit_blocks_after_configured_
    attempts), spätere, unabhängige Tests fälschlich mit 429 blockieren, weil
    der Zähler über den gesamten Testlauf hinweg bestehen bliebe."""
    caches['throttle'].clear()
    yield
    caches['throttle'].clear()


@pytest.fixture(autouse=True)
def _no_exchange_rate_network(settings):
    """Tests laden nie echte EZB-Kurse (core/fx.py) — Kurse legen die Tests selbst als ExchangeRate an."""
    settings.FX_FETCH_ENABLED = False
    caches['fx'].clear()
    yield
    caches['fx'].clear()
