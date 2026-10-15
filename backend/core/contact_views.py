"""Familie & Freunde: Kontakte und Einladungen per E-Mail.

Eine Verbindung teilt nichts. Sie entsteht erst, wenn die eingeladene Person (das Konto mit genau der eingeladenen
E-Mail-Adresse) die Einladung annimmt; danach sehen sich beide mit Name und E-Mail-Adresse — mehr nicht. Geteilt wird
später ausdrücklich pro Reise oder Haushalt (docs/PRODUCT_REQUIREMENTS.md §10)."""

import logging
import secrets

from allauth.account.models import EmailAddress

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Contact, ContactInvite, HouseholdMembership, Invitation
from core.throttling import LocalCacheThrottle

logger = logging.getLogger(__name__)
DECLINED_VISIBLE = timezone.timedelta(days=14)


class ContactInviteRateThrottle(LocalCacheThrottle):
    """Einladungen pro angemeldetem Nutzer und Stunde begrenzen (kein Spam über unser Mail-Postfach)."""

    scope = 'contact_invite'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.pk)}


def _display_name(user) -> str:
    return user.first_name or user.email.split('@')[0]


def _open_invites():
    return ContactInvite.objects.filter(accepted_at__isnull=True, declined_at__isnull=True, expires_at__gt=timezone.now())


def _received_for(user):
    # Eine selbst eingetragene Adresse ist noch kein Nachweis über das Postfach.
    if not EmailAddress.objects.filter(user=user, email__iexact=user.email, verified=True).exists():
        return _open_invites().none()
    return _open_invites().filter(email__iexact=user.email).select_related('inviter')


def _contact_payload(contact: Contact) -> dict:
    return {
        'id': contact.pk,
        'name': _display_name(contact.other),
        'email': contact.other.email,
        'relation': contact.relation,
        'since': contact.created_at,
    }


def _send_invite_mail(invite: ContactInvite) -> bool:
    # Token im Fragment (#…): wird vom Browser nie an einen Server geschickt, landet also in keinem Zugriffsprotokoll.
    link = f'{settings.FRONTEND_URL}/einladung#{invite.token}'
    name = _display_name(invite.inviter)
    relation = 'Familie' if invite.relation == Contact.Relation.FAMILY else 'Freund:in'
    body = (
        f'Hallo,\n\n{name} möchte dich bei 4inOne als {relation} hinzufügen.\n\n'
        'Mit der Verbindung teilt ihr noch nichts. Ihr seht euch nur mit Namen und E-Mail-Adresse. '
        'Was ihr später teilt, entscheidet ihr jeweils ausdrücklich.\n\n'
        f'Einladung ansehen und annehmen: {link}\n\n'
        f'Der Link gilt {settings.CONTACT_INVITE_EXPIRY_DAYS} Tage. '
        'Kennst du die Person nicht oder willst du das nicht, ignoriere diese E-Mail einfach.\n'
    )
    try:
        send_mail(f'{name} lädt dich zu 4inOne ein', body, settings.DEFAULT_FROM_EMAIL, [invite.email], fail_silently=False)
        return True
    except Exception:  # E-Mail-Server nicht erreichbar o. Ä.: die Einladung bleibt bestehen und ist erneut sendbar
        logger.exception('Einladungs-E-Mail konnte nicht gesendet werden')
        return False


