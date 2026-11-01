from django.apps import AppConfig


class HaushaltConfig(AppConfig):
    name = 'haushalt'

    def ready(self):
        from . import signals  # noqa: F401
