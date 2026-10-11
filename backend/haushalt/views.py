from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, Prefetch, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from core.permissions import HouseholdScopedPermission
from haushalt import services
from haushalt.models import FolderEntry, Section, ShoppingItem, ShoppingList, Task, TaskCompletion
from haushalt.serializers import (
    CompleteShoppingSerializer,
    FolderEntrySerializer,
    ItemMemorySerializer,
    ShoppingItemSerializer,
    ShoppingListSerializer,
    TaskSerializer,
)
from haushalt.throttling import HaushaltWriteRateThrottle
from core.households import active_household


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
        # ?liste=<id> wählt eine Liste des eigenen Haushalts, ohne Angabe die
        # Standardliste. Eine fremde ID ist 404 — nicht „leer“.
        shopping_list = services.shopping_list_for(household, request.query_params.get('liste'))
        if shopping_list is None:
            raise NotFound('Diese Einkaufsliste gibt es nicht.')
        items = services.sort_items(shopping_list.items.select_related('checked_by', 'added_by'))
        per_item, from_history = services.price_per_item(household)
        list_row = _lists_with_counts(household).get(pk=shopping_list.pk)
        return Response(
            {
                'list': ShoppingListSerializer(list_row).data,
                'members': services.list_members(household, shopping_list),
                'items': ShoppingItemSerializer(items, many=True).data,
                'suggestions': ItemMemorySerializer(services.suggestions(household, shopping_list), many=True).data,
                'sections': [{'key': choice.value, 'label': choice.label} for choice in Section],
                'price_per_item': str(per_item),
                'price_from_history': from_history,
                'can_book_expense': not services.is_child_account(membership),
            }
        )


def _lists_with_counts(household):
    return (
        ShoppingList.objects.filter(household=household)
        .select_related('created_by')
        .annotate(item_count=Count('items'), checked_count=Count('items', filter=Q(items__is_checked=True)))
        .order_by('id')
    )


class ShoppingListViewSet(_WriteThrottleMixin, ModelViewSet):
    """Mehrere Einkaufslisten pro Haushalt (Wocheneinkauf, Drogerie …), jede
    mit Zahl der Einträge und der abgehakten. Die letzte Liste lässt sich
    nicht löschen — es gibt immer eine Standardliste."""

    serializer_class = ShoppingListSerializer
    permission_classes = [IsAuthenticated, HouseholdScopedPermission]
    household_field = 'household'
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        membership = services.membership_for(self.request.user)
        if membership is None:
            return ShoppingList.objects.none()
        # Beim ersten Aufruf gibt es die Standardliste noch nicht.
        services.active_shopping_list(membership.household)
        queryset = _lists_with_counts(membership.household)
        if self.action == 'list' and self.request.query_params.get('archiviert') != '1':
            # Archivierte Listen sind ausgeblendet; ?archiviert=1 zeigt nur sie.
            return queryset.filter(archived=False)
        if self.action == 'list':
            return queryset.filter(archived=True)
        return queryset

    def perform_create(self, serializer):
        household = _require_membership(self.request).household
        # Die Standardliste (älteste) muss es vorher geben, sonst würde die
        # erste selbst angelegte Liste ungewollt zur Standardliste.
        services.active_shopping_list(household)
        if ShoppingList.objects.filter(household=household).count() >= services.MAX_SHOPPING_LISTS:
            raise ValidationError(f'Maximal {services.MAX_SHOPPING_LISTS} Einkaufslisten pro Haushalt.')
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        if serializer.validated_data.get('archived') and not instance.archived:
            active = ShoppingList.objects.filter(household=instance.household, archived=False).count()
            if active <= 1:
                raise ValidationError('Die letzte aktive Einkaufsliste kann nicht archiviert werden.')
        serializer.save(updated_at=timezone.now())

    def perform_destroy(self, instance):
        if ShoppingList.objects.filter(household=instance.household).count() <= 1:
            raise ValidationError('Die letzte Einkaufsliste kann nicht gelöscht werden.')
        instance.delete()


