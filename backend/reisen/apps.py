from django.apps import AppConfig


class ReisenConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reisen'
    verbose_name = 'Reisen'

    def ready(self):
        from . import core_hooks

        core_hooks.register()  # Anmeldung bei core/registry.py
