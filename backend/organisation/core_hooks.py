"""Organisation meldet sich bei `core` an (core/registry.py, docs/ARCHITECTURE.md § 3.1, 24.11.2026).

Der Code stand bis 24.11.2026 in core/{invitations,contact_views,places,onboarding_views,signals}.py; Verhalten
unverändert, nur die Abhängigkeitsrichtung ist jetzt Organisation → core.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db.models.signals import post_delete

from core import registry
from core.invitations import InvitationError, Scope, display_name


# ------------------------------------------------------------------ Einladungen (core/invitations.py)
def calendar_scope() -> Scope:
    """Gemeinsamer Kalender (31.10.2026): einladen darf nur die Besitzerin/der Besitzer; Rollen wie bei Reisen.
    Die Mitgliedschaft gibt nur Sicht auf die Termine DIESES Kalenders — nie auf private Termine."""
    from organisation.calendars import MAX_MEMBERS_PER_CALENDAR
    from organisation.models import CalendarMember, SharedCalendar

    def add(user, calendar, role):
        if CalendarMember.objects.filter(calendar=calendar).count() >= MAX_MEMBERS_PER_CALENDAR:
            raise InvitationError('Dieser Kalender hat schon die größtmögliche Zahl an Mitgliedern.')
        CalendarMember.objects.create(calendar=calendar, user=user, role=role)

    return Scope(
        roles={CalendarMember.Role.VIEWER: 'Kann ansehen', CalendarMember.Role.EDITOR: 'Kann bearbeiten'},
        default_role=CalendarMember.Role.VIEWER,
        load=lambda pk: SharedCalendar.objects.filter(pk=pk).first(),
        title=lambda calendar: calendar.name,
        detail=lambda calendar: 'Gemeinsamer Kalender',
        can_invite=lambda user, calendar: calendar.owner_id == user.pk,
        is_member=lambda user, calendar: CalendarMember.objects.filter(calendar=calendar, user=user).exists(),
        add_member=add,
    )


def my_calendar_scope() -> Scope:
    """Freigabe des eigenen Kalenders (wie Outlook, 31.10.2026). `scope_id` ist das Konto der freigebenden Person;
    freigeben kann nur sie selbst. Angenommen sieht die eingeladene Person nur Termine, die ausdrücklich mit ihr
    geteilt werden — private Termine nie."""
    from organisation.models import CalendarShare

    def add(user, owner, role):
        CalendarShare.objects.create(owner=owner, grantee=user, role=role)

    return Scope(
        roles={CalendarShare.Role.VIEWER: 'Kann ansehen', CalendarShare.Role.EDITOR: 'Kann bearbeiten'},
        default_role=CalendarShare.Role.VIEWER,
        load=lambda pk: get_user_model().objects.filter(pk=pk, is_active=True).first(),
        title=lambda owner: f'Kalender von {display_name(owner)}',
        detail=lambda owner: 'Kalenderfreigabe',
        can_invite=lambda user, owner: user.pk == owner.pk,
        # Die freigebende Person „gehört dazu“ (sonst sähe sie ihre eigenen gesendeten Einladungen nicht).
        is_member=lambda user, owner: user.pk == owner.pk
        or CalendarShare.objects.filter(owner=owner, grantee=user).exists(),
        add_member=add,
    )


# ------------------------------------------------------------------ Personen & Gruppen (core/contact_views.py)
def contact_sharing_calendars(ctx: registry.SharingContext) -> None:
    """Gemeinsame Kalender (31.10.2026): geteilt, wenn beide Mitglied sind; einladen nur in eigene Kalender."""
    from organisation.models import SharedCalendar

    calendars = SharedCalendar.objects.filter(members__user=ctx.user).prefetch_related('members').order_by('name', 'id')
    for calendar in calendars:
        members = {m.user_id for m in calendar.members.all()}
        entry = {'kind': 'CALENDAR', 'id': calendar.pk, 'title': calendar.name}
        for pk in ctx.ids:
            ctx.classify(pk, entry, member=pk in members, can_invite=calendar.owner_id == ctx.user.pk)


def contact_sharing_my_calendar(ctx: registry.SharingContext) -> None:
    """Kalenderfreigaben (Outlook-ähnlich): mein Kalender für die Person, ihr Kalender für mich."""
    from organisation.models import CalendarShare

    user = ctx.user
    given = set(CalendarShare.objects.filter(owner=user, grantee_id__in=ctx.ids).values_list('grantee_id', flat=True))
    received = set(CalendarShare.objects.filter(grantee=user, owner_id__in=ctx.ids).values_list('owner_id', flat=True))
    mine_entry = {'kind': 'MY_CALENDAR', 'id': user.pk, 'title': 'Dein Kalender'}
    for p in ctx.people:
        ctx.classify(p.pk, mine_entry, member=p.pk in given, can_invite=True)
        if p.pk in received:
            ctx.shared[p.pk].append({'kind': 'MY_CALENDAR', 'id': p.pk, 'title': f'Kalender von {display_name(p)}'})


# ------------------------------------------------------------------ Ortsvorschläge (core/places.py)
def place_candidates(user, kind: str) -> list[tuple[str, object]]:
    from organisation.models import PersonalEvent

    if kind == 'lodging':
        return []
    return list(PersonalEvent.objects.filter(owner=user).exclude(location='').values_list('location', 'updated_at').order_by('-updated_at')[:300])


# ------------------------------------------------------------------ Onboarding (core/onboarding_views.py)
def has_user_data(user, personal) -> bool:
    from organisation.models import CalendarEvent, PersonalEvent, PersonalTask

    checks = [
        PersonalEvent.objects.filter(owner=user),
        PersonalTask.objects.filter(owner=user),
        CalendarEvent.objects.filter(Q(created_by=user) | Q(household__in=personal)),
    ]
    return any(query.exists() for query in checks)


def guide_steps(user, household) -> dict:
    from organisation.models import CalendarEvent, PersonalEvent, PersonalNote, PersonalTask

    return {
        'organisation': {
            'event': PersonalEvent.objects.filter(owner=user).exists()
            or (household is not None and CalendarEvent.objects.filter(household=household).exists()),
            'task': PersonalTask.objects.filter(owner=user).exists(),
            'note': PersonalNote.objects.filter(owner=user).exists(),
        },
    }


def register() -> None:
    from core.models import Invitation
    from core.signals import revoke_open_invitations
    from organisation.models import SharedCalendar

    registry.register_invitation_scope(Invitation.Scope.CALENDAR, calendar_scope)
    registry.register_invitation_scope(Invitation.Scope.MY_CALENDAR, my_calendar_scope)
    registry.register(registry.CONTACT_SHARING, contact_sharing_calendars, order=30)
    registry.register(registry.CONTACT_SHARING, contact_sharing_my_calendar, order=40)
    registry.register(registry.PLACE_SOURCES, place_candidates, order=10)
    registry.register(registry.HAS_USER_DATA, has_user_data, order=30)
    registry.register(registry.GUIDE_STEPS, guide_steps, order=30)
    post_delete.connect(revoke_open_invitations(Invitation.Scope.CALENDAR), sender=SharedCalendar, weak=False,
                        dispatch_uid='invitations-calendar-deleted')
