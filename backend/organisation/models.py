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


class Recurrence(models.TextChoices):
    """Wiederholung eines Termins — berechnet über core/recurrence.py, es
    entstehen keine Datensätze pro Vorkommen."""
    NONE = '', 'Einmalig'
    DAILY = 'daily', 'Täglich'
    WEEKLY = 'weekly', 'Wöchentlich'
    MONTHLY = 'monthly', 'Monatlich'
    YEARLY = 'yearly', 'Jährlich'


class CalendarColor(models.TextChoices):
    """Farbe eines gemeinsamen Kalenders — eine feste Auswahl, keine freien Farbwerte."""
    AMBER = 'amber', 'Bernstein'
    BLUE = 'blue', 'Blau'
    GREEN = 'green', 'Grün'
    ROSE = 'rose', 'Rosé'
    VIOLET = 'violet', 'Violett'
    SLATE = 'slate', 'Schiefer'


class SharedCalendar(models.Model):
    """Ein gemeinsamer Kalender (31.10.2026), z. B. „Familie“ oder „WG“.

    Regeln (organisation/calendars.py, docs/AUTH_AND_PERMISSIONS.md › Gemeinsame Kalender):
    - Sehen: nur Mitglieder (CalendarMember). Private Termine (calendar=None) sieht nie jemand außer der Person,
      die sie angelegt hat — auch nicht als „beschäftigt“.
    - Mitglied wird man nur über eine angenommene Einladung (core/invitations.py, Scope CALENDAR).
    - Wird der Kalender gelöscht, werden seine Termine wieder private Termine der Person, die sie angelegt hat
      (on_delete=SET_NULL am Termin) — nichts geht verloren, nichts wird für andere sichtbar."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_calendars')
    name = models.CharField(max_length=60)
    color = models.CharField(max_length=8, choices=CalendarColor.choices, default=CalendarColor.AMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name', 'id']

    def __str__(self) -> str:
        return f'Kalender {self.pk}: {self.name}'


class CalendarMember(models.Model):
    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Besitzer:in'
        EDITOR = 'EDITOR', 'Kann bearbeiten'
        VIEWER = 'VIEWER', 'Kann ansehen'

    calendar = models.ForeignKey(SharedCalendar, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_memberships')
    role = models.CharField(max_length=6, choices=Role.choices, default=Role.VIEWER)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['added_at', 'id']
        constraints = [models.UniqueConstraint(fields=['calendar', 'user'], name='one_membership_per_calendar')]
        indexes = [models.Index(fields=['user', 'calendar'])]


class CalendarShare(models.Model):
    """Freigabe des eigenen Kalenders für eine Person (wie Outlook, 31.10.2026).

    Die Person sieht danach NUR die Termine, die `owner` ausdrücklich mit ihr teilt (EventShare) — private Termine
    bleiben unsichtbar, auch nicht als „beschäftigt“. Entsteht ausschließlich über eine angenommene Einladung
    (core/invitations.py, Scope MY_CALENDAR). Rolle: VIEWER sieht, EDITOR darf geteilte Termine auch ändern.
    Endet die Freigabe, verschwinden alle geteilten Termine sofort (EventShare-Zeilen werden gelöscht)."""

    class Role(models.TextChoices):
        EDITOR = 'EDITOR', 'Kann bearbeiten'
        VIEWER = 'VIEWER', 'Kann ansehen'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_shares_given')
    grantee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_shares_received')
    role = models.CharField(max_length=6, choices=Role.choices, default=Role.VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'grantee'], name='one_calendar_share_per_pair'),
            models.CheckConstraint(condition=~models.Q(owner=models.F('grantee')), name='calendar_share_not_self'),
        ]


class PersonalEvent(models.Model):
    """Privater Termin, getrennt vom alten gemeinsamen Haushaltskalender
    (CalendarEvent). Ganztägig: starts_at ist Mitternacht (Zeitzone der
    Person) des ersten Tags, ends_at Mitternacht des letzten Tags."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_events')
    title = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=240, blank=True)
    description = models.TextField(blank=True, max_length=5000)
    # Art des Termins — färbt ihn im Kalender und lässt sich filtern.
    category = models.CharField(max_length=12, choices=EventCategory.choices, default=EventCategory.OTHER)
    all_day = models.BooleanField(default=False)
    recurrence = models.CharField(max_length=8, choices=Recurrence.choices, blank=True, default='')
    # Gemeinsamer Kalender oder None = privat (nur `owner`). `owner` bleibt immer die Person, die den Termin angelegt
    # hat; wird der Kalender gelöscht, ist der Termin wieder ihr privater Termin.
    calendar = models.ForeignKey(SharedCalendar, on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['starts_at', 'id']
        indexes = [models.Index(fields=['owner', 'starts_at']), models.Index(fields=['calendar', 'starts_at'])]
        constraints = [models.CheckConstraint(condition=models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=models.F('starts_at')), name='personal_event_end_after_start')]


class EventShare(models.Model):
    """Ein Termin, den `event.owner` mit einer Person teilt, für die der eigene Kalender freigegeben ist.
    Sichtbar nur, solange die Freigabe (CalendarShare owner → user) besteht — die Prüfung macht
    organisation/calendars.py, nicht diese Zeile allein."""

    event = models.ForeignKey(PersonalEvent, on_delete=models.CASCADE, related_name='shares')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shared_events')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['event', 'user'], name='one_share_per_event_and_user')]
        indexes = [models.Index(fields=['user', 'event'])]


class PersonalTask(models.Model):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Offen'
        IN_PROGRESS = 'IN_PROGRESS', 'In Bearbeitung'
        DONE = 'DONE', 'Erledigt'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Niedrig'
        MEDIUM = 'MEDIUM', 'Normal'
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
    # Wiederholung wie im Haushalt (core/recurrence.py): alle N Tage ODER alle N Monate.
    # Erledigen rückt die Fälligkeit weiter, die Aufgabe bleibt offen.
    recurrence_days = models.PositiveSmallIntegerField(null=True, blank=True)
    recurrence_months = models.PositiveSmallIntegerField(null=True, blank=True)
    last_done_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'due_time', 'id']
        indexes = [models.Index(fields=['owner', 'status', 'due_date'])]
        constraints = [models.CheckConstraint(condition=models.Q(due_time__isnull=True) | models.Q(due_date__isnull=False), name='personal_task_time_requires_date')]


class PersonalNote(models.Model):
    """Private Notiz — nur für die eigene Person sichtbar wie Termine und Aufgaben.
    Der Titel ist optional; ohne Titel zeigt die Liste die erste Zeile des Inhalts."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_notes')
    title = models.CharField(max_length=120, blank=True, default='')
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
    # Anhang einer Notiz (31.10.2026). Notiz gelöscht → Datei gelöscht (Speicher räumt organisation/signals.py auf).
    note = models.ForeignKey('PersonalNote', on_delete=models.CASCADE, null=True, blank=True, related_name='attachments')

    class Meta:
        ordering = ['-used_at', '-id']
        indexes = [models.Index(fields=['owner', 'used_at'])]
