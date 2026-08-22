from django.conf import settings
from django.db import models

from core.models import Household


class CalendarEvent(models.Model):
    """Ein Termin im gemeinsamen Haushaltskalender (GESAMTKONZEPT.md §5).

    Bewusst schlank gehalten für den MVP — kein eigener Kalender-Unterbau,
    Fokus liegt auf Verknüpfung mit Finanzen/Haushalt statt Konkurrenz zu
    etablierten Kalender-Apps (siehe GESAMTKONZEPT.md §5 zu Organisation).
    """

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='calendar_events')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    title = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f'{self.title} ({self.starts_at:%Y-%m-%d})'
