from decimal import Decimal

from django.db.models import Count, DecimalField, IntegerField, OuterRef, Prefetch, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PackingItem, Trip, TripBudgetCategory, TripEvent, TripExpense, TripParticipant, TripTask
from .permissions import WRITABLE_ROLES, TripAccessPermission, TripContentAccessPermission, TripParticipantManagePermission
from .serializers import (
    PackingItemSerializer,
    TripBudgetCategorySerializer,
    TripEventSerializer,
    TripExpenseSerializer,
    TripParticipantSerializer,
    TripSerializer,
    TripTaskSerializer,
)


def trips_visible_to(user):
    """Reisen, die ein Nutzer sehen darf: eigene plus die, an denen er als Teilnehmer beteiligt ist (gleich
    welcher Rolle) — siehe TripParticipant-Docstring für die Trennung von owner und participants."""
    return Trip.objects.filter(Q(owner=user) | Q(participants__user=user)).distinct()


def _subquery_count(model, **filters):
    rows = model.objects.filter(trip=OuterRef('pk'), **filters).order_by().values('trip').annotate(n=Count('id')).values('n')
    return Coalesce(Subquery(rows, output_field=IntegerField()), Value(0))


def annotate_trip_counts(queryset):
    """Alle Kennzahlen der Reisekarten in EINER Abfrage (Subqueries statt Joins, damit sich die Zählungen nicht
    gegenseitig vervielfachen) plus Teilnehmer vorab — kein N+1 bei vielen Reisen."""
    spent = TripExpense.objects.filter(trip=OuterRef('pk')).order_by().values('trip').annotate(s=Sum('amount')).values('s')
    return queryset.annotate(
        n_packing=_subquery_count(PackingItem),
        n_packed=_subquery_count(PackingItem, is_packed=True),
        n_tasks=_subquery_count(TripTask),
        n_tasks_open=_subquery_count(TripTask, status=TripTask.Status.OPEN),
        n_events=_subquery_count(TripEvent),
        sum_spent=Coalesce(
            Subquery(spent, output_field=DecimalField(max_digits=12, decimal_places=2)),
            Value(Decimal('0')),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
    ).prefetch_related(Prefetch('participants', queryset=TripParticipant.objects.select_related('user')))


def _money(value):
    return None if value is None else str(Decimal(value).quantize(Decimal('0.01')))


class PrivateResponseMixin:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class TripViewSet(PrivateResponseMixin, viewsets.ModelViewSet):
    """Eine Reise gehört ihrem Ersteller (owner), ist aber für alle Teilnehmer sichtbar — siehe
    trips_visible_to() und TripAccessPermission."""

    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated, TripAccessPermission]
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    queryset = Trip.objects.all()

    def get_queryset(self):
        queryset = annotate_trip_counts(trips_visible_to(self.request.user))
        # Meine Reisen: ?scope=upcoming (läuft noch oder kommt), past (vorbei) oder cancelled (abgesagt).
        scope = self.request.query_params.get('scope')
        today = timezone.localdate()
        if scope == 'upcoming':
            queryset = queryset.filter(end_date__gte=today).exclude(status=Trip.Status.CANCELLED)
        elif scope == 'past':
            queryset = queryset.filter(end_date__lt=today).exclude(status=Trip.Status.CANCELLED)
        elif scope == 'cancelled':
            queryset = queryset.filter(status=Trip.Status.CANCELLED)
        return queryset

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Die Zahlen für Reise › Übersicht in einer Antwort — Berechtigung wie beim Lesen der Reise selbst."""
        trip = self.get_object()
        spent = trip.sum_spent
        planned = trip.tripbudgetcategorys.aggregate(total=Sum('planned_amount'))['total'] or Decimal('0')
        budget = trip.budget_amount if trip.budget_amount else (planned if planned > 0 else None)
        return Response({
            'open_tasks': trip.n_tasks_open,
            'tasks_total': trip.n_tasks,
            'packing_total': trip.n_packing,
            'packing_completed': trip.n_packed,
            'participants': len(trip.participants.all()),
            'budget_total': _money(budget),
            'budget_spent': _money(spent),
            'budget_remaining': _money(budget - spent) if budget is not None else None,
            'currency': trip.currency,
        })

    def perform_create(self, serializer):
        trip = serializer.save(owner=self.request.user)
        # Solo-Reise: der Ersteller ist automatisch der einzige Teilnehmer, ohne vorher eine Gruppe oder einen
        # Haushalt anzulegen (siehe TripParticipant-Docstring) — kann später ausdrücklich entfernt werden.
        TripParticipant.objects.create(trip=trip, user=self.request.user, role=TripParticipant.Role.OWNER)

    @action(detail=False, methods=['get'])
    def overlaps(self, request):
        """Reisen, an denen der Nutzer tatsächlich beteiligt ist (Ersteller ODER Teilnehmer), deren Zeitraum
        sich mit dem übergebenen überschneidet — nicht nur die eigenen, da Überschneidungen genauso relevant
        sind, wenn man nur Teilnehmer einer fremden Reise ist. Rein informativ: blockiert nichts, das Frontend
        zeigt damit nur eine Warnung mit der Wahl "Daten ändern" oder "Trotzdem erstellen" — serverseitig, weil
        eine rein clientseitige Prüfung sich umgehen ließe und nicht verlässlich wäre.
        """
        start = parse_date(request.query_params.get('start_date') or '')
        end = parse_date(request.query_params.get('end_date') or '')
        if not start or not end:
            return Response([])
        queryset = annotate_trip_counts(trips_visible_to(request.user)).filter(
            start_date__isnull=False, end_date__isnull=False, start_date__lte=end, end_date__gte=start,
        )
        exclude_id = request.query_params.get('exclude')
        if exclude_id and exclude_id.isdigit():
            queryset = queryset.exclude(pk=exclude_id)
        return Response(TripSerializer(queryset, many=True, context={'request': request}).data)


class TripScopedViewSet(PrivateResponseMixin, viewsets.ModelViewSet):
    """Für alles, was an eine Trip hängt (Packliste/Aufgaben/Termine/Ausgaben/Budget). Sichtbar für Ersteller UND
    Teilnehmer, schreibbar nur für Ersteller und Teilnehmer mit Rolle OWNER/EDITOR (siehe
    TripContentAccessPermission). Optionaler Query-Parameter ?trip=<id> grenzt auf eine einzelne Reise ein, da
    ein Nutzer mehrere Reisen gleichzeitig haben kann (anders als z. B. Haushalt, wo es je Nutzer nur einen
    aktiven Haushalt gibt)."""

    permission_classes = [IsAuthenticated, TripContentAccessPermission]
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = self.queryset.filter(Q(trip__owner=self.request.user) | Q(trip__participants__user=self.request.user)).distinct()
        trip_id = self.request.query_params.get('trip')
        if trip_id is not None:
            queryset = queryset.filter(trip_id=trip_id)
        return queryset


class PackingItemViewSet(TripScopedViewSet):
    queryset = PackingItem.objects.all()
    serializer_class = PackingItemSerializer


    @action(detail=False, methods=['post'], url_path='zuruecksetzen')
    def reset(self, request):
        """Alle Häkchen einer Reise auf einmal zurücknehmen (?trip=<id>) — nur mit Schreibrecht an der Reise."""
        trip = trips_visible_to(request.user).filter(pk=request.query_params.get('trip') or 0).first()
        if trip is None:
            raise NotFound()
        if trip.owner_id != request.user.id and not TripParticipant.objects.filter(
            trip=trip, user=request.user, role__in=WRITABLE_ROLES
        ).exists():
            raise PermissionDenied('Du darfst diese Packliste nicht ändern.')
        changed = PackingItem.objects.filter(trip=trip, is_packed=True).update(is_packed=False, packed_at=None)
        return Response({'reset': changed})


class TripTaskViewSet(TripScopedViewSet):
    queryset = TripTask.objects.all()
    serializer_class = TripTaskSerializer


class TripEventViewSet(TripScopedViewSet):
    queryset = TripEvent.objects.all()
    serializer_class = TripEventSerializer


class TripExpenseViewSet(TripScopedViewSet):
    queryset = TripExpense.objects.all()
    serializer_class = TripExpenseSerializer


class TripBudgetCategoryViewSet(TripScopedViewSet):
    queryset = TripBudgetCategory.objects.all()
    serializer_class = TripBudgetCategorySerializer


class TripParticipantViewSet(PrivateResponseMixin, viewsets.ModelViewSet):
    """Teilnehmer einer Reise. Sichtbar für jeden mit Zugriff auf die Reise (siehe get_queryset()); verwalten
    (hinzufügen/Rolle ändern/entfernen) dürfen nur Ersteller und Teilnehmer mit Rolle OWNER — außer man entfernt
    sich selbst, das darf jeder (siehe TripParticipantManagePermission)."""

    queryset = TripParticipant.objects.all()
    serializer_class = TripParticipantSerializer
    permission_classes = [IsAuthenticated, TripParticipantManagePermission]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = TripParticipant.objects.filter(
            Q(trip__owner=self.request.user) | Q(trip__participants__user=self.request.user)
        ).distinct()
        trip_id = self.request.query_params.get('trip')
        if trip_id is not None:
            queryset = queryset.filter(trip_id=trip_id)
        return queryset
