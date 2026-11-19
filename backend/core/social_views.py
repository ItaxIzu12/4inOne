"""Endpunkte für die Anmeldung mit Google und Apple (core/social.py, docs/SOCIAL_LOGIN.md).

Nach dem Rückruf vom Anbieter gibt es genau drei Ausgänge:
- bekannter Zugang (Anbieter + `sub` verknüpft) → anmelden (mit Zwei-Faktor-Schritt, falls eingeschaltet);
- neue E-Mail → Konto anlegen (E-Mail gilt als bestätigt, Passwort unbrauchbar bis „Passwort vergessen“) → anmelden;
- E-Mail gehört schon einem Konto → NICHT automatisch verknüpfen, sondern einmal das Passwort dieses Kontos verlangen
  (Entscheidung 19.11.2026: niemand übernimmt ein Konto nur über eine E-Mail-Adresse).

Offene Schritte (verknüpfen, Zwei-Faktor) liegen signiert und 10 Minuten gültig in einem httpOnly-Cookie dieses
Browsers — nie in der Adresse.
"""

from __future__ import annotations

import secrets

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core import signing
from django.db import IntegrityError, transaction
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.exceptions import Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from core import auth_events
from core import social
from core.auth_views import (
    LoginRateThrottle, _set_refresh_cookie, _start_session, _user_payload, create_account,
)
from core.mfa_views import MfaVerifyRateThrottle, user_has_mfa_enabled, verify_mfa_code
from core.models import SocialAccount

FLOW_COOKIE = 'oauth_flow'
PENDING_COOKIE = 'oauth_pending'
COOKIE_PATH = '/api/v1/auth/oauth/'
MAX_AGE = 600


def _sign(data: dict, salt: str) -> str:
    return signing.dumps(data, salt=f'4inone.oauth.{salt}', compress=True)


def _unsign(raw: str | None, salt: str) -> dict | None:
    if not raw:
        return None
    try:
        data = signing.loads(raw, salt=f'4inone.oauth.{salt}', max_age=MAX_AGE)
    except signing.BadSignature:
        return None
    return data if isinstance(data, dict) else None


def _set(response, name: str, value: str, *, cross_site_post: bool = False) -> None:
    # Apple schickt den Rückruf als seitenübergreifendes POST → nur mit SameSite=None (und damit Secure) kommt das
    # Ablauf-Cookie mit. Google und die offenen Schritte: Lax (Rückruf ist eine normale Weiterleitung).
    response.set_cookie(name, value, max_age=MAX_AGE, path=COOKIE_PATH, httponly=True,
                        secure=cross_site_post or not settings.DEBUG, samesite='None' if cross_site_post else 'Lax')


def _clear(response, *names: str) -> None:
    for name in names:
        response.delete_cookie(name, path=COOKIE_PATH, samesite='Lax')


def _to_frontend(query: str) -> HttpResponseRedirect:
    return HttpResponseRedirect(f"{settings.FRONTEND_URL.rstrip('/')}/login?{query}")


def _login_redirect(request, user, *, new: bool) -> HttpResponseRedirect:
    """Anmelden ohne weiteren Schritt: Sitzung + Refresh-Cookie, das Frontend holt sich dann das Access-Token."""
    refresh = RefreshToken.for_user(user)
    _start_session(request, user, refresh, mfa_verified=False)
    auth_events.emit(auth_events.REGISTERED if new else auth_events.LOGIN_SUCCEEDED, request, user)
    response = _to_frontend('social=neu' if new else 'social=ok')
    _set_refresh_cookie(response, refresh)
    return response


def _login_json(request, user, *, mfa_verified: bool) -> Response:
    refresh = RefreshToken.for_user(user)
    _start_session(request, user, refresh, mfa_verified=mfa_verified)
    auth_events.emit(auth_events.LOGIN_SUCCEEDED, request, user)
    response = Response({'access': str(refresh.access_token), 'user': _user_payload(user)})
    _set_refresh_cookie(response, refresh)
    _clear(response, PENDING_COOKIE)
    return response


class SocialRateThrottle(LoginRateThrottle):
    """Start und Rückruf, pro IP (RATE_LIMIT_SOCIAL_LOGIN, Standard 20/min). Eigene Grenze: ein normaler Ablauf braucht
    zwei Anfragen und soll das Login-Limit (5/min) nicht aufbrauchen. Die Passwort-Eingabe beim Verknüpfen zählt
    dagegen wie eine Anmeldung (LoginRateThrottle + axes)."""

    scope = 'social_login'


