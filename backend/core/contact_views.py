"""Familie & Freunde: Kontakte und Einladungen per E-Mail.

Eine Verbindung teilt nichts. Sie entsteht erst, wenn die eingeladene Person (das Konto mit genau der eingeladenen
E-Mail-Adresse) die Einladung annimmt; danach sehen sich beide mit Name und E-Mail-Adresse — mehr nicht. Geteilt wird
später ausdrücklich pro Reise oder Haushalt (docs/PRODUCT_REQUIREMENTS.md §10)."""

import logging
import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Contact, ContactInvite
from core.throttling import LocalCacheThrottle

logger = logging.getLogger(__name__)


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
    link = f'{settings.FRONTEND_URL}/einladung/{invite.token}'
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


class ContactListView(APIView):
    """Meine Kontakte, meine gesendeten und meine erhaltenen offenen Einladungen."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        contacts = Contact.objects.filter(owner=request.user).select_related('other')
        sent = _open_invites().filter(inviter=request.user).order_by('-created_at')
        return Response(
            {
                'contacts': [_contact_payload(c) for c in contacts],
                'sent': [
                    {'id': i.pk, 'email': i.email, 'relation': i.relation, 'expires_at': i.expires_at} for i in sent
                ],
                'received': [
                    {
                        'token': i.token,
                        'from_name': _display_name(i.inviter),
                        'relation': i.relation,
                        'expires_at': i.expires_at,
                    }
                    for i in _received_for(request.user)
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


def _invite_for(request, token):
    """Nur das Konto mit der eingeladenen E-Mail-Adresse sieht und beantwortet die Einladung (sonst: 404, nichts verraten)."""
    return _received_for(request.user).filter(token=token).first()


class InviteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, token):
        invite = _invite_for(request, token)
        if invite is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(
            {'from_name': _display_name(invite.inviter), 'relation': invite.relation, 'expires_at': invite.expires_at}
        )


class InviteAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        invite = _invite_for(request, token)
        if invite is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            Contact.objects.get_or_create(owner=invite.inviter, other=request.user, defaults={'relation': invite.relation})
            contact, _ = Contact.objects.get_or_create(owner=request.user, other=invite.inviter, defaults={'relation': invite.relation})
            invite.accepted_at = timezone.now()
            invite.save(update_fields=['accepted_at'])
        return Response(_contact_payload(contact), status=status.HTTP_201_CREATED)


class InviteDeclineView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        invite = _invite_for(request, token)
        if invite is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        invite.declined_at = timezone.now()
        invite.save(update_fields=['declined_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)
