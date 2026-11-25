from django.apps import AppConfig


class HaushaltConfig(AppConfig):
    name = 'haushalt'

    def ready(self):
        from . import core_hooks

        core_hooks.register()  # Anmeldung bei core/registry.py
        from . import signals  # noqa: F401
