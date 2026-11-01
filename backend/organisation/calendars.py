"""Gemeinsame Kalender und Kalenderfreigaben (31.10.2026) — alle Regeln an einem Ort. Views reichen nur durch.

Zwei Wege, einen Termin zu teilen — beide bewusst, jeder Termin ist zuerst privat:
1. Gruppen-Kalender (SharedCalendar, z. B. „Familie“): alle Mitglieder sehen die Termine darin.
2. Freigabe des eigenen Kalenders (CalendarShare, wie Outlook): die Person sieht nur die Termine, die man
   ausdrücklich mit ihr teilt (EventShare) — und nur, solange die Freigabe besteht.

Grundsätze (docs/AUTH_AND_PERMISSIONS.md › Gemeinsame Kalender):
- Ein Termin ist entweder privat (calendar=None, sichtbar nur für `owner`) oder gehört zu genau einem gemeinsamen
  Kalender (sichtbar für dessen Mitglieder). Private Termine erscheinen für andere NIRGENDS — auch nicht als
  „beschäftigt“, nicht als Zähler, nicht in Verknüpfungen oder auf der Startseite.
- Rollen: OWNER (Besitzer:in, verwaltet Kalender und Mitglieder), EDITOR (Termine anlegen, ändern, löschen),
  VIEWER (nur ansehen). Mitglied wird man nur über eine angenommene Einladung (core/invitations.py).
- Fremde und nicht vorhandene Kalender/Termine sind nicht unterscheidbar (404). Sichtbar, aber nicht änderbar → 403.
- Den Kalender eines Termins ändern darf nur, wer ihn angelegt hat — sonst könnte jemand einen gemeinsamen Termin
  für alle anderen verschwinden lassen.
"""

from django.db import transaction
from django.db.models import Q

from organisation.models import CalendarMember, CalendarShare, EventShare, PersonalEvent, SharedCalendar

MAX_CALENDARS_PER_OWNER = 20
MAX_MEMBERS_PER_CALENDAR = 30
WRITE_ROLES = (CalendarMember.Role.OWNER, CalendarMember.Role.EDITOR)


