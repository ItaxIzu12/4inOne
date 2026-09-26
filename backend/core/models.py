from decimal import Decimal

from django.conf import settings
from django.db import models


class Household(models.Model):
    """Ein Haushalt/eine Familie — der gemeinsame Container, dem alle
    fachlichen Daten (Finanzen/Haushalt/Organisation) zugeordnet sind.

    Bewusst KEINE Erweiterung des eingebauten User-Models (siehe
    ARCHITEKTUR.md §2.3): Ein Nutzer kann Mitglied mehrerer Haushalte sein,
    daher die separate Verknüpfungstabelle HouseholdMembership.
    """

    name = models.CharField(max_length=120)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='HouseholdMembership',
        related_name='households',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Gemeinsame monatliche Rücklage, für die "Verfügbares Einkommen"-
    # Berechnung im Finanzen-Analysen-Tab (finanzen/views.py AnalysenView) —
    # bewusst auf Household (haushaltsweit), nicht pro Mitglied wie
    # monthly_income unten: ein Puffer ist eine gemeinsame Rücklage, kein
    # privater Einzelwert.
    monthly_buffer = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))

    def __str__(self) -> str:
        return self.name


class HouseholdMembership(models.Model):
    """Verknüpft User und Household mit einer Rolle.

    Das Rollenmodell ist Grundlage für HouseholdScopedPermission
    (core/permissions.py) und muss laut ARCHITEKTUR.md §3.2 serverseitig
    durchgesetzt werden, nicht nur im Frontend versteckt werden — z. B.
    darf ein CHILD_ACCOUNT keine Finanz-Endpunkte erreichen.
    """

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        MEMBER = 'MEMBER', 'Mitglied'
        CHILD_ACCOUNT = 'CHILD_ACCOUNT', 'Kind-Konto'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)
    # PRIVATES Einzeleinkommen dieses Mitglieds — darf laut Sicherheits-
    # anforderung NIE an ein anderes Haushaltsmitglied ausgeliefert werden,
    # nur an die Person selbst (request.user == membership.user) und als Teil
    # der Haushalts-SUMME (finanzen/serializers.py
    # HouseholdMembershipIncomeSerializer, finanzen/views.py AnalysenView).
    # null=True: nicht jedes Mitglied muss ein Einkommen hinterlegen, damit
    # "Verfügbares Einkommen" funktioniert (nur wer möchte, trägt seins ein).
    monthly_income = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'household'], name='unique_household_membership'
            )
        ]

    def __str__(self) -> str:
        return f'{self.user} @ {self.household} ({self.role})'


class HouseholdInvite(models.Model):
    """Einladung einer weiteren Person in einen bestehenden Haushalt.

    Registrierung selbst legt IMMER einen neuen, eigenen Haushalt an (siehe
    core/auth_views.py RegisterView) — dieses Model ist der spätere Weg,
    wie ein ADMIN zusätzliche Mitglieder in genau diesen Haushalt holt,
    statt dass jede Person isoliert bleibt.
    """

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='invites')
    email = models.EmailField()
    # Rolle, die die eingeladene Person nach Annahme bekommen soll — noch
    # keine echte Annahme-Logik in diesem Schritt gebaut (siehe Chat-
    # Verlauf), aber der Wert wird bereits vom Einladungsformular erfasst
    # und darf nicht stillschweigend verworfen werden.
    role = models.CharField(
        max_length=20, choices=HouseholdMembership.Role.choices, default=HouseholdMembership.Role.MEMBER
    )
    token = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'Einladung {self.email} → {self.household}'


