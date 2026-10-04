from rest_framework import serializers
from .models import FileCategory, PersonalEvent, PersonalFile, PersonalNote, PersonalTask


class PersonalEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalEvent
        fields = ['id', 'title', 'starts_at', 'ends_at', 'location', 'description', 'category', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        start = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        end = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if end and start and end < start:
            raise serializers.ValidationError({'ends_at': 'Das Ende darf nicht vor dem Beginn liegen.'})
        return attrs


class PersonalTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalTask
        fields = ['id', 'title', 'description', 'due_date', 'due_time', 'priority', 'status', 'project', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        date = attrs.get('due_date', getattr(self.instance, 'due_date', None))
        time = attrs.get('due_time', getattr(self.instance, 'due_time', None))
        if time and not date:
            raise serializers.ValidationError({'due_time': 'Eine Uhrzeit benötigt ein Fälligkeitsdatum.'})
        return attrs

    def validate_project(self, value):
        return value.strip()


class PersonalNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalNote
        fields = ['id', 'title', 'body', 'pinned', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Bitte einen Titel eingeben.')
        return value


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