class ShoppingItemViewSet(_WriteThrottleMixin, ModelViewSet):
    serializer_class = ShoppingItemSerializer
    permission_classes = [IsAuthenticated, HouseholdScopedPermission]
    household_field = 'shopping_list__household'
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return ShoppingItem.objects.select_related('checked_by', 'added_by', 'shopping_list__household').filter(
            shopping_list__household=active_household(self.request.user)
        )

    def perform_create(self, serializer):
        household = _require_membership(self.request).household
        shopping_list = serializer.validated_data.pop('shopping_list', None) or services.active_shopping_list(
            household
        )
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
            services.touch_list(shopping_list)
            return
        section = serializer.validated_data.get('section') or services.guess_section(household, name)
        serializer.save(shopping_list=shopping_list, added_by=self.request.user, section=section)
        services.remember_item(household, name, section)
        services.touch_list(shopping_list)

    def perform_update(self, serializer):
        checked = serializer.validated_data.pop('is_checked', None)
        item = serializer.save()
        if checked is not None and checked != item.is_checked:
            services.set_item_checked(item, checked, self.request.user)
        if 'section' in serializer.validated_data:
            services.update_memory_section(item.shopping_list.household, item.name, item.section)
        services.touch_list(item.shopping_list)

    def perform_destroy(self, instance):
        shopping_list = instance.shopping_list
        instance.delete()
        services.touch_list(shopping_list)

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
                membership.household,
                request.user,
                amount,
                serializer.validated_data.get('category'),
                serializer.validated_data.get('shopping_list'),
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
        since = timezone.now() - timedelta(days=services.STREAK_LOOKBACK_DAYS)
        queryset = (
            Task.objects.select_related('assigned_to', 'last_done_by', 'household')
            .prefetch_related(
                'rotation_members',
                # Für die Serie (TaskSerializer.streak) in einem Rutsch statt pro Aufgabe.
                Prefetch(
                    'completions',
                    queryset=TaskCompletion.objects.filter(done_at__gte=since).only('task_id', 'done_at'),
                    to_attr='recent_completions',
                ),
            )
            .filter(household=active_household(self.request.user))
        )
        if self.action != 'list':
            # Einzelzugriff (ändern, löschen, wieder öffnen) gilt auch für
            # erledigte Aufgaben — die Haushaltsgrenze bleibt oben erhalten.
            return queryset
        state = self.request.query_params.get('status', 'open')
        if state == 'done':
            return queryset.filter(is_done=True).order_by('-last_done_at', '-id')
        if state == 'all':
            return queryset.order_by(F('due_date').asc(nulls_last=True), 'id')
        return queryset.filter(is_done=False).order_by(F('due_date').asc(nulls_last=True), 'id')

    def perform_create(self, serializer):
        household = _require_membership(self.request).household
        if Task.objects.filter(household=household, is_done=False).count() >= services.MAX_OPEN_TASKS:
            raise ValidationError(f'Maximal {services.MAX_OPEN_TASKS} offene Aufgaben pro Haushalt.')
        serializer.save(household=household, created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='erledigt')
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.is_done:
            raise ValidationError('Diese Aufgabe ist bereits erledigt.')
        if task.is_paused:
            raise ValidationError('Diese Routine ist pausiert. Bitte erst fortsetzen.')
        return Response(self.get_serializer(services.complete_task(task, request.user)).data)

    @action(detail=True, methods=['post'], url_path='wieder-oeffnen')
    def reopen(self, request, pk=None):
        task = self.get_object()
        if not task.is_done:
            raise ValidationError('Diese Aufgabe ist noch offen.')
        return Response(self.get_serializer(services.reopen_task(task)).data)


