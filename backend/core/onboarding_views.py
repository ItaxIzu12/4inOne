"""Read-only cross-domain eligibility; completing setup only writes preferences."""
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView
from core.models import Household, HouseholdMembership, OnboardingProfile
from core.throttling import LocalCacheThrottle


def has_user_data(user):
    from finanzen.models import Budget, Category, RecurringDeduction, Transaction, MonthlyBudget, SavingsGoal
    from haushalt.models import FolderEntry, ShoppingItem, ShoppingTrip, Task, TaskCompletion
    from organisation.models import CalendarEvent, PersonalEvent, PersonalTask

    # Older records without author information count only in the user's sole-member homes.
    personal = Household.objects.annotate(member_total=Count('members')).filter(member_total=1, members=user)
    if HouseholdMembership.objects.filter(user=user, monthly_income__isnull=False).exists():
        return True
    if personal.filter(monthly_buffer__gt=0).exists():
        return True
    checks = [
        MonthlyBudget.objects.filter(owner=user),
        SavingsGoal.objects.filter(owner=user),
        PersonalEvent.objects.filter(owner=user),
        PersonalTask.objects.filter(owner=user),
        Transaction.objects.filter(Q(created_by=user) | Q(account__household__in=personal)),
        RecurringDeduction.objects.filter(Q(created_by=user) | Q(household__in=personal)),
        Category.objects.filter(household__in=personal).filter(Q(is_default=False) | Q(monthly_goal__isnull=False)),
        Budget.objects.filter(household__in=personal),
        ShoppingItem.objects.filter(Q(added_by=user) | Q(shopping_list__household__in=personal)),
        ShoppingTrip.objects.filter(Q(completed_by=user) | Q(household__in=personal)),
        TaskCompletion.objects.filter(Q(done_by=user) | Q(household__in=personal)),
        Task.objects.filter(Q(created_by=user) | Q(assigned_to=user) | Q(household__in=personal)),
        FolderEntry.objects.filter(Q(created_by=user) | Q(household__in=personal)),
        CalendarEvent.objects.filter(Q(created_by=user) | Q(household__in=personal)),
    ]
    return any(query.exists() for query in checks)


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
    """Welche Startschritte je Bereich schon erledigt sind — nur aus echten Daten, die die Person sehen darf
    (wie has_user_data oben: Fach-Apps erst hier importieren, core hängt sonst nicht von ihnen ab)."""
    from core.households import active_household
    from finanzen.models import MonthlyBudget, SavingsGoal, Transaction
    from haushalt.models import FolderEntry, ShoppingItem, Task
    from organisation.models import CalendarEvent, PersonalEvent, PersonalNote, PersonalTask
    from reisen.models import PackingItem, Trip, TripBudgetCategory

    household = active_household(user)
    trips = Trip.objects.filter(Q(owner=user) | Q(participants__user=user)).distinct()
    latest_trip = trips.order_by('-start_date', '-id').values_list('id', flat=True).first()
    return {
        'finanzen': {
            'budget': MonthlyBudget.objects.filter(owner=user).exists(),
            'transaction': Transaction.objects.filter(owner=user).exists(),
            'goal': SavingsGoal.objects.filter(owner=user).exists(),
        },
        'haushalt': {
            'task': household is not None and Task.objects.filter(household=household).exists(),
            'shopping': household is not None and ShoppingItem.objects.filter(shopping_list__household=household).exists(),
            'folder': household is not None and FolderEntry.objects.filter(household=household).exists(),
        },
        'organisation': {
            'event': PersonalEvent.objects.filter(owner=user).exists()
            or (household is not None and CalendarEvent.objects.filter(household=household).exists()),
            'task': PersonalTask.objects.filter(owner=user).exists(),
            'note': PersonalNote.objects.filter(owner=user).exists(),
        },
        'reisen': {
            'trip': latest_trip is not None,
            'packing': PackingItem.objects.filter(trip__in=trips).exists(),
            'budget': trips.filter(budget_amount__isnull=False).exists()
            or TripBudgetCategory.objects.filter(trip__in=trips).exists(),
            # Ziel für „Packliste“/„Budget“: die zuletzt beginnende sichtbare Reise (nie eine fremde ID)
            'trip_id': latest_trip,
        },
    }


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
