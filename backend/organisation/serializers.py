from rest_framework import serializers
from .models import PersonalEvent, PersonalTask


class PersonalEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalEvent
        fields = ['id', 'title', 'starts_at', 'ends_at', 'location', 'description', 'created_at', 'updated_at']
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
        fields = ['id', 'title', 'description', 'due_date', 'due_time', 'priority', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        date = attrs.get('due_date', getattr(self.instance, 'due_date', None))
        time = attrs.get('due_time', getattr(self.instance, 'due_time', None))
        if time and not date:
            raise serializers.ValidationError({'due_time': 'Eine Uhrzeit benötigt ein Fälligkeitsdatum.'})
        return attrs
