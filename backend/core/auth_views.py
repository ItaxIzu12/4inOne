import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.middleware.csrf import get_token
from rest_framework import serializers, status
from rest_framework.exceptions import Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from core.mfa_views import MfaVerifyRateThrottle, user_has_mfa_enabled, verify_mfa_code
from core.models import Household, HouseholdMembership, PasswordResetToken
from core.throttling import LocalCacheThrottle

REFRESH_COOKIE_NAME = 'refresh_token'
PASSWORD_RESET_TOKEN_LIFETIME = timezone.timedelta(minutes=30)

# ARCHITEKTUR.md §3.1: JWTs NICHT in localStorage/sessionStorage. Das
# Refresh-Token wird ausschließlich als httpOnly/Secure/SameSite=Strict-
# Cookie gesetzt — clientseitiges JavaScript kann es dadurch selbst bei
# einer XSS-Lücke nicht auslesen. Das Access-Token darf im Body zurück,
# das Frontend hält es nur im Speicher (kein persistenter Storage).
REFRESH_COOKIE_KWARGS = {
    'httponly': True,
    'secure': not settings.DEBUG,
    'samesite': 'Strict',
    'path': '/api/v1/auth/',
}


def _set_refresh_cookie(response: Response, refresh: RefreshToken, *, remember: bool = True) -> None:
    # remember=False (Checkbox "Angemeldet bleiben" abgewählt): Cookie ohne
    # max_age setzen -> Session-Cookie, das der Browser beim Schließen
    # verwirft. Als Claim im Token selbst gespeichert, damit die Wahl auch
    # nach einer Rotation durch RefreshView erhalten bleibt (SimpleJWT
    # mutiert bei ROTATE_REFRESH_TOKENS nur jti/iat/exp, andere Claims
    # bleiben unverändert bestehen).
    refresh['remember'] = remember
    cookie_kwargs = dict(REFRESH_COOKIE_KWARGS)
    if remember:
        cookie_kwargs['max_age'] = int(refresh.lifetime.total_seconds())
    response.set_cookie(REFRESH_COOKIE_NAME, str(refresh), **cookie_kwargs)


def _user_payload(user) -> dict:
    """Für die Begrüßung/Initialen im Frontend (Header, Dashboard) — bewusst
    nur Name/E-Mail, keine weiteren Felder (Datenminimierung)."""
    return {'name': user.first_name, 'email': user.email}


class RegisterRateThrottle(LocalCacheThrottle):
    """Max. 3 Registrierungen pro Stunde pro IP gegen automatisiertes
    Fake-Konto-Spam. Rate kommt aus DEFAULT_THROTTLE_RATES['register']
    (settings.py)."""

    scope = 'register'


class LoginRateThrottle(LocalCacheThrottle):
    """Max. 5 Versuche pro Minute pro IP+E-Mail-Kombination — bewusst
    ZUSÄTZLICH zu django-axes: Axes sperrt erst nach AXES_FAILURE_LIMIT
    fehlgeschlagenen Versuchen für AXES_COOLOFF_TIME (aktuell 1 Stunde,
    siehe settings.py); dieses Rate-Limit bremst dagegen JEDEN Versuch
    (auch erfolgreiche) schon vorher über ein kurzes 1-Minuten-Fenster —
    schützt zusätzlich vor sehr schnellem Credential-Stuffing gegen EIN
    bekanntes Konto, bevor Axes überhaupt zu greifen beginnt. Schlüssel ist
    IP+E-Mail statt nur IP, damit mehrere echte Nutzer:innen hinter
    derselben IP/demselben NAT (z. B. Firmen-WLAN) sich nicht gegenseitig
    aussperren — ein Angreifer, der viele verschiedene E-Mail-Adressen von
    einer IP aus durchprobiert, wird stattdessen von Axes' IP-basiertem
    Anteil an AXES_LOCKOUT_PARAMETERS erfasst, nicht von diesem Limit."""

    scope = 'login'

    def get_cache_key(self, request, view):
        raw_email = request.data.get('email')
        email = raw_email.strip().lower() if isinstance(raw_email, str) else ''
        ident = f'{self.get_ident(request)}:{email}'
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class PasswordResetRateThrottle(LocalCacheThrottle):
    """Max. 5 Anfragen pro Stunde pro IP — verhindert, dass der
    Reset-Endpunkt selbst (der absichtlich für jede E-Mail identisch
    antwortet, siehe PasswordResetRequestView) als Spam-/Enumeration-
    Werkzeug in großer Zahl missbraucht wird."""

    scope = 'password_reset'


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=1024)
    name = serializers.CharField(max_length=150, min_length=2)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)
    accept_privacy = serializers.BooleanField()

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Die Passwörter stimmen nicht überein.'})
        if not attrs['accept_privacy']:
            raise serializers.ValidationError({'accept_privacy': 'Bitte bestätige die Nutzungsbedingungen und den Datenschutz.'})
        return attrs

    # Optional: leer -> Fallback-Name in RegisterView.post() (nicht hier im
    # Serializer, weil der Fallback von einem ANDEREN Feld (name/email)
    # abhängt, nicht validierbar auf Feldebene).
    household_name = serializers.CharField(max_length=120, required=False, allow_blank=True)

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


