from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from core.models import HouseholdMembership
from finanzen.models import Category, RecurringDeduction
from haushalt import services
from haushalt.models import FolderEntry, ItemMemory, Section, ShoppingItem, Task

# Wie in finanzen/serializers.py: deutlich unter dem technisch Möglichen,
# fängt Tippfehler (eine Null zu viel) ab.
_MAX_AMOUNT = Decimal('1000000')


def _display_name(user) -> str | None:
    if user is None:
        return None
    return user.first_name or user.email


def _household(serializer):
    request = serializer.context['request']
    membership = services.membership_for(request.user)
    if membership is None:
        raise serializers.ValidationError('Dieses Konto ist noch keinem Haushalt zugeordnet.')
    return membership.household


def _clean_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise serializers.ValidationError('Bitte einen Namen eingeben.')
    return value


# ---------------------------------------------------------------------------
# Einkaufsliste
# ---------------------------------------------------------------------------


class ShoppingItemSerializer(serializers.ModelSerializer):
    section = serializers.ChoiceField(choices=Section.choices, required=False)
    checked_by_name = serializers.SerializerMethodField()
    added_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ShoppingItem
        # Explizite Whitelist (Mass-Assignment-Schutz wie in finanzen/):
        # shopping_list wird nie vom Client übernommen, sondern serverseitig
        # aus dem Haushalt der anfragenden Person bestimmt.
        fields = [
            'id',
            'name',
            'quantity',
            'section',
            'is_checked',
            'checked_at',
            'checked_by_name',
            'added_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'checked_at', 'checked_by_name', 'added_by_name', 'created_at']

    def get_checked_by_name(self, obj) -> str | None:
        return _display_name(obj.checked_by)

    def get_added_by_name(self, obj) -> str | None:
        return _display_name(obj.added_by)

    def validate_name(self, value):
        return _clean_name(value)

    def validate_quantity(self, value):
        return value.strip()


class ItemMemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemMemory
        fields = ['id', 'name', 'section', 'use_count']


class CompleteShoppingSerializer(serializers.Serializer):
    # null/fehlend = Einkauf ohne Ausgabe abschließen.
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source='category', queryset=Category.objects.all(), required=False, allow_null=True
    )

    def validate_amount(self, value):
        if value is None:
            return value
        if value <= 0:
            raise serializers.ValidationError('Der Betrag muss größer als 0 sein.')
        if value >= _MAX_AMOUNT:
            raise serializers.ValidationError('Der Betrag darf nicht 1.000.000 € oder mehr betragen.')
        return value

    def validate(self, attrs):
        # IDOR-Schutz: eine Kategorie aus einem fremden Haushalt darf nicht
        # als Buchungsziel dienen.
        category = attrs.get('category')
        if category is not None and category.household_id != _household(self).pk:
            raise serializers.ValidationError({'category_id': 'Diese Kategorie gehört nicht zu deinem Haushalt.'})
        return attrs


# ---------------------------------------------------------------------------
# Aufgaben
# ---------------------------------------------------------------------------


class _HouseholdMemberField(serializers.PrimaryKeyRelatedField):
    """Eine Person, die Mitglied im Haushalt der anfragenden Person sein
    muss — sonst ließe sich eine Aufgabe einer fremden Person zuweisen
    (IDOR, dieselbe Klasse wie category_id in finanzen/)."""

    def get_queryset(self):
        request = self.context['request']
        membership = services.membership_for(request.user)
        if membership is None:
            return get_user_model().objects.none()
        member_ids = HouseholdMembership.objects.filter(household=membership.household).values_list(
            'user_id', flat=True
        )
        return get_user_model().objects.filter(pk__in=member_ids)


class TaskSerializer(serializers.ModelSerializer):
    assigned_to = _HouseholdMemberField(required=False, allow_null=True)
    rotation_member_ids = _HouseholdMemberField(
        source='rotation_members', many=True, required=False
    )
    assigned_to_name = serializers.SerializerMethodField()
    last_done_by_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'assigned_to',
            'assigned_to_name',
            'due_date',
            'recurrence_days',
            'effort',
            'rotate',
            'rotation_member_ids',
            'is_done',
            'is_overdue',
            'last_done_at',
            'last_done_by_name',
        ]
        read_only_fields = ['id', 'is_done', 'last_done_at', 'last_done_by_name', 'assigned_to_name', 'is_overdue']

    def get_assigned_to_name(self, obj) -> str | None:
        return _display_name(obj.assigned_to)

    def get_last_done_by_name(self, obj) -> str | None:
        return _display_name(obj.last_done_by)

    def get_is_overdue(self, obj) -> bool:
        return bool(obj.due_date and not obj.is_done and obj.due_date < timezone.localdate())

    def validate_title(self, value):
        return _clean_name(value)

    def validate_recurrence_days(self, value):
        if value is not None and not 1 <= value <= 365:
            raise serializers.ValidationError('Die Wiederholung muss zwischen 1 und 365 Tagen liegen.')
        return value

    def validate_due_date(self, value):
        if value is not None and value < timezone.localdate() - timedelta(days=365):
            raise serializers.ValidationError('Das Datum darf nicht mehr als ein Jahr zurückliegen.')
        return value

    def validate(self, attrs):
        def current(field, default=None):
            if field in attrs:
                return attrs[field]
            if self.instance is not None:
                if field == 'rotation_members':
                    return list(self.instance.rotation_members.all())
                return getattr(self.instance, field)
            return default

        recurrence = current('recurrence_days')
        rotate = current('rotate', False)
        rotation = current('rotation_members', [])

        if recurrence and current('due_date') is None:
            # Wiederkehrende Aufgaben brauchen einen Startpunkt — ohne Angabe
            # ist das heute.
            attrs['due_date'] = timezone.localdate()

        if rotate:
            if not recurrence:
                raise serializers.ValidationError(
                    {'rotate': 'Reihum wechseln geht nur bei wiederkehrenden Aufgaben.'}
                )
            if len(rotation) < 2:
                raise serializers.ValidationError(
                    {'rotation_member_ids': 'Für „reihum“ bitte mindestens zwei Personen auswählen.'}
                )
            assigned = current('assigned_to')
            if assigned is None or assigned not in rotation:
                attrs['assigned_to'] = sorted(rotation, key=lambda user: user.pk)[0]
        return attrs


