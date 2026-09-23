from django.db.models import F
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from core.permissions import HouseholdScopedPermission
from finanzen.models import RecurringDeduction
from haushalt import services
from haushalt.models import FolderEntry, Section, ShoppingItem, Task
from haushalt.serializers import (
    CompleteShoppingSerializer,
    FolderEntrySerializer,
    ItemMemorySerializer,
    ShoppingItemSerializer,
    TaskSerializer,
)
from haushalt.throttling import HaushaltWriteRateThrottle


def _require_membership(request):
    membership = services.membership_for(request.user)
    if membership is None:
        raise ValidationError('Dieses Konto ist noch keinem Haushalt zugeordnet.')
    return membership


class NoChildAccount(BasePermission):
    """Kind-Konten erreichen keine Endpunkte mit Finanzbezug (core/models.py
    HouseholdMembership, ARCHITEKTUR.md §3.2) — der Haushaltsordner enthält
    Vertragskosten und ist deshalb für sie gesperrt."""

    message = 'Kind-Konten haben keinen Zugriff auf den Haushaltsordner.'

    def has_permission(self, request, view) -> bool:
        return not services.is_child_account(services.membership_for(request.user))


class _WriteThrottleMixin:
    def get_throttles(self):
        if self.request.method in SAFE_METHODS:
            return []
        return [HaushaltWriteRateThrottle()]


# ---------------------------------------------------------------------------
# Einkaufsliste
# ---------------------------------------------------------------------------


class ShoppingOverviewView(APIView):
    """Alles, was die Einkaufsansicht braucht, in einer Antwort: Einträge
    (in Supermarkt-Reihenfolge), Schnellauswahl, Ladenbereiche und der
    Durchschnittspreis pro Artikel für den Schätz-Vorschlag beim Abschließen.

    Kein HouseholdScopedPermission nötig: keine ID vom Client, der Haushalt
    kommt ausschließlich aus request.user (wie finanzen OverviewView)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _require_membership(request)
        household = membership.household
        shopping_list = services.active_shopping_list(household)
        items = services.sort_items(shopping_list.items.select_related('checked_by', 'added_by'))
        per_item, from_history = services.price_per_item(household)
        return Response(
            {
                'items': ShoppingItemSerializer(items, many=True).data,
                'suggestions': ItemMemorySerializer(services.suggestions(household, shopping_list), many=True).data,
                'sections': [{'key': choice.value, 'label': choice.label} for choice in Section],
                'price_per_item': str(per_item),
                'price_from_history': from_history,
                'can_book_expense': not services.is_child_account(membership),
            }
        )


class ShoppingItemViewSet(_WriteThrottleMixin, ModelViewSet):
    serializer_class = ShoppingItemSerializer
    permission_classes = [IsAuthenticated, HouseholdScopedPermission]
    household_field = 'shopping_list__household'
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return ShoppingItem.objects.select_related('checked_by', 'added_by', 'shopping_list__household').filter(
            shopping_list__household__members=self.request.user
        )

    def perform_create(self, serializer):
        household = _require_membership(self.request).household
        shopping_list = services.active_shopping_list(household)
        if shopping_list.items.filter(is_checked=False).count() >= services.MAX_OPEN_ITEMS:
            raise ValidationError(f'Maximal {services.MAX_OPEN_ITEMS} offene Einträge pro Liste.')
        name = serializer.validated_data['name']
        existing = shopping_list.items.filter(name__iexact=name, is_checked=False).first()
        if existing is not None:
            # Doppelter Eintrag (zwei Personen tragen gleichzeitig "Milch"
            # ein): statt einer zweiten Zeile nur die Menge übernehmen.
            quantity = serializer.validated_data.get('quantity')
            if quantity:
                existing.quantity = quantity
                existing.save(update_fields=['quantity'])
            serializer.instance = existing
            return
        section = serializer.validated_data.get('section') or services.guess_section(household, name)
        serializer.save(shopping_list=shopping_list, added_by=self.request.user, section=section)
        services.remember_item(household, name, section)

    def perform_update(self, serializer):
        checked = serializer.validated_data.pop('is_checked', None)
        item = serializer.save()
        if checked is not None and checked != item.is_checked:
            services.set_item_checked(item, checked, self.request.user)
        if 'section' in serializer.validated_data:
            services.update_memory_section(item.shopping_list.household, item.name, item.section)

    @action(detail=False, methods=['post'], url_path='abschliessen')
    def complete(self, request):
        """Einkauf-zu-Ausgabe-Moment: abgehakte Einträge abschließen und —
        mit Betrag — als Ausgabe in Finanzen buchen."""
        membership = _require_membership(request)
        serializer = CompleteShoppingSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data.get('amount')
        if amount is not None and services.is_child_account(membership):
            raise PermissionDenied('Kind-Konten können keine Ausgaben buchen.')
        try:
            trip, _ = services.complete_shopping(
                membership.household, request.user, amount, serializer.validated_data.get('category')
            )
        except ValueError as error:
            raise ValidationError(str(error)) from error
        return Response(
            {
                'item_count': trip.item_count,
                'amount': str(trip.amount) if trip.amount is not None else None,
                'transaction_id': trip.transaction_id,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Aufgaben
# ---------------------------------------------------------------------------


class TaskViewSet(_WriteThrottleMixin, ModelViewSet):
    """Offene Aufgaben des Haushalts, nach Fälligkeit sortiert (undatierte
    zuletzt). Erledigte einmalige Aufgaben tauchen nicht mehr auf, bleiben
    aber für die Lastanzeige im Protokoll (TaskCompletion)."""

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, HouseholdScopedPermission]
    household_field = 'household'
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return (
            Task.objects.select_related('assigned_to', 'last_done_by', 'household')
            .prefetch_related('rotation_members')
            .filter(household__members=self.request.user, is_done=False)
            .order_by(F('due_date').asc(nulls_last=True), 'id')
        )

    def perform_create(self, serializer):
        household = _require_membership(self.request).household
        if Task.objects.filter(household=household, is_done=False).count() >= services.MAX_OPEN_TASKS:
            raise ValidationError(f'Maximal {services.MAX_OPEN_TASKS} offene Aufgaben pro Haushalt.')
        task = serializer.save(household=household, created_by=self.request.user)
        services.sync_task_event(task)

    def perform_update(self, serializer):
        services.sync_task_event(serializer.save())

    def perform_destroy(self, instance):
        services.remove_task_event(instance)
        instance.delete()

    @action(detail=True, methods=['post'], url_path='erledigt')
    def complete(self, request, pk=None):
        task = services.complete_task(self.get_object(), request.user)
        return Response(self.get_serializer(task).data)


class TaskLoadView(APIView):
    """Lastanzeige: wer hat diesen Monat wie viel übernommen — zugleich die
    Mitgliederliste für die Zuweisung im Frontend."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        household = _require_membership(request).household
        return Response({'members': services.month_load(household)})


