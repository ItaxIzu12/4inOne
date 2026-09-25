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


class PersonalEvent(models.Model):
    """Private appointments, separate from the existing shared household calendar."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_events')
    title = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=240, blank=True)
    description = models.TextField(blank=True, max_length=5000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['starts_at', 'id']
        indexes = [models.Index(fields=['owner', 'starts_at'])]
        constraints = [models.CheckConstraint(condition=models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=models.F('starts_at')), name='personal_event_end_after_start')]


class PersonalTask(models.Model):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Offen'
        IN_PROGRESS = 'IN_PROGRESS', 'In Bearbeitung'
        DONE = 'DONE', 'Erledigt'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Niedrig'
        MEDIUM = 'MEDIUM', 'Mittel'
        HIGH = 'HIGH', 'Hoch'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_tasks')
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=5000)
    due_date = models.DateField(null=True, blank=True)
    due_time = models.TimeField(null=True, blank=True)
    priority = models.CharField(max_length=6, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=11, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'due_time', 'id']
        indexes = [models.Index(fields=['owner', 'status', 'due_date'])]
        constraints = [models.CheckConstraint(condition=models.Q(due_time__isnull=True) | models.Q(due_date__isnull=False), name='personal_task_time_requires_date')]
