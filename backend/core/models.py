from django.conf import settings
from django.db import models


class Household(models.Model):
    """Ein Haushalt/eine Familie — der gemeinsame Container, dem alle
    fachlichen Daten (Finanzen/Haushalt/Organisation) zugeordnet sind.

    Bewusst KEINE Erweiterung des eingebauten User-Models (siehe
    ARCHITEKTUR.md §2.3): Ein Nutzer kann Mitglied mehrerer Haushalte sein,
    daher die separate Verknüpfungstabelle HouseholdMembership.
    """

    name = models.CharField(max_length=120)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='HouseholdMembership',
        related_name='households',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class HouseholdMembership(models.Model):
    """Verknüpft User und Household mit einer Rolle.

    Das Rollenmodell ist Grundlage für HouseholdScopedPermission
    (core/permissions.py) und muss laut ARCHITEKTUR.md §3.2 serverseitig
    durchgesetzt werden, nicht nur im Frontend versteckt werden — z. B.
    darf ein CHILD_ACCOUNT keine Finanz-Endpunkte erreichen.
    """

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        MEMBER = 'MEMBER', 'Mitglied'
        CHILD_ACCOUNT = 'CHILD_ACCOUNT', 'Kind-Konto'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'household'], name='unique_household_membership'
            )
        ]

    def __str__(self) -> str:
        return f'{self.user} @ {self.household} ({self.role})'


class Notification(models.Model):
    """Einfache In-App-Benachrichtigung für einen Nutzer innerhalb eines
    Haushalts (z. B. "Miete fällig", "Aufgabe zugewiesen")."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.message