class PasswordResetToken(models.Model):
    """Einmaliges, kurzlebiges Token für den Passwort-Reset-Flow (core/
    auth_views.py PasswordResetRequestView/PasswordResetConfirmView).

    Bewusst ein eigenes Model statt Djangos eingebautem
    PasswordResetTokenGenerator (der leitet das Token deterministisch aus
    Nutzerdaten ab und speichert es nicht — hier soll es aber einmalig
    nutzbar UND explizit als "verbraucht" markierbar sein, siehe used_at).
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f'Reset-Token für {self.user}'


class MfaBackupCode(models.Model):
    """Ein Einmal-Code für den Fall, dass ein Nutzer sein TOTP-Gerät verliert
    (core/mfa_views.py) — verhindert Selbstaussperrung bei aktivierter MFA.

    Gespeichert wird bewusst ein HASH (django.contrib.auth.hashers, dieselbe
    Infrastruktur wie für Passwörter) statt reversibler Verschlüsselung:
    Backup-Codes müssen nach der einmaligen Anzeige nie wieder im Klartext
    abrufbar sein — Hashing ist dafür der richtige, irreversible Baustein
    (kein Schlüssel, der zusätzlich geschützt/rotiert werden müsste).
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mfa_backup_codes')
    code_hash = models.CharField(max_length=128)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'Backup-Code für {self.user} ({"benutzt" if self.used_at else "offen"})'


class Notification(models.Model):
    """Einfache In-App-Benachrichtigung für einen Nutzer innerhalb eines
    Haushalts (z. B. "Miete fällig", "Aufgabe zugewiesen")."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.message


class OnboardingProfile(models.Model):
    """Personal preferences only; never grants membership or sharing rights."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='onboarding_profile')
    usage = models.CharField(max_length=10, choices=[('personal', 'Nur für mich'), ('shared', 'Gemeinsam')])
    domains = models.JSONField(default=list)
    completed_at = models.DateTimeField(null=True, blank=True)


class UserSession(models.Model):
    """Ein angemeldetes Gerät (eine Kette rotierender Refresh-Tokens, gekennzeichnet durch den Claim `sid`).

    Damit sieht man unter Einstellungen → Aktive Sitzungen, wo man angemeldet ist, und kann einzelne Geräte abmelden:
    das aktuelle Refresh-Token (`current_jti`) wird dann gesperrt. Gespeichert wird nur, was dafür nötig ist: das
    Gerät (User-Agent, gekürzt) und wann es zuletzt aktiv war — keine IP-Adresse."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='login_sessions')
    sid = models.CharField(max_length=32, unique=True)
    current_jti = models.CharField(max_length=64)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField()

    class Meta:
        ordering = ['-last_seen']


class Contact(models.Model):
    """Eine bestätigte Verbindung zu einer anderen Person (Familie oder Freund:in).

    Jede Verbindung besteht aus zwei Zeilen, je eine pro Sicht: `owner` sieht `other` mit der Bezeichnung, die er
    selbst gewählt hat. Eine Verbindung teilt NICHTS: sie ist nur die Grundlage, jemanden später ausdrücklich zu einer
    Reise oder einem gemeinsamen Haushalt einzuladen (PRODUCT_REQUIREMENTS §10, ADR-001)."""

    class Relation(models.TextChoices):
        FAMILY = 'FAMILY', 'Familie'
        FRIEND = 'FRIEND', 'Freund:in'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='contacts')
    other = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    relation = models.CharField(max_length=10, choices=Relation.choices, default=Relation.FRIEND)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'other'], name='unique_contact'),
            models.CheckConstraint(condition=~models.Q(owner=models.F('other')), name='contact_not_self'),
        ]


class ContactInvite(models.Model):
    """Einladung per E-Mail, Kontakt zu werden. Sie wird erst durch die Annahme der eingeladenen Person zur Verbindung;
    angenommen werden kann sie nur vom Konto mit genau dieser E-Mail-Adresse."""

    inviter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='contact_invites')
    email = models.EmailField()
    relation = models.CharField(max_length=10, choices=Contact.Relation.choices, default=Contact.Relation.FRIEND)
    token = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    declined_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_open(self) -> bool:
        from django.utils import timezone

        return self.accepted_at is None and self.declined_at is None and self.expires_at > timezone.now()
