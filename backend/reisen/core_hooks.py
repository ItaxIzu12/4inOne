"""Reisen meldet sich bei `core` an (core/registry.py, docs/ARCHITECTURE.md § 3.1, 24.11.2026).

Der Code stand bis 24.11.2026 in core/{invitations,contact_views,places,onboarding_views,signals}.py und
core/management/commands/cleanup_expired.py; Verhalten unverändert, nur die Abhängigkeitsrichtung ist jetzt Reisen → core.
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.db.models.signals import post_delete
from django.utils import timezone

from core import registry
from core.invitations import Scope, date_range


# ------------------------------------------------------------------ Einladungen (core/invitations.py)
def trip_scope() -> Scope:
    from reisen.models import Trip, TripParticipant

    def can_invite(user, trip) -> bool:
        return trip.owner_id == user.pk or TripParticipant.objects.filter(
            trip=trip, user=user, role=TripParticipant.Role.OWNER
        ).exists()

    def add(user, trip, role):
        TripParticipant.objects.create(trip=trip, user=user, role=role)

    return Scope(
        roles={TripParticipant.Role.VIEWER: 'Kann ansehen', TripParticipant.Role.EDITOR: 'Kann bearbeiten'},
        default_role=TripParticipant.Role.VIEWER,
        load=lambda pk: Trip.objects.filter(pk=pk).first(),
        title=lambda trip: trip.title,
        detail=lambda trip: date_range(trip.start_date, trip.end_date),
        can_invite=can_invite,
        is_member=lambda user, trip: trip.owner_id == user.pk
        or TripParticipant.objects.filter(trip=trip, user=user).exists(),
        add_member=add,
    )


# ------------------------------------------------------------------ Personen & Gruppen (core/contact_views.py)
def contact_sharing(ctx: registry.SharingContext) -> None:
    """Reisen, an denen beide beteiligt sind; einladen nur in kommende Reisen, die der Nutzer verwalten darf."""
    from reisen.models import Trip, TripParticipant

    user = ctx.user
    trips = (
        Trip.objects.filter(Q(owner=user) | Q(participants__user=user))
        .distinct()
        .prefetch_related('participants')
        .order_by('start_date', 'id')
    )
    today = timezone.localdate()
    for trip in trips:
        involved = {trip.owner_id} | {p.user_id for p in trip.participants.all()}
        manages = trip.owner_id == user.pk or any(
            p.user_id == user.pk and p.role == TripParticipant.Role.OWNER for p in trip.participants.all()
        )
        entry = {'kind': 'TRIP', 'id': trip.pk, 'title': trip.title}
        for pk in ctx.ids:
            ctx.classify(pk, entry, member=pk in involved, can_invite=manages and trip.end_date >= today)


# ------------------------------------------------------------------ Ortsvorschläge (core/places.py)
def place_candidates(user, kind: str) -> list[tuple[str, object]]:
    from reisen.models import Trip

    trips = (Trip.objects.filter(owner=user) | Trip.objects.filter(participants__user=user)).distinct()
    if kind == 'lodging':
        return list(trips.exclude(accommodation='').values_list('accommodation', 'updated_at').order_by('-updated_at')[:100])
    candidates: list[tuple[str, object]] = []
    for destination, departure, stamp in trips.values_list('destination', 'departure', 'updated_at').order_by('-updated_at')[:100]:
        for value in (destination, departure):
            if value:
                candidates.append((value, stamp))
    return candidates


# ------------------------------------------------------------------ Startleitfaden (core/onboarding_views.py)
def guide_steps(user, household) -> dict:
    from reisen.models import PackingItem, Trip, TripBudgetCategory

    trips = Trip.objects.filter(Q(owner=user) | Q(participants__user=user)).distinct()
    latest_trip = trips.order_by('-start_date', '-id').values_list('id', flat=True).first()
    return {
        'reisen': {
            'trip': latest_trip is not None,
            'packing': PackingItem.objects.filter(trip__in=trips).exists(),
            'budget': trips.filter(budget_amount__isnull=False).exists()
            or TripBudgetCategory.objects.filter(trip__in=trips).exists(),
            # Ziel für „Packliste“/„Budget“: die zuletzt beginnende sichtbare Reise (nie eine fremde ID)
            'trip_id': latest_trip,
        },
    }


# ------------------------------------------------------------------ Aufräumen (cleanup_expired)
def cleanup_rules(now) -> dict:
    from reisen.models import BoardingPass

    cutoff = now.date() - timedelta(days=2)
    # Bordkarten (Buchungscode!) nur bis 2 Tage nach Reiseende bzw. Flugtag aufbewahren
    return {'Bordkarten nach der Reise': BoardingPass.objects.filter(Q(trip__end_date__lt=cutoff) | Q(flight_date__lt=cutoff))}


def register() -> None:
    from core.models import Invitation
    from core.signals import revoke_open_invitations
    from reisen.models import Trip

    registry.register_invitation_scope(Invitation.Scope.TRIP, trip_scope)
    registry.register(registry.CONTACT_SHARING, contact_sharing, order=20)
    registry.register(registry.PLACE_SOURCES, place_candidates, order=20)
    registry.register(registry.GUIDE_STEPS, guide_steps, order=40)
    registry.register(registry.CLEANUP_RULES, cleanup_rules, order=20)
    post_delete.connect(revoke_open_invitations(Invitation.Scope.TRIP), sender=Trip, weak=False,
                        dispatch_uid='invitations-trip-deleted')
