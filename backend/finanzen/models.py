from datetime import date

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import Household


def heute() -> date:
    """Standardwert für Transaction.datum: das heutige Datum in der
    Django-Zeitzone (settings.TIME_ZONE). Modul-Funktion statt lambda, damit
    Migrationen sie referenzieren können."""
    return timezone.localdate()


class Account(models.Model):
    """Ein Finanzkonto innerhalb eines Haushalts (z. B. die geteilte
    Haushaltskasse), siehe ARCHITEKTUR.md §2.3 und GESAMTKONZEPT.md §5."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='accounts')
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.name} ({self.household})'


class Category(models.Model):
    """Ausgaben-/Budgetkategorie, pro Haushalt frei definierbar.

    color/icon_key sind bewusst DATEN, nicht im Frontend-Template hartkodiert
    (siehe frontend finanzen.css vor diesem Umbau) — sonst hat eine vierte,
    selbst angelegte Kategorie keine Farbe/kein Icon. icon_key referenziert
    einen Eintrag in der Icon-Zuordnungs-Map im Frontend (siehe
    shared/icons/category-icon.map.ts), ist aber hier bewusst ein simples
    CharField statt einer harten FK/Choices-Bindung ans Frontend — neue
    Icons lassen sich so ergänzen, ohne das Backend anzufassen.
    """

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='categories', null=True, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='finance_categories')
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default='#164c49', help_text='Hex-Farbwert, z. B. #164c49.')
    icon_key = models.CharField(max_length=30, default='sonstiges')
    # Optionales monatliches Ausgabenziel — OverviewView (finanzen/views.py)
    # stellt es dem live berechneten "ausgegeben diesen Monat" gegenüber.
    monthly_goal = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # Gesetzt von finanzen/signals.py bei der automatischen Anlage der drei
    # Standard-Kategorien pro neuem Haushalt — verhindert serverseitig, dass
    # deren Name geändert wird (siehe CategorySerializer.validate()),
    # monthly_goal/color/icon_key bleiben trotzdem änderbar.
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'Categories'
        constraints = [
            models.UniqueConstraint(fields=['household', 'name'], name='unique_category_per_household'),
            models.UniqueConstraint(fields=['owner', 'name'], name='unique_category_per_owner'),
            models.CheckConstraint(condition=(models.Q(owner__isnull=False, household__isnull=True) | models.Q(owner__isnull=True, household__isnull=False)), name='category_exactly_one_scope')
        ]

    def __str__(self) -> str:
        return self.name


class RecurringDeduction(models.Model):
    """Ein regelmäßiger fester Abzug vom Haushaltseinkommen (z. B. Miete,
    Versicherung) — Grundlage der "Verfügbares Einkommen"-Berechnung im
    Analysen-Tab (finanzen/views.py AnalysenView).

    Bewusst ein EIGENES Model, keine Transaction: ein fester Abzug ist eine
    PLANGRÖSSE (wiederkehrend, ohne konkretes Datum, kein occurred_at), keine
    tatsächlich stattgefundene Zahlung — Transaction bliebe für die
    Kategorien-Übersicht/den Budget-Donut sonst durch nicht wirklich
    stattgefundene Buchungen verfälscht.
    """

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='recurring_deductions')
    # Für Nachvollziehbarkeit, analog zu Transaction.created_by — SET_NULL
    # statt PROTECT: ein gelöschter Nutzer soll einen bestehenden Abzug nicht
    # dauerhaft unlöschbar machen, nur weil er ihn einmal angelegt hat.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    name = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='recurring_deductions'
    )
    # Ein pausierter (nicht gelöschter) Abzug fließt nicht in die
    # "Verfügbares Einkommen"-Berechnung ein — z. B. eine Versicherung, die
    # gerade ruht, ohne den Eintrag samt Historie zu verlieren.
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.name} ({self.amount})'


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


class Transaction(models.Model):
    """Eine Ausgabe oder Einnahme. Löschung erfolgt ausschließlich über
    soft_delete() — siehe Docstring dort."""

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='private_transactions')
    currency = models.CharField(max_length=3, default='EUR')
    type = models.CharField(max_length=7, choices=[('INCOME', 'Einnahme'), ('EXPENSE', 'Ausgabe')], default='EXPENSE')
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    # null=True als pragmatische Ausnahme: das Feld ist NEU auf einer
    # bereits befüllten Tabelle (lokale Testdaten aus dieser Sitzung), für
    # die es keinen sinnvoll rekonstruierbaren Ersteller gibt. Jede NEU
    # angelegte Transaction bekommt created_by aber immer gesetzt (siehe
    # TransactionViewSet.perform_create(), finanzen/views.py) — in einer
    # frischen Produktions-DB wäre das Feld von Anfang an durchgehend befüllt.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='transactions_created'
    )
    # Nachvollziehbarkeit bei Bearbeitungen (Sicherheitsprüfung PRÜFUNG 5):
    # created_by allein reicht seit Einführung von PATCH nicht mehr — sonst
    # geht unsichtbar verloren, wer eine fremd erfasste Ausgabe zuletzt
    # geändert hat. Wird ausschließlich serverseitig gesetzt
    # (TransactionViewSet.perform_update, finanzen/views.py), niemals aus
    # dem Request-Body — sonst könnte sich ein Nutzer per Body-Feld
    # fälschlich als jemand anderen ausgeben. SET_NULL statt PROTECT (anders
    # als created_by): ein gelöschter Nutzer soll eine bestehende
    # Transaction nicht dauerhaft unlöschbar machen, nur weil er sie einmal
    # bearbeitet hat.
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    updated_at = models.DateTimeField(auto_now=True)
    # Wann hat die Ausgabe stattgefunden? Ein DATUM (kein Zeitstempel):
    # standardmäßig heute, im Request überschreibbar (Validierung in
    # TransactionSerializer.validate_datum: nicht in der Zukunft, höchstens
    # 12 Monate zurück). Alle Monats-/Jahresrechnungen (finanzen/services.py)
    # filtern nach DIESEM Feld. Ersetzt das frühere occurred_at (DateTime).
    datum = models.DateField(default=heute)
    # Technischer Erstellungs-Zeitstempel — unabhängig von datum, nur für
    # Audit/Nachvollziehbarkeit, fließt in keine Berechnung ein.
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    # Für Admin/Audit/Tests, die AUCH weich gelöschte Datensätze sehen
    # müssen — SoftDeleteManager (objects) blendet sie standardmäßig aus.
    all_objects = models.Manager()

    def __str__(self) -> str:
        return f'{self.amount} · {self.description or self.account}'

    class Meta:
        indexes = [models.Index(fields=['owner', 'datum'])]
        constraints = [models.CheckConstraint(condition=(models.Q(owner__isnull=False, account__isnull=True) | models.Q(owner__isnull=True, account__isnull=False)), name='transaction_exactly_one_scope')]

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


class MonthlyBudget(models.Model):
    """Ein Budget für einen Monat oder einen Zeitraum aus mehreren Monaten.

    `month` ist der erste Monat. Wie lange es gilt:
    - `end_month` leer und `open_ended` aus → nur dieser eine Monat (so waren alle
      bisherigen Budgets, ohne Datenänderung),
    - `end_month` gesetzt → bis einschließlich dieses Monats,
    - `open_ended` an → bis auf Weiteres.

    Für einen Monat gilt das Budget mit dem spätesten Start, das ihn abdeckt: ein
    später beginnendes Budget überschreibt das ältere ab seinem Start, und fällt es
    weg (z. B. ein Einzelmonat), gilt danach wieder das ältere."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='monthly_budgets')
    month = models.DateField()
    end_month = models.DateField(null=True, blank=True)
    open_ended = models.BooleanField(default=False)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='EUR')

    class Meta:
        ordering = ['-month']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'month', 'currency'], name='unique_owner_month_budget'),
            models.CheckConstraint(condition=models.Q(amount__gte=0), name='monthly_budget_nonnegative'),
            models.CheckConstraint(
                condition=models.Q(end_month__isnull=True) | models.Q(end_month__gte=models.F('month')),
                name='monthly_budget_end_after_start',
            ),
            models.CheckConstraint(
                condition=models.Q(open_ended=False) | models.Q(end_month__isnull=True),
                name='monthly_budget_open_or_end',
            ),
        ]

    def covers(self, month_start) -> bool:
        if month_start < self.month:
            return False
        if self.open_ended:
            return True
        return month_start <= (self.end_month or self.month)

    @classmethod
    def for_month(cls, owner, month_start, currency='EUR'):
        """Das Budget, das für diesen Monat (erster Tag) gilt — oder None."""
        candidates = cls.objects.filter(owner=owner, currency=currency, month__lte=month_start).filter(
            models.Q(open_ended=True) | models.Q(end_month__gte=month_start) | models.Q(end_month__isnull=True, month=month_start)
        )
        return candidates.order_by('-month').first()


