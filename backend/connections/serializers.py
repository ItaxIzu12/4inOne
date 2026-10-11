from rest_framework import serializers

from connections.models import ObjectType, RelationType

# Obergrenze von PositiveBigIntegerField: größere Werte wären auf PostgreSQL ein Datenbankfehler (500) statt 400.
MAX_ID = 2**63 - 1


class ConnectionCreateSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=ObjectType.choices)
    source_id = serializers.IntegerField(min_value=1, max_value=MAX_ID)
    target_type = serializers.ChoiceField(choices=ObjectType.choices)
    target_id = serializers.IntegerField(min_value=1, max_value=MAX_ID)
    relation_type = serializers.ChoiceField(choices=RelationType.choices, required=False)


class ObjectQuerySerializer(serializers.Serializer):
    object_type = serializers.ChoiceField(choices=ObjectType.choices)
    object_id = serializers.IntegerField(min_value=1, max_value=MAX_ID)


class CandidateQuerySerializer(ObjectQuerySerializer):
    target_type = serializers.ChoiceField(choices=ObjectType.choices)
    q = serializers.CharField(required=False, allow_blank=True, max_length=120, default='')


class OptionsQuerySerializer(serializers.Serializer):
    object_type = serializers.ChoiceField(choices=ObjectType.choices)
    # Optional: prüft vorab, ob der Nutzer dieses Objekt verknüpfen darf.
    object_id = serializers.IntegerField(min_value=1, max_value=MAX_ID, required=False)


class SuggestionQuerySerializer(serializers.Serializer):
    trip = serializers.IntegerField(min_value=1, max_value=MAX_ID, required=False)


class LinkSuggestionKeySerializer(serializers.Serializer):
    # Nur die Kennung — Typen und IDs leitet der Server daraus ab und prüft sie neu.
    key = serializers.CharField(max_length=80)


class SuggestionKeySerializer(serializers.Serializer):
    key = serializers.CharField(max_length=80)


class SuggestionAcceptSerializer(SuggestionKeySerializer):
    action = serializers.CharField(max_length=20)
    member_id = serializers.IntegerField(min_value=1, max_value=MAX_ID, required=False)
