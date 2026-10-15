"""E-Mail-Adresse einmal bestätigen — Voraussetzung dafür, dass Kontakt-Einladungen in der App (Glocke, Startseite,
Personen & Gruppen) erscheinen und dort angenommen werden können.

Warum überhaupt: Jede Person kann sich mit einer beliebigen Adresse registrieren. Ohne Nachweis über das Postfach
könnte sie fremde Einladungen sehen und annehmen (siehe core/contact_views.py › _received_for). Der Link enthält
eine signierte, zeitlich begrenzte Angabe „Konto + Adresse“ (django.core.signing) — keine eigene Tabelle, und er
gilt nur, solange das Konto noch genau diese Adresse hat. Lokal ohne EMAIL_HOST steht die Mail im Backend-Log.
"""

import logging

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.mail import send_mail
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import LocalCacheThrottle

logger = logging.getLogger(__name__)

SALT = 'core.email-verification'
MAX_AGE_SECONDS = 3 * 24 * 3600


def is_verified(user) -> bool:
    return EmailAddress.objects.filter(user=user, email__iexact=user.email, verified=True).exists()


def make_token(user) -> str:
    return signing.dumps({'u': user.pk, 'e': user.email.lower()}, salt=SALT)


def link_for(user) -> str:
    # Token im Fragment: wird nie an einen Server geschickt (keine Zugriffsprotokolle, kein Referer).
    return f'{settings.FRONTEND_URL}/email-bestaetigen#token={make_token(user)}'


def dev_link_allowed() -> bool:
    """Nur lokal: DEBUG an UND Mails landen ohnehin nur im Server-Log (kein EMAIL_HOST). Dann darf die App den Link
    direkt anzeigen — es gibt kein Postfach, das ihn sonst zustellen würde. Mit echtem Mailversand oder ohne DEBUG
    nie (sonst ließe sich die Bestätigung ohne Postfach umgehen)."""
    backend = settings.MAILERS.get('default', {}).get('BACKEND', '')
    return bool(settings.DEBUG) and backend.endswith('console.EmailBackend')


def send_verification_mail(user) -> bool:
    """Schickt den Bestätigungslink. Ein Versandfehler wird nur geloggt (ohne Adresse) und bricht nichts ab."""
    link = link_for(user)
    body = (
        'Hallo,\n\n'
        'bitte bestätige deine E-Mail-Adresse für 4inOne. Danach erscheinen Einladungen von anderen Personen direkt '
        'in der App, und du kannst sie dort annehmen.\n\n'
        f'E-Mail-Adresse bestätigen: {link}\n\n'
        'Der Link gilt 3 Tage. Hast du kein Konto bei 4inOne angelegt, ignoriere diese E-Mail einfach.\n'
    )
    try:
        send_mail('Bitte bestätige deine E-Mail-Adresse', body, settings.DEFAULT_FROM_EMAIL, [user.email])
        return True
    except Exception:  # E-Mail-Server nicht erreichbar o. Ä.
        logger.exception('Bestätigungs-E-Mail konnte nicht gesendet werden')
        return False


def verify(token: str):
    """Gibt das bestätigte Konto zurück oder None (ungültig, abgelaufen, Adresse inzwischen geändert)."""
    try:
        data = signing.loads(token, salt=SALT, max_age=MAX_AGE_SECONDS)
    except signing.BadSignature:  # umfasst auch SignatureExpired
        return None
    user = get_user_model().objects.filter(pk=data.get('u'), is_active=True).first()
    if user is None or user.email.lower() != data.get('e'):
        return None
    EmailAddress.objects.filter(user=user).exclude(email__iexact=user.email).update(primary=False)
    EmailAddress.objects.update_or_create(
        user=user, email=user.email, defaults={'verified': True, 'primary': True}
    )
    return user


class EmailVerifyRateThrottle(LocalCacheThrottle):
    scope = 'email_verify'


class EmailResendRateThrottle(LocalCacheThrottle):
    scope = 'email_verify_resend'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.pk)}


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=512)


class EmailVerifyView(APIView):
    """Der Link aus der Mail ist der Nachweis — deshalb ohne Anmeldung nutzbar (z. B. am Handy geöffnet)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [EmailVerifyRateThrottle]

    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if verify(serializer.validated_data['token']) is None:
            return Response(
                {'detail': 'Dieser Bestätigungslink ist ungültig oder abgelaufen.'}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response({'detail': 'E-Mail-Adresse bestätigt.'})


class EmailResendView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [EmailResendRateThrottle]

    def post(self, request):
        if is_verified(request.user):
            return Response({'detail': 'Deine E-Mail-Adresse ist bereits bestätigt.'})
        send_verification_mail(request.user)
        payload = {'detail': 'Wir haben dir eine neue Bestätigungs-Mail geschickt.'}
        if dev_link_allowed():
            payload['dev_link'] = link_for(request.user)
        return Response(payload)
