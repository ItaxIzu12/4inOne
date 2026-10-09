from rest_framework import serializers
from core.recurrence import SIMPLE
from .models import FileCategory, PersonalEvent, PersonalFile, PersonalNote, PersonalTask


def _clean_title(value: str) -> str:
    value = value.strip()
    if not value:
        raise serializers.ValidationError('Bitte einen Titel eingeben.')
    return value


class PersonalEventSerializer(serializers.ModelSerializer):
    """Termin. Vergangene Termine sind erlaubt (ein Kalender hat Historie).
    In der Zeitraum-Liste (events/?start=&end=) erscheinen wiederkehrende
    Termine einmal pro Vorkommen: starts_at/ends_at sind dann die des
    Vorkommens, series_starts_at der ursprüngliche Beginn."""

    class Meta:
        model = PersonalEvent
        fields = [
            'id', 'title', 'starts_at', 'ends_at', 'all_day', 'recurrence', 'location', 'description', 'category',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_title(self, value):
        return _clean_title(value)

    def validate(self, attrs):
        start = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        end = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if end and start and end < start:
            same_day = end.date() == start.date()
            raise serializers.ValidationError(
                {'ends_at': 'Das Ende liegt vor dem Beginn.' if same_day else 'Das Enddatum liegt vor dem Startdatum.'}
            )
        return attrs


class PersonalTaskSerializer(serializers.ModelSerializer):
    """Aufgabe. Vergangene Fälligkeiten sind erlaubt (Grundlage für „Überfällig“).
    `recurrence` (täglich/wöchentlich/monatlich/jährlich) setzt die Intervalle wie im
    Haushalt; null = einmalig."""

    recurrence = serializers.ChoiceField(choices=list(SIMPLE), required=False, allow_null=True, write_only=True)
    repeat = serializers.SerializerMethodField()

    class Meta:
        model = PersonalTask
        fields = [
            'id', 'title', 'description', 'due_date', 'due_time', 'priority', 'status', 'project',
            'recurrence', 'repeat', 'recurrence_days', 'recurrence_months', 'last_done_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'repeat', 'recurrence_days', 'recurrence_months', 'last_done_at', 'created_at', 'updated_at']

    def get_repeat(self, obj) -> str | None:
        if not (obj.recurrence_days or obj.recurrence_months):
            return None
        for key, interval in SIMPLE.items():
            if (obj.recurrence_days, obj.recurrence_months) == interval:
                return key
        return 'custom'

    def validate_title(self, value):
        return _clean_title(value)

    def validate(self, attrs):
        if 'recurrence' in attrs:
            choice = attrs.pop('recurrence')
            attrs['recurrence_days'], attrs['recurrence_months'] = SIMPLE.get(choice, (None, None)) if choice else (None, None)
        date = attrs.get('due_date', getattr(self.instance, 'due_date', None))
        time = attrs.get('due_time', getattr(self.instance, 'due_time', None))
        if time and not date:
            raise serializers.ValidationError({'due_time': 'Eine Uhrzeit benötigt ein Fälligkeitsdatum.'})
        recurring = attrs.get('recurrence_days', getattr(self.instance, 'recurrence_days', None)) or attrs.get(
            'recurrence_months', getattr(self.instance, 'recurrence_months', None)
        )
        if recurring and not date:
            raise serializers.ValidationError({'due_date': 'Eine wiederkehrende Aufgabe braucht ein Fälligkeitsdatum.'})
        return attrs

    def validate_project(self, value):
        return value.strip()


class PersonalNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalNote
        fields = ['id', 'title', 'body', 'pinned', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {'title': {'required': False, 'allow_blank': True}}

    def validate_title(self, value):
        return value.strip()

    def validate(self, attrs):
        # Ein Inhalt genügt; der Titel ist optional. Ganz leer geht nicht.
        title = attrs.get('title', getattr(self.instance, 'title', ''))
        body = attrs.get('body', getattr(self.instance, 'body', ''))
        if not (title or '').strip() and not (body or '').strip():
            raise serializers.ValidationError({'body': 'Bitte schreib etwas in die Notiz.'})
        return attrs


class PersonalFileSerializer(serializers.ModelSerializer):
    """Metadaten einer Datei. Der Inhalt kommt nur über files/{id}/inhalt/;
    Pfad und Speichername werden nie ausgeliefert."""

    class Meta:
        model = PersonalFile
        fields = ['id', 'name', 'content_type', 'size', 'category', 'favorite', 'created_at', 'updated_at', 'used_at']
        read_only_fields = ['id', 'content_type', 'size', 'created_at', 'updated_at', 'used_at']

    def validate_name(self, value):
        from .files import clean_name
        return clean_name(value)

    def validate_category(self, value):
        if value not in FileCategory.values:
            raise serializers.ValidationError('Unbekannte Kategorie.')
        return value
