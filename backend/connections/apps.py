from django.apps import AppConfig


class ConnectionsConfig(AppConfig):
    name = 'connections'

    def ready(self) -> None:
        from connections import signals  # noqa: F401  (registriert die Aufräum-Signale)
