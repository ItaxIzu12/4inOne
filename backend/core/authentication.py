"""JWT-Authentifizierung, die an die Gerätesitzung gebunden ist.

Access-Tokens tragen die Sitzungs-ID (`sid`) des Geräts (core/auth_views.py › _start_session). Wird die Sitzung
beendet — Abmelden, „Gerät abmelden“, „Alle anderen abmelden“, Passwort zurückgesetzt —, gilt auch ein noch nicht
abgelaufenes Access-Token sofort nicht mehr (sonst bis zu 15 Minuten weiter). Tokens ohne `sid` (z. B. aus Tests oder
ältere Tokens) werden wie bisher behandelt und laufen regulär nach ACCESS_TOKEN_LIFETIME ab.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from core.models import UserSession


class SessionBoundJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        sid = validated_token.get('sid')
        if sid and not UserSession.objects.filter(sid=sid, user_id=user.pk).exists():
            raise InvalidToken('Die Sitzung wurde beendet. Bitte erneut anmelden.')
        return user
