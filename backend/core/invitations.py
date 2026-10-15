"""Einladungen in teilbare Bereiche (V1: Haushalt und Reise) — die gesamte Fachlogik an einem Ort.

Grundregeln (docs/AUTH_AND_PERMISSIONS.md › Einladungen):
- Eine offene Einladung gibt keinerlei Zugriff. Erst `accept()` legt die Mitgliedschaft an, atomar mit dem
  Statuswechsel, und nur für genau den eingeladenen Bereich.
- Bereiche und Rollen kommen aus einer serverseitigen Allowlist (SCOPES). Der Client bestimmt weder einladende
  Person noch Status; die eingeladene Person kommt ausschließlich aus den eigenen Kontakten.
- Zustandswechsel sind bedingte UPDATEs (`status=PENDING` in der WHERE-Klausel): bei Doppelklick oder
  gleichzeitigem Annehmen/Ablehnen gewinnt genau einer, ohne IntegrityError.
- Beim Annehmen wird der AKTUELLE Stand geprüft (Bereich existiert, einladende Person darf noch einladen, Rolle
  noch erlaubt) — nie blind der Stand vom Zeitpunkt der Einladung.

Zustellung (In-App) liegt in core/notifications.py; diese Datei kennt keinen Kanal.
"""

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Callable

from django.db import IntegrityError, transaction
from django.utils import timezone

from core.models import Contact, HouseholdMembership, Invitation

logger = logging.getLogger(__name__)

INVITATION_LIFETIME = timedelta(days=14)
_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober',
           'November', 'Dezember']


class InvitationError(Exception):
    """Fachlicher Fehler mit verständlicher Meldung; `status` für die API (400 oder 404)."""

    def __init__(self, message: str, status: int = 400, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.field = field


NOT_FOUND = 'Diese Einladung gibt es nicht (mehr).'
NO_LONGER_VALID = 'Diese Einladung ist nicht mehr gültig.'


def display_name(user) -> str:
    return user.first_name or user.email.split('@')[0]


def _range(start: date, end: date) -> str:
    if start == end:
        return f'{start.day}. {_MONTHS[start.month - 1]} {start.year}'
    if (start.year, start.month) == (end.year, end.month):
        return f'{start.day}.–{end.day}. {_MONTHS[end.month - 1]} {end.year}'
    return f'{start.day}. {_MONTHS[start.month - 1]} – {end.day}. {_MONTHS[end.month - 1]} {end.year}'


# --------------------------------------------------------------------------- Bereiche (Allowlist)


@dataclass(frozen=True)
class Scope:
    roles: dict[str, str]  # erlaubte Rolle → Anzeige
    default_role: str
    load: Callable[[int], Any]  # Bereich laden oder None
    title: Callable[[Any], str]
    detail: Callable[[Any], str]
    can_invite: Callable[[Any, Any], bool]  # (user, bereich)
    is_member: Callable[[Any, Any], bool]
    add_member: Callable[[Any, Any, str], None]


def _household_scope() -> Scope:
    from core.models import Household

    def can_invite(user, household) -> bool:
        return HouseholdMembership.objects.filter(
            user=user, household=household, role=HouseholdMembership.Role.ADMIN
        ).exists()

    def add(user, household, role):
        HouseholdMembership.objects.create(user=user, household=household, role=role)

    return Scope(
        roles={HouseholdMembership.Role.MEMBER: 'Mitglied'},
        default_role=HouseholdMembership.Role.MEMBER,
        load=lambda pk: Household.objects.filter(pk=pk).first(),
        title=lambda household: household.name,
        detail=lambda household: 'Haushalt',
        can_invite=can_invite,
        is_member=lambda user, household: HouseholdMembership.objects.filter(user=user, household=household).exists(),
        add_member=add,
    )


def _trip_scope() -> Scope:
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
        detail=lambda trip: _range(trip.start_date, trip.end_date),
        can_invite=can_invite,
        is_member=lambda user, trip: trip.owner_id == user.pk
        or TripParticipant.objects.filter(trip=trip, user=user).exists(),
        add_member=add,
    )


_SCOPES: dict[str, Callable[[], Scope]] = {
    Invitation.Scope.HOUSEHOLD: _household_scope,
    Invitation.Scope.TRIP: _trip_scope,
}


