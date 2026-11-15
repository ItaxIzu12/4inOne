"""Anmelde-Ereignisse aufzeichnen und Auffälliges an GlitchTip melden.

Quellen: core.auth_events (Registrierung, Anmeldung, MFA, Passwort-Reset), Djangos `user_login_failed` (falsches
Passwort, unbekanntes Konto, auch während einer Sperre) und axes' `user_locked_out` (Sperre nach zu vielen Versuchen).

An GlitchTip gehen NUR auffällige Ereignisse (ALERTS) — ohne E-Mail, ohne IP, ohne Nutzerkennung, gruppiert je Art
(Fingerprint), damit ein Brute-Force-Angriff ein Vorgang mit Zähler ist und nicht tausend Meldungen.
"""

from __future__ import annotations

import ipaddress
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_login_failed
from rest_framework.throttling import BaseThrottle

from core import auth_events

logger = logging.getLogger(__name__)

ALERTS = {
    auth_events.LOGIN_FAILED: ('warning', 'Anmeldung fehlgeschlagen'),
    auth_events.LOCKED_OUT: ('error', 'Konto gesperrt nach zu vielen Fehlversuchen'),
    auth_events.MFA_FAILED: ('warning', 'Zwei-Faktor-Code falsch'),
}


def anonymize_ip(raw: str | None) -> str:
    """IPv4 auf /24 (letzte Stelle 0), IPv6 auf /48 — reicht, um Angriffe zu erkennen, nicht um Personen zu finden."""
    try:
        ip = ipaddress.ip_address((raw or '').strip())
    except ValueError:
        return ''
    prefix = 24 if ip.version == 4 else 48
    return str(ipaddress.ip_network(f'{ip}/{prefix}', strict=False).network_address)


def client_ip(request) -> str:
    # Dieselbe Regel wie die Rate-Limits (NUM_PROXIES nur mit BEHIND_PROXY): hinter nginx die echte Gegenstelle.
    return BaseThrottle().get_ident(request) if request is not None else ''


def record(kind: str, request=None, user=None) -> None:
    from .models import AuthEvent

    try:
        AuthEvent.objects.create(kind=kind, user=user, ip_prefix=anonymize_ip(client_ip(request)))
    except Exception:  # das Protokoll darf nie eine Anmeldung verhindern
        logger.exception('Anmelde-Ereignis konnte nicht gespeichert werden')
    alert = ALERTS.get(kind)
    if alert:
        _send_alert(kind, *alert, known_account=user is not None)


def _send_alert(kind: str, level: str, message: str, known_account: bool) -> None:
    try:
        import sentry_sdk
    except ImportError:  # pragma: no cover
        return
    with sentry_sdk.new_scope() as scope:
        scope.set_level(level)
        scope.set_tag('auth_event', kind)
        scope.set_tag('bekanntes_konto', 'ja' if known_account else 'nein')
        scope.fingerprint = ['auth-event', kind]
        sentry_sdk.capture_message(message)


# -- Empfänger ---------------------------------------------------------------------------------------------------
def _on_auth_event(sender, kind, request, user=None, **kwargs):
    record(kind, request, user)


def _on_login_failed(sender, credentials, request=None, **kwargs):
    # credentials['username'] ist die eingetippte Adresse — nur zum Zuordnen eines BESTEHENDEN Kontos, nie gespeichert
    username = (credentials or {}).get('username') or ''
    user = get_user_model().objects.filter(username__iexact=username).first() if username else None
    record(auth_events.LOGIN_FAILED, request, user)


def _on_locked_out(sender, request=None, username=None, ip_address=None, **kwargs):
    user = get_user_model().objects.filter(username__iexact=username).first() if username else None
    record(auth_events.LOCKED_OUT, request, user)


def connect() -> None:
    from axes.signals import user_locked_out

    auth_events.auth_event.connect(_on_auth_event, dispatch_uid='monitoring-auth-event', weak=False)
    user_login_failed.connect(_on_login_failed, dispatch_uid='monitoring-login-failed', weak=False)
    user_locked_out.connect(_on_locked_out, dispatch_uid='monitoring-locked-out', weak=False)
