"""Beweist ARCHITEKTUR.md §3.4: bei DEBUG=False keine internen
Fehlerdetails/Stacktraces im Response-Body — aber normale, sichere
DRF-Validierungsfehler bleiben für die Nutzer:innen sichtbar."""

from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView


class _BoomView(APIView):
    permission_classes = []

    def get(self, request):
        raise Exception('GEHEIME-INTERNE-DETAILS-DIE-NICHT-RAUS-DUERFEN')


class _PasswordSerializer(serializers.Serializer):
    password = serializers.CharField(min_length=10)


class _ValidationView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = _PasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


def test_unhandled_exception_is_masked_when_debug_false(settings):
    settings.DEBUG = False

    response = _BoomView.as_view()(APIRequestFactory().get('/boom/'))
    response.render()

    assert response.status_code == 500
    assert response.data == {'detail': 'Ein interner Fehler ist aufgetreten.'}
    assert b'GEHEIME-INTERNE-DETAILS' not in response.content


def test_validation_errors_stay_intact_when_debug_false(settings):
    settings.DEBUG = False

    response = _ValidationView.as_view()(APIRequestFactory().post('/v/', {'password': 'kurz'}))
    response.render()

    assert response.status_code == 400
    assert 'password' in response.data
