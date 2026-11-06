"""Beta-Rückmeldungen (Entwicklungsplan Phase 5, docs/beta/).

GET  /api/v1/feedback/ → ob Feedback eingeschaltet ist und welche Bereiche/Aufgaben es gibt (für das Formular).
POST /api/v1/feedback/ → eine Rückmeldung speichern; Antwort enthält nur die ID. Es gibt bewusst keine Liste:
Testpersonen sehen fremde Rückmeldungen nie, Betreiber werten über `beta_feedback_report` aus."""

from urllib.parse import urlsplit

from django.conf import settings
from django.http import Http404
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import BetaFeedback
from core.throttling import LocalCacheThrottle


class BetaFeedbackRateThrottle(LocalCacheThrottle):
    scope = 'beta_feedback'

    def get_cache_key(self, request, view):
        if request.method != 'POST':
            return None
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.pk)}


class BetaFeedbackSerializer(serializers.ModelSerializer):
    understood = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    in_control = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    message = serializers.CharField(max_length=2000, required=False, allow_blank=True, trim_whitespace=True)
    page = serializers.CharField(max_length=500, required=False, allow_blank=True)

    class Meta:
        model = BetaFeedback
        fields = ['area', 'task', 'understood', 'in_control', 'saves_time', 'would_continue', 'message', 'page']

    def validate_page(self, value):
        # Nur der Pfad: keine Query, kein Fragment (dort können Tokens oder IDs stehen), höchstens 200 Zeichen.
        path = urlsplit(value.strip()).path
        return path[:200] if path.startswith('/') else ''

    def validate(self, attrs):
        answered = any(attrs.get(f) not in (None, '') for f in ('understood', 'in_control', 'saves_time', 'would_continue', 'message'))
        if not answered:
            raise serializers.ValidationError('Bitte mindestens eine Frage beantworten oder etwas schreiben.')
        return attrs


def _choices(choices) -> list[dict]:
    return [{'value': value, 'label': label} for value, label in choices]


class BetaFeedbackView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [BetaFeedbackRateThrottle]

    def get(self, request):
        enabled = settings.BETA_FEEDBACK_ENABLED
        response = Response({
            'enabled': enabled,
            'areas': _choices(BetaFeedback.Area.choices) if enabled else [],
            'tasks': _choices(BetaFeedback.Task.choices) if enabled else [],
        })
        response['Cache-Control'] = 'no-store'
        return response

    def post(self, request):
        if not settings.BETA_FEEDBACK_ENABLED:
            raise Http404
        serializer = BetaFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feedback = serializer.save(user=request.user)
        return Response({'id': feedback.id}, status=status.HTTP_201_CREATED)
