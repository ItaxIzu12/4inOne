"""Personal finance V1. Household finance endpoints remain a separate explicit scope."""
from datetime import date
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .category_colors import UNCATEGORISED_COLOR, color_for_name
from .models import Category, Transaction, MonthlyBudget, SavingsGoal, SavingsContribution
from .savings import SavingsPlanner, _next_month, contribution_date, goal_change_warning, plan_alert
from .services import month_bounds

ZERO = Decimal('0.00')
# Grenzen gegen Tippfehler (eine Null zu viel, falsches Jahr) — wie im alten
# Haushalts-Finanzmodell (finanzen/serializers.py _MAX_AMOUNT). Frontend:
# private-finance-api.service.ts MAX_AMOUNT / bookingDateBounds.
MAX_AMOUNT = Decimal('999999.99')
BOOKING_YEARS_BACK = 10    # Aufbewahrungsfrist für Steuerunterlagen
BOOKING_YEARS_AHEAD = 1    # geplante Ausgaben, z. B. die Miete nächsten Monat
CONTRIBUTION_LIMIT = 100   # „Letzte Einzahlungen“ und Monatsverlauf brauchen nicht mehr

def booking_date_bounds(today=None):
    today = today or timezone.localdate()
    def shift(years):
        try:
            return today.replace(year=today.year + years)
        except ValueError:  # 29. Februar
            return today.replace(year=today.year + years, day=28)
    return shift(-BOOKING_YEARS_BACK), shift(BOOKING_YEARS_AHEAD)

MAX_AMOUNT_MESSAGES = {'max_value': 'Der Betrag darf höchstens 999.999,99 € betragen.'}

def money(value):
    return format(value or ZERO, '.2f')

class CurrencyMixin(serializers.Serializer):
    # EUR-only V1 deliberately prevents adding incompatible currencies together.
    currency = serializers.ChoiceField(choices=['EUR'], default='EUR')

MAX_CATEGORY_NAME = 40
# Auffang-Kategorie: Buchungen gelöschter Kategorien landen hier, daher nicht lösch- oder umbenennbar.
FALLBACK_CATEGORY = 'Sonstiges'

class PrivateCategorySerializer(serializers.ModelSerializer):
    # Monatslimit der Kategorie („Kategorie-Budgets“) — leer = kein Limit.
    monthly_goal = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal('0'), max_value=MAX_AMOUNT,
        required=False, allow_null=True, error_messages=MAX_AMOUNT_MESSAGES,
    )
    class Meta:
        model = Category
        # color nur lesbar: sie wird beim Anlegen fest vergeben
        # (category_colors.py), damit sie nie von der Listenposition abhängt.
        fields = ['id', 'name', 'color', 'monthly_goal']
        read_only_fields = ['id', 'color']
        validators = []
    def validate_name(self, value):
        # Eigene Kategorien: Name getrimmt, kurz genug für Legende und Auswahl, pro Person
        # nur einmal (ohne Groß/Klein). Die Farbe bleibt beim Umbenennen gleich.
        name = ' '.join(value.split())
        if not name:
            raise ValidationError('Gib der Kategorie einen Namen.')
        if len(name) > MAX_CATEGORY_NAME:
            raise ValidationError(f'Der Name darf höchstens {MAX_CATEGORY_NAME} Zeichen lang sein.')
        if self.instance is not None and self.instance.name == FALLBACK_CATEGORY and name != FALLBACK_CATEGORY:
            raise ValidationError(f'„{FALLBACK_CATEGORY}“ sammelt alles ohne eigene Kategorie und behält seinen Namen.')
        mine = Category.objects.filter(owner=self.context['request'].user, name__iexact=name)
        if self.instance is not None:
            mine = mine.exclude(pk=self.instance.pk)
        if mine.exists():
            raise ValidationError('Diese Kategorie gibt es schon.')
        return name

