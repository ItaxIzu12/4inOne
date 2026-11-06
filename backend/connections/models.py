from django.conf import settings
from django.db import models
from django.db.models import Q


class ObjectType(models.TextChoices):
    """Verbindbare Objekte. Der Schlüssel ist bewusst fachlich, nicht der
    Modellname: TASK ist die persönliche Aufgabe aus Organisation,
    CALENDAR_EVENT der persönliche Termin, HOUSEHOLD_TASK die Aufgabe eines
    Haushalts. Welches Modell dahinter steckt, steht nur in registry.py."""

    TASK = 'TASK', 'Aufgabe'
    CALENDAR_EVENT = 'CALENDAR_EVENT', 'Termin'
    SAVINGS_GOAL = 'SAVINGS_GOAL', 'Sparziel'
    HOUSEHOLD_TASK = 'HOUSEHOLD_TASK', 'Haushaltsaufgabe'
    TRIP = 'TRIP', 'Reise'
    DEVICE = 'DEVICE', 'Gerät'
    CONTRACT = 'CONTRACT', 'Vertrag'
    # Vorgesehen, noch in keinem erlaubten Paar.
    BUDGET = 'BUDGET', 'Budget'


class RelationType(models.TextChoices):
    RELATED_TO = 'RELATED_TO', 'Gehört zusammen'
    TASK_FOR = 'TASK_FOR', 'Aufgabe für'
    SCHEDULED_AS = 'SCHEDULED_AS', 'Eingeplant als'
    FUNDED_BY = 'FUNDED_BY', 'Finanziert durch'
    AFFECTS = 'AFFECTS', 'Betrifft'


class Origin(models.TextChoices):
    MANUAL = 'MANUAL', 'Manuell'
    SUGGESTED = 'SUGGESTED', 'Vorgeschlagen'
    AUTOMATED = 'AUTOMATED', 'Automatisch'


class Connection(models.Model):
    """„Diese zwei Dinge gehören zusammen.“ Mehr nicht.

    Keine Fremdschlüssel in die Domains: Finanzen, Haushalt und Organisation
    bleiben unabhängig. Dafür gibt es keine referentielle Integrität — das
    Aufräumen gelöschter Objekte übernimmt signals.py.

    Eine Verbindung gewährt NIE Zugriff. Wer sie sehen will, muss beide
    Seiten sehen dürfen (services.py).

    Die Richtung ist pro Typpaar festgelegt (registry.ALLOWED_PAIRS), so dass
    A→B und B→A nie beide existieren können; die Oberfläche zeigt die
    Verbindung trotzdem auf beiden Seiten."""

    source_type = models.CharField(max_length=20, choices=ObjectType.choices)
    source_id = models.PositiveBigIntegerField()
    target_type = models.CharField(max_length=20, choices=ObjectType.choices)
    target_id = models.PositiveBigIntegerField()
    relation_type = models.CharField(max_length=20, choices=RelationType.choices, default=RelationType.RELATED_TO)
    origin = models.CharField(max_length=10, choices=Origin.choices, default=Origin.MANUAL)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['source_type', 'source_id']),
            models.Index(fields=['target_type', 'target_id']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source_type', 'source_id', 'target_type', 'target_id'], name='unique_connection_pair'
            ),
            models.CheckConstraint(
                condition=~(Q(source_type=models.F('target_type')) & Q(source_id=models.F('target_id'))),
                name='connection_not_self',
            ),
            models.CheckConstraint(condition=Q(source_type__in=ObjectType.values), name='connection_source_type_valid'),
            models.CheckConstraint(condition=Q(target_type__in=ObjectType.values), name='connection_target_type_valid'),
            models.CheckConstraint(condition=Q(relation_type__in=RelationType.values), name='connection_relation_valid'),
            models.CheckConstraint(condition=Q(origin__in=Origin.values), name='connection_origin_valid'),
        ]

    def __str__(self) -> str:
        return f'{self.source_type}#{self.source_id} → {self.target_type}#{self.target_id} ({self.relation_type})'


