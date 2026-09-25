from django.conf import settings
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from core.models import Household
from organisation.models import CalendarEvent


class Section(models.TextChoices):
    """Ladenbereiche für den Einkaufsmodus — die Liste wird beim Einkaufen
    nach diesen Bereichen gruppiert, in der Reihenfolge, in der man sie in
    einem typischen Supermarkt abläuft (siehe SECTION_ORDER)."""

    PRODUCE = 'obst_gemuese', 'Obst & Gemüse'
    BAKERY = 'backwaren', 'Brot & Backwaren'
    DAIRY = 'kuehlregal', 'Kühlregal'
    MEAT = 'fleisch_fisch', 'Fleisch & Fisch'
    FROZEN = 'tiefkuehl', 'Tiefkühl'
    PANTRY = 'vorrat', 'Vorrat'
    DRINKS = 'getraenke', 'Getränke'
    TOILETRIES = 'drogerie', 'Drogerie'
    HOUSEHOLD = 'haushalt', 'Haushalt'
    OTHER = 'sonstiges', 'Sonstiges'


SECTION_ORDER = [choice.value for choice in Section]


class ShoppingList(models.Model):
    """Eine Einkaufsliste, gemeinsam bearbeitbar für den ganzen Haushalt
    (GESAMTKONZEPT.md §5). Aktuell genau eine pro Haushalt, angelegt beim
    ersten Zugriff (haushalt/services.py active_shopping_list)."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='shopping_lists')
    name = models.CharField(max_length=120, default='Einkaufsliste')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.name} ({self.household})'


class ShoppingItem(models.Model):
    """Ein einzelner Eintrag auf einer Einkaufsliste.

    Abgehakte Einträge bleiben auf der Liste, bis der Einkauf abgeschlossen
    wird (ShoppingTrip) — erst dann werden sie entfernt. So lässt sich ein
    versehentliches Abhaken im Laden einfach rückgängig machen."""

    shopping_list = models.ForeignKey(ShoppingList, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=120)
    quantity = models.CharField(max_length=40, blank=True, default='')
    section = models.CharField(max_length=20, choices=Section.choices, default=Section.OTHER)
    is_checked = models.BooleanField(default=False)
    checked_at = models.DateTimeField(null=True, blank=True)
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return self.name


class ItemMemory(models.Model):
    """Was dieser Haushalt schon einmal eingekauft hat — Grundlage für die
    Schnellauswahl ("zuletzt gekauft", ein Tippen statt neu tippen) und dafür,
    dass ein bekannter Artikel automatisch im richtigen Ladenbereich landet.

    Pro Haushalt und Name (ohne Groß-/Kleinschreibung) genau ein Eintrag."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='item_memories')
    name = models.CharField(max_length=120)
    section = models.CharField(max_length=20, choices=Section.choices, default=Section.OTHER)
    use_count = models.PositiveIntegerField(default=0)
    last_used_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower('name'), 'household', name='unique_item_memory_per_household'),
        ]

    def __str__(self) -> str:
        return f'{self.name} ({self.use_count}×)'