def scope_for(scope_type: str) -> Scope:
    factory = _SCOPES.get(scope_type)
    if factory is None:
        raise InvitationError('Dorthin kann man nicht einladen.', field='scope_type')
    return factory()


# --------------------------------------------------------------------------- Darstellung


def present(invitation: Invitation, viewer) -> dict | None:
    """Nur, was die Person für ihre Entscheidung braucht — keine E-Mail-Adressen, keine fremden Mitgliedschaften.
    None, wenn der Bereich nicht mehr existiert (die Einladung ist dann ohnehin nicht mehr annehmbar)."""
    scope = scope_for(invitation.scope_type)
    target = scope.load(invitation.scope_id)
    if target is None or not _may_see_scope(invitation, scope, target, viewer):
        return None
    data = {
        'id': invitation.pk,
        'scope': {
            'type': invitation.scope_type,
            'id': invitation.scope_id,
            'display_name': scope.title(target),
            'detail': scope.detail(target),
        },
        'role': invitation.role,
        'role_label': scope.roles.get(invitation.role, invitation.role),
        'status': invitation.status,
        'created_at': invitation.created_at,
        'expires_at': invitation.expires_at,
    }
    if invitation.invitee_id == viewer.pk:
        data['inviter'] = {'display_name': display_name(invitation.inviter) if invitation.inviter else ''}
    else:
        data['invitee'] = {'display_name': display_name(invitation.invitee)}
    return data


def _may_see_scope(invitation: Invitation, scope: Scope, target, viewer) -> bool:
    """Name und Zeitraum eines Bereichs sieht nur, wer gerade wirklich dazu berechtigt ist — nicht, wer es beim
    Einladen einmal war (Rechte gelten sofort, auch für alte Einladungen und Benachrichtigungen):

    - eingeladene Person, offene Einladung: nur solange die einladende Person noch einladen darf (sonst wäre die
      Einladung ohnehin nicht mehr annehmbar);
    - eingeladene Person, sonst: nur als Mitglied;
    - einladende Person: nur solange sie selbst noch Mitglied ist."""
    if invitation.invitee_id == viewer.pk:
        if invitation.status == Invitation.Status.PENDING:
            return invitation.inviter is not None and scope.can_invite(invitation.inviter, target)
        return scope.is_member(viewer, target)
    return invitation.inviter_id == viewer.pk and scope.is_member(viewer, target)


def received_open(user):
    """Offene, noch gültige Einladungen an `user` (ohne gelöschte einladende Person, ohne abgelaufene)."""
    return (
        Invitation.objects.filter(invitee=user, status=Invitation.Status.PENDING, expires_at__gt=timezone.now())
        .exclude(inviter=None)
        .select_related('inviter')
    )


def sent_declined(user, days: int = 14):
    """Abgelehnt wird nicht gemeldet; die einladende Person sieht still „Nicht angenommen“ (zeitlich begrenzt)."""
    return Invitation.objects.filter(
        inviter=user, status=Invitation.Status.DECLINED, responded_at__gte=timezone.now() - timedelta(days=days)
    ).select_related('invitee')


def sent_open(user):
    return Invitation.objects.filter(
        inviter=user, status=Invitation.Status.PENDING, expires_at__gt=timezone.now()
    ).select_related('invitee')


# --------------------------------------------------------------------------- Zustandswechsel