class HaushaltOverviewView(APIView):
    """„Heute“ im Haushalt und die Dashboard-Karte in einer Antwort:
    Zusammenfassung (Zählwerte), heute fällige und überfällige Aufgaben
    (höchstens 5), „Demnächst“ (Fristen der nächsten services.UPCOMING_DAYS
    Tage) und der offene Einkauf. Der Haushalt kommt nur aus request.user;
    ohne Haushalt ist alles leer, statt einen Fehler zu liefern. Kind-Konten
    sehen keine Geräte und Verträge (NoChildAccount)."""

    permission_classes = [IsAuthenticated]
    LIMIT = 5
    SHOPPING_PREVIEW = 4

    @staticmethod
    def _summary(**values) -> dict:
        keys = (
            'open_tasks', 'due_today', 'overdue_tasks', 'recurring_tasks', 'done_this_week',
            'open_shopping_items', 'active_lists', 'devices', 'devices_in_repair',
            'contracts', 'contracts_expiring', 'upcoming',
        )
        return {key: values.get(key, 0) for key in keys}

    def get(self, request):
        membership = services.membership_for(request.user)
        if membership is None:
            return Response(
                {
                    'summary': self._summary(),
                    'open_tasks': 0,
                    'overdue_tasks': 0,
                    'today': [],
                    'upcoming': [],
                    'deadlines': [],
                    'shopping': {'open_items': 0, 'preview': [], 'list_id': None},
                    'open_shopping_items': 0,
                    'devices': 0,
                    'device_list': [],
                    'contracts': 0,
                    'contracts_monthly': '0.00',
                    'contract_list': [],
                }
            )
        household = membership.household
        today = timezone.localdate()
        is_child = services.is_child_account(membership)
        open_tasks = Task.objects.filter(household=household, is_done=False, is_paused=False)
        due = (
            open_tasks.filter(due_date__lte=today)
            .select_related('assigned_to', 'last_done_by', 'household')
            .prefetch_related('rotation_members')
            .order_by('due_date', F('due_time').asc(nulls_last=True), 'id')[: self.LIMIT]
        )
        upcoming = (
            open_tasks.filter(Q(due_date__gt=today) | Q(due_date__isnull=True))
            .select_related('assigned_to', 'last_done_by', 'household')
            .prefetch_related('rotation_members')
            .order_by(F('due_date').asc(nulls_last=True), F('due_time').asc(nulls_last=True), 'id')[: self.LIMIT]
        )

        open_items = ShoppingItem.objects.filter(
            shopping_list__household=household, shopping_list__archived=False, is_checked=False
        )
        default_list = services.active_shopping_list(household)
        shopping = {
            'open_items': open_items.count(),
            'preview': list(open_items.order_by('-created_at', '-id').values_list('name', flat=True)[: self.SHOPPING_PREVIEW]),
            'list_id': default_list.pk,
        }

        devices = []
        contracts = []
        deadlines = []
        contracts_monthly = Decimal('0')
        device_rows = []
        contract_rows = []
        if not is_child:
            entries = list(FolderEntry.objects.filter(household=household))
            contract_rows = [e for e in entries if e.kind == FolderEntry.Kind.CONTRACT]
            device_rows = [e for e in entries if e.kind == FolderEntry.Kind.DEVICE]
            running = [
                e for e in contract_rows
                if services.contract_status(e, today) not in (FolderEntry.Status.CANCELLED, FolderEntry.Status.ENDED)
            ]
            contracts_monthly = sum((services.monthly_equivalent(e) or Decimal('0') for e in running), Decimal('0'))
            # Verträge mit der nächsten Kündigungsfrist zuerst, ohne Frist zuletzt.
            running.sort(
                key=lambda e: (
                    services.cancellation_deadline(e) is None,
                    services.cancellation_deadline(e) or today,
                    e.name.lower(),
                )
            )
            contracts = [
                {
                    'id': entry.id,
                    'name': entry.name,
                    'provider': entry.provider,
                    'cost': str(entry.cost) if entry.cost is not None else None,
                    'billing_cycle': entry.billing_cycle,
                    'cancellation_deadline': services.cancellation_deadline(entry),
                    'effective_status': services.contract_status(entry, today),
                }
                for entry in running[: self.LIMIT]
            ]
            devices = [
                {
                    'id': entry.id,
                    'name': entry.name,
                    'provider': entry.provider,
                    'status': entry.status,
                    'maintenance_due_date': entry.maintenance_due_date,
                    'warranty_end_date': entry.warranty_end_date,
                }
                for entry in sorted(
                    (e for e in device_rows if e.status != FolderEntry.Status.RETIRED), key=lambda e: e.name.lower()
                )[: self.LIMIT]
            ]
            deadlines = [
                {**row, 'date': row['date'].isoformat()} for row in services.upcoming_deadlines(household, today)
            ]

        week_start, week_end = services.calendar_week(today)
        summary = self._summary(
            open_tasks=open_tasks.count(),
            due_today=open_tasks.filter(due_date=today).count(),
            overdue_tasks=open_tasks.filter(due_date__lt=today).count(),
            recurring_tasks=Task.objects.filter(household=household)
            .filter(Q(recurrence_days__isnull=False) | Q(recurrence_months__isnull=False))
            .count(),
            done_this_week=TaskCompletion.objects.filter(
                household=household, done_at__date__gte=week_start, done_at__date__lte=week_end
            ).count(),
            open_shopping_items=shopping['open_items'],
            active_lists=ShoppingList.objects.filter(household=household, archived=False).count(),
            devices=sum(1 for e in device_rows if e.status != FolderEntry.Status.RETIRED),
            devices_in_repair=sum(1 for e in device_rows if e.status == FolderEntry.Status.REPAIR),
            contracts=sum(
                1
                for e in contract_rows
                if services.contract_status(e, today) not in (FolderEntry.Status.CANCELLED, FolderEntry.Status.ENDED)
            ),
            contracts_expiring=sum(
                1 for e in contract_rows if services.contract_status(e, today) == FolderEntry.Status.EXPIRING
            ),
            upcoming=len(deadlines),
        )
        return Response(
            {
                'summary': summary,
                'open_tasks': summary['open_tasks'],
                'overdue_tasks': summary['overdue_tasks'],
                'today': TaskSerializer(due, many=True, context={'request': request}).data,
                'upcoming': TaskSerializer(upcoming, many=True, context={'request': request}).data,
                'deadlines': deadlines[: self.LIMIT + 3],
                'shopping': shopping,
                'device_list': devices,
                'contracts': summary['contracts'],
                'contracts_monthly': f'{contracts_monthly:.2f}',
                'contract_list': contracts,
                'open_shopping_items': summary['open_shopping_items'],
                'devices': summary['devices'],
            }
        )


