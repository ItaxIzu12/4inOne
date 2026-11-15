"""Anbindung an GlitchTip (Sentry-kompatibel). Wird am Ende von config/settings.py aufgerufen.

Ohne SENTRY_DSN passiert nichts — lokal ohne GlitchTip, in Tests und in der CI bleibt alles wie vorher.

Datenschutz (docs/MONITORING.md): das SDK sammelt standardmäßig keine Personendaten, zusätzlich `scrub_event`, das vor dem Senden alles
entfernt, was Personen oder Inhalte verraten könnte — Anfrage-Inhalte, Cookies, Header, Query-Strings, Nutzerangaben,
Server-Name, lokale Variablen. Übrig bleiben Fehlerart, Codezeile, Adresse ohne Parameter, Umgebung und Version.
"""

from __future__ import annotations

import re

SAFE_HEADERS = frozenset({'content-type', 'accept', 'user-agent'})
_EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')


def _redact(text):
    return _EMAIL.sub('[E-Mail]', text) if isinstance(text, str) else text


def scrub_event(event: dict, hint: dict | None = None) -> dict:
    request = event.get('request')
    if isinstance(request, dict):
        for key in ('data', 'cookies', 'query_string', 'env'):
            request.pop(key, None)
        if isinstance(request.get('url'), str):
            request['url'] = request['url'].split('?', 1)[0]
        headers = request.get('headers')
        if isinstance(headers, dict):
            request['headers'] = {k: v for k, v in headers.items() if k.lower() in SAFE_HEADERS}
    event.pop('user', None)
    event.pop('server_name', None)
    # E-Mail-Adressen aus Meldungstexten entfernen (z. B. in Fehlermeldungen von Bibliotheken)
    if isinstance(event.get('message'), str):
        event['message'] = _redact(event['message'])
    logentry = event.get('logentry')
    if isinstance(logentry, dict):
        logentry['message'] = _redact(logentry.get('message'))
        logentry.pop('params', None)
    for exc in (event.get('exception') or {}).get('values') or []:
        exc['value'] = _redact(exc.get('value'))
        for frame in (exc.get('stacktrace') or {}).get('frames') or []:
            frame.pop('vars', None)
    for crumb in (event.get('breadcrumbs') or {}).get('values') or []:
        crumb['message'] = _redact(crumb.get('message'))
        crumb.pop('data', None)
    return event


def init_sentry(dsn: str, environment: str, release: str | None = None) -> bool:
    if not dsn:
        return False
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=release or None,
        integrations=[DjangoIntegration()],
        # Weder send_default_pii (veraltet) noch data_collection gesetzt → das SDK sammelt keine Personendaten
        # (gleich send_default_pii=False). scrub_event ist die zweite Sicherung.
        include_local_variables=False,
        max_request_body_size='never',
        traces_sample_rate=0.0,  # keine Leistungsmessung — nur Fehler und Alarme
        before_send=scrub_event,
        before_send_transaction=lambda event, hint: None,
    )
    return True