def create(inviter, *, contact_id: int, scope_type: str, scope_id: int, role: str | None = None) -> tuple[Invitation, bool]:
    """Lädt einen eigenen Kontakt in einen Bereich ein, den `inviter` verwalten darf.

    Gibt (Einladung, neu?) zurück. Eine bereits offene Einladung für dieselbe Person und denselben Bereich wird
    wiederverwendet — keine zweite Anfrage, keine zweite Benachrichtigung."""
    scope = scope_for(scope_type)
    role = role or scope.default_role
    if role not in scope.roles:
        raise InvitationError('Diese Rolle gibt es hier nicht.', field='role')

    contact = Contact.objects.filter(owner=inviter, pk=contact_id).select_related('other').first()
    if contact is None:
        raise InvitationError('Bitte wähle eine Person aus deinen Kontakten.', field='contact_id')
    invitee = contact.other
    if invitee.pk == inviter.pk:  # durch Contact ausgeschlossen, hier trotzdem ausdrücklich
        raise InvitationError('Du kannst dich nicht selbst einladen.', field='contact_id')

    target = scope.load(scope_id)
    # Fremder oder nicht verwaltbarer Bereich: dieselbe Antwort wie „gibt es nicht“ — verrät nichts über fremde IDs.
    if target is None or not scope.can_invite(inviter, target):
        raise InvitationError('Nicht gefunden.', status=404)
    if scope.is_member(invitee, target):
        raise InvitationError(f'{display_name(invitee)} ist bereits dabei.', field='contact_id')

    existing = Invitation.objects.filter(
        invitee=invitee, scope_type=scope_type, scope_id=target.pk, status=Invitation.Status.PENDING
    ).first()
    if existing is not None:
        return existing, False
    try:
        with transaction.atomic():
            invitation = Invitation.objects.create(
                inviter=inviter,
                invitee=invitee,
                scope_type=scope_type,
                scope_id=target.pk,
                role=role,
                expires_at=timezone.now() + INVITATION_LIFETIME,
            )
    except IntegrityError:  # gleichzeitig zweimal gesendet: die andere Anfrage hat gewonnen
        return Invitation.objects.get(
            invitee=invitee, scope_type=scope_type, scope_id=target.pk, status=Invitation.Status.PENDING
        ), False

    from core import notifications

    notifications.invitation_created(invitation)
    return invitation, True


def _finish(pk: int, status: str, **who) -> int:
    return Invitation.objects.filter(pk=pk, status=Invitation.Status.PENDING, **who).update(
        status=status, responded_at=timezone.now()
    )


def accept(user, invitation_id: int) -> Invitation:
    """Annehmen: alles neu prüfen, dann Statuswechsel und Mitgliedschaft in EINER Transaktion."""
    invitation = Invitation.objects.filter(pk=invitation_id, invitee=user).select_related('inviter').first()
    if invitation is None:
        raise InvitationError(NOT_FOUND, status=404)
    if invitation.status == Invitation.Status.ACCEPTED:
        return invitation  # Doppelklick: schon erledigt, keine zweite Mitgliedschaft
    if invitation.status != Invitation.Status.PENDING:
        raise InvitationError(NO_LONGER_VALID)

    scope = scope_for(invitation.scope_type)
    target = scope.load(invitation.scope_id)
    still_valid = (
        invitation.expires_at > timezone.now()
        and invitation.inviter is not None
        and target is not None
        and invitation.role in scope.roles
        and scope.can_invite(invitation.inviter, target)
    )
    if not still_valid:
        _finish(invitation.pk, Invitation.Status.REVOKED, invitee=user)
        raise InvitationError(NO_LONGER_VALID)

    with transaction.atomic():
        if not _finish(invitation.pk, Invitation.Status.ACCEPTED, invitee=user):
            invitation.refresh_from_db()
            if invitation.status == Invitation.Status.ACCEPTED:
                return invitation
            raise InvitationError(NO_LONGER_VALID)
        if not scope.is_member(user, target):
            try:
                with transaction.atomic():
                    scope.add_member(user, target, invitation.role)
            except IntegrityError:
                pass  # parallel schon Mitglied geworden — Unique-Constraint verhindert die doppelte Zeile
    invitation.refresh_from_db()
    from core import notifications

    notifications.invitation_answered(invitation)
    notifications.invitation_accepted(invitation)
    return invitation


def decline(user, invitation_id: int) -> None:
    if not Invitation.objects.filter(pk=invitation_id, invitee=user).exists():
        raise InvitationError(NOT_FOUND, status=404)
    if not _finish(invitation_id, Invitation.Status.DECLINED, invitee=user):
        raise InvitationError(NO_LONGER_VALID)
    from core import notifications

    notifications.invitation_answered(Invitation.objects.get(pk=invitation_id))


def revoke(user, invitation_id: int) -> None:
    if not Invitation.objects.filter(pk=invitation_id, inviter=user).exists():
        raise InvitationError(NOT_FOUND, status=404)
    if not _finish(invitation_id, Invitation.Status.REVOKED, inviter=user):
        raise InvitationError(NO_LONGER_VALID)
    from core import notifications

    notifications.invitation_answered(Invitation.objects.get(pk=invitation_id))