class PrivateTransactionSerializer(CurrencyMixin, serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.none())
    date = serializers.DateField(source='datum')
    note = serializers.CharField(source='description', max_length=255, allow_blank=True, required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('.01'), max_value=MAX_AMOUNT, error_messages=MAX_AMOUNT_MESSAGES)
    class Meta:
        model = Transaction
        fields = ['id', 'amount', 'type', 'category', 'date', 'note', 'currency', 'recurring']
        read_only_fields = ['id']
        extra_kwargs = {'recurring': {'required': False}}
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['category'].queryset = Category.objects.filter(owner=self.context['request'].user)
    def validate_date(self, value):
        earliest, latest = booking_date_bounds()
        if value < earliest:
            raise ValidationError(f'Das Datum darf höchstens {BOOKING_YEARS_BACK} Jahre zurückliegen.')
        if value > latest:
            raise ValidationError('Das Datum darf höchstens ein Jahr in der Zukunft liegen.')
        return value

class MonthlyBudgetSerializer(CurrencyMixin, serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=ZERO, max_value=MAX_AMOUNT, error_messages=MAX_AMOUNT_MESSAGES)
    class Meta:
        model = MonthlyBudget
        fields = ['id', 'month', 'end_month', 'open_ended', 'amount', 'currency']
        read_only_fields = ['id']
        validators = []
    def validate_month(self, value):
        return value.replace(day=1)
    def validate_end_month(self, value):
        return value.replace(day=1) if value else value
    def validate(self, attrs):
        month = attrs.get('month', getattr(self.instance, 'month', None))
        end_month = attrs['end_month'] if 'end_month' in attrs else getattr(self.instance, 'end_month', None)
        open_ended = attrs.get('open_ended', getattr(self.instance, 'open_ended', False))
        if open_ended:
            attrs['end_month'] = None  # „bis auf Weiteres“ hat kein Ende
            end_month = None
        if end_month is not None and end_month < month:
            raise ValidationError({'end_month': 'Das Ende darf nicht vor dem Startmonat liegen.'})
        qs = MonthlyBudget.objects.filter(owner=self.context['request'].user, month=month, currency='EUR')
        if self.instance: qs = qs.exclude(pk=self.instance.pk)
        if qs.exists(): raise ValidationError('In diesem Monat beginnt bereits ein Budget.')
        return attrs

class SavingsGoalSerializer(CurrencyMixin, serializers.ModelSerializer):
    target_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('.01'), max_value=MAX_AMOUNT, error_messages=MAX_AMOUNT_MESSAGES)
    current_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=ZERO, max_value=MAX_AMOUNT, error_messages=MAX_AMOUNT_MESSAGES, default=ZERO)
    class Meta:
        model = SavingsGoal
        fields = ['id', 'title', 'target_amount', 'current_amount', 'target_date', 'status', 'currency',
                  'monthly_amount', 'plan_month', 'plan_end_month', 'plan_open_ended']
        read_only_fields = ['id']
        extra_kwargs = {'monthly_amount': {'min_value': Decimal('.01'), 'max_value': MAX_AMOUNT, 'error_messages': MAX_AMOUNT_MESSAGES, 'allow_null': True, 'required': False}}
    def validate_plan_month(self, value):
        return value.replace(day=1) if value else value
    def validate_plan_end_month(self, value):
        return value.replace(day=1) if value else value
    def validate(self, attrs):
        attrs = self._validate_plan(attrs)
        attrs = self._validate_cap(attrs)
        return attrs
    def _validate_plan(self, attrs):
        """Jedes Ziel hat einen Zeitraum (Standard: nur der laufende Monat); die Sparrate ist optional."""
        def current(field, default=None):
            return attrs[field] if field in attrs else getattr(self.instance, field, default)
        start = current('plan_month') or timezone.localdate().replace(day=1)
        end = current('plan_end_month')
        open_ended = current('plan_open_ended', False)
        if open_ended:
            end = None
        if end is not None and end < start:
            raise ValidationError({'plan_end_month': 'Das Ende darf nicht vor dem Startmonat liegen.'})
        rate, target = current('monthly_amount'), current('target_amount')
        if rate is not None and target is not None and rate > target:
            raise ValidationError({'monthly_amount': 'Die Sparrate darf nicht höher sein als das Sparziel.'})
        attrs.update(plan_month=start, plan_end_month=end, plan_open_ended=open_ended)
        return attrs
    def _validate_cap(self, attrs):
        # Gespartes darf das Ziel nicht überschreiten — außer das Ziel wird im selben Zug erhöht.
        target = attrs.get('target_amount', getattr(self.instance, 'target_amount', None))
        current = attrs.get('current_amount', getattr(self.instance, 'current_amount', ZERO))
        if target is not None and current > target:
            if 'target_amount' in attrs and 'current_amount' not in attrs:
                raise ValidationError({'target_amount': 'Das Sparziel darf nicht unter dem bereits gesparten Betrag liegen.'})
            raise ValidationError({'current_amount': 'Der gesparte Betrag darf das Sparziel nicht überschreiten. Erhöhe zuerst das Sparziel.'})
        return attrs

