from decimal import Decimal

from django.conf import settings
from django.db import models

from .currencies import CURRENCY_CHOICES, DEFAULT_HOME_CURRENCY


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


class Invitation(models.Model):
    """In-App-Einladung einer bestehenden Person (aus den eigenen Kontakten) in einen teilbaren Bereich.

    Eine Einladung ist eine ANFRAGE, keine Berechtigung: solange sie offen ist, entsteht weder Mitgliedschaft
    noch Sichtbarkeit. Erst `core.invitations.accept()` legt in derselben Transaktion die Mitgliedschaft des
    jeweiligen Bereichs an (HouseholdMembership bzw. reisen.TripParticipant) — und nur für genau diesen Bereich.

    Bereiche sind eine feste Allowlist (Scope), keine freie Kombination aus Model und ID. `scope_id` ist bewusst
    kein ForeignKey, damit ein gelöschter Bereich die Einladung nicht mitreißt; die Annahme prüft dann, dass er
    noch existiert. Zustandswechsel nur über core/invitations.py (bedingte UPDATEs, sicher bei Doppelklick und
    gleichzeitigem Annehmen/Ablehnen)."""

    class Scope(models.TextChoices):
        HOUSEHOLD = 'HOUSEHOLD', 'Haushalt'
        TRIP = 'TRIP', 'Reise'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Offen'
        ACCEPTED = 'ACCEPTED', 'Angenommen'
        DECLINED = 'DECLINED', 'Abgelehnt'
        REVOKED = 'REVOKED', 'Zurückgezogen'

    # Wird das Konto der einladenden Person gelöscht, bleibt der Datensatz für die Nachvollziehbarkeit; eine
    # noch offene Einladung lässt sich dann aber nicht mehr annehmen (siehe invitations.accept()).
    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='sent_invitations'
    )
    invitee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invitations')
    scope_type = models.CharField(max_length=12, choices=Scope.choices)
    scope_id = models.PositiveBigIntegerField()
    role = models.CharField(max_length=12)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            # Höchstens eine offene Einladung je Person und Bereich — fünfmal Einladen erzeugt keine fünf Anfragen.
            models.UniqueConstraint(
                fields=['invitee', 'scope_type', 'scope_id'],
                condition=models.Q(status='PENDING'),
                name='one_pending_invitation_per_scope',
            ),
            models.CheckConstraint(condition=~models.Q(inviter=models.F('invitee')), name='invitation_not_self'),
        ]
        indexes = [
            models.Index(fields=['invitee', 'status'], name='core_invita_invitee_status_idx'),
            models.Index(fields=['inviter', 'status'], name='core_invita_inviter_status_idx'),
        ]

    def __str__(self) -> str:
        return f'Einladung {self.scope_type}:{self.scope_id} → {self.invitee_id} ({self.status})'


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
    """In-App-Benachrichtigung — der Zustellkanal, nicht die Sache selbst.

    Enthält keine eigenen Inhalte, nur einen Verweis (z. B. auf eine Einladung); angezeigt wird immer der aktuelle
    Stand der Quelle, und nur, wenn sie für genau diese Person bestimmt ist. „Gelesen“ ändert nichts an der
    Quelle (gelesen ≠ angenommen). Weitere Kanäle (E-Mail) hängen sich später an core/notifications.py an."""

    class Kind(models.TextChoices):
        INVITATION_CREATED = 'INVITATION_CREATED', 'Neue Einladung'
        CONTACT_INVITE = 'CONTACT_INVITE', 'Kontaktanfrage'
        # an die einladende Person, wenn angenommen wurde (Ablehnungen werden bewusst nicht gemeldet)
        CONTACT_ACCEPTED = 'CONTACT_ACCEPTED', 'Kontaktanfrage angenommen'
        INVITATION_ACCEPTED = 'INVITATION_ACCEPTED', 'Einladung angenommen'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=32, choices=Kind.choices)
    invitation = models.ForeignKey(Invitation, on_delete=models.CASCADE, null=True, related_name='notifications')
    # Kontakt-Einladung (per E-Mail-Adresse) — erscheint nur bei bestätigter Adresse, siehe core/notifications.py.
    contact_invite = models.ForeignKey(
        'ContactInvite', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications'
    )
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['user', 'read_at'], name='core_notif_user_read_idx')]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'contact_invite'], condition=models.Q(contact_invite__isnull=False),
                name='one_notification_per_contact_invite',
            )
        ]

    def __str__(self) -> str:
        return f'{self.kind} → {self.user_id}'


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


class ExchangeRate(models.Model):
    """EZB-Referenzkurs je Kursdatum: 1 EUR = `rate` Einheiten `currency` (siehe core/fx.py). Bleibt gespeichert, damit
    Umrechnungen nachvollziehbar sind und ein Ausfall der Quelle die App nicht blockiert."""

    currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=20, decimal_places=8)
    rate_date = models.DateField()
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['currency', 'rate_date'], name='unique_exchange_rate_per_day')]
        indexes = [models.Index(fields=['rate_date'])]


class UserPreference(models.Model):
    """Persönliche Anzeige-Einstellungen eines Nutzers — die einzige Stelle für die Heimatwährung (Umrechnungen in
    Reisen). Fehlt der Datensatz, gilt DEFAULT_HOME_CURRENCY."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='preference')
    home_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=DEFAULT_HOME_CURRENCY)


def home_currency_for(user) -> str:
    preference = UserPreference.objects.filter(user=user).only('home_currency').first()
    return preference.home_currency if preference else DEFAULT_HOME_CURRENCY


class IdempotencyRecord(models.Model):
    """Ergebnis einer Anlage-Anfrage mit `Idempotency-Key` (core/idempotency.py).

    Kommt dieselbe Anfrage erneut — Netzwerk-Wiederholung, erneutes Absenden nach einem Verbindungsfehler —, liefert
    der Server die gespeicherte Antwort, statt ein zweites Objekt anzulegen. Schlüssel gelten je Person und Endpunkt
    24 Stunden; ältere Einträge werden beim nächsten Schreiben der Person entfernt."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    scope = models.CharField(max_length=80)
    key = models.CharField(max_length=100)
    # Fingerabdruck des Request-Bodys: derselbe Schlüssel mit anderem Inhalt ist ein Fehler, keine Wiederholung.
    fingerprint = models.CharField(max_length=64)
    status_code = models.PositiveSmallIntegerField(default=0)  # 0 = wird gerade verarbeitet
    body = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'scope', 'key'], name='unique_idempotency_key')]
        indexes = [models.Index(fields=['user', 'created_at'], name='core_idem_user_created_idx')]

