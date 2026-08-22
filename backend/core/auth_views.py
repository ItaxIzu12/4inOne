from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

REFRESH_COOKIE_NAME = 'refresh_token'

# ARCHITEKTUR.md §3.1: JWTs NICHT in localStorage/sessionStorage. Das
# Refresh-Token wird ausschließlich als httpOnly/Secure/SameSite=Strict-
# Cookie gesetzt — clientseitiges JavaScript kann es dadurch selbst bei
# einer XSS-Lücke nicht auslesen. Das Access-Token darf im Body zurück,
# das Frontend hält es nur im Speicher (kein persistenter Storage).
REFRESH_COOKIE_KWARGS = {
    'httponly': True,
    'secure': not settings.DEBUG,
    'samesite': 'Strict',
    'path': '/api/auth/',
}


def _set_refresh_cookie(response: Response, refresh: RefreshToken) -> None:
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        str(refresh),
        max_age=int(refresh.lifetime.total_seconds()),
        **REFRESH_COOKIE_KWARGS,
    )


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate_email(self, value: str) -> str:
        User = get_user_model()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('E-Mail-Adresse wird bereits verwendet.')
        return value


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        User = get_user_model()
        user = User.objects.create_user(
            username=data['email'],
            email=data['email'],
            password=data['password'],
            first_name=data.get('name', ''),
        )

        refresh = RefreshToken.for_user(user)
        response = Response({'access': str(refresh.access_token)}, status=status.HTTP_201_CREATED)
        _set_refresh_cookie(response, refresh)
        return response


class LoginView(APIView):
    """Login per E-Mail + Passwort.

    Übersetzt 'email' auf das intern von Django genutzte USERNAME_FIELD
    ('username' — siehe RegisterView, dort wird username=email gesetzt) und
    reicht den request explizit im Serializer-Kontext durch. Letzteres ist
    kein Stildetail: TokenObtainPairSerializer.validate() liest
    self.context['request'] aus und gibt es an authenticate() weiter — nur
    dann kann AxesStandaloneBackend (AUTHENTICATION_BACKENDS) den
    Login-Versuch der anfragenden IP zuordnen und mitzählen. Ohne request
    im Kontext greift die Axes-Sperre nach AXES_FAILURE_LIMIT NICHT.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        credentials = {
            'username': request.data.get('email', ''),
            'password': request.data.get('password', ''),
        }
        serializer = TokenObtainPairSerializer(data=credentials, context={'request': request})
        serializer.is_valid(raise_exception=True)
        refresh = RefreshToken(serializer.validated_data['refresh'])

        response = Response({'access': serializer.validated_data['access']})
        _set_refresh_cookie(response, refresh)
        return response


class RefreshView(APIView):
    """Liest das Refresh-Token aus dem httpOnly-Cookie statt aus dem
    Request-Body — das Frontend schickt es nie explizit mit, der Browser
    hängt das Cookie automatisch an (siehe REFRESH_COOKIE_KWARGS)."""

    permission_classes = [AllowAny]

    def post(self, request):
        raw_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not raw_token:
            return Response(
                {'detail': 'Kein Refresh-Token vorhanden.'}, status=status.HTTP_401_UNAUTHORIZED
            )

        # TokenRefreshSerializer übernimmt Rotation + Blacklisting des alten
        # Tokens gemäß ROTATE_REFRESH_TOKENS/BLACKLIST_AFTER_ROTATION
        # (settings.py) — dadurch wird ein altes Refresh-Token serverseitig
        # ungültig, sobald ein neues ausgestellt wurde.
        serializer = TokenRefreshSerializer(data={'refresh': raw_token})
        serializer.is_valid(raise_exception=True)

        response = Response({'access': serializer.validated_data['access']})
        new_refresh_str = serializer.validated_data.get('refresh')
        if new_refresh_str:
            max_age = int(RefreshToken(new_refresh_str).lifetime.total_seconds())
            response.set_cookie(REFRESH_COOKIE_NAME, new_refresh_str, max_age=max_age, **REFRESH_COOKIE_KWARGS)
        return response


class LogoutView(APIView):
    def post(self, request):
        raw_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw_token:
            try:
                RefreshToken(raw_token).blacklist()
            except TokenError:
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_KWARGS['path'])
        return response


class PasswordResetRequestView(APIView):
    """Platzhalter für den Passwort-Reset-Flow.

    TODO (Backend, siehe ARCHITEKTUR.md §3.6 "Account-Recovery"): Die
    tatsächliche Antwort muss UNABHÄNGIG davon, ob zur eingegebenen
    E-Mail-Adresse ein Konto existiert, textlich und im Zeitverhalten
    identisch sein — sonst lässt sich über Antwortunterschiede (z. B.
    "E-Mail nicht gefunden" vs. "E-Mail gesendet", oder Response-Zeit
    einer echten DB-Abfrage + Mail-Versand) erraten, welche E-Mail-Adressen
    registriert sind (Account-Enumeration). Reset-Token muss kryptographisch
    zufällig, einmalig nutzbar und kurz gültig sein (~30 Min.). Der
    tatsächliche Mail-Versand ist hier bewusst noch nicht implementiert.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '')
        serializers.EmailField().run_validation(email)

        # TODO: Reset-Token erzeugen + E-Mail verschicken, siehe Docstring
        # oben. Bewusst keine Fallunterscheidung "Konto existiert/nicht" —
        # die Antwort ist in beiden Fällen identisch.

        return Response(
            {'detail': 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Nachricht versendet.'}
        )
