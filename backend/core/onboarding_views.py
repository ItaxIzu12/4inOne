"""Read-only cross-domain eligibility; completing setup only writes preferences."""
from django.db.models import Count
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView
from core.models import Household, HouseholdMembership, OnboardingProfile
from core.throttling import LocalCacheThrottle


def has_user_data(user):
    """Hat die Person schon etwas eingetragen? Die Bereiche prüfen ihre eigenen Daten (core/registry.py ›
    HAS_USER_DATA); core kennt nur Haushalt und Einkommen."""
    from core import registry

    # Older records without author information count only in the user's sole-member homes.
    personal = Household.objects.annotate(member_total=Count('members')).filter(member_total=1, members=user)
    if HouseholdMembership.objects.filter(user=user, monthly_income__isnull=False).exists():
        return True
    if personal.filter(monthly_buffer__gt=0).exists():
        return True
    return any(check(user, personal) for check in registry.hooks(registry.HAS_USER_DATA))


class OnboardingInput(serializers.Serializer):
    usage = serializers.ChoiceField(choices=['personal', 'shared'])
    domains = serializers.ListField(child=serializers.ChoiceField(choices=['finanzen','haushalt','organisation','reisen']), min_length=1, max_length=4)

    def validate_domains(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError('Bitte jeden Bereich nur einmal auswählen.')
        return value


class OnboardingThrottle(LocalCacheThrottle):
    scope = 'haushalt_write'

    def get_cache_key(self, request, view):
        return f'onboarding:{request.user.pk}'


class OnboardingProfileView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [OnboardingThrottle]

    def get(self, request):
        profile = OnboardingProfile.objects.filter(user=request.user).first()
        completed = bool(profile and profile.completed_at)
        response = Response({
            'needs_onboarding': not completed and not has_user_data(request.user),
            'completed': completed,
            'usage': profile.usage if profile else None,
            'domains': profile.domains if profile else [],
        })
        response['Cache-Control'] = 'no-store'
        return response

    def put(self, request):
        data = OnboardingInput(data=request.data)
        data.is_valid(raise_exception=True)
        # No client-supplied user id: preferences always belong to request.user.
        profile, _ = OnboardingProfile.objects.get_or_create(user=request.user)
        profile.usage = data.validated_data['usage']
        profile.domains = data.validated_data['domains']
        profile.completed_at = profile.completed_at or timezone.now()
        profile.save()
        return Response({'needs_onboarding': False, 'completed': True, 'usage': profile.usage, 'domains': profile.domains})


# ---------------------------------------------------------------- Startleitfaden (seit 21.11.2026)
GUIDE_AREAS = ('start', 'finanzen', 'haushalt', 'organisation', 'reisen')


def guide_steps(user) -> dict:
    """Welche Startschritte je Bereich schon erledigt sind — nur aus echten Daten, die die Person sehen darf. Jeder
    Bereich liefert seinen Teil selbst (core/registry.py › GUIDE_STEPS)."""
    from core import registry
    from core.households import active_household

    household = active_household(user)
    steps: dict = {}
    for contribute in registry.hooks(registry.GUIDE_STEPS):
        steps.update(contribute(user, household))
    return steps


class GuideInput(serializers.Serializer):
    area = serializers.ChoiceField(choices=GUIDE_AREAS)
    hidden = serializers.BooleanField()


class OnboardingGuideView(APIView):
    """GET: Stand der Startleitfäden + ausgeblendete. PUT {area, hidden}: einen Leitfaden aus-/einblenden —
    gespeichert im eigenen OnboardingProfile (nie über eine fremde ID)."""

    permission_classes = [IsAuthenticated]

    throttle_classes = [*api_settings.DEFAULT_THROTTLE_CLASSES, OnboardingThrottle]

    def get_throttles(self):
        # Lesen passiert nach jedem neuen Eintrag: dafür nur die allgemeinen Grenzen, das Speichern zusätzlich eng
        throttles = super().get_throttles()
        return throttles if self.request.method == 'PUT' else [t for t in throttles if not isinstance(t, OnboardingThrottle)]

    def _payload(self, user, profile):
        return {'areas': guide_steps(user), 'dismissed': list(profile.dismissed_guides) if profile else []}

    def get(self, request):
        response = Response(self._payload(request.user, OnboardingProfile.objects.filter(user=request.user).first()))
        response['Cache-Control'] = 'no-store'
        return response

    def put(self, request):
        data = GuideInput(data=request.data)
        data.is_valid(raise_exception=True)
        area, hidden = data.validated_data['area'], data.validated_data['hidden']
        profile, _ = OnboardingProfile.objects.get_or_create(user=request.user, defaults={'usage': 'personal'})
        dismissed = [a for a in profile.dismissed_guides if a in GUIDE_AREAS and a != area]
        if hidden:
            dismissed.append(area)
        profile.dismissed_guides = dismissed
        profile.save(update_fields=['dismissed_guides'])
        return Response(self._payload(request.user, profile))
