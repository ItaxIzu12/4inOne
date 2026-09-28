from rest_framework import serializers

from .models import PackingItem, Trip, TripEvent, TripExpense, TripTask


class TripSerializer(serializers.ModelSerializer):
    # Kennzahlen für die Übersicht/Listenkarten — clientseitig berechnet, keine eigene
    # Aggregations-API (siehe AGENTS.md: keine spekulative Infrastruktur vor echtem Bedarf).
    packing_total = serializers.SerializerMethodField()
    packing_packed = serializers.SerializerMethodField()
    tasks_open = serializers.SerializerMethodField()
    tasks_total = serializers.SerializerMethodField()
    events_count = serializers.SerializerMethodField()
    budget_spent = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'title', 'destination', 'start_date', 'end_date', 'notes', 'status', 'budget_amount',
            'created_at', 'updated_at',
            'packing_total', 'packing_packed', 'tasks_open', 'tasks_total', 'events_count', 'budget_spent',
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


class TripScopedSerializer(serializers.ModelSerializer):
    """Gemeinsame Validierung für alles, was an eine Reise hängt: die Reise muss existieren
    und dem anfragenden Nutzer gehören — sonst könnte man Daten an eine fremde Reise hängen,
    obwohl get_queryset() das Lesen bereits korrekt einschränkt (siehe views.py)."""

    def validate_trip(self, trip):
        request = self.context.get('request')
        if request is not None and trip.owner_id != request.user.id:
            raise serializers.ValidationError('Diese Reise gehört dir nicht.')
        return trip


class PackingItemSerializer(TripScopedSerializer):
    class Meta:
        model = PackingItem
        fields = ['id', 'trip', 'title', 'is_packed', 'quantity', 'created_at']
        read_only_fields = ['id', 'created_at']


class TripTaskSerializer(TripScopedSerializer):
    class Meta:
        model = TripTask
        fields = ['id', 'trip', 'title', 'due_date', 'status', 'created_at']
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