class PrivateMixin:
    permission_classes = [IsAuthenticated]
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response

class PrivateViewSet(PrivateMixin, viewsets.ModelViewSet):
    pagination_class = None
    def get_queryset(self):
        return self.queryset.filter(owner=self.request.user)
    def perform_create(self, serializer):
        try:
            with transaction.atomic(): serializer.save(owner=self.request.user)
        except IntegrityError:
            raise ValidationError('Dieser Eintrag besteht bereits oder ist ungültig.')
    def perform_update(self, serializer):
        try:
            with transaction.atomic(): serializer.save()
        except IntegrityError:
            raise ValidationError('Dieser Eintrag besteht bereits oder ist ungültig.')

class PrivateTransactionViewSet(PrivateViewSet):
    queryset = Transaction.objects.order_by('-datum', '-id')
    serializer_class = PrivateTransactionSerializer
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, created_by=self.request.user)
    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
    def perform_destroy(self, instance):
        instance.soft_delete()

class PrivateCategoryViewSet(PrivateViewSet):
    queryset = Category.objects.order_by('name')
    serializer_class = PrivateCategorySerializer
    # PATCH für Name und Monatslimit; DELETE verschiebt Buchungen nach „Sonstiges“.
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                name = serializer.validated_data['name']
                serializer.save(owner=self.request.user, color=color_for_name(name))
        except IntegrityError:
            raise ValidationError('Diese Kategorie gibt es schon.')

    @action(detail=True, methods=['get'], url_path='impact')
    def impact(self, request, pk=None):
        """Wie viele Buchungen hängen an der Kategorie? Nur zur Anzeige vor dem Löschen."""
        category = self.get_object()
        return Response({'transactions': category.transactions.count(), 'fallback': FALLBACK_CATEGORY})

    def perform_destroy(self, instance):
        if instance.name == FALLBACK_CATEGORY:
            raise ValidationError(f'„{FALLBACK_CATEGORY}“ sammelt alles ohne eigene Kategorie und kann nicht gelöscht werden.')
        with transaction.atomic():
            # Keine Buchung geht verloren: alles wandert in die Auffang-Kategorie (bei Bedarf neu angelegt).
            if instance.transactions.exists():
                fallback, _ = Category.objects.get_or_create(
                    owner=self.request.user, name=FALLBACK_CATEGORY,
                    defaults={'color': color_for_name(FALLBACK_CATEGORY)},
                )
                instance.transactions.update(category=fallback)
            instance.delete()

