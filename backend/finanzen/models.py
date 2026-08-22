from django.db import models

from core.models import Household


class Account(models.Model):
    """Ein Finanzkonto innerhalb eines Haushalts (z. B. die geteilte
    Haushaltskasse), siehe ARCHITEKTUR.md §2.3 und GESAMTKONZEPT.md §5."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='accounts')
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.name} ({self.household})'


class Category(models.Model):
    """Ausgaben-/Budgetkategorie, pro Haushalt frei definierbar."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=80)

    class Meta:
        verbose_name_plural = 'Categories'
        constraints = [
            models.UniqueConstraint(fields=['household', 'name'], name='unique_category_per_household')
        ]

    def __str__(self) -> str:
        return self.name


class Budget(models.Model):
    """Ein einfaches Budgetziel pro Kategorie und Zeitraum (GESAMTKONZEPT.md §5:
    "einfache Budgetziele", bewusst kein komplexes Envelope-Budgeting im MVP)."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='budgets')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='budgets')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    month = models.DateField(help_text='Erster Tag des Budgetmonats, z. B. 2026-08-01.')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'month'], name='unique_budget_per_category_month'
            )
        ]

    def __str__(self) -> str:
        return f'{self.category} · {self.month:%Y-%m}'


class SoftDeleteManager(models.Manager):
    """Gibt standardmäßig nur nicht-gelöschte Objekte zurück.

    Siehe ARCHITEKTUR.md §2.3: Finanzdatensätze werden weich gelöscht statt
    hart entfernt, da das DSGVO-Recht auf Löschung mit handelsrechtlichen
    Aufbewahrungspflichten (§ 257 HGB, § 147 AO) in Konflikt stehen kann.
    """

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

    def all_with_deleted(self):
        return super().get_queryset()


class Transaction(models.Model):
    """Eine Ausgabe oder Einnahme. Löschung erfolgt ausschließlich über
    soft_delete() — siehe Docstring dort."""

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='transactions')
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    occurred_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()

    def __str__(self) -> str:
        return f'{self.amount} · {self.description or self.account}'

    def soft_delete(self) -> None:
        """Markiert die Transaction als gelöscht, statt sie zu entfernen.

        WICHTIG (ARCHITEKTUR.md §2.3): Die Standard-delete()-Methode darf für
        Transaction NICHT verwendet werden — Finanzdatensätze unterliegen
        potenziell handelsrechtlichen Aufbewahrungspflichten (§ 257 HGB,
        § 147 AO, 6–10 Jahre) und müssen referenzierbar bleiben, auch wenn
        sie aus Nutzersicht "gelöscht" sind. Hartes delete() lässt sich bei
        Bedarf nachrüsten, das Gegenteil (Daten fehlen, obwohl sie hätten
        aufbewahrt werden müssen) nicht.
        """
        from django.utils import timezone

        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])
