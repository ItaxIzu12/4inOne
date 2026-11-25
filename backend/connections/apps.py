from django.apps import AppConfig


class ConnectionsConfig(AppConfig):
    name = 'connections'

    def ready(self) -> None:
        from connections import signals  # noqa: F401  (registriert die Aufräum-Signale)
        from core import registry

        # Finanzen › Geplant: abgeleitete Posten (docs/ARCHITECTURE.md § 3.1 – Finanzen importiert connections nicht)
        registry.register(registry.PLANNED_EXPENSES, contracts_planned, order=10)
        registry.register(registry.PLANNED_EXPENSES, trips_planned, order=20)


def contracts_planned(user, start, end, rows):
    """Verbundene Verträge (CON-01). Sie ersetzen gleichnamige wiederkehrende Posten (sonst doppelt)."""
    from connections.auto_links import contract_planned

    return True, contract_planned(user, start, end, rows)


def trips_planned(user, start, end, rows):
    """Reisebudget im Abreisemonat, wenn die Reise mit Finanzen verbunden ist (R3)."""
    from connections.auto_links import trip_planned

    return False, trip_planned(user, start, end, rows)
