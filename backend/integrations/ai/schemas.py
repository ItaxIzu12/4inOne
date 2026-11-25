"""Gemeinsamer Antwort-Rahmen des Personal AI Core (docs/AI_INTEGRATION.md § 4.3).

Die Modell-Ausgabe ist Daten, keine Anweisung: sie wird nur gegen diese Formate geprüft und als Vorschlag weitergegeben,
nie ausgeführt (§ 7).
"""

from rest_framework import serializers

SCHEMA_VERSION = 1


class EvidenceSerializer(serializers.Serializer):
    field = serializers.CharField(max_length=100)
    source = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    quote = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')


class ErrorSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    message = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


class EnvelopeSerializer(serializers.Serializer):
    schema_version = serializers.IntegerField(min_value=SCHEMA_VERSION, max_value=SCHEMA_VERSION)
    request_id = serializers.CharField(max_length=64)
    status = serializers.ChoiceField(choices=['ok', 'refused', 'error'])
    result = serializers.DictField(required=False, default=dict)
    evidence = EvidenceSerializer(many=True, required=False, default=list)
    confidence = serializers.DictField(child=serializers.FloatField(min_value=0, max_value=1), required=False, default=dict)
    model = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    duration_ms = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=None)
    error = ErrorSerializer(required=False, allow_null=True, default=None)