class TaskWeekView(APIView):
    """Kennzahlen für „Aufgaben im Überblick“: erledigt diese Woche (Mo–So) und
    in der Vorwoche, offene Aufgaben gesamt und die der anfragenden Person."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        household = _require_membership(request).household
        return Response(services.week_stats(household, request.user))


class RoutineStatsView(APIView):
    """Erledigungsrate der aktiven Routinen in den letzten vier Wochen."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        household = _require_membership(request).household
        return Response(services.routine_stats(household))


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
            FolderEntry.objects.select_related('household')
            .filter(household=active_household(self.request.user))
            .order_by('kind', 'name')
        )

    def perform_create(self, serializer):
        household = _require_membership(self.request).household
        if FolderEntry.objects.filter(household=household).count() >= services.MAX_FOLDER_ENTRIES:
            raise ValidationError(f'Maximal {services.MAX_FOLDER_ENTRIES} Einträge im Haushaltsordner.')
        serializer.save(household=household, created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='wartung-erledigt')
    def maintenance_done(self, request, pk=None):
        entry = self.get_object()
        if entry.kind != FolderEntry.Kind.DEVICE:
            raise ValidationError('Nur Geräte haben Wartungstermine.')
        return Response(self.get_serializer(services.complete_maintenance(entry)).data)