class ProvidersView(APIView):
    """Welche Anmeldewege aktiv sind — die Knöpfe erscheinen nur dafür."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({name: social.enabled(name) for name in social.PROVIDERS})


class StartView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SocialRateThrottle]

    def get(self, request, provider: str):
        if provider not in social.PROVIDERS or not social.enabled(provider):
            return Response({'detail': 'Dieser Anmeldeweg ist nicht eingerichtet.'}, status=404)
        flow = social.new_flow(provider)
        response = HttpResponseRedirect(social.authorize_url(flow))
        _set(response, FLOW_COOKIE, _sign(flow, 'flow'), cross_site_post=social.PROVIDERS[provider].form_post)
        _clear(response, PENDING_COOKIE)
        return response


class CallbackView(APIView):
    """Rückruf vom Anbieter (Google: GET, Apple: POST). Fehler führen still zur Anmeldeseite mit einem Kurzwort."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SocialRateThrottle]

    def get(self, request, provider: str):
        return self._handle(request, provider, request.query_params)

    def post(self, request, provider: str):
        return self._handle(request, provider, request.data)

    def _handle(self, request, provider: str, params):
        flow = _unsign(request.COOKIES.get(FLOW_COOKIE), 'flow')
        try:
            if provider not in social.PROVIDERS or not social.enabled(provider):
                raise social.SocialLoginError('anbieter')
            if params.get('error'):
                raise social.SocialLoginError('abgebrochen')
            if not flow or flow.get('provider') != provider:
                raise social.SocialLoginError('abgelaufen')
            if not secrets.compare_digest(str(params.get('state', '')), flow['state']):
                raise social.SocialLoginError('abgelaufen')
            code = params.get('code')
            if not isinstance(code, str) or not code:
                raise social.SocialLoginError('anbieter')
            token = social.exchange_code(provider, code, flow['verifier'])
            identity = social.verify_id_token(provider, token, flow['nonce'])
            if provider == 'apple' and not identity['name']:
                identity['name'] = social.apple_first_name(params.get('user'))
            response = self._resolve(request, provider, identity)
        except social.SocialLoginError as error:
            response = _to_frontend(f'fehler={error.code}')
        _clear(response, FLOW_COOKIE)
        return response

    def _resolve(self, request, provider: str, identity: dict):
        User = get_user_model()
        account = SocialAccount.objects.select_related('user').filter(provider=provider, subject=identity['sub']).first()
        if account is not None:
            if not account.user.is_active:
                raise social.SocialLoginError('gesperrt')
            account.last_used_at = timezone.now()
            account.save(update_fields=['last_used_at'])
            return self._finish(request, account.user, provider, identity, new=False)

        existing = User.objects.filter(email__iexact=identity['email']).first()
        if existing is not None:
            # Nie automatisch verknüpfen — erst mit dem Passwort dieses Kontos (LinkView)
            response = _to_frontend('social=verknuepfen')
            _set(response, PENDING_COOKIE, _sign({'step': 'link', 'provider': provider, 'sub': identity['sub'],
                                                   'email': identity['email'], 'user': existing.pk}, 'pending'))
            return response

        try:
            with transaction.atomic():
                user = create_account(identity['email'], None, identity['name'])
                SocialAccount.objects.create(user=user, provider=provider, subject=identity['sub'], email=identity['email'],
                                             last_used_at=timezone.now())
                _mark_email_verified(user)
        except IntegrityError:
            # Zwei Rückrufe gleichzeitig (Doppelklick, zwei Tabs): der andere hat das Konto schon angelegt
            account = SocialAccount.objects.select_related('user').filter(provider=provider, subject=identity['sub']).first()
            if account is None:
                raise social.SocialLoginError('abgelaufen')
            return self._finish(request, account.user, provider, identity, new=False)
        return self._finish(request, user, provider, identity, new=True)

    def _finish(self, request, user, provider: str, identity: dict, *, new: bool):
        if user_has_mfa_enabled(user):
            response = _to_frontend('social=zwei-faktor')
            _set(response, PENDING_COOKIE, _sign({'step': 'mfa', 'provider': provider, 'user': user.pk}, 'pending'))
            return response
        return _login_redirect(request, user, new=new)


