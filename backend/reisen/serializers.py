from rest_framework import serializers

from core.models import Contact

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
    # Kennzahlen für die Übersicht/Listenkarten — clientseitig berechnet, keine eigene
    # Aggregations-API (siehe AGENTS.md: keine spekulative Infrastruktur vor echtem Bedarf).
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
            'id', 'title', 'destination', 'start_date', 'end_date', 'notes', 'status',
            'travel_type', 'transport_type', 'baggage_type', 'budget_amount', 'currency',
            'created_at', 'updated_at',
            'packing_total', 'packing_packed', 'tasks_open', 'tasks_total', 'events_count', 'budget_spent',
            'participants', 'my_role',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'Das Ende darf nicht vor dem Beginn liegen.'})
        return attrs

    def validate_budget_amount(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Das Budget darf nicht negativ sein.')
        return value

    def get_packing_total(self, obj):
        return obj.packingitems.count()

    def get_packing_packed(self, obj):
        return obj.packingitems.filter(is_packed=True).count()

    def get_tasks_open(self, obj):
        return obj.triptasks.filter(status=TripTask.Status.OPEN).count()

    def get_tasks_total(self, obj):
        return obj.triptasks.count()

    def get_events_count(self, obj):
        return obj.tripevents.count()

    def get_budget_spent(self, obj):
        total = sum((expense.amount for expense in obj.tripexpenses.all()), start=0)
        return str(total)

    def get_participants(self, obj):
        return TripParticipantSerializer(obj.participants.select_related('user'), many=True, context=self.context).data

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
        fields = ['id', 'trip', 'title', 'is_packed', 'quantity', 'category', 'note', 'created_at']
        read_only_fields = ['id', 'created_at']


class TripTaskSerializer(TripScopedSerializer):
    class Meta:
        model = TripTask
        fields = ['id', 'trip', 'title', 'due_date', 'status', 'note', 'created_at']
        read_only_fields = ['id', 'created_at']


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
    class Meta:
        model = TripExpense
        fields = ['id', 'trip', 'title', 'amount', 'date', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Der Betrag darf nicht negativ sein.')
        return value


class TripBudgetCategorySerializer(TripScopedSerializer):
    class Meta:
        model = TripBudgetCategory
        fields = ['id', 'trip', 'category', 'planned_amount', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_planned_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Der geplante Betrag darf nicht negativ sein.')
        return value
