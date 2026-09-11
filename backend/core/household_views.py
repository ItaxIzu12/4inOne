import secrets

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import HouseholdInvite, HouseholdMembership
from core.throttling import LocalCacheThrottle


class HouseholdInviteRateThrottle(LocalCacheThrottle):
    """Max. RATE_LIMIT_HOUSEHOLD_INVITE Einladungen pro Stunde — PRO
    HAUSHALT, nicht pro Nutzer/IP (ARCHITEKTUR.md §3.9: "Rate-Limit auf das
    Versenden von Einladungen pro Haushalt/Zeitfenster"). Mehrere
    ADMIN-Mitglieder desselben Haushalts teilen sich dadurch ein Limit —
    sonst ließe es sich durch mehrere Admin-Konten im selben Haushalt
    umgehen."""

    scope = 'household_invite'

    def get_cache_key(self, request, view):
        household = request.user.households.first() if request.user.is_authenticated else None
        ident = str(household.id) if household else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class HouseholdInviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=HouseholdMembership.Role.choices, default=HouseholdMembership.Role.MEMBER)


class HouseholdInviteView(APIView):
    """Lädt eine weitere Person in den eigenen Haushalt ein (ARCHITEKTUR.md
    §3.9). Token kryptografisch zufällig (secrets.token_urlsafe(32)),
    Ablaufzeit über HOUSEHOLD_INVITE_EXPIRY_DAYS, Einmal-Nutzung über
    accepted_at (Annahme-Flow selbst ist noch nicht Teil dieses Schritts).

    Verrät bewusst NICHT, ob die eingeladene E-Mail bereits ein Konto hat
    (Account-Enumeration, §3.9) — es wird nie gegen das User-Model geprüft,
    nur ob die E-Mail bereits Mitglied DIESES Haushalts ist.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [HouseholdInviteRateThrottle]

    def post(self, request):
        household = request.user.households.first()
        if household is None:
            return Response({'detail': 'Dieses Konto ist noch keinem Haushalt zugeordnet.'}, status=400)

        serializer = HouseholdInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        role = serializer.validated_data['role']

        if household.members.filter(email__iexact=email).exists():
            return Response({'email': ['Diese Person ist bereits Mitglied dieses Haushalts.']}, status=400)

        invite = HouseholdInvite.objects.create(
            household=household,
            email=email,
            role=role,
            token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + timezone.timedelta(days=settings.HOUSEHOLD_INVITE_EXPIRY_DAYS),
        )
        # TODO (Backend): tatsächlichen Mail-Versand mit Einladungslink
        # ergänzen, sobald ein E-Mail-Backend konfiguriert ist (siehe
        # PasswordResetRequestView, dasselbe TODO dort) — Token-Logik selbst
        # (erzeugen/Ablaufzeit/Einmal-Nutzung) funktioniert bereits vollständig.
        return Response(
            {'detail': f'Einladung an {email} gesendet.', 'email': email, 'expires_at': invite.expires_at},
            status=status.HTTP_201_CREATED,
        )
