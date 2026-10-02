import pytest


@pytest.fixture(autouse=True)
def _legacy_household_finance_writable(request, settings):
    """Die Tests hier prüfen auch den eingefrorenen Schreibcode der alten
    Haushaltsfinanzen (ADR-001). Damit er testbar bleibt, wird das Schreiben
    für diese Tests wieder erlaubt — außer ein Test prüft ausdrücklich die
    Sperre (@pytest.mark.legacy_frozen)."""
    if request.node.get_closest_marker('legacy_frozen') is None:
        settings.LEGACY_HOUSEHOLD_FINANCE_WRITABLE = True
