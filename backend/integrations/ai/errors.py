"""Fehlerarten des KI-Clients (docs/AI_INTEGRATION.md § 5).

Jeder Fehler endet für die Person im Zustand „kein Vorschlag“. Keiner darf das normale Speichern blockieren: Aufrufer
fangen `AiError` und machen ohne Vorschlag weiter.
"""


class AiError(Exception):
    """Oberklasse. `code` ist kurz und ohne Inhalte, damit es gefahrlos geloggt werden kann."""

    code = 'error'


class AiDisabled(AiError):
    """KI ist abgeschaltet, nicht eingerichtet oder die Fähigkeit ist nicht freigegeben – es gab keinen Aufruf."""

    code = 'disabled'


class AiUnavailable(AiError):
    """Core nicht erreichbar, Serverfehler, falsches Token oder Sperre nach wiederholten Fehlern."""

    code = 'unavailable'


class AiTimeout(AiUnavailable):
    code = 'timeout'


class AiInvalidResponse(AiError):
    """Antwort passt nicht zum vereinbarten Format (kein JSON, zu groß, Felder fehlen, falsche Request-ID)."""

    code = 'invalid_response'


class AiRefused(AiError):
    """Der Core lehnt die Aufgabe ab (`status: refused`)."""

    code = 'refused'


class AiRequestTooLarge(AiError):
    """Die Anfrage überschreitet AI_MAX_REQUEST_BYTES – sie wurde nicht gesendet."""

    code = 'request_too_large'
