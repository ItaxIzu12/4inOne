"""In-App-Benachrichtigungen — der Zustellkanal für Einladungen (V1 nur in der App).

core/invitations.py ruft nach jedem fachlichen Ereignis genau eine Funktion hier auf. Ein späterer weiterer Kanal
(z. B. E-Mail) hängt sich an dieselben Funktionen an, ohne die Einladungslogik zu ändern. Bewusst keine Django-
Signals: der Ablauf bleibt in einer Datei nachvollziehbar.
"""

from datetime import timedelta

from django.utils import timezone

from core import invitations
from core.models import Invitation, Notification


def invitation_created(invitation: Invitation) -> None:
    Notification.objects.create(user=invitation.invitee, kind=Notification.Kind.INVITATION_CREATED, invitation=invitation)


def invitation_answered(invitation: Invitation) -> None:
    """Beantwortet oder zurückgezogen: die Benachrichtigung ist erledigt (sie verschwindet aus „offen“)."""
    Notification.objects.filter(invitation=invitation, read_at=None).update(read_at=timezone.now())


# Wie lange eine Annahme-Meldung in der Glocke sichtbar bleibt (danach nur noch in Personen & Gruppen erkennbar).
ACCEPTED_VISIBLE = timedelta(days=7)


def invitation_accepted(invitation: Invitation) -> None:
    """Erfolgsmeldung an die einladende Person. Abgelehnt wird bewusst NICHT gemeldet."""
    if invitation.inviter_id is None:
        return
    Notification.objects.create(
        user_id=invitation.inviter_id, kind=Notification.Kind.INVITATION_ACCEPTED, invitation=invitation
    )


def contact_invite_accepted(invite) -> None:
    Notification.objects.get_or_create(
        user_id=invite.inviter_id, contact_invite=invite, defaults={'kind': Notification.Kind.CONTACT_ACCEPTED}
    )
    contact_invite_answered(invite)


def contact_invite_answered(invite) -> None:
    """Die Kontaktanfrage der eingeladenen Person ist erledigt (angenommen oder abgelehnt)."""
    Notification.objects.filter(
        contact_invite=invite, kind=Notification.Kind.CONTACT_INVITE, read_at=None
    ).update(read_at=timezone.now())


def _accepted(user) -> list[dict]:
    """Annahmen der letzten Tage für die einladende Person — nur Namen von Personen, die sie selbst eingeladen hat."""
    from core.contact_views import _display_name
    from core.models import Contact

    since = timezone.now() - ACCEPTED_VISIBLE
    rows = Notification.objects.filter(
        user=user, kind__in=[Notification.Kind.CONTACT_ACCEPTED, Notification.Kind.INVITATION_ACCEPTED],
        created_at__gte=since,
    ).select_related('contact_invite', 'invitation__invitee')
    result = []
    for row in rows:
        base = {'id': row.pk, 'kind': row.kind, 'read': row.read_at is not None, 'created_at': row.created_at}
        if row.kind == Notification.Kind.CONTACT_ACCEPTED and row.contact_invite is not None:
            contact = Contact.objects.filter(
                owner=user, other__email__iexact=row.contact_invite.email
            ).select_related('other').first()
            if contact is None:  # Verbindung inzwischen beendet
                continue
            result.append({**base, 'accepted': {
                'name': _display_name(contact.other),
                'relation_label': 'Familie' if contact.relation == 'FAMILY' else 'Freund:in',
            }})
        elif row.kind == Notification.Kind.INVITATION_ACCEPTED and row.invitation is not None:
            payload = invitations.present(row.invitation, user)
            if payload is None:  # Bereich gelöscht
                continue
            result.append({**base, 'accepted': {
                'name': payload['invitee']['display_name'],
                'scope': {k: payload['scope'][k] for k in ('type', 'id', 'display_name')},
            }})
    return result


def _contact_invites(user) -> list[dict]:
    """Kontakt-Einladungen an die (bestätigte!) Adresse dieser Person. `_received_for` liefert für unbestätigte
    Adressen nichts — sonst könnte jemand mit fremder Adresse fremde Einladungen sehen."""
    from core.contact_views import _display_name, _received_for

    result = []
    for invite in _received_for(user):
        row, _ = Notification.objects.get_or_create(
            user=user, contact_invite=invite, defaults={'kind': Notification.Kind.CONTACT_INVITE}
        )
        result.append({
            'id': row.pk,
            'kind': row.kind,
            'read': row.read_at is not None,
            'created_at': invite.created_at,
            'contact_invite': {
                'token': invite.token,
                'from_name': _display_name(invite.inviter),
                'relation': invite.relation,
                'relation_label': 'Familie' if invite.relation == 'FAMILY' else 'Freund:in',
            },
        })
    return result


def for_user(user) -> list[dict]:
    """Nur eigene Benachrichtigungen, und nur solange die Einladung für diese Person noch offen ist."""
    open_ids = set(invitations.received_open(user).values_list('pk', flat=True))
    rows = (
        Notification.objects.filter(user=user, invitation_id__in=open_ids, kind=Notification.Kind.INVITATION_CREATED)
        .select_related('invitation__inviter')
        .order_by('-created_at', '-id')
    )
    result = _contact_invites(user) + _accepted(user)
    for row in rows:
        payload = invitations.present(row.invitation, user)
        if payload is None:
            continue
        result.append(
            {'id': row.pk, 'kind': row.kind, 'read': row.read_at is not None, 'created_at': row.created_at,
             'invitation': payload}
        )
    return sorted(result, key=lambda item: item['created_at'], reverse=True)


def mark_all_read(user) -> int:
    return Notification.objects.filter(user=user, read_at=None).update(read_at=timezone.now())
