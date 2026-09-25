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
    # Für Reisen vorgesehen, in V1 noch in keinem erlaubten Paar.
    TRIP = 'TRIP', 'Reise'
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
