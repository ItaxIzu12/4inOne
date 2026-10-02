from rest_framework import serializers

from connections.models import ObjectType, RelationType


class ConnectionCreateSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=ObjectType.choices)
    source_id = serializers.IntegerField(min_value=1)
    target_type = serializers.ChoiceField(choices=ObjectType.choices)
    target_id = serializers.IntegerField(min_value=1)
    relation_type = serializers.ChoiceField(choices=RelationType.choices, required=False)


class ObjectQuerySerializer(serializers.Serializer):
    object_type = serializers.ChoiceField(choices=ObjectType.choices)
    object_id = serializers.IntegerField(min_value=1)


class CandidateQuerySerializer(ObjectQuerySerializer):
    target_type = serializers.ChoiceField(choices=ObjectType.choices)
    q = serializers.CharField(required=False, allow_blank=True, max_length=120, default='')


class OptionsQuerySerializer(serializers.Serializer):
    object_type = serializers.ChoiceField(choices=ObjectType.choices)


class SuggestionQuerySerializer(serializers.Serializer):
    trip = serializers.IntegerField(min_value=1, required=False)


class SuggestionKeySerializer(serializers.Serializer):
    key = serializers.CharField(max_length=80)


class SuggestionAcceptSerializer(SuggestionKeySerializer):
    action = serializers.CharField(max_length=20)
    member_id = serializers.IntegerField(min_value=1, required=False)
