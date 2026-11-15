from django.conf import settings
from django.db import models


class AuthEvent(models.Model):
    """Ein Anmelde-Ereignis fürs Admin-Panel (Sicherheitsprotokoll, berechtigtes Interesse, 90 Tage).

    Datensparsam: keine eingetippte E-Mail-Adresse (bei Fehlversuchen mit unbekanntem Konto steht dort nichts),
    IP-Adresse nur gekürzt (IPv4 /24, IPv6 /48), kein Browser-Fingerabdruck. Wird ein Konto gelöscht, bleibt das
    Ereignis ohne Personenbezug stehen (SET_NULL) und läuft mit der Aufbewahrungsfrist aus (prune_auth_events)."""

    class Kind(models.TextChoices):
        REGISTERED = 'registered', 'Registriert'
        LOGIN_SUCCEEDED = 'login_succeeded', 'Angemeldet'
        LOGIN_FAILED = 'login_failed', 'Anmeldung fehlgeschlagen'
        LOCKED_OUT = 'locked_out', 'Gesperrt nach Fehlversuchen'
        MFA_FAILED = 'mfa_failed', 'Zwei-Faktor-Code falsch'
        PASSWORD_RESET_REQUESTED = 'password_reset_requested', 'Passwort-Reset angefordert'
        PASSWORD_RESET_COMPLETED = 'password_reset_completed', 'Passwort zurückgesetzt'

    kind = models.CharField(max_length=32, choices=Kind.choices)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    ip_prefix = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['kind', 'created_at'])]

    def __str__(self) -> str:
        return f'{self.get_kind_display()} · {self.created_at:%d.%m.%Y %H:%M}'
