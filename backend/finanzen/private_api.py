"""Personal finance V1. Household finance endpoints remain a separate explicit scope."""
from datetime import date
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Category, Transaction, MonthlyBudget, SavingsGoal
from .services import month_bounds

ZERO = Decimal('0.00')
def money(value):
    return format(value or ZERO, '.2f')

class CurrencyMixin(serializers.Serializer):
    # EUR-only V1 deliberately prevents adding incompatible currencies together.
    currency = serializers.ChoiceField(choices=['EUR'], default='EUR')

class PrivateCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']
        read_only_fields = ['id']
        validators = []

class PrivateTransactionSerializer(CurrencyMixin, serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.none())
    date = serializers.DateField(source='datum')
    note = serializers.CharField(source='description', max_length=255, allow_blank=True, required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('.01'))
    class Meta:
        model = Transaction
        fields = ['id', 'amount', 'type', 'category', 'date', 'note', 'currency']
        read_only_fields = ['id']
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['category'].queryset = Category.objects.filter(owner=self.context['request'].user)

class MonthlyBudgetSerializer(CurrencyMixin, serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=ZERO)
    class Meta:
        model = MonthlyBudget
        fields = ['id', 'month', 'amount', 'currency']
        read_only_fields = ['id']
        validators = []
    def validate_month(self, value):
        return value.replace(day=1)
    def validate(self, attrs):
        month = attrs.get('month', getattr(self.instance, 'month', None))
        qs = MonthlyBudget.objects.filter(owner=self.context['request'].user, month=month, currency='EUR')
        if self.instance: qs = qs.exclude(pk=self.instance.pk)
        if qs.exists(): raise ValidationError('Für diesen Monat besteht bereits ein Budget.')
        return attrs

class SavingsGoalSerializer(CurrencyMixin, serializers.ModelSerializer):
    target_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('.01'))
    current_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=ZERO, default=ZERO)
    class Meta:
        model = SavingsGoal
        fields = ['id', 'title', 'target_amount', 'current_amount', 'target_date', 'status', 'currency']
        read_only_fields = ['id']

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
    http_method_names = ['get', 'post', 'head', 'options']

class MonthlyBudgetViewSet(PrivateViewSet):
    queryset = MonthlyBudget.objects.all()
    serializer_class = MonthlyBudgetSerializer

class SavingsGoalViewSet(PrivateViewSet):
    queryset = SavingsGoal.objects.all()
    serializer_class = SavingsGoalSerializer

DEFAULT_CATEGORIES = ['Wohnen', 'Lebensmittel', 'Mobilität', 'Freizeit', 'Gesundheit', 'Reisen', 'Sonstiges']
class SetupCategoriesView(PrivateMixin, APIView):
    def post(self, request):
        # Explicit idempotent write, never create rows as a side effect of GET.
        with transaction.atomic():
            for name in DEFAULT_CATEGORIES:
                Category.objects.get_or_create(owner=request.user, name=name)
        return Response(PrivateCategorySerializer(Category.objects.filter(owner=request.user).order_by('name'), many=True).data)

class PrivateSummaryView(PrivateMixin, APIView):
    def get(self, request):
        raw = request.query_params.get('month', timezone.localdate().strftime('%Y-%m'))
        try:
            selected = date.fromisoformat(raw+'-01')
            start, end = month_bounds(selected)
        except (ValueError, OverflowError):
            raise ValidationError({'month': 'Bitte einen Monat im Format JJJJ-MM angeben.'})
        rows = Transaction.objects.filter(owner=request.user, datum__gte=start, datum__lt=end, currency='EUR')
        income = rows.filter(type='INCOME').aggregate(total=Sum('amount'))['total'] or ZERO
        expense = rows.filter(type='EXPENSE').aggregate(total=Sum('amount'))['total'] or ZERO
        budget = MonthlyBudget.objects.filter(owner=request.user, month=start, currency='EUR').first()
        categories = rows.filter(type='EXPENSE').values('category__name').annotate(amount=Sum('amount')).order_by('-amount')
        goals = SavingsGoal.objects.filter(owner=request.user, currency='EUR')
        total = goals.exclude(status='PAUSED').aggregate(target=Sum('target_amount'), current=Sum('current_amount'))
        return Response({'month':raw, 'currency':'EUR', 'budget':money(budget.amount) if budget else None,
                         'available':money(budget.amount-expense) if budget else None,
                         'income':money(income),'expenses':money(expense),
                         'categories':[{'name':c['category__name'] or 'Sonstiges','amount':money(c['amount'])} for c in categories],
                         'savings_target':money(total['target']),'savings_current':money(total['current']),
                         'has_data':bool(budget or rows.exists() or goals.exists()),
                         'recent':PrivateTransactionSerializer(rows[:5],many=True,context={'request':request}).data})
