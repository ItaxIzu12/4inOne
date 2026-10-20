import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import LocalCacheThrottle

from .models import ContactMessage, PageView

logger = logging.getLogger(__name__)

# Nur diese öffentlichen Seiten werden gezählt. Alles andere (App-Bereiche, Einladungs-Links mit Token, Reset-Links)
# wird verworfen — so kann nie etwas Persönliches in der Statistik landen.
TRACKED_PATHS = frozenset({
    '/', '/demo', '/login', '/registrieren', '/kontakt', '/kontakt/danke',
    '/impressum', '/datenschutz', '/nutzungsbedingungen', '/barrierefreiheit', '/404',
})


class ContactRateThrottle(LocalCacheThrottle):
    """Kontaktformular: wenige Nachrichten pro Stunde und IP gegen Spam."""

    scope = 'contact'


class PageViewRateThrottle(LocalCacheThrottle):
    """Gegen künstliches Hochzählen; großzügig, weil echte Besucher mehrere Seiten öffnen."""

    scope = 'pageview'


def _single_line(value: str) -> str:
    return ' '.join(value.split())


class ContactSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    message = serializers.CharField(min_length=10, max_length=4000, trim_whitespace=True)
    # Honeypot: für Menschen unsichtbar. Ist es ausgefüllt, war es ein Bot.
    website = serializers.CharField(required=False, allow_blank=True, max_length=200)

    def validate_name(self, value: str) -> str:
        value = _single_line(value)
        if not value:
            raise serializers.ValidationError('Bitte gib deinen Namen an.')
        return value


class ContactView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ContactRateThrottle]

    def post(self, request):
        serializer = ContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get('website'):
            # Bot: dieselbe Antwort wie bei Erfolg, damit er nichts lernt — gespeichert wird nichts.
            return Response(status=status.HTTP_204_NO_CONTENT)

        entry = ContactMessage.objects.create(name=data['name'], email=data['email'], message=data['message'])
        recipient = settings.CONTACT_RECIPIENT
        if recipient:
            mail = EmailMessage(
                subject=f'Kontaktanfrage von {entry.name}',
                body=f'{entry.message}\n\n— {entry.name} <{entry.email}>',
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient],
                reply_to=[entry.email],
            )
            try:
                mail.send()
                ContactMessage.objects.filter(pk=entry.pk).update(forwarded=True)
            except Exception:  # Nachricht ist gespeichert; Mailserver-Fehler nicht nach außen zeigen
                logger.exception('Kontaktanfrage konnte nicht weitergeleitet werden')
        return Response(status=status.HTTP_204_NO_CONTENT)


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
