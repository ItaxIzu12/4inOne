"""Anmelde-Ereignisse als Signal (15.11.2026).

`core` meldet nur, DASS etwas passiert ist — wer zuhört (backend/monitoring/: Protokoll fürs Admin-Panel, Alarm an
GlitchTip), weiß `core` nicht. So bleibt die Abhängigkeitsrichtung aus ARCHITEKTUR.md §2.1: core importiert nichts aus
den anderen Apps. Fehlgeschlagene Anmeldungen und Sperren kommen nicht von hier, sondern aus Djangos
`user_login_failed` bzw. axes' `user_locked_out` (die monitoring ebenfalls empfängt).
"""

from django.dispatch import Signal

REGISTERED = 'registered'
LOGIN_SUCCEEDED = 'login_succeeded'
LOGIN_FAILED = 'login_failed'
LOCKED_OUT = 'locked_out'
MFA_FAILED = 'mfa_failed'
PASSWORD_RESET_REQUESTED = 'password_reset_requested'
PASSWORD_RESET_COMPLETED = 'password_reset_completed'

# Signal-Argumente: kind (eine der Konstanten oben), request, user (oder None)
auth_event = Signal()


def emit(kind: str, request, user=None) -> None:
    auth_event.send(sender=None, kind=kind, request=request, user=user)
