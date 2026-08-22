from django.conf import settings
from django.db import models

from core.models import Household
from organisation.models import CalendarEvent


class ShoppingList(models.Model):
    """Eine Einkaufsliste, gemeinsam bearbeitbar für den ganzen Haushalt
    (GESAMTKONZEPT.md §5)."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='shopping_lists')
    name = models.CharField(max_length=120, default='Einkaufsliste')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.name} ({self.household})'


class ShoppingItem(models.Model):
    """Ein einzelner Eintrag auf einer Einkaufsliste."""

    shopping_list = models.ForeignKey(ShoppingList, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=120)
    is_checked = models.BooleanField(default=False)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    def __str__(self) -> str:
        return self.name


class Task(models.Model):
    """Eine Haushaltsaufgabe (Putzplan, Wartung, o. Ä.), optional verknüpft
    mit einem Kalendereintrag — Grundlage für die modulübergreifende
    Verknüpfung aus GESAMTKONZEPT.md §5 ("wiederkehrende Haushaltsaufgaben
    erscheinen automatisch im Organisations-Kalender")."""

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

    def __str__(self) -> str:
        return self.title
