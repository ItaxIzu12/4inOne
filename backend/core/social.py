"""Anmeldung mit Google und Apple (OpenID Connect, Authorization Code Flow mit PKCE) — seit 19.11.2026.

Ablauf (docs/SOCIAL_LOGIN.md):
1. start: zufälliger `state`, `nonce` und PKCE-`verifier`, signiert und kurzlebig (10 Min.) in einem httpOnly-Cookie,
   das an genau diesen Browser gebunden ist — dann Weiterleitung zum Anbieter.
2. callback: `state` aus der Antwort muss zum Cookie passen (sonst Login-CSRF), Code wird serverseitig mit
   Client-Secret und PKCE-Verifier gegen das ID-Token getauscht.
3. ID-Token wird vollständig geprüft: Signatur über die öffentlichen Schlüssel des Anbieters (JWKS, nur RS256),
   Aussteller, Empfänger (unsere Client-ID), Ablaufzeit, Ausstellungszeit und `nonce` (gegen Wiedereinspielen).
   Nur eine vom Anbieter bestätigte E-Mail-Adresse wird akzeptiert.

Ein Anbieter ist nur aktiv, wenn seine Zugangsdaten in der .env stehen — sonst gibt es weder Knopf noch Endpunkt.
"""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import jwt
from django.conf import settings


