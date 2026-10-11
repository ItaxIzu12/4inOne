"""API für Einladungen und In-App-Benachrichtigungen. Fachlogik: core/invitations.py, Zustellung: core/notifications.py.

Alle Endpunkte arbeiten ausschließlich mit request.user — es gibt keinen Parameter, um fremde Einladungen oder
Benachrichtigungen auszuwählen. Fremde IDs ergeben dieselbe 404 wie nicht existierende.
"""

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core import invitations, notifications
from core.models import Invitation
from core.throttling import LocalCacheThrottle

MAX_ID = 2**63 - 1


class InvitationRateThrottle(LocalCacheThrottle):
    """Begrenzt neue Einladungen je Person (settings: RATE_LIMIT_INVITATION)."""

    scope = 'invitation'

    def get_cache_key(self, request, view):
        if request.method != 'POST':
            return None
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.pk)}


class InvitationCreateSerializer(serializers.Serializer):
    # Nur diese vier Felder werden gelesen; inviter, invitee, status usw. aus dem Request werden ignoriert.
    contact_id = serializers.IntegerField(min_value=1, max_value=MAX_ID)
    scope_type = serializers.ChoiceField(choices=Invitation.Scope.choices)
    scope_id = serializers.IntegerField(min_value=1, max_value=MAX_ID)
    role = serializers.CharField(max_length=12, required=False, allow_blank=True)


def _error(exc: invitations.InvitationError) -> Response:
    body = {exc.field: [exc.message]} if exc.field else {'detail': exc.message}
    return Response(body, status=exc.status)


def _list(user) -> dict:
    received = [p for i in invitations.received_open(user) if (p := invitations.present(i, user))]
    sent = [p for i in invitations.sent_open(user) if (p := invitations.present(i, user))]
    declined = [p for i in invitations.sent_declined(user) if (p := invitations.present(i, user))]
    return {'received': received, 'sent': sent, 'declined': declined}


class InvitationListView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [InvitationRateThrottle]

    def get(self, request):
        return Response(_list(request.user))

    def post(self, request):
        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            invitation, created = invitations.create(
                request.user,
                contact_id=data['contact_id'],
                scope_type=data['scope_type'],
                scope_id=data['scope_id'],
                role=data.get('role') or None,
            )
        except invitations.InvitationError as exc:
            return _error(exc)
        return Response(
            invitations.present(invitation, request.user),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class _InvitationAction(APIView):
    permission_classes = [IsAuthenticated]
    action = ''

    def post(self, request, pk):
        if pk > MAX_ID:
            return Response({'detail': invitations.NOT_FOUND}, status=404)
        try:
            if self.action == 'accept':
                invitation = invitations.accept(request.user, pk)
                payload = invitations.present(invitation, request.user)
                return Response(payload or {'detail': 'Angenommen.'})
            getattr(invitations, self.action)(request.user, pk)
        except invitations.InvitationError as exc:
            return _error(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitationAcceptView(_InvitationAction):
    action = 'accept'


class InvitationDeclineView(_InvitationAction):
    action = 'decline'


class InvitationRevokeView(_InvitationAction):
    action = 'revoke'


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = notifications.for_user(request.user)
        return Response({'unread': sum(1 for item in items if not item['read']), 'items': items})


class NotificationReadView(APIView):
    """Alle eigenen als gelesen markieren (beim Öffnen der Glocke). Ändert keine Einladung."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        notifications.mark_all_read(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
