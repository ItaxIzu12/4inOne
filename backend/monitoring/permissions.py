from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from core.mfa_views import user_has_mfa_enabled
from core.models import UserSession


class IsMonitoringAdmin(BasePermission):
    """Admin-Panel: aktives Konto mit is_staff UND bestätigter Zwei-Faktor-Anmeldung — bei jeder Anfrage geprüft.

    is_staff lässt sich über keine API setzen, nur per `manage.py monitoring_admin <email>`. Ohne Zwei-Faktor gibt es
    einen eigenen Hinweis (code mfa_required), damit das Frontend erklären kann, was fehlt."""

    message = 'Kein Zugriff auf das Admin-Panel.'

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.is_active and user.is_staff):
            return False
        if not user_has_mfa_enabled(user):
            raise PermissionDenied({'detail': 'Für das Admin-Panel ist die Zwei-Faktor-Anmeldung nötig.', 'code': 'mfa_required'})
        # Nicht nur „das Konto hat Zwei-Faktor“, sondern „DIESE Sitzung wurde damit angemeldet“ (security-review
        # 15.11.2026): sonst öffnete eine Sitzung von vor dem Einschalten das Panel weiter.
        sid = request.auth.get('sid') if request.auth is not None and hasattr(request.auth, 'get') else None
        if not sid or not UserSession.objects.filter(user=user, sid=sid, mfa_verified=True).exists():
            raise PermissionDenied({'detail': 'Bitte einmal ab- und mit Zwei-Faktor-Code wieder anmelden.', 'code': 'mfa_session'})
        return True