class MonthlyBudgetViewSet(PrivateViewSet):
    queryset = MonthlyBudget.objects.all()
    serializer_class = MonthlyBudgetSerializer

    @action(detail=True, methods=['get'], url_path='impact')
    def impact(self, request, pk=None):
        """Was hängt an diesem Budget? Zählt Buchungen und Sparziele in den Monaten, die OHNE dieses Budget gar kein
        Budget mehr hätten (Monate, in denen ein anderes Budget gilt, zählen nicht). Nur zur Anzeige vor dem Löschen."""
        budget = self.get_object()
        others = MonthlyBudget.objects.filter(owner=request.user, currency=budget.currency).exclude(pk=budget.pk)
        months, cursor = [], budget.month
        for _ in range(120):  # bei „bis auf Weiteres“ zehn Jahre voraus
            if not budget.covers(cursor):
                break
            if MonthlyBudget.for_month(request.user, cursor, budget.currency) == budget and not any(o.covers(cursor) for o in others):
                months.append(cursor)
            cursor = _next_month(cursor)
        transactions = goals = 0
        if months:
            first, last = months[0], months[-1]
            wanted = {(m.year, m.month) for m in months}
            dates = Transaction.objects.filter(owner=request.user, currency='EUR', datum__gte=first, datum__lt=_next_month(last)).values_list('datum', flat=True)
            transactions = sum(1 for d in dates if (d.year, d.month) in wanted)
            for goal in SavingsGoal.objects.filter(owner=request.user, currency='EUR').exclude(status='PAUSED'):
                if (goal.current_amount > ZERO or goal.monthly_amount is not None) and any(goal.covers(m) for m in months):
                    goals += 1
        return Response({'transactions': transactions, 'goals': goals})

class SavingsGoalViewSet(PrivateViewSet):
    queryset = SavingsGoal.objects.all()
    serializer_class = SavingsGoalSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        month = self.request.query_params.get('month')
        if self.action == 'list' and month:
            # Nur die Ziele, die in diesem Monat gelten. Einzelzugriffe (ändern, löschen) bleiben ungefiltert.
            try:
                start = date.fromisoformat(month + '-01')
            except ValueError:
                raise ValidationError({'month': 'Bitte einen Monat im Format JJJJ-MM angeben.'})
            return SavingsGoal.covering(queryset, start)
        return queryset

    @staticmethod
    def _record(goal, change):
        # Jede Änderung des gesparten Betrags zählt in dem Monat, in dem sie passiert.
        if change:
            SavingsContribution.objects.create(owner=goal.owner, goal=goal, amount=change, date=contribution_date(goal, timezone.localdate()))
    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)
            self._record(serializer.instance, serializer.instance.current_amount)
    def perform_update(self, serializer):
        before = serializer.instance.current_amount
        with transaction.atomic():
            super().perform_update(serializer)
            self._record(serializer.instance, serializer.instance.current_amount - before)

    @action(detail=False, methods=['get'], url_path='einzahlungen')
    def contributions(self, request):
        """Die letzten Einzahlungen (und Entnahmen) in die eigenen Sparziele,
        neueste zuerst — für „Letzte Einzahlungen“ und den Monatsverlauf."""
        rows = (SavingsContribution.objects.filter(owner=request.user).select_related('goal')
                .order_by('-date', '-id')[:CONTRIBUTION_LIMIT])
        return Response([
            {'id': c.id, 'goal': c.goal_id, 'goal_title': c.goal.title, 'amount': money(c.amount), 'date': c.date.isoformat()}
            for c in rows
        ])

    @action(detail=False, methods=['post'], url_path='preview')
    def preview_new(self, request):
        return self._preview(request, None)
    @action(detail=True, methods=['post'], url_path='preview')
    def preview_existing(self, request, pk=None):
        return self._preview(request, self.get_object())
    def _preview(self, request, instance):
        """Zeigt vor dem Speichern, ob die Änderung das Budget sprengt. Speichert nichts."""
        serializer = self.get_serializer(instance, data=request.data, partial=instance is not None)
        serializer.is_valid(raise_exception=True)
        apply = (lambda: self.perform_update(serializer)) if instance is not None else (lambda: self.perform_create(serializer))
        return Response(goal_change_warning(request.user, apply))

