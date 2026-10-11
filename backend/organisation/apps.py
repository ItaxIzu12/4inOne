from django.apps import AppConfig


class OrganisationConfig(AppConfig):
    name = 'organisation'

    def ready(self):
        from . import signals  # noqa: F401
