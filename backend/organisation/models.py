from django.conf import settings
from django.db import models

from core.models import Household


class CalendarEvent(models.Model):
    """Ein Termin im gemeinsamen Haushaltskalender (GESAMTKONZEPT.md §5).

    Bewusst schlank gehalten für den MVP — kein eigener Kalender-Unterbau,
    Fokus liegt auf Verknüpfung mit Finanzen/Haushalt statt Konkurrenz zu
    etablierten Kalender-Apps (siehe GESAMTKONZEPT.md §5 zu Organisation).
    """

    class Source(models.TextChoices):
        # Woher ein Termin stammt — automatisch erzeugte Termine (Haushalts-
        # aufgaben, Fristen aus dem Haushaltsordner) werden ausschließlich
        # von haushalt/services.py gepflegt und dürfen im Kalender nicht wie
        # ein manueller Termin behandelt werden (sonst überschreibt die
        # nächste Synchronisation eine Handänderung stillschweigend).
        MANUAL = 'manuell', 'Manuell'
        TASK = 'aufgabe', 'Haushaltsaufgabe'
        FOLDER = 'ordner', 'Haushaltsordner'

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='calendar_events')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    title = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    # Ganztägig: Aufgaben und Fristen haben ein Datum, keine Uhrzeit —
    # starts_at ist dann Mitternacht (lokale Zeit) dieses Tages.
    all_day = models.BooleanField(default=False)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    # Stabiler Schlüssel für automatisch erzeugte Termine (z. B.
    # "ordner:12:garantie"), damit eine erneute Synchronisation denselben
    # Termin aktualisiert statt einen zweiten anzulegen. Leer bei manuellen
    # Terminen.
    source_key = models.CharField(max_length=60, blank=True, default='')

    class Meta:
        indexes = [models.Index(fields=['household', 'source_key'])]

    def __str__(self) -> str:
        return f'{self.title} ({self.starts_at:%Y-%m-%d})'