def _mark_email_verified(user) -> None:
    # Der Anbieter hat die Adresse bestätigt (email_verified im geprüften ID-Token) — keine zweite Bestätigungsmail nötig
    from allauth.account.models import EmailAddress

    EmailAddress.objects.update_or_create(user=user, email=user.email, defaults={'verified': True, 'primary': True})


def _code(raw) -> str:
    # Nur Text bis 16 Zeichen an django-otp — eine Liste oder Zahl aus dem JSON soll abgelehnt werden, nicht abstürzen
    return raw.strip()[:16] if isinstance(raw, str) else ''


def _pending(request) -> dict | None:
    return _unsign(request.COOKIES.get(PENDING_COOKIE), 'pending')


def _mask(email: str) -> str:
    local, _, domain = email.partition('@')
    return f'{local[:1]}•••@{domain}' if domain else ''


class PendingView(APIView):
    """Was nach dem Rückruf noch offen ist (für die Anmeldeseite). DELETE bricht ab."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        pending = _pending(request)
        if not pending:
            return Response({'step': None})
        user = get_user_model().objects.filter(pk=pending['user'], is_active=True).first()
        if user is None:
            return Response({'step': None})
        return Response({
            'step': pending['step'],
            'provider': pending['provider'],
            'email': _mask(user.email),
            'has_password': user.has_usable_password(),
        })

    def delete(self, request):
        response = Response(status=204)
        _clear(response, PENDING_COOKIE)
        return response


@method_decorator(csrf_protect, name='dispatch')
class LinkView(APIView):
    """Bestehendes Konto mit Google/Apple verknüpfen — nur mit dem Passwort dieses Kontos (und Zwei-Faktor, falls an)."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        pending = _pending(request)
        if not pending or pending.get('step') != 'link':
            return Response({'detail': 'Die Verknüpfung ist abgelaufen. Bitte noch einmal mit Google oder Apple anmelden.'}, status=400)
        User = get_user_model()
        user = User.objects.filter(pk=pending['user'], is_active=True).first()
        if user is None or user.email.lower() != pending['email']:
            return Response({'detail': 'Die Verknüpfung ist abgelaufen. Bitte noch einmal mit Google oder Apple anmelden.'}, status=400)
        password = request.data.get('password', '')
        # authenticate() mit request: axes zählt Fehlversuche wie bei der normalen Anmeldung
        if not isinstance(password, str) or authenticate(request, username=user.username, password=password) is None:
            return Response({'detail': 'Das Passwort stimmt nicht.'}, status=401)
        mfa_verified = False
        if user_has_mfa_enabled(user):
            code = _code(request.data.get('mfa_code'))
            if not code:
                return Response({'mfa_required': True})
            throttle = MfaVerifyRateThrottle()
            if not throttle.allow_request(request, self):
                raise Throttled(wait=throttle.wait())
            if not verify_mfa_code(user, code):
                auth_events.emit(auth_events.MFA_FAILED, request, user)
                return Response({'detail': 'Der Code ist ungültig oder abgelaufen.'}, status=401)
            mfa_verified = True
        try:
            SocialAccount.objects.create(user=user, provider=pending['provider'], subject=pending['sub'],
                                         email=pending['email'], last_used_at=timezone.now())
        except IntegrityError:
            return Response({'detail': 'Dieser Zugang ist schon mit einem anderen Konto verbunden.'}, status=409)
        return _login_json(request, user, mfa_verified=mfa_verified)


@method_decorator(csrf_protect, name='dispatch')
class SocialMfaView(APIView):
    """Zwei-Faktor-Schritt nach der Anmeldung mit Google/Apple."""

    permission_classes = [AllowAny]
    throttle_classes = [MfaVerifyRateThrottle]

    def post(self, request):
        pending = _pending(request)
        if not pending or pending.get('step') != 'mfa':
            return Response({'detail': 'Die Anmeldung ist abgelaufen. Bitte noch einmal mit Google oder Apple anmelden.'}, status=400)
        user = get_user_model().objects.filter(pk=pending['user'], is_active=True).first()
        if user is None:
            return Response({'detail': 'Die Anmeldung ist abgelaufen. Bitte noch einmal mit Google oder Apple anmelden.'}, status=400)
        code = _code(request.data.get('code'))
        if not code or not verify_mfa_code(user, code):
            auth_events.emit(auth_events.MFA_FAILED, request, user)
            return Response({'detail': 'Der Code ist ungültig oder abgelaufen.'}, status=401)
        return _login_json(request, user, mfa_verified=True)