# ---------------------------------------------------------------------------
# Haushaltsordner
# ---------------------------------------------------------------------------


class FolderEntryViewSet(_WriteThrottleMixin, ModelViewSet):
    serializer_class = FolderEntrySerializer
    permission_classes = [IsAuthenticated, NoChildAccount, HouseholdScopedPermission]
    household_field = 'household'
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return (
            FolderEntry.objects.select_related('recurring_deduction', 'household')
            .filter(household__members=self.request.user)
            .order_by('kind', 'name')
        )

    def perform_create(self, serializer):
        household = _require_membership(self.request).household
        if FolderEntry.objects.filter(household=household).count() >= services.MAX_FOLDER_ENTRIES:
            raise ValidationError(f'Maximal {services.MAX_FOLDER_ENTRIES} Einträge im Haushaltsordner.')
        services.sync_folder_events(serializer.save(household=household, created_by=self.request.user))

    def perform_update(self, serializer):
        services.sync_folder_events(serializer.save())

    def perform_destroy(self, instance):
        services.remove_folder_events(instance)
        instance.delete()

    @action(detail=True, methods=['post'], url_path='wartung-erledigt')
    def maintenance_done(self, request, pk=None):
        entry = self.get_object()
        if entry.kind != FolderEntry.Kind.DEVICE:
            raise ValidationError('Nur Geräte haben Wartungstermine.')
        return Response(self.get_serializer(services.complete_maintenance(entry)).data)

    @action(detail=False, methods=['get'], url_path='abzuege')
    def unlinked_deductions(self, request):
        """Feste Abzüge aus Finanzen, die noch keinem Vertrag zugeordnet sind
        — Vorschläge für "Aus Finanzen übernehmen"."""
        household = _require_membership(request).household
        linked = FolderEntry.objects.filter(household=household, recurring_deduction__isnull=False).values_list(
            'recurring_deduction_id', flat=True
        )
        deductions = RecurringDeduction.objects.filter(household=household).exclude(pk__in=linked).order_by('name')
        return Response(
            [
                {'id': deduction.id, 'name': deduction.name, 'amount': str(deduction.amount), 'active': deduction.active}
                for deduction in deductions
            ]
        )
