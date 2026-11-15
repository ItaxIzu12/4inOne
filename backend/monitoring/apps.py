from django.apps import AppConfig


class MonitoringConfig(AppConfig):
    """Fehler-Monitoring (GlitchTip, Sentry-kompatibel) und Admin-Panel — docs/MONITORING.md.

    Eigene App: liest Anmelde-Ereignisse aus core (Signal) und meldet Auffälliges an GlitchTip. core weiß nichts davon.
    GlitchTip selbst läuft getrennt im Ordner monitoring/ (Projektwurzel, eigene Docker-Compose-Datei)."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'monitoring'
    verbose_name = 'Monitoring'

    def ready(self):
        from . import events

        events.connect()