class SavingsGoal(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='savings_goals')
    title = models.CharField(max_length=120)
    target_amount = models.DecimalField(max_digits=10, decimal_places=2)
    current_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    target_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3, default='EUR')
    status = models.CharField(max_length=9, choices=[('ACTIVE', 'Aktiv'), ('COMPLETED', 'Erreicht'), ('PAUSED', 'Pausiert')], default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)

    # ZEITRAUM des Ziels (wie beim Budget): in welchen Monaten es gilt, also angezeigt wird und
    # seine Sparrate reserviert. `plan_month` ist der erste Monat; ohne `plan_end_month` und ohne
    # `plan_open_ended` gilt es nur für diesen einen Monat, mit `plan_end_month` bis einschließlich
    # dieses Monats, mit `plan_open_ended` bis auf Weiteres. Leer (nur Altdaten) = in jedem Monat.
    # Sparrate: optional, pro Monat im Zeitraum; Wirkung aufs Budget in finanzen/savings.py.
    monthly_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    plan_month = models.DateField(null=True, blank=True)
    plan_end_month = models.DateField(null=True, blank=True)
    plan_open_ended = models.BooleanField(default=False)

    def covers(self, month_start) -> bool:
        """Gilt das Ziel in diesem Monat (erster Tag)? Ohne Zeitraum (Altdaten): immer."""
        if self.plan_month is None:
            return True
        if month_start < self.plan_month:
            return False
        if self.plan_open_ended:
            return True
        return month_start <= (self.plan_end_month or self.plan_month)

    @classmethod
    def covering(cls, queryset, month_start):
        """Die Ziele aus `queryset`, die in diesem Monat gelten (wie `covers`, aber als Abfrage)."""
        return queryset.filter(
            models.Q(plan_month__isnull=True)
            | (
                models.Q(plan_month__lte=month_start)
                & (
                    models.Q(plan_open_ended=True)
                    | models.Q(plan_end_month__gte=month_start)
                    | models.Q(plan_end_month__isnull=True, plan_month=month_start)
                )
            )
        )

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(target_amount__gt=0, current_amount__gte=0), name='savings_goal_valid_amounts'),
            models.CheckConstraint(
                condition=models.Q(monthly_amount__isnull=True) | models.Q(monthly_amount__gt=0),
                name='savings_goal_rate_positive',
            ),
            models.CheckConstraint(
                condition=models.Q(monthly_amount__isnull=True) | models.Q(plan_month__isnull=False),
                name='savings_goal_rate_has_start',
            ),
            models.CheckConstraint(
                condition=models.Q(plan_end_month__isnull=True) | models.Q(plan_end_month__gte=models.F('plan_month')),
                name='savings_goal_plan_end_after_start',
            ),
            models.CheckConstraint(
                condition=models.Q(plan_open_ended=False) | models.Q(plan_end_month__isnull=True),
                name='savings_goal_plan_open_or_end',
            ),
        ]


class SavingsContribution(models.Model):
    """Eine Einzahlung in ein Sparziel (oder, negativ, eine Entnahme).

    Der gesparte Betrag eines Ziels ist eine Summe über die Zeit, das Budget
    gilt pro Monat. Damit Gespartes das Budget des richtigen Monats mindert,
    hält dieser Eintrag fest, WANN sich der gesparte Betrag geändert hat:
    Ändert jemand „Bereits gespart“ von 300 auf 350 €, entsteht eine
    Einzahlung von +50 € am heutigen Tag. Wird das Ziel gelöscht, verschwinden
    seine Einträge — das Geld ist wieder frei."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='savings_contributions')
    goal = models.ForeignKey(SavingsGoal, on_delete=models.CASCADE, related_name='contributions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']
        indexes = [models.Index(fields=['owner', 'date'])]
        constraints = [models.CheckConstraint(condition=~models.Q(amount=0), name='savings_contribution_not_zero')]
