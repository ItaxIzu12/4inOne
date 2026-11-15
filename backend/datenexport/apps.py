from django.apps import AppConfig


class DatenexportConfig(AppConfig):
    """DSGVO-Datenexport (Art. 15 Auskunft, Art. 20 Datenübertragbarkeit). Eigene App, weil der Export aus allen
    Bereichen liest und `core` laut ARCHITEKTUR.md §2.1 nicht von den Fachbereichen abhängen darf. Keine Tabellen."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'datenexport'
    verbose_name = 'Datenexport'
