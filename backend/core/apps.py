from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        from core import checks, signals  # noqa: F401 — checks registriert sich beim Import

        signals.connect()