class ShoppingTrip(models.Model):
    """Ein abgeschlossener Einkauf — der "Einkauf-zu-Ausgabe-Moment"
    (GESAMTKONZEPT.md §5.1). Hält fest, wie viele Artikel gekauft wurden und
    was der Einkauf gekostet hat; aus dem Verhältnis beider Werte über alle
    bisherigen Einkäufe schätzt haushalt/services.py den Betrag des nächsten.

    amount ist optional: wer den Einkauf ohne Betrag abschließt (z. B. ein
    Kind-Konto ohne Finanzzugriff), erzeugt keine Ausgabe."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='shopping_trips')
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    completed_at = models.DateTimeField(default=timezone.now)
    item_count = models.PositiveIntegerField()
    item_names = models.JSONField(default=list)
    # Der beim Abschließen gebuchte Betrag, nur zur Nachvollziehbarkeit. Für
    # Berechnungen zählt der aktuelle Betrag der Buchung (transaction), weil
    # er in Finanzen nachträglich korrigiert werden kann.
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # Die in Finanzen erzeugte Ausgabe. SET_NULL: Transaktionen werden
    # ohnehin nur weich gelöscht, aber der Einkauf soll auch dann bestehen
    # bleiben, wenn es die Buchung nicht mehr gibt.
    transaction = models.ForeignKey(
        'finanzen.Transaction', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )

    def __str__(self) -> str:
        return f'Einkauf {self.completed_at:%Y-%m-%d} ({self.item_count} Artikel)'


class Task(models.Model):
    """Eine Haushaltsaufgabe (Putzplan, Wartung, o. Ä.), optional verknüpft
    mit einem Kalendereintrag — Grundlage für die modulübergreifende
    Verknüpfung aus GESAMTKONZEPT.md §5 ("wiederkehrende Haushaltsaufgaben
    erscheinen automatisch im Organisations-Kalender").

    Wiederkehrende Aufgaben (recurrence_days gesetzt) werden nie "erledigt",
    sondern rücken beim Abhaken um das Intervall weiter und wechseln — falls
    rotate — zur nächsten Person der Rotation. Einmalige Aufgaben werden
    beim Abhaken auf is_done gesetzt."""

    class Effort(models.IntegerChoices):
        SMALL = 1, 'Klein'
        MEDIUM = 2, 'Mittel'
        LARGE = 3, 'Groß'

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=120)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    calendar_event = models.ForeignKey(
        CalendarEvent, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks'
    )
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    description = models.CharField(max_length=500, blank=True, default='')
    due_date = models.DateField(null=True, blank=True)
    # Optionale Uhrzeit; der Kalendertermin bleibt ganztägig (kein
    # Zeitzonen-Sonderfall in V1).
    due_time = models.TimeField(null=True, blank=True)
    # None = einmalige Aufgabe, sonst Wiederholung alle N Tage ...
    recurrence_days = models.PositiveSmallIntegerField(null=True, blank=True)
    # ... oder alle N Kalendermonate ("monatlich"). Höchstens eines von beiden.
    recurrence_months = models.PositiveSmallIntegerField(null=True, blank=True)
    effort = models.PositiveSmallIntegerField(choices=Effort.choices, default=Effort.SMALL)
    # Reihum wechselnde Zuständigkeit: nach jedem Erledigen übernimmt die
    # nächste Person aus rotation_members (sortiert nach ID).
    rotate = models.BooleanField(default=False)
    rotation_members = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='+')
    last_done_at = models.DateTimeField(null=True, blank=True)
    last_done_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )

    @property
    def recurrence(self) -> str | None:
        """Die drei V1-Wiederholungen; andere Intervalle (z. B. alle 3 Tage,
        aus älteren Aufgaben) bleiben über recurrence_days erhalten."""
        if self.recurrence_months == 1:
            return 'monthly'
        return {1: 'daily', 7: 'weekly'}.get(self.recurrence_days)

    def __str__(self) -> str:
        return self.title


class TaskCompletion(models.Model):
    """Protokoll jeder Erledigung — Grundlage der Lastanzeige ("wer hat
    diesen Monat wie viel übernommen"). effort wird beim Erledigen
    festgeschrieben, damit eine spätere Änderung des Aufwands die
    Vergangenheit nicht umschreibt."""

    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, related_name='completions')
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='task_completions')
    title = models.CharField(max_length=120)
    done_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    done_at = models.DateTimeField(default=timezone.now)
    effort = models.PositiveSmallIntegerField(choices=Task.Effort.choices)

    def __str__(self) -> str:
        return f'{self.title} · {self.done_at:%Y-%m-%d}'


class FolderEntry(models.Model):
    """Ein Eintrag im Haushaltsordner: ein Vertrag (Strom, Internet,
    Versicherung …) oder ein Gerät (Heizung, Waschmaschine, Rauchmelder …).

    Die Fristen (Kündigung, Garantieende, nächste Wartung) werden von
    haushalt/services.py als ganztägige Termine in den gemeinsamen Kalender
    übertragen. Kosten eines Vertrags kommen, wenn verknüpft, immer aus dem
    festen Abzug in Finanzen — eine einzige Quelle statt zweier Zahlen, die
    auseinanderlaufen können."""

    class Kind(models.TextChoices):
        CONTRACT = 'vertrag', 'Vertrag'
        DEVICE = 'geraet', 'Gerät'

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='folder_entries')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    name = models.CharField(max_length=120)
    provider = models.CharField(max_length=120, blank=True, default='')
    notes = models.TextField(max_length=1000, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    # --- Vertrag ---
    recurring_deduction = models.ForeignKey(
        'finanzen.RecurringDeduction', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    contract_end = models.DateField(null=True, blank=True)
    notice_period_months = models.PositiveSmallIntegerField(null=True, blank=True)

    # --- Gerät ---
    purchase_date = models.DateField(null=True, blank=True)
    warranty_until = models.DateField(null=True, blank=True)
    maintenance_interval_months = models.PositiveSmallIntegerField(null=True, blank=True)
    next_maintenance = models.DateField(null=True, blank=True)

    def __str__(self) -> str:
        return f'{self.get_kind_display()}: {self.name}'
