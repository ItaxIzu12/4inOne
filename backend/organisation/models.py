import uuid

from django.conf import settings
from django.core.files.storage import FileSystemStorage
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


class EventCategory(models.TextChoices):
    HEALTH = 'gesundheit', 'Gesundheit'
    SPORT = 'sport', 'Sport'
    FAMILY = 'familie', 'Familie'
    WORK = 'arbeit', 'Arbeit'
    LEISURE = 'freizeit', 'Freizeit'
    OTHER = 'sonstiges', 'Sonstiges'


class PersonalEvent(models.Model):
    """Private appointments, separate from the existing shared household calendar."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_events')
    title = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=240, blank=True)
    description = models.TextField(blank=True, max_length=5000)
    # Art des Termins — färbt ihn im Kalender und lässt sich filtern.
    category = models.CharField(max_length=12, choices=EventCategory.choices, default=EventCategory.OTHER)
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
    # Freies Projekt („Familie“, „Hausbau“) zum Gruppieren und Filtern; leer = ohne Projekt.
    project = models.CharField(max_length=60, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'due_time', 'id']
        indexes = [models.Index(fields=['owner', 'status', 'due_date'])]
        constraints = [models.CheckConstraint(condition=models.Q(due_time__isnull=True) | models.Q(due_date__isnull=False), name='personal_task_time_requires_date')]


class PersonalNote(models.Model):
    """Private Notiz — nur für die eigene Person sichtbar wie Termine und Aufgaben."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_notes')
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True, max_length=10000)
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-pinned', '-updated_at', '-id']
        indexes = [models.Index(fields=['owner', 'updated_at'])]


# Private Ablage AUSSERHALB von MEDIA_ROOT und ohne URL: Dateien sind nie direkt
# erreichbar, nur über den Endpunkt mit Eigentümer-Prüfung (docs/SECURITY.md).
def private_storage():
    # Als Funktion, damit Migrationen keinen rechnerspezifischen Pfad festschreiben.
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT, base_url=None)


def private_file_path(instance, filename):
    # Zufälliger Speichername; der Originalname wird nie als Pfad verwendet.
    return f'organisation/{instance.owner_id}/{uuid.uuid4().hex}'


class FileCategory(models.TextChoices):
    TRAVEL = 'reise', 'Reisedokumente'
    BOOKING = 'buchung', 'Buchungen'
    PERSONAL = 'persoenlich', 'Persönliches'
    CHECKLIST = 'checkliste', 'Checklisten'
    IMAGE = 'bild', 'Bilder'
    OTHER = 'sonstiges', 'Sonstiges'


class PersonalFile(models.Model):
    """Eine private Datei (Unterlagen, Bilder, Checklisten). Typ wird beim
    Hochladen am Inhalt geprüft, nicht am Dateinamen (organisation/files.py)."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_files')
    file = models.FileField(storage=private_storage, upload_to=private_file_path, max_length=200)
    # Nur zur Anzeige, bereinigt — nie als Pfad oder Header ungeprüft verwendet.
    name = models.CharField(max_length=160)
    content_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField()
    category = models.CharField(max_length=12, choices=FileCategory.choices, default=FileCategory.OTHER)
    favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # „Zuletzt verwendet“: Öffnen oder Herunterladen rückt die Datei nach vorn.
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-used_at', '-id']
        indexes = [models.Index(fields=['owner', 'used_at'])]