class CalendarRuleError(Exception):
    def __init__(self, message: str, status: int = 400, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.field = field


NOT_FOUND = 'Diesen Kalender gibt es nicht (mehr).'


def member_calendar_ids(user):
    return CalendarMember.objects.filter(user=user).values('calendar_id')


def writable_calendar_ids(user):
    return CalendarMember.objects.filter(user=user, role__in=WRITE_ROLES).values('calendar_id')


def sharing_owner_ids(user, editors_only: bool = False):
    """Wer seinen Kalender für `user` freigegeben hat (angenommene Freigaben)."""
    shares = CalendarShare.objects.filter(grantee=user)
    if editors_only:
        shares = shares.filter(role=CalendarShare.Role.EDITOR)
    return shares.values('owner_id')


def shared_with_me_ids(user):
    """Termine, die jemand mit `user` geteilt hat — nur solange dessen Freigabe für `user` besteht."""
    return EventShare.objects.filter(user=user, event__owner_id__in=sharing_owner_ids(user)).values('event_id')


def visible_events(user):
    """Eigene private Termine, Termine der Gruppen-Kalender, in denen die Person Mitglied ist, und Termine, die
    jemand über seine Kalenderfreigabe ausdrücklich mit ihr teilt. Nie fremde private Termine."""
    return PersonalEvent.objects.filter(
        Q(owner=user, calendar__isnull=True)
        | Q(calendar_id__in=member_calendar_ids(user))
        | Q(pk__in=shared_with_me_ids(user))
    )


def can_edit_event(user, event: PersonalEvent) -> bool:
    if event.calendar_id is None and event.owner_id == user.pk:
        return True
    if event.calendar_id is not None and CalendarMember.objects.filter(
        calendar_id=event.calendar_id, user=user, role__in=WRITE_ROLES
    ).exists():
        return True
    # Über die Freigabe geteilt und Rolle „Kann bearbeiten“
    return EventShare.objects.filter(event=event, user=user).exists() and CalendarShare.objects.filter(
        owner_id=event.owner_id, grantee=user, role=CalendarShare.Role.EDITOR
    ).exists()


# --------------------------------------------------------------------------- Freigabe des eigenen Kalenders


def grantee_ids(owner) -> set[int]:
    return set(CalendarShare.objects.filter(owner=owner).values_list('grantee_id', flat=True))


def set_audience(user, event: PersonalEvent, user_ids) -> None:
    """Mit wem ein Termin geteilt ist — nur die Person, die ihn angelegt hat, und nur mit Personen, für die ihr
    Kalender freigegeben ist. Ersetzt die bisherige Auswahl."""
    if event.owner_id != user.pk:
        raise CalendarRuleError('Mit wem ein Termin geteilt ist, legt nur fest, wer ihn eingetragen hat.', 403, 'shared_with')
    wanted = set(user_ids)
    if not wanted <= grantee_ids(user):
        raise CalendarRuleError('Mit dieser Person ist dein Kalender nicht geteilt.', field='shared_with')
    EventShare.objects.filter(event=event).exclude(user_id__in=wanted).delete()
    existing = set(EventShare.objects.filter(event=event).values_list('user_id', flat=True))
    EventShare.objects.bulk_create([EventShare(event=event, user_id=pk) for pk in wanted - existing])


@transaction.atomic
def end_share(owner_id: int, grantee_id: int) -> bool:
    """Freigabe beenden (von beiden Seiten möglich): die geteilten Termine verschwinden sofort und vollständig."""
    deleted, _ = CalendarShare.objects.filter(owner_id=owner_id, grantee_id=grantee_id).delete()
    EventShare.objects.filter(event__owner_id=owner_id, user_id=grantee_id).delete()
    return bool(deleted)


def change_share_role(owner, grantee_id: int, role: str) -> None:
    if role not in (CalendarShare.Role.EDITOR, CalendarShare.Role.VIEWER):
        raise CalendarRuleError('Diese Rolle gibt es nicht.', field='role')
    if not CalendarShare.objects.filter(owner=owner, grantee_id=grantee_id).update(role=role):
        raise CalendarRuleError('Dein Kalender ist für diese Person nicht freigegeben.', 404)


def writable_calendar(user, calendar_id: int | None) -> SharedCalendar | None:
    """Kalender, in den die Person Termine schreiben darf; None = privat. Unsichtbar → 404, nur lesend → 403."""
    if calendar_id is None:
        return None
    calendar = SharedCalendar.objects.filter(pk=calendar_id, members__user=user).first()
    if calendar is None:
        raise CalendarRuleError(NOT_FOUND, 404, 'calendar')
    if not CalendarMember.objects.filter(calendar=calendar, user=user, role__in=WRITE_ROLES).exists():
        raise CalendarRuleError('In diesem Kalender kannst du Termine nur ansehen.', 403, 'calendar')
    return calendar


def check_move(user, event: PersonalEvent, new_calendar: SharedCalendar | None) -> None:
    if (event.calendar_id or None) != (new_calendar.pk if new_calendar else None) and event.owner_id != user.pk:
        raise CalendarRuleError('Den Kalender eines Termins kann nur ändern, wer ihn angelegt hat.', 403, 'calendar')


# --------------------------------------------------------------------------- Kalender verwalten


def calendars_for(user):
    return (
        SharedCalendar.objects.filter(members__user=user)
        .prefetch_related('members__user')
        .order_by('name', 'id')
    )


def get_member_calendar(user, calendar_id: int) -> SharedCalendar:
    calendar = SharedCalendar.objects.filter(pk=calendar_id, members__user=user).first()
    if calendar is None:
        raise CalendarRuleError(NOT_FOUND, 404)
    return calendar


def get_owned_calendar(user, calendar_id: int) -> SharedCalendar:
    calendar = get_member_calendar(user, calendar_id)
    if calendar.owner_id != user.pk:
        raise CalendarRuleError('Das darf nur die Person, der der Kalender gehört.', 403)
    return calendar


@transaction.atomic
def create_calendar(user, name: str, color: str) -> SharedCalendar:
    if SharedCalendar.objects.filter(owner=user).count() >= MAX_CALENDARS_PER_OWNER:
        raise CalendarRuleError(f'Du kannst höchstens {MAX_CALENDARS_PER_OWNER} gemeinsame Kalender anlegen.')
    calendar = SharedCalendar.objects.create(owner=user, name=name, color=color)
    CalendarMember.objects.create(calendar=calendar, user=user, role=CalendarMember.Role.OWNER)
    return calendar


@transaction.atomic
def delete_calendar(user, calendar_id: int) -> None:
    """Termine werden wieder private Termine ihrer Ersteller:innen (SET_NULL); offene Einladungen verfallen."""
    calendar = get_owned_calendar(user, calendar_id)
    calendar.delete()  # offene Einladungen zieht core/signals.py zurück


def remove_member(user, calendar_id: int, member_user_id: int) -> None:
    """Besitzer:in entfernt jemanden — oder man tritt selbst aus (member_user_id == user)."""
    calendar = get_member_calendar(user, calendar_id)
    if member_user_id == user.pk:
        if calendar.owner_id == user.pk:
            raise CalendarRuleError('Als Besitzer:in kannst du nicht austreten — lösche den Kalender stattdessen.')
    elif calendar.owner_id != user.pk:
        raise CalendarRuleError('Das darf nur die Person, der der Kalender gehört.', 403)
    deleted, _ = CalendarMember.objects.filter(calendar=calendar, user_id=member_user_id).exclude(
        role=CalendarMember.Role.OWNER
    ).delete()
    if not deleted:
        raise CalendarRuleError('Diese Person ist kein Mitglied.', 404)


def change_role(user, calendar_id: int, member_user_id: int, role: str) -> None:
    calendar = get_owned_calendar(user, calendar_id)
    if role not in (CalendarMember.Role.EDITOR, CalendarMember.Role.VIEWER):
        raise CalendarRuleError('Diese Rolle gibt es nicht.', field='role')
    updated = CalendarMember.objects.filter(calendar=calendar, user_id=member_user_id).exclude(
        role=CalendarMember.Role.OWNER
    ).update(role=role)
    if not updated:
        raise CalendarRuleError('Diese Person ist kein Mitglied.', 404)
