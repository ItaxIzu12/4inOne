import base64
import io
import secrets

import qrcode
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import MfaBackupCode
from core.throttling import LocalCacheThrottle

BACKUP_CODE_COUNT = 10


class MfaVerifyRateThrottle(LocalCacheThrottle):
    """5 Versuche pro 5 Minuten — bewusst STRENGER und GETRENNT vom
    allgemeinen Login-Rate-Limit (core/auth_views.py LoginRateThrottle).
    Ein 6-stelliger TOTP-Code hat nur eine Million mögliche Werte und ist
    ohne ein eigenes, aggressives Limit brute-forcebar, selbst wenn E-Mail
    und Passwort bereits korrekt sind. Gilt sowohl für MfaVerifyView (Setup-
    Abschluss) als auch für den mfa_code-Zweig in LoginView (core/
    auth_views.py) — dort manuell aufgerufen, da DRFs throttle_classes
    nicht davon abhängig gemacht werden kann, ob ein Request-Feld gesetzt
    ist."""

    scope = 'mfa_verify'

    def get_cache_key(self, request, view):
        # AnonRateThrottle.get_cache_key() liefert None (= "nicht drosseln")
        # sobald request.user authentifiziert ist — genau das braucht
        # MfaVerifyView aber IMMER (IsAuthenticated). Diese Klasse wird
        # sowohl dort (authentifiziert) als auch im mfa_code-Zweig von
        # LoginView (noch anonym, siehe core/auth_views.py) verwendet,
        # daher hier bewusst beide Fälle statt nur den anonymen abdecken.
        if request.user and request.user.is_authenticated:
            ident = str(request.user.pk)
        else:
            ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}

    def parse_rate(self, rate):
        # 5 Versuche pro 5 Minuten lässt sich nicht als 'n/period'-String
        # ausdrücken (DRF kennt als Einheit nur s/m/h/d, siehe settings.py-
        # Kommentar bei DEFAULT_THROTTLE_RATES) — die Anzahl kommt weiterhin
        # aus DEFAULT_THROTTLE_RATES['mfa_verify'], das Zeitfenster wird hier
        # explizit auf 5 Minuten gesetzt.
        num_requests, _duration = super().parse_rate(rate)
        return num_requests, 5 * 60


def user_has_mfa_enabled(user) -> bool:
    """"MFA aktiv" bedeutet hier: mindestens ein bestätigtes TOTP-Gerät
    existiert — kein separates Boolean-Feld nötig, django-otp führt diesen
    Zustand bereits über TOTPDevice.confirmed."""
    return TOTPDevice.objects.filter(user=user, confirmed=True).exists()


def verify_mfa_code(user, code: str) -> bool:
    """Prüft `code` gegen das aktive TOTP-Gerät ODER einen offenen
    Backup-Code — für den Login-Zusatzschritt in LoginView. Ein Backup-Code
    ist nach genau einer erfolgreichen Nutzung verbraucht (used_at)."""
    device = TOTPDevice.objects.filter(user=user, confirmed=True).first()
    if device is not None and device.verify_token(code):
        return True

    for backup_code in MfaBackupCode.objects.filter(user=user, used_at__isnull=True):
        if check_password(code, backup_code.code_hash):
            backup_code.used_at = timezone.now()
            backup_code.save(update_fields=['used_at'])
            return True

    return False


def _generate_qr_data_uri(otpauth_url: str) -> str:
    img = qrcode.make(otpauth_url)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
    return f'data:image/png;base64,{encoded}'


def _generate_backup_codes(user) -> list[str]:
    """Löscht evtl. vorhandene alte Backup-Codes und legt BACKUP_CODE_COUNT
    neue an. Gibt die Klartext-Codes zurück — das ist die EINZIGE Stelle im
    System, an der sie im Klartext existieren; danach ist nur noch
    MfaBackupCode.code_hash gespeichert."""
    user.mfa_backup_codes.all().delete()
    plain_codes = []
    for _ in range(BACKUP_CODE_COUNT):
        code = f'{secrets.randbelow(10**10):010d}'
        plain_codes.append(code)
        MfaBackupCode.objects.create(user=user, code_hash=make_password(code))
    return plain_codes


class MfaSetupView(APIView):
    """Schritt 1 der MFA-Einrichtung: Secret erzeugen + QR-Code
    zurückgeben. Aktiviert MFA noch NICHT — das passiert erst nach
    erfolgreicher Verifizierung des ersten Codes (MfaVerifyView), damit
    sich niemand selbst aussperrt, falls der QR-Code falsch gescannt wurde.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if user_has_mfa_enabled(request.user):
            return Response({'detail': 'Zwei-Faktor-Authentifizierung ist bereits aktiv.'}, status=400)

        # Ein evtl. vorhandenes, noch NICHT bestätigtes Gerät aus einem
        # vorherigen Versuch wird ersetzt (neuer Scan) — ein bereits
        # bestätigtes Gerät bleibt oben durch die Prüfung unangetastet.
        TOTPDevice.objects.filter(user=request.user, confirmed=False).delete()
        device = TOTPDevice.objects.create(user=request.user, name='default', confirmed=False)

        return Response(
            {
                # Base32 statt des intern hex-gespeicherten device.key — das
                # ist das Format, das Authenticator-Apps für die manuelle
                # Eingabe erwarten (RFC 4648 / Google-Authenticator-Konvention).
                'secret': base64.b32encode(device.bin_key).decode('ascii'),
                'otpauth_url': device.config_url,
                'qr_code': _generate_qr_data_uri(device.config_url),
            }
        )


class MfaVerifySerializer(serializers.Serializer):
    code = serializers.CharField(min_length=6, max_length=6)


class MfaVerifyView(APIView):
    """Schritt 2: den ersten TOTP-Code prüfen → aktiviert MFA und gibt die
    Backup-Codes einmalig zurück (siehe _generate_backup_codes)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [MfaVerifyRateThrottle]

    def post(self, request):
        serializer = MfaVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        device = TOTPDevice.objects.filter(user=request.user, confirmed=False).first()
        if device is None:
            return Response(
                {'detail': 'Keine ausstehende Einrichtung gefunden. Bitte zuerst /mfa/setup/ aufrufen.'}, status=400
            )
        if not device.verify_token(serializer.validated_data['code']):
            return Response({'detail': 'Der Code ist ungültig oder abgelaufen.'}, status=400)

        device.confirmed = True
        device.save(update_fields=['confirmed'])
        backup_codes = _generate_backup_codes(request.user)

        return Response(
            {
                'detail': 'Zwei-Faktor-Authentifizierung aktiviert.',
                # Einmalig im Response — siehe MfaBackupCode-Docstring, ab
                # jetzt ist nur noch der Hash gespeichert, kein Wiederabruf
                # möglich.
                'backup_codes': backup_codes,
            }
        )
