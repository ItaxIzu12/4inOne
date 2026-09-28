from django.conf import settings
from django.db import models


class Trip(models.Model):
    """Eine private Reise. Analog zu PersonalTask/PersonalEvent (organisation/models.py):
    eigenständig dem Nutzer zugeordnet, kein Household-Sharing (siehe AGENTS.md Privacy-Prinzipien
    und ADR-001 — die dort vorgeschlagene Household-Verallgemeinerung für Reisen ist noch nicht
    umgesetzt, ein Teilnehmer-Modell ist deshalb bewusst nicht Teil von V1).
    """

    class Status(models.TextChoices):
        PLANNED = 'PLANNED', 'Geplant'
        ACTIVE = 'ACTIVE', 'Unterwegs'
        DONE = 'DONE', 'Abgeschlossen'
        CANCELLED = 'CANCELLED', 'Storniert'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trips')
    title = models.CharField(max_length=120)
    destination = models.CharField(max_length=160, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, max_length=5000)
    status = models.CharField(max_length=9, choices=Status.choices, default=Status.PLANNED)
    budget_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_date', 'id']
        indexes = [models.Index(fields=['owner', 'start_date'])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__isnull=True) | models.Q(start_date__isnull=True) | models.Q(end_date__gte=models.F('start_date')),
                name='trip_end_after_start',
            ),
            models.CheckConstraint(
                condition=models.Q(budget_amount__isnull=True) | models.Q(budget_amount__gte=0),
                name='trip_budget_not_negative',
            ),
        ]

    def __str__(self) -> str:
        return self.title


class TripScopedModel(models.Model):
    """Gemeinsame Basis für alles, was zu genau einer Reise gehört. Der Besitz läuft
    ausschließlich über trip.owner — kein eigenes owner-Feld, damit nichts aus dem
    Gleichgewicht geraten kann (siehe OwnedViewSet-Analogon in views.py)."""

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='%(class)ss')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class PackingItem(TripScopedModel):
    title = models.CharField(max_length=120)
    is_packed = models.BooleanField(default=False)
    quantity = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ['is_packed', 'id']
        indexes = [models.Index(fields=['trip', 'is_packed'])]


class TripTask(TripScopedModel):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Offen'
        DONE = 'DONE', 'Erledigt'

    title = models.CharField(max_length=120)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=4, choices=Status.choices, default=Status.OPEN)

    class Meta:
        ordering = ['status', 'due_date', 'id']
        indexes = [models.Index(fields=['trip', 'status'])]


class TripEvent(TripScopedModel):
    title = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ['starts_at', 'id']
        indexes = [models.Index(fields=['trip', 'starts_at'])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=models.F('starts_at')),
                name='trip_event_end_after_start',
            ),
        ]


class TripExpense(TripScopedModel):
    """Eigenständige Ausgabenerfassung je Reise — bewusst NICHT mit Finanzen/Transaction
    verbunden (AGENTS.md: Finanzen bleibt stabil, Cross-Domain nur über explizite
    Connections, die für Reisen V1 noch nicht gebaut werden)."""

    title = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()

    class Meta:
        ordering = ['date', 'id']
        indexes = [models.Index(fields=['trip', 'date'])]
        constraints = [models.CheckConstraint(condition=models.Q(amount__gte=0), name='trip_expense_not_negative')]