class SocialLoginError(Exception):
    """Fehler im Ablauf. `code` geht als Kurzwort ans Frontend, nie Details (keine Token, keine Anbieterantworten)."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Provider:
    name: str
    authorize_url: str
    token_url: str
    jwks_url: str
    issuers: tuple[str, ...]
    scope: str
    form_post: bool  # Apple antwortet per POST (response_mode=form_post), wenn Name/E-Mail angefragt werden


PROVIDERS = {
    'google': Provider(
        name='google',
        authorize_url='https://accounts.google.com/o/oauth2/v2/auth',
        token_url='https://oauth2.googleapis.com/token',
        jwks_url='https://www.googleapis.com/oauth2/v3/certs',
        issuers=('https://accounts.google.com', 'accounts.google.com'),
        scope='openid email profile',
        form_post=False,
    ),
    'apple': Provider(
        name='apple',
        authorize_url='https://appleid.apple.com/auth/authorize',
        token_url='https://appleid.apple.com/auth/token',
        jwks_url='https://appleid.apple.com/auth/keys',
        issuers=('https://appleid.apple.com',),
        scope='name email',
        form_post=True,
    ),
}


# -- Konfiguration ---------------------------------------------------------------------------------------------------
def client_id(provider: str) -> str:
    return settings.GOOGLE_OAUTH_CLIENT_ID if provider == 'google' else settings.APPLE_CLIENT_ID


def enabled(provider: str) -> bool:
    if provider == 'google':
        return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)
    if provider == 'apple':
        return bool(settings.APPLE_CLIENT_ID and settings.APPLE_TEAM_ID and settings.APPLE_KEY_ID and _apple_key())
    return False


def _apple_key() -> str:
    path = settings.APPLE_PRIVATE_KEY_PATH
    if not path:
        return ''
    try:
        return Path(path).read_text()
    except OSError:
        return ''


def client_secret(provider: str) -> str:
    if provider == 'google':
        return settings.GOOGLE_OAUTH_CLIENT_SECRET
    # Apple: Client-Secret ist ein kurzlebiges, mit dem privaten Schlüssel (.p8, ES256) signiertes JWT
    now = int(time.time())
    return jwt.encode(
        {'iss': settings.APPLE_TEAM_ID, 'iat': now, 'exp': now + 300, 'aud': 'https://appleid.apple.com',
         'sub': settings.APPLE_CLIENT_ID},
        _apple_key(), algorithm='ES256', headers={'kid': settings.APPLE_KEY_ID},
    )


def redirect_uri(provider: str) -> str:
    return f"{settings.OAUTH_CALLBACK_BASE.rstrip('/')}/api/v1/auth/oauth/{provider}/callback/"


# -- Schritt 1: zum Anbieter ---------------------------------------------------------------------------------------
def new_flow(provider: str) -> dict:
    verifier = secrets.token_urlsafe(64)
    return {'provider': provider, 'state': secrets.token_urlsafe(32), 'nonce': secrets.token_urlsafe(32), 'verifier': verifier}


def _challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()


def authorize_url(flow: dict) -> str:
    provider = PROVIDERS[flow['provider']]
    params = {
        'client_id': client_id(provider.name),
        'redirect_uri': redirect_uri(provider.name),
        'response_type': 'code',
        'scope': provider.scope,
        'state': flow['state'],
        'nonce': flow['nonce'],
        'code_challenge': _challenge(flow['verifier']),
        'code_challenge_method': 'S256',
    }
    if provider.form_post:
        params['response_mode'] = 'form_post'
    else:
        params['prompt'] = 'select_account'
    return f'{provider.authorize_url}?{urllib.parse.urlencode(params)}'


# -- Schritt 2: Code gegen ID-Token tauschen -----------------------------------------------------------------------
def exchange_code(provider: str, code: str, verifier: str) -> str:
    body = urllib.parse.urlencode({
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri(provider),
        'client_id': client_id(provider),
        'client_secret': client_secret(provider),
        'code_verifier': verifier,
    }).encode()
    request = urllib.request.Request(PROVIDERS[provider].token_url, data=body, method='POST',
                                     headers={'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=8) as answer:  # noqa: S310 (feste Anbieter-Adresse)
            data = json.loads(answer.read(256 * 1024))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        raise SocialLoginError('anbieter') from exc
    token = data.get('id_token') if isinstance(data, dict) else None
    if not isinstance(token, str):
        raise SocialLoginError('anbieter')
    return token


# -- Schritt 3: ID-Token prüfen --------------------------------------------------------------------------------------
_jwks_clients: dict[str, jwt.PyJWKClient] = {}


def _signing_key(provider: str, token: str):
    client = _jwks_clients.get(provider)
    if client is None:
        client = _jwks_clients[provider] = jwt.PyJWKClient(PROVIDERS[provider].jwks_url, cache_keys=True, lifespan=3600, timeout=8)
    return client.get_signing_key_from_jwt(token).key


def verify_id_token(provider: str, token: str, nonce: str) -> dict:
    try:
        key = _signing_key(provider, token)
        claims = jwt.decode(
            token, key, algorithms=['RS256'], audience=client_id(provider), issuer=list(PROVIDERS[provider].issuers),
            options={'require': ['exp', 'iat', 'iss', 'aud', 'sub']}, leeway=30,
        )
    except (jwt.PyJWTError, jwt.PyJWKClientError, OSError) as exc:
        raise SocialLoginError('token') from exc
    if not secrets.compare_digest(str(claims.get('nonce', '')), nonce):
        raise SocialLoginError('token')
    email = claims.get('email')
    # Google liefert true/false, Apple "true"/"false" als Text
    verified = claims.get('email_verified') in (True, 'true')
    if not isinstance(email, str) or not email or not verified:
        raise SocialLoginError('email')
    return {'sub': str(claims['sub']), 'email': email.strip().lower(), 'name': str(claims.get('given_name') or claims.get('name') or '')[:150]}


def apple_first_name(raw_user: str | None) -> str:
    """Apple schickt den Namen nur beim allerersten Mal, als JSON im Formularfeld `user` (nicht signiert — nur für die
    Anzeige, nie für Entscheidungen)."""
    if not raw_user:
        return ''
    try:
        data = json.loads(raw_user)
    except ValueError:
        return ''
    name = data.get('name') if isinstance(data, dict) else None
    first = name.get('firstName') if isinstance(name, dict) else ''
    return str(first or '')[:150]
