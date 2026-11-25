from django.apps import AppConfig


class FinanzenConfig(AppConfig):
    name = 'finanzen'

    def ready(self):
        from . import core_hooks

        core_hooks.register()  # Anmeldung bei core/registry.py
        import finanzen.signals  # noqa: F401 — registriert den post_save-Receiver