def _shared_by_person(user, people: list) -> tuple[dict, dict, dict]:
    """Was teile ich heute schon mit wem, wozu kann ich die Person einladen, und wozu ist sie schon eingeladen?

    Nur Bereiche, die der anfragende Nutzer selbst sehen darf: gemeinsame Haushalte (beide Mitglied) und Reisen,
    an denen beide beteiligt sind. Einladen nur in den eigenen aktiven Haushalt (als Admin) und in kommende
    Reisen, die der Nutzer verwalten darf — dieselben Regeln wie core/invitations.py."""
    from core.households import active_membership
    from reisen.models import Trip, TripParticipant

    ids = {p.pk for p in people}
    shared: dict[int, list[dict]] = {pk: [] for pk in ids}
    addable: dict[int, list[dict]] = {pk: [] for pk in ids}
    pending: dict[int, list[dict]] = {pk: [] for pk in ids}
    if not ids:
        return shared, addable, pending

    open_invites = {
        (i.invitee_id, i.scope_type, i.scope_id): i.pk
        for i in Invitation.objects.filter(inviter=user, invitee_id__in=ids, status=Invitation.Status.PENDING)
    }

    my_households = HouseholdMembership.objects.filter(user=user).values_list('household_id', flat=True)
    household_members: dict[int, set[int]] = {}
    for m in HouseholdMembership.objects.filter(household_id__in=my_households).select_related('household'):
        household_members.setdefault(m.household_id, set()).add(m.user_id)
        if m.user_id in ids:
            shared[m.user_id].append({'kind': 'HOUSEHOLD', 'id': m.household_id, 'title': m.household.name})
    mine = active_membership(user)
    if mine is not None and mine.role == HouseholdMembership.Role.ADMIN:
        entry = {'kind': 'HOUSEHOLD', 'id': mine.household_id, 'title': mine.household.name}
        for pk in ids - household_members.get(mine.household_id, set()):
            key = (pk, 'HOUSEHOLD', mine.household_id)
            (pending if key in open_invites else addable)[pk].append(
                {**entry, 'invitation_id': open_invites[key]} if key in open_invites else entry
            )

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
        for pk in ids:
            key = (pk, 'TRIP', trip.pk)
            if pk in involved:
                shared[pk].append(entry)
            elif key in open_invites:
                pending[pk].append({**entry, 'invitation_id': open_invites[key]})
            elif manages and trip.end_date >= today:
                addable[pk].append(entry)
    return shared, addable, pending


class ContactListView(APIView):
    """Meine Kontakte, meine gesendeten und meine erhaltenen offenen Einladungen.

    Je Kontakt zusätzlich `shared` (was ihr heute gemeinsam habt), `can_add_to` (wozu ich die Person einladen darf)
    und `invited_to` (offene Einladungen von mir an sie). Daraus entsteht keine Freigabe — nur Bestehendes wird
    sichtbar; eingeladen wird über /invitations/."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        contacts = list(Contact.objects.filter(owner=request.user).select_related('other'))
        shared, addable, pending = _shared_by_person(request.user, [c.other for c in contacts])
        sent = _open_invites().filter(inviter=request.user).order_by('-created_at')
        return Response(
            {
                'contacts': [
                    {
                        **_contact_payload(c),
                        'shared': shared[c.other_id],
                        'can_add_to': addable[c.other_id],
                        'invited_to': pending[c.other_id],
                    }
                    for c in contacts
                ],
                'sent': [
                    {
                        'id': i.pk,
                        'email': i.email,
                        'relation': i.relation,
                        'expires_at': i.expires_at,
                        'created_at': i.created_at,
                    }
                    for i in sent
                ],
                # Abgelehnt wird nicht gemeldet; die einladende Person sieht nur still „Nicht angenommen“ (14 Tage).
                'declined': [
                    {'id': i.pk, 'email': i.email, 'relation': i.relation, 'declined_at': i.declined_at}
                    for i in ContactInvite.objects.filter(
                        inviter=request.user, declined_at__gte=timezone.now() - DECLINED_VISIBLE
                    ).order_by('-declined_at')
                ],
                'received': [
                    {
                        'token': i.token,
                        'from_name': _display_name(i.inviter),
                        'relation': i.relation,
                        'expires_at': i.expires_at,
                        'created_at': i.created_at,
                    }
                    for i in _received_for(request.user).order_by('-created_at')
                ],
            }
        )


class RelationSerializer(serializers.Serializer):
    relation = serializers.ChoiceField(choices=Contact.Relation.choices)


class ContactDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        contact = Contact.objects.filter(owner=request.user, pk=pk).select_related('other').first()
        if contact is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = RelationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact.relation = serializer.validated_data['relation']  # nur die eigene Sicht
        contact.save(update_fields=['relation'])
        return Response(_contact_payload(contact))

    def delete(self, request, pk):
        """Beendet die Verbindung für beide Seiten."""
        contact = Contact.objects.filter(owner=request.user, pk=pk).first()
        if contact is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            Contact.objects.filter(Q(owner=contact.owner, other=contact.other) | Q(owner=contact.other, other=contact.owner)).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    relation = serializers.ChoiceField(choices=Contact.Relation.choices, default=Contact.Relation.FRIEND)


class InviteCreateView(APIView):
    """Lädt eine Person per E-Mail ein. Verrät nicht, ob die Adresse schon ein Konto hat: die Antwort ist immer gleich."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ContactInviteRateThrottle]

    def post(self, request):
        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip()
        relation = serializer.validated_data['relation']
        user = request.user

        if email.lower() == user.email.lower():
            return Response({'email': ['Das ist deine eigene E-Mail-Adresse.']}, status=status.HTTP_400_BAD_REQUEST)
        if Contact.objects.filter(owner=user, other__email__iexact=email).exists():
            return Response({'email': ['Diese Person ist bereits in deinen Kontakten.']}, status=status.HTTP_400_BAD_REQUEST)

        invite = _open_invites().filter(inviter=user, email__iexact=email).first()
        if invite is None:
            invite = ContactInvite.objects.create(
                inviter=user,
                email=email,
                relation=relation,
                token=secrets.token_urlsafe(32),
                expires_at=timezone.now() + timezone.timedelta(days=settings.CONTACT_INVITE_EXPIRY_DAYS),
            )
        elif invite.relation != relation:
            invite.relation = relation
            invite.save(update_fields=['relation'])
        sent = _send_invite_mail(invite)
        return Response({'id': invite.pk, 'email': invite.email, 'email_sent': sent}, status=status.HTTP_201_CREATED)


class InviteCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        invite = _open_invites().filter(pk=pk, inviter=request.user).first()
        if invite is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        invite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _invite_for(request):
    """Nur das Konto mit der eingeladenen E-Mail-Adresse sieht und beantwortet die Einladung (sonst: 404, nichts verraten).

    Das Token kommt im Request-Body, nie in der URL — URLs landen in Zugriffsprotokollen von Server und Proxy."""
    token = request.data.get('token') if hasattr(request, 'data') else None
    if not isinstance(token, str) or not token or len(token) > 128:
        return None
    # Der explizite, zufällige Link aus der E-Mail ist der Postfachnachweis.
    # Niemals an unbestätigte Konten über die Listen-API herausgeben.
    return _open_invites().filter(email__iexact=request.user.email, token=token).select_related('inviter').first()


class InviteDetailView(APIView):
    """Vorschau für die Einladungsseite (POST, damit das Token nicht in der URL steht)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        invite = _invite_for(request)
        if invite is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(
            {'from_name': _display_name(invite.inviter), 'relation': invite.relation, 'expires_at': invite.expires_at}
        )


class InviteAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        invite = _invite_for(request)
        if invite is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            # Atomar verbrauchen: auch parallele Annahmen dürfen nur einmal gelten.
            if not _open_invites().filter(pk=invite.pk).update(accepted_at=timezone.now()):
                return Response(status=status.HTTP_404_NOT_FOUND)
            EmailAddress.objects.update_or_create(
                user=request.user, email=request.user.email,
                defaults={'verified': True, 'primary': True},
            )
            Contact.objects.get_or_create(owner=invite.inviter, other=request.user, defaults={'relation': invite.relation})
            contact, _ = Contact.objects.get_or_create(owner=request.user, other=invite.inviter, defaults={'relation': invite.relation})
            from core import notifications

            notifications.contact_invite_accepted(invite)
        return Response(_contact_payload(contact), status=status.HTTP_201_CREATED)


class InviteDeclineView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        invite = _invite_for(request)
        if invite is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        invite.declined_at = timezone.now()
        invite.save(update_fields=['declined_at'])
        from core import notifications

        notifications.contact_invite_answered(invite)  # keine Meldung an die einladende Person
        return Response(status=status.HTTP_204_NO_CONTENT)