@method_decorator(csrf_protect, name='dispatch')
class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        User = get_user_model()
        # Atomar: entweder entstehen User + Household + ADMIN-Mitgliedschaft
        # zusammen, oder gar nichts — sonst könnte bei einem Fehler zwischen
        # den drei Schritten ein User ohne Haushalt zurückbleiben, der sich
        # zwar einloggen aber keine Haushaltsdaten anlegen könnte.
        with transaction.atomic():
            user = User.objects.create_user(
                username=data['email'],
                email=data['email'],
                password=data['password'],
                first_name=data.get('name', ''),
            )
            # Jede Registrierung startet mit einem eigenen Haushalt, dessen
            # ADMIN der registrierende Nutzer ist — spätere Einladungen
            # weiterer Mitglieder laufen über HouseholdInvite (siehe
            # core/models.py), nicht über diesen Endpunkt.
            #
            # household_name ist optional (Frontend-Feld "Wie soll dein
            # Haushalt heißen?", siehe features/login/login.html) — bei
            # leerem Feld greift derselbe Fallback wie zuvor, damit ein
            # Haushalt nie einen leeren/rein technischen Namen bekommt.
            fallback_source = data.get('name') or data['email'].split('@')[0]
            household_name = data.get('household_name', '').strip() or f'Haushalt von {fallback_source}'
            household = Household.objects.create(name=household_name)
            HouseholdMembership.objects.create(
                user=user, household=household, role=HouseholdMembership.Role.ADMIN
            )

        refresh = RefreshToken.for_user(user)
        response = Response(
            {'access': str(refresh.access_token), 'user': _user_payload(user)}, status=status.HTTP_201_CREATED
        )
        _set_refresh_cookie(response, refresh)
        return response


class LoginInputSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(trim_whitespace=False, max_length=1024)
    remember = serializers.BooleanField(default=True)


