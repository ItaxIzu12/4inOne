from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import LocalCacheThrottle

from .models import PageView

# Nur diese öffentlichen Seiten werden gezählt. Alles andere (App-Bereiche, Einladungs-Links mit Token, Reset-Links)
# wird verworfen — so kann nie etwas Persönliches in der Statistik landen.
TRACKED_PATHS = frozenset({
    '/', '/demo', '/login', '/registrieren',
    '/impressum', '/datenschutz', '/nutzungsbedingungen', '/barrierefreiheit', '/404',
})


class PageViewRateThrottle(LocalCacheThrottle):
    """Gegen künstliches Hochzählen; großzügig, weil echte Besucher mehrere Seiten öffnen."""

    scope = 'pageview'


class PageViewSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=60)
    device = serializers.ChoiceField(choices=PageView.Device.choices)


class PageViewView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PageViewRateThrottle]

    def post(self, request):
        serializer = PageViewSerializer(data=request.data)
        if not serializer.is_valid() or serializer.validated_data['path'] not in TRACKED_PATHS:
            # Unbekannte Seiten still verwerfen — kein Fehler, der Hinweise auf die Liste gibt.
            return Response(status=status.HTTP_204_NO_CONTENT)
        key = {'day': timezone.localdate(), **serializer.validated_data}
        updated = PageView.objects.filter(**key).update(count=F('count') + 1)
        if not updated:
            try:
                with transaction.atomic():
                    PageView.objects.create(**key, count=1)
            except IntegrityError:  # gleichzeitig angelegt — dann eben hochzählen
                PageView.objects.filter(**key).update(count=F('count') + 1)
        return Response(status=status.HTTP_204_NO_CONTENT)
