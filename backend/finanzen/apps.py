from django.apps import AppConfig


class FinanzenConfig(AppConfig):
    name = 'finanzen'

    def ready(self):
        import finanzen.signals  # noqa: F401 — registriert den post_save-Receiver