class SuggestionDismissal(models.Model):
    """„Diesen Vorschlag will ich nicht.“ Vorschläge selbst werden nie
    gespeichert — sie werden bei jedem Aufruf aus den echten Daten berechnet
    (connections/suggestions.py). Gespeichert wird nur, was die Person
    abgelehnt hat, damit derselbe Vorschlag nicht wiederkommt."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    key = models.CharField(max_length=80)
    dismissed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'key'], name='unique_suggestion_dismissal')]

    def __str__(self) -> str:
        return f'{self.user_id}: {self.key}'


# --------------------------------------------------------------------------- Connection Engine V2 (01.11.2026)


class AutoKind(models.TextChoices):
    """Abgeleitete Verbindungen (docs/CONNECTION_ENGINE_V2_AUDIT.md). Jede hat genau EINE Quelle; was in Finanzen
    oder Organisation erscheint, wird bei jedem Lesen aus der Quelle berechnet — es entsteht keine Kopie."""

    CONTRACT_FINANCE = 'CONTRACT_FINANCE', 'Vertrag in Finanzen planen'            # CON-01
    CONTRACT_REMINDER = 'CONTRACT_REMINDER', 'Kündigungserinnerung'                # CON-02
    HOUSEHOLD_TASKS = 'HOUSEHOLD_TASKS', 'Haushaltsaufgaben in Organisation'       # CON-03
    DEVICE_MAINTENANCE = 'DEVICE_MAINTENANCE', 'Wartungserinnerung'                # CON-04
    TRIP_CALENDAR = 'TRIP_CALENDAR', 'Reisezeitraum im Kalender'                   # CON-07
    SAVINGS_REMINDER = 'SAVINGS_REMINDER', 'Sparziel-Erinnerung'                   # CON-10


class AutoStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Aktiv'
    PAUSED = 'PAUSED', 'Pausiert'


class AutoLink(models.Model):
    """„Zeige diese Quelle auch dort.“ Gehört genau einer Person (owner): die abgeleiteten Einträge erscheinen nur in
    IHREN privaten Bereichen. Gibt nie Zugang — beim Lesen wird die Quelle jedes Mal gegen ihre eigene Regel
    geprüft (auto_links.py). Pausiert = nichts erscheint, die Einstellung bleibt."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='auto_links')
    kind = models.CharField(max_length=20, choices=AutoKind.choices)
    source_id = models.PositiveBigIntegerField()
    status = models.CharField(max_length=6, choices=AutoStatus.choices, default=AutoStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']
        indexes = [models.Index(fields=['owner', 'kind', 'status'])]
        constraints = [
            # Idempotenz und Gleichzeitigkeit: je Person, Art und Quelle höchstens eine Zeile
            models.UniqueConstraint(fields=['owner', 'kind', 'source_id'], name='unique_auto_link'),
            models.CheckConstraint(condition=Q(kind__in=AutoKind.values), name='auto_link_kind_valid'),
            models.CheckConstraint(condition=Q(status__in=AutoStatus.values), name='auto_link_status_valid'),
        ]


class AutoAction(models.TextChoices):
    CREATE = 'CREATE', 'Angelegt'
    PAUSE = 'PAUSE', 'Pausiert'
    RESUME = 'RESUME', 'Fortgesetzt'
    UNLINK = 'UNLINK', 'Aufgehoben'
    SOURCE_GONE = 'SOURCE_GONE', 'Quelle gelöscht'


class AutoLinkEvent(models.Model):
    """Protokoll (AUDIT): wer hat wann was an einer abgeleiteten Verbindung getan. Bewusst OHNE Inhalte — keine
    Titel, Beträge oder Daten, nur Art, Quelle (ID) und Aktion. Bleibt nach dem Aufheben erhalten."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    kind = models.CharField(max_length=20, choices=AutoKind.choices)
    source_id = models.PositiveBigIntegerField()
    action = models.CharField(max_length=12, choices=AutoAction.choices)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-at', '-id']
        indexes = [models.Index(fields=['owner', 'at'])]