# ---------------------------------------------------------------------------
# Haushaltsordner
# ---------------------------------------------------------------------------


class _RecurringDeductionField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        request = self.context['request']
        membership = services.membership_for(request.user)
        if membership is None:
            return RecurringDeduction.objects.none()
        return RecurringDeduction.objects.filter(household=membership.household)


class FolderEntrySerializer(serializers.ModelSerializer):
    recurring_deduction_id = _RecurringDeductionField(
        source='recurring_deduction', required=False, allow_null=True
    )
    monthly_cost = serializers.SerializerMethodField()
    deduction_active = serializers.SerializerMethodField()
    cancel_by = serializers.SerializerMethodField()
    deadlines = serializers.SerializerMethodField()

    class Meta:
        model = FolderEntry
        fields = [
            'id',
            'kind',
            'name',
            'provider',
            'notes',
            'recurring_deduction_id',
            'monthly_cost',
            'deduction_active',
            'contract_end',
            'notice_period_months',
            'cancel_by',
            'purchase_date',
            'warranty_until',
            'maintenance_interval_months',
            'next_maintenance',
            'deadlines',
        ]
        read_only_fields = ['id', 'monthly_cost', 'deduction_active', 'cancel_by', 'deadlines']

    def get_monthly_cost(self, obj) -> str | None:
        # Kosten kommen ausschließlich aus dem verknüpften festen Abzug —
        # eine Quelle, keine zweite Zahl, die auseinanderlaufen kann. Ein
        # pausierter Abzug kostet laut Finanzen gerade nichts (fließt nicht
        # ins Verfügbare Einkommen ein), also auch hier nicht.
        deduction = obj.recurring_deduction
        if deduction is None or not deduction.active:
            return None
        return str(deduction.amount)

    def get_deduction_active(self, obj) -> bool | None:
        """None = kein fester Abzug verknüpft; False = verknüpft, aber in
        Finanzen pausiert (das Frontend zeigt dann "pausiert")."""
        deduction = obj.recurring_deduction
        return None if deduction is None else deduction.active

    def get_cancel_by(self, obj) -> str | None:
        day = services.cancel_by(obj) if obj.kind == FolderEntry.Kind.CONTRACT else None
        return day.isoformat() if day else None

    def get_deadlines(self, obj) -> list[dict]:
        return [
            {'art': deadline['art'], 'datum': deadline['datum'].isoformat(), 'titel': deadline['titel']}
            for deadline in services.folder_deadlines(obj)
        ]

    def validate_name(self, value):
        return _clean_name(value)

    def validate_notice_period_months(self, value):
        if value is not None and value > 36:
            raise serializers.ValidationError('Die Kündigungsfrist darf höchstens 36 Monate betragen.')
        return value

    def validate_maintenance_interval_months(self, value):
        if value is not None and not 1 <= value <= 120:
            raise serializers.ValidationError('Das Wartungsintervall muss zwischen 1 und 120 Monaten liegen.')
        return value

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', None))
        if self.instance is not None and 'kind' in attrs and attrs['kind'] != self.instance.kind:
            raise serializers.ValidationError({'kind': 'Die Art eines Eintrags kann nicht geändert werden.'})

        # Felder der jeweils anderen Art werden verworfen, statt stillschweigend
        # gespeichert zu werden (ein Gerät hat keine Kündigungsfrist).
        contract_fields = ('recurring_deduction', 'contract_end', 'notice_period_months')
        device_fields = ('purchase_date', 'warranty_until', 'maintenance_interval_months', 'next_maintenance')
        foreign = device_fields if kind == FolderEntry.Kind.CONTRACT else contract_fields
        for field in foreign:
            attrs.pop(field, None)

        if kind == FolderEntry.Kind.DEVICE:
            interval = attrs.get('maintenance_interval_months', getattr(self.instance, 'maintenance_interval_months', None))
            next_maintenance = attrs.get('next_maintenance', getattr(self.instance, 'next_maintenance', None))
            if interval and next_maintenance is None:
                # Ohne Angabe: erste Wartung ein Intervall nach Kauf (oder heute).
                base = attrs.get('purchase_date', getattr(self.instance, 'purchase_date', None))
                attrs['next_maintenance'] = services.first_maintenance(base or timezone.localdate(), interval)

        deduction = attrs.get('recurring_deduction')
        if deduction is not None:
            linked = FolderEntry.objects.filter(recurring_deduction=deduction)
            if self.instance is not None:
                linked = linked.exclude(pk=self.instance.pk)
            if linked.exists():
                raise serializers.ValidationError(
                    {'recurring_deduction_id': 'Dieser feste Abzug ist bereits mit einem anderen Vertrag verknüpft.'}
                )
        return attrs
