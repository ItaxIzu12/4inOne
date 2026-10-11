"""Mitglieder des aktiven Haushalts ansehen, verlassen und (als Admin) entfernen.

Einladen läuft über core/invitations.py (In-App-Einladung an einen eigenen Kontakt). Eine entfernte Person verliert
die Mitgliedschaft; eine alte angenommene Einladung reaktiviert nichts — für eine Rückkehr braucht es eine neue.
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.households import active_membership, own_membership
from core.invitations import display_name
from core.models import HouseholdMembership

ROLE_LABEL = {'ADMIN': 'Verwaltet', 'MEMBER': 'Mitglied', 'CHILD_ACCOUNT': 'Kind-Konto'}


class HouseholdMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        mine = active_membership(request.user)
        if mine is None:
            return Response({'household': None, 'members': [], 'can_invite': False, 'can_leave': False})
        own = own_membership(request.user)
        members = HouseholdMembership.objects.filter(household=mine.household).select_related('user').order_by('id')
        is_admin = mine.role == HouseholdMembership.Role.ADMIN
        return Response(
            {
                'household': {'id': mine.household_id, 'name': mine.household.name},
                'members': [
                    {
                        'id': m.pk,
                        'name': display_name(m.user),
                        'role': m.role,
                        'role_label': ROLE_LABEL.get(m.role, m.role),
                        'is_self': m.user_id == request.user.pk,
                        'can_remove': is_admin and m.user_id != request.user.pk and m.role != HouseholdMembership.Role.ADMIN,
                    }
                    for m in members
                ],
                'can_invite': is_admin,
                # Den eigenen (bei der Registrierung angelegten) Haushalt verlässt man nicht — nur einen beigetretenen.
                'can_leave': own is not None and own.pk != mine.pk,
            }
        )


class HouseholdMemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        mine = active_membership(request.user)
        target = (
            HouseholdMembership.objects.filter(pk=pk, household=mine.household).first() if mine is not None else None
        )
        if target is None:
            return Response({'detail': 'Nicht gefunden.'}, status=404)
        if target.user_id == request.user.pk:
            own = own_membership(request.user)
            if own is None or own.pk == target.pk:
                return Response({'detail': 'Deinen eigenen Haushalt kannst du nicht verlassen.'}, status=400)
        elif mine.role != HouseholdMembership.Role.ADMIN or target.role == HouseholdMembership.Role.ADMIN:
            return Response({'detail': 'Dafür fehlt dir die Berechtigung.'}, status=403)
        target.delete()
        return Response(status=204)