@method_decorator(csrf_protect, name='dispatch')
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
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        credentials_input = LoginInputSerializer(data=request.data)
        credentials_input.is_valid(raise_exception=True)
        login_data = credentials_input.validated_data
        email = login_data['email']
        existing_user = get_user_model().objects.filter(email__iexact=email).first()
        credentials = {
            'username': existing_user.username if existing_user else email,
            'password': login_data['password'],
        }
        serializer = TokenObtainPairSerializer(data=credentials, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.user

        # SCHRITT 5 (MFA): wenn für diesen Nutzer aktiviert (core/mfa_views.py),
        # verlangt der Login-Endpunkt einen zusätzlichen Schritt, BEVOR
        # Access-/Refresh-Token ausgestellt werden. Das vom Serializer oben
        # bereits erzeugte Token-Paar bleibt in diesem Fall unbenutzt/nie
        # übertragen und verfällt regulär mit seiner Lifetime — es gibt in
        # SimpleJWT keinen Weg, Zugangsdaten zu prüfen, ohne dabei Tokens zu
        # erzeugen.
        if user_has_mfa_enabled(user):
            mfa_code = request.data.get('mfa_code')
            if not mfa_code:
                return Response({'mfa_required': True})

            # Eigenes, STRENGERES Rate-Limit als das allgemeine Login-Limit
            # oben (siehe MfaVerifyRateThrottle-Docstring) — manuell geprüft,
            # weil DRFs throttle_classes nicht davon abhängig gemacht werden
            # kann, ob request.data ein mfa_code-Feld enthält.
            mfa_throttle = MfaVerifyRateThrottle()
            if not mfa_throttle.allow_request(request, self):
                raise Throttled(wait=mfa_throttle.wait())

            if not verify_mfa_code(user, mfa_code):
                return Response({'detail': 'Der Code ist ungültig oder abgelaufen.'}, status=401)

        remember = login_data['remember']
        refresh = RefreshToken(serializer.validated_data['refresh'])
        response = Response({'access': serializer.validated_data['access'], 'user': _user_payload(user)})
        _set_refresh_cookie(response, refresh, remember=remember)
        return response


@method_decorator(csrf_protect, name='dispatch')
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
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken('Die Sitzung ist abgelaufen. Bitte erneut anmelden.') from exc

        payload = {'access': serializer.validated_data['access']}
        new_refresh_str = serializer.validated_data.get('refresh')

        remember = True
        if new_refresh_str:
            # Claims (user_id, 'remember') aus dem NEUEN, rotierten Token
            # lesen — NICHT aus raw_token: das ist durch is_valid() oben
            # bereits geblacklistet (ROTATE_REFRESH_TOKENS +
            # BLACKLIST_AFTER_ROTATION, settings.py), und RefreshToken(...)
            # prüft beim Dekodieren den Blacklist-Status mit (BlacklistMixin)
            # — ein erneutes RefreshToken(raw_token) hier würde mit
            # TokenError('Token is blacklisted') abbrechen.
            #
            # Frontend braucht Name/E-Mail auch nach einem reinen Refresh
            # (z. B. nach Tab-Schließen+Neuladen ohne erneuten Login) — sonst
            # bleibt AuthService.currentUser() leer und der Header zeigt zwar
            # das Profil-Icon, aber ohne Initialen.
            new_refresh = RefreshToken(new_refresh_str)
            user = get_user_model().objects.get(pk=new_refresh.payload.get('user_id'))
            payload['user'] = _user_payload(user)
            remember = bool(new_refresh.get('remember', True))

        response = Response(payload)

        if new_refresh_str:
            cookie_kwargs = dict(REFRESH_COOKIE_KWARGS)
            if remember:
                cookie_kwargs['max_age'] = int(new_refresh.lifetime.total_seconds())
            response.set_cookie(REFRESH_COOKIE_NAME, new_refresh_str, **cookie_kwargs)
        return response


@method_decorator(csrf_protect, name='dispatch')
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
    """Passwort-Reset anstoßen (ARCHITEKTUR.md §3.6 "Account-Recovery").

    Die Antwort ist UNABHÄNGIG davon, ob zur eingegebenen E-Mail-Adresse ein
    Konto existiert, textlich identisch — sonst ließe sich über
    Antwortunterschiede (z. B. "E-Mail nicht gefunden" vs. "E-Mail
    gesendet") erraten, welche E-Mail-Adressen registriert sind (Account-
    Enumeration). Der Code-Pfad ist für beide Fälle bewusst so ähnlich wie
    möglich gehalten (dieselbe DB-Abfrage, derselbe Rückgabewert) — eine
    zusätzliche künstliche Verzögerung wird hier NICHT eingebaut, weil sie
    fragil ist (falsche Konstante verschiebt das Leck nur) und die
    eigentliche Absicherung die identische Antwort selbst ist.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        email = request.data.get('email', '')
        serializers.EmailField().run_validation(email)

        user = get_user_model().objects.filter(email__iexact=email).first()
        if user is not None:
            PasswordResetToken.objects.create(
                user=user,
                token=secrets.token_urlsafe(32),
                expires_at=timezone.now() + PASSWORD_RESET_TOKEN_LIFETIME,
            )
            # TODO (Backend, siehe ARCHITEKTUR.md §3.6): tatsächlichen
            # Mail-Versand mit dem Reset-Link anschließen, sobald ein
            # E-Mail-Backend konfiguriert ist (aktuell settings.MAILERS
            # zeigt auf die Konsole). Bis dahin nicht blockierend, da die
            # Token-Logik selbst (erzeugen/prüfen/verbrauchen) bereits
            # vollständig funktioniert.

        return Response(
            {'detail': 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Nachricht versendet.'}
        )


class PasswordResetConfirmView(APIView):
    """Schließt den Passwort-Reset-Flow ab: prüft das Token aus
    PasswordResetRequestView und setzt bei Erfolg das neue Passwort.

    Anders als beim Request-Endpunkt ist hier KEINE Enumeration-sichere
    Antwort nötig — wer ein gültiges Token besitzt, hat die E-Mail bereits
    erhalten (das Token selbst ist der Nachweis, nicht die E-Mail-Adresse).
    Ein ungültiges/abgelaufenes/bereits genutztes Token bekommt deshalb
    einfach eine normale 400-Fehlermeldung.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        token = request.data.get('token', '')
        password = request.data.get('password', '')

        reset_token = (
            PasswordResetToken.objects.filter(token=token, used_at__isnull=True)
            .select_related('user')
            .first()
        )
        if reset_token is None or reset_token.expires_at < timezone.now():
            return Response({'detail': 'Der Reset-Link ist ungültig oder abgelaufen.'}, status=400)

        try:
            validate_password(password, user=reset_token.user)
        except DjangoValidationError as exc:
            return Response({'password': exc.messages}, status=400)

        with transaction.atomic():
            reset_token.user.set_password(password)
            reset_token.user.save(update_fields=['password'])
            reset_token.used_at = timezone.now()
            reset_token.save(update_fields=['used_at'])

        return Response({'detail': 'Passwort erfolgreich geändert.'})


class CsrfTokenView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        response = Response({'csrfToken': get_token(request)})
        response['Cache-Control'] = 'no-store'
        return response
