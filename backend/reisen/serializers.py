from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from core.currencies import CURRENCY_CHOICES, DEFAULT_HOME_CURRENCY
from core.fx import convert
from core.models import Contact, home_currency_for

from .expense_fx import _Rates, resnapshot_trip_currency, snapshot_expense
from .models import PackingItem, Trip, TripBudgetCategory, TripEvent, TripExpense, TripParticipant, TripTask


def _display_name(user) -> str:
    # Dieselbe, bereits etablierte Regel wie core/contact_views.py — kein voller Name/E-Mail an andere
    # Teilnehmer, nur ein Anzeigename (AGENTS.md: private Profilinformationen nicht automatisch teilen).
    return user.first_name or user.email.split('@')[0]


class TripParticipantSerializer(serializers.ModelSerializer):
    """Erzeugen geschieht ausschließlich über einen eigenen Kontakt (core.Contact), nie über eine frei eingegebene
    E-Mail-Adresse — ein Endpunkt, der beliebige E-Mails gegen bestehende Konten prüft, wäre eine
    User-Enumeration-Lücke. contact_id ist deshalb write-only und auf die eigenen Kontakte eingeschränkt."""

    contact_id = serializers.PrimaryKeyRelatedField(queryset=Contact.objects.none(), write_only=True, required=False)
    display_name = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()

    class Meta:
        model = TripParticipant
        fields = ['id', 'trip', 'user', 'display_name', 'is_self', 'role', 'added_at', 'contact_id']
        read_only_fields = ['id', 'user', 'added_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request is not None:
            self.fields['contact_id'].queryset = Contact.objects.filter(owner=request.user)

    def get_display_name(self, obj) -> str:
        return _display_name(obj.user)

    def get_is_self(self, obj) -> bool:
        # Fürs Frontend: nur so lässt sich "Reise verlassen" (Selbstentfernung, immer erlaubt) von "jemand
        # anderen entfernen" (nur Ersteller/OWNER) unterscheiden, ohne dass das Frontend eine Nutzer-ID kennen
        # müsste (AuthService liefert bewusst nur Name/E-Mail, siehe core/auth_views.py::_user_payload).
        request = self.context.get('request')
        return request is not None and obj.user_id == request.user.id

    def validate(self, attrs):
        if self.instance is None:
            contact = attrs.pop('contact_id', None)
            if contact is None:
                raise serializers.ValidationError({'contact_id': 'Bitte wähle eine Person aus deinen Kontakten.'})
            attrs['user'] = contact.other
            trip = attrs.get('trip')
            if trip is not None and TripParticipant.objects.filter(trip=trip, user=attrs['user']).exists():
                raise serializers.ValidationError({'contact_id': 'Diese Person ist bereits Teilnehmer dieser Reise.'})
        return attrs

    def validate_trip(self, trip):
        """Nur der Ersteller oder ein Teilnehmer mit Rolle OWNER darf neue Teilnehmer hinzufügen — für
        Rollenänderung/Entfernen bestehender Zeilen prüft TripParticipantManagePermission zusätzlich pro Objekt,
        weil ein PATCH ohne erneutes `trip`-Feld hier sonst gar nicht validiert würde."""
        request = self.context.get('request')
        if request is None:
            return trip
        if trip.owner_id == request.user.id:
            return trip
        if TripParticipant.objects.filter(trip=trip, user=request.user, role=TripParticipant.Role.OWNER).exists():
            return trip
        raise serializers.ValidationError('Du darfst keine Teilnehmer für diese Reise verwalten.')


class TripSerializer(serializers.ModelSerializer):
    # Kennzahlen für Meine Reisen und die Übersicht. Die Liste liefert sie per Annotation in einer Abfrage
    # (siehe annotate_trip_counts() in views.py); ohne Annotation (z. B. direkt nach dem Anlegen) wird gezählt.
    packing_total = serializers.SerializerMethodField()
    packing_packed = serializers.SerializerMethodField()
    tasks_open = serializers.SerializerMethodField()
    tasks_total = serializers.SerializerMethodField()
    events_count = serializers.SerializerMethodField()
    budget_spent = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'title', 'destination', 'departure', 'start_date', 'end_date', 'notes', 'status',
            'travel_type', 'transport_type', 'baggage', 'climate', 'budget_amount', 'currency',
            'accommodation', 'accommodation_area', 'transport_note',
            'created_at', 'updated_at',
            'packing_total', 'packing_packed', 'tasks_open', 'tasks_total', 'events_count', 'budget_spent',
            'participants', 'my_role',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if self.instance is None and start and start < timezone.localdate():
            raise serializers.ValidationError({'start_date': 'Der erste Reisetag darf nicht vor heute liegen.'})
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'Das Ende darf nicht vor dem Beginn liegen.'})
        # Reisen V1: eine Reise braucht ein Ziel. Ältere Reisen ohne Ziel bleiben bearbeitbar, solange das Ziel
        # nicht ausdrücklich geleert wird.
        destination = attrs.get('destination')
        if (self.instance is None or 'destination' in attrs) and not (destination or '').strip():
            raise serializers.ValidationError({'destination': 'Bitte gib ein Reiseziel an.'})
        return attrs

    def create(self, validated_data):
        # Ohne Angabe: die Heimatwährung dessen, der die Reise anlegt — keine fest eingebaute Währung.
        request = self.context.get('request')
        if 'currency' not in validated_data and request is not None:
            validated_data['currency'] = home_currency_for(request.user)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        old_currency = instance.currency
        trip = super().update(instance, validated_data)
        if trip.currency != old_currency:
            resnapshot_trip_currency(trip)
        return trip

    baggage = serializers.ListField(
        child=serializers.ChoiceField(choices=Trip.BaggageType.choices), required=False, allow_empty=True, max_length=3,
    )

    def validate_baggage(self, value):
        order = [choice for choice, _ in Trip.BaggageType.choices]
        return [choice for choice in order if choice in set(value)]

    def validate_budget_amount(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Das Budget darf nicht negativ sein.')
        return value

    @staticmethod
    def _count(obj, name, fallback):
        value = getattr(obj, name, None)
        return fallback() if value is None else value

    def get_packing_total(self, obj):
        return self._count(obj, 'n_packing', lambda: obj.packingitems.count())

    def get_packing_packed(self, obj):
        return self._count(obj, 'n_packed', lambda: obj.packingitems.filter(is_packed=True).count())

    def get_tasks_open(self, obj):
        return self._count(obj, 'n_tasks_open', lambda: obj.triptasks.filter(status=TripTask.Status.OPEN).count())

    def get_tasks_total(self, obj):
        return self._count(obj, 'n_tasks', lambda: obj.triptasks.count())

    def get_events_count(self, obj):
        return self._count(obj, 'n_events', lambda: obj.tripevents.count())

    def get_budget_spent(self, obj):
        total = self._count(obj, 'sum_spent', lambda: obj.tripexpenses.aggregate(total=Sum('amount_trip'))['total'])
        return str((total or Decimal('0')).quantize(Decimal('0.01')))

    def get_participants(self, obj):
        return TripParticipantSerializer(obj.participants.all(), many=True, context=self.context).data

    def get_my_role(self, obj):
        request = self.context.get('request')
        if request is None:
            return None
        if obj.owner_id == request.user.id:
            return 'OWNER'
        participant = next((p for p in obj.participants.all() if p.user_id == request.user.id), None)
        return participant.role if participant else None


class TripScopedSerializer(serializers.ModelSerializer):
    """Gemeinsame Validierung für alles, was an eine Reise hängt: die Reise muss existieren und für den
    anfragenden Nutzer SCHREIBBAR sein — Ersteller oder Teilnehmer mit Rolle OWNER/EDITOR. Eine reine
    VIEWER-Mitgliedschaft darf lesen (siehe get_queryset() in views.py), aber nichts anhängen."""

    def validate_trip(self, trip):
        request = self.context.get('request')
        if request is None:
            return trip
        if trip.owner_id == request.user.id:
            return trip
        participant = TripParticipant.objects.filter(trip=trip, user=request.user).first()
        if participant is not None and participant.role in (TripParticipant.Role.OWNER, TripParticipant.Role.EDITOR):
            return trip
        raise serializers.ValidationError('Du darfst dieser Reise nichts hinzufügen.')


class PackingItemSerializer(TripScopedSerializer):
    class Meta:
        model = PackingItem
        fields = ['id', 'trip', 'title', 'is_packed', 'quantity', 'category', 'note', 'packed_at', 'created_at']
        read_only_fields = ['id', 'packed_at', 'created_at']

    def _stamp(self, validated_data, before: bool):
        # „Erledigt am“ folgt allein dem Häkchen: abhaken setzt den Zeitpunkt, zurücknehmen löscht ihn.
        if 'is_packed' in validated_data and validated_data['is_packed'] != before:
            validated_data['packed_at'] = timezone.now() if validated_data['is_packed'] else None

    def create(self, validated_data):
        self._stamp(validated_data, False)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._stamp(validated_data, instance.is_packed)
        return super().update(instance, validated_data)


class TripTaskSerializer(TripScopedSerializer):
    assignee_name = serializers.SerializerMethodField()

    class Meta:
        model = TripTask
        fields = ['id', 'trip', 'title', 'due_date', 'due_time', 'status', 'note', 'assignee', 'assignee_name', 'created_at']
        read_only_fields = ['id', 'created_at']
        # Zuständig sein kann nur, wer die Reise sieht — die Prüfung gegen genau diese Reise folgt in validate().
        # Unbekannte ID und fremde Person bekommen dieselbe Meldung, damit sich keine Konten erraten lassen.
        extra_kwargs = {'assignee': {'error_messages': {'does_not_exist': 'Diese Person reist nicht mit.'}}}

    def get_assignee_name(self, obj):
        return _display_name(obj.assignee) if obj.assignee_id else ''

    def validate(self, attrs):
        due_date = attrs.get('due_date', getattr(self.instance, 'due_date', None))
        if attrs.get('due_time') and not due_date:
            raise serializers.ValidationError({'due_time': 'Eine Uhrzeit braucht ein Datum.'})
        if 'due_date' in attrs and attrs['due_date'] is None:
            attrs['due_time'] = None
        assignee = attrs.get('assignee')
        if assignee is not None:
            trip = attrs.get('trip') or getattr(self.instance, 'trip', None)
            if trip is None or not (
                trip.owner_id == assignee.id or TripParticipant.objects.filter(trip=trip, user=assignee).exists()
            ):
                # Gleiche Meldung wie für eine unbekannte ID: verrät nicht, ob es das Konto gibt.
                raise serializers.ValidationError({'assignee': 'Diese Person reist nicht mit.'})
        return attrs


class TripEventSerializer(TripScopedSerializer):
    class Meta:
        model = TripEvent
        fields = ['id', 'trip', 'title', 'starts_at', 'ends_at', 'location', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        start = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        end = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if end and start and end < start:
            raise serializers.ValidationError({'ends_at': 'Das Ende darf nicht vor dem Beginn liegen.'})
        return attrs


class TripExpenseSerializer(TripScopedSerializer):
    """Originalbetrag + Originalwährung kommen vom Nutzer (Standard: Reisewährung); die Umrechnungen rechnet nur das
    Backend (expense_fx.py) — vom Client gesendete Werte dafür werden ignoriert (read-only)."""

    currency = serializers.ChoiceField(choices=CURRENCY_CHOICES, required=False)

    class Meta:
        model = TripExpense
        fields = [
            'id', 'trip', 'title', 'amount', 'currency', 'date', 'category', 'note',
            'amount_trip', 'rate_to_trip', 'home_currency', 'amount_home', 'rate_to_home', 'rate_date',
            'created_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'amount_trip', 'rate_to_trip', 'home_currency', 'amount_home', 'rate_to_home', 'rate_date',
        ]

    def validate_amount(self, value):
        # Eine Ausgabe von 0 ist keine Ausgabe. Das Datum darf vor der Reise liegen (Flug Monate vorher gebucht).
        if value <= 0:
            raise serializers.ValidationError('Der Betrag muss größer als 0 sein.')
        return value

    def _home(self) -> str:
        request = self.context.get('request')
        return home_currency_for(request.user) if request else DEFAULT_HOME_CURRENCY

    def to_representation(self, instance):
        """Der Heimatwährungs-Wert ist persönlich: gespeichert ist er in der Währung dessen, der die Ausgabe erfasst
        hat. Mitreisende mit anderer Heimatwährung bekommen stattdessen ihren eigenen Vergleichswert (aktueller Kurs)
        — so verrät die Antwort nie die Heimatwährung einer anderen Person."""
        data = super().to_representation(instance)
        viewer_home = self._home()
        if data.get('home_currency') in (None, '', viewer_home):
            return data
        rates = self.context.setdefault('_fx_rates', _Rates())
        rate = rates.rate(instance.currency, viewer_home)
        data['home_currency'] = viewer_home
        data['rate_to_home'] = str(rate.rate) if rate else None
        data['amount_home'] = str(convert(instance.amount, rate)) if rate else None
        data['rate_date'] = rate.rate_date.isoformat() if rate and rate.rate_date else None
        return data

    def create(self, validated_data):
        validated_data.setdefault('currency', validated_data['trip'].currency)
        expense = TripExpense(**validated_data)
        snapshot_expense(expense, home_currency=self._home(), recompute=True)
        expense.save()
        return expense

    def update(self, instance, validated_data):
        validated_data.pop('trip', None)  # eine Ausgabe wandert nicht in eine andere Reise
        changed = any(key in validated_data and validated_data[key] != getattr(instance, key) for key in ('amount', 'currency'))
        for key, value in validated_data.items():
            setattr(instance, key, value)
        snapshot_expense(instance, home_currency=self._home(), recompute=changed)
        instance.save()
        return instance


class TripBudgetCategorySerializer(TripScopedSerializer):
    class Meta:
        model = TripBudgetCategory
        fields = ['id', 'trip', 'category', 'planned_amount', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_planned_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Der geplante Betrag darf nicht negativ sein.')
        return value