DEFAULT_CATEGORIES = ['Wohnen', 'Lebensmittel', 'Mobilität', 'Freizeit', 'Gesundheit', 'Reisen', FALLBACK_CATEGORY]
class SetupCategoriesView(PrivateMixin, APIView):
    def post(self, request):
        # Explicit idempotent write, never create rows as a side effect of GET.
        with transaction.atomic():
            for name in DEFAULT_CATEGORIES:
                if not Category.objects.filter(owner=request.user, name=name).exists():
                    Category.objects.create(owner=request.user, name=name, color=color_for_name(name))
        return Response(PrivateCategorySerializer(Category.objects.filter(owner=request.user).order_by('name'), many=True).data)

def month_figures(user, start, end) -> dict:
    """Die Kennzahlen eines Monats der PRIVATEN Finanzen — eine Stelle für
    die Finanzübersicht und „Heute“ (connections/today.py), damit beide nie
    auseinanderlaufen. Restbudget = Monatsbudget − Ausgaben − Sparreservierungen; Einnahmen bleiben separat."""
    rows = Transaction.objects.filter(owner=user, datum__gte=start, datum__lt=end, currency='EUR')
    income = rows.filter(type='INCOME').aggregate(total=Sum('amount'))['total'] or ZERO
    expense = rows.filter(type='EXPENSE').aggregate(total=Sum('amount'))['total'] or ZERO
    budget = MonthlyBudget.for_month(user, start)
    planner = SavingsPlanner(user)
    saved, saved_planned = planner.for_month(start)
    available = budget.amount - expense - saved if budget else None
    return {'rows': rows, 'income': income, 'expense': expense, 'budget': budget, 'planner': planner,
            'saved': saved, 'saved_planned': saved_planned, 'available': available}


class PrivateSummaryView(PrivateMixin, APIView):
    def get(self, request):
        raw = request.query_params.get('month', timezone.localdate().strftime('%Y-%m'))
        try:
            selected = date.fromisoformat(raw+'-01')
            start, end = month_bounds(selected)
        except (ValueError, OverflowError):
            raise ValidationError({'month': 'Bitte einen Monat im Format JJJJ-MM angeben.'})
        figures = month_figures(request.user, start, end)
        rows, income, expense, budget = figures['rows'], figures['income'], figures['expense'], figures['budget']
        # Nach Betrag sortiert, deshalb gehört die Farbe zur Kategorie selbst
        # (category__color) und nie zur Position in dieser Liste.
        categories = (rows.filter(type='EXPENSE').values('category_id', 'category__name', 'category__color')
                      .annotate(amount=Sum('amount')).order_by('-amount', 'category__name'))
        planner, saved, saved_planned = figures['planner'], figures['saved'], figures['saved_planned']
        goals = SavingsGoal.covering(SavingsGoal.objects.filter(owner=request.user, currency='EUR'), start)  # nur Ziele dieses Monats
        total = goals.exclude(status='PAUSED').aggregate(target=Sum('target_amount'), current=Sum('current_amount'))
        return Response({'month':raw, 'currency':'EUR', 'budget':money(budget.amount) if budget else None,
                         # total bleibt als API-Feld erhalten und bezeichnet ausschließlich das Ausgabenlimit.
                         'total':money(budget.amount) if budget else None,
                         'saved':money(saved),'saved_planned':money(saved_planned),
                         # Erster Monat (ab hier, 12 Monate voraus), in dem die Sparraten das Budget sprengen — sonst null.
                         'plan_alert':plan_alert(request.user,start,planner),
                         'available':money(figures['available']) if budget else None,
                         'income':money(income),'expenses':money(expense),
                         'categories':[{'id':c['category_id'],'name':c['category__name'] or 'Sonstiges',
                                        'color':c['category__color'] or UNCATEGORISED_COLOR,'amount':money(c['amount'])} for c in categories],
                         'savings_target':money(total['target']),'savings_current':money(total['current']),
                         'has_data':bool(budget or rows.exists() or goals.exists()),
                         'recent':PrivateTransactionSerializer(rows[:5],many=True,context={'request':request}).data})
