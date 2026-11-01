"""API der gemeinsamen Kalender (31.10.2026). Alle Regeln in organisation/calendars.py; hier nur Ein- und Ausgabe.

GET    /organisation/calendars/                      meine Kalender (Mitglied), mit Mitgliedern und meiner Rolle
POST   /organisation/calendars/                      neuen Kalender anlegen {name, color} — ich bin Besitzer:in
PATCH  /organisation/calendars/{id}/                 umbenennen / Farbe (nur Besitzer:in)
DELETE /organisation/calendars/{id}/                 löschen (nur Besitzer:in) — Termine werden wieder privat
DELETE /organisation/calendars/{id}/members/{user}/  Mitglied entfernen (Besitzer:in) oder selbst austreten
PATCH  /organisation/calendars/{id}/members/{user}/  Rolle ändern {role: EDITOR|VIEWER} (nur Besitzer:in)

Eingeladen wird über die bestehende Einladungs-API (scope_type=CALENDAR) — nur Personen aus den eigenen Kontakten.
"""

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.invitations import display_name
from core.models import Invitation
from organisation import calendars
from organisation.models import CalendarColor, CalendarMember

MAX_ID = 2**63 - 1


class CalendarInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60)
    color = serializers.ChoiceField(choices=CalendarColor.choices, required=False)

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Bitte gib dem Kalender einen Namen.')
        return value


class RoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[CalendarMember.Role.EDITOR, CalendarMember.Role.VIEWER])


def present(calendar, viewer) -> dict:
    members = list(calendar.members.all())
    mine = next((m for m in members if m.user_id == viewer.pk), None)
    data = {
        'id': calendar.pk,
        'name': calendar.name,
        'color': calendar.color,
        'role': mine.role if mine else CalendarMember.Role.VIEWER,
        'is_owner': calendar.owner_id == viewer.pk,
        # Nur Anzeigenamen der Mitglieder dieses Kalenders — keine E-Mail-Adressen.
        'members': [
            {'user_id': m.user_id, 'name': display_name(m.user), 'role': m.role, 'is_self': m.user_id == viewer.pk}
            for m in members
        ],
    }
    if data['is_owner']:
        data['pending'] = [
            {'invitation_id': i.pk, 'name': display_name(i.invitee), 'role': i.role}
            for i in Invitation.objects.filter(
                scope_type=Invitation.Scope.CALENDAR, scope_id=calendar.pk, status=Invitation.Status.PENDING
            ).select_related('invitee')
        ]
    return data


class _CalendarView(APIView):
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        for name in ('pk', 'user_id'):
            if name in kwargs and kwargs[name] > MAX_ID:
                raise calendars.CalendarRuleError(calendars.NOT_FOUND, 404)

    def handle_exception(self, exc):
        if isinstance(exc, calendars.CalendarRuleError):
            body = {exc.field: [exc.message]} if exc.field else {'detail': exc.message}
            return Response(body, status=exc.status)
        return super().handle_exception(exc)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class CalendarListView(_CalendarView):
    def get(self, request):
        return Response([present(c, request.user) for c in calendars.calendars_for(request.user)])

    def post(self, request):
        body = CalendarInputSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        calendar = calendars.create_calendar(
            request.user, body.validated_data['name'], body.validated_data.get('color', CalendarColor.AMBER)
        )
        calendar = calendars.calendars_for(request.user).get(pk=calendar.pk)
        return Response(present(calendar, request.user), status=status.HTTP_201_CREATED)


class CalendarDetailView(_CalendarView):
    def patch(self, request, pk):
        calendar = calendars.get_owned_calendar(request.user, pk)
        body = CalendarInputSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        for field in ('name', 'color'):
            if field in body.validated_data:
                setattr(calendar, field, body.validated_data[field])
        calendar.save(update_fields=['name', 'color'])
        return Response(present(calendars.calendars_for(request.user).get(pk=pk), request.user))

    def delete(self, request, pk):
        calendars.delete_calendar(request.user, pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CalendarMemberView(_CalendarView):
    def delete(self, request, pk, user_id):
        calendars.remove_member(request.user, pk, user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk, user_id):
        body = RoleSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        calendars.change_role(request.user, pk, user_id, body.validated_data['role'])
        return Response(present(calendars.calendars_for(request.user).get(pk=pk), request.user))


# --------------------------------------------------------------------------- Freigabe des eigenen Kalenders


def _shares(user) -> dict:
    from organisation.models import CalendarShare

    given = CalendarShare.objects.filter(owner=user).select_related('grantee')
    received = CalendarShare.objects.filter(grantee=user).select_related('owner')
    pending = Invitation.objects.filter(
        inviter=user, scope_type=Invitation.Scope.MY_CALENDAR, scope_id=user.pk, status=Invitation.Status.PENDING
    ).select_related('invitee')
    return {
        # Das eigene Konto als Bereich für Einladungen (scope_id) — nur die eigene ID, nie eine fremde.
        'owner_id': user.pk,
        'given': [{'user_id': s.grantee_id, 'name': display_name(s.grantee), 'role': s.role} for s in given],
        'received': [{'user_id': s.owner_id, 'name': display_name(s.owner), 'role': s.role} for s in received],
        'pending': [{'invitation_id': i.pk, 'name': display_name(i.invitee), 'role': i.role} for i in pending],
    }


class ShareListView(_CalendarView):
    """GET /organisation/shares/ — für wen mein Kalender freigegeben ist, wer seinen für mich freigegeben hat, offene
    Freigabe-Einladungen. Freigeben selbst läuft über die Einladungs-API (scope_type=MY_CALENDAR, scope_id=owner_id)."""

    def get(self, request):
        return Response(_shares(request.user))


class ShareGivenView(_CalendarView):
    """PATCH Rolle ändern · DELETE Freigabe für diese Person beenden (geteilte Termine verschwinden sofort)."""

    def patch(self, request, user_id):
        body = RoleSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        calendars.change_share_role(request.user, user_id, body.validated_data['role'])
        return Response(_shares(request.user))

    def delete(self, request, user_id):
        if not calendars.end_share(request.user.pk, user_id):
            raise calendars.CalendarRuleError('Dein Kalender ist für diese Person nicht freigegeben.', 404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ShareReceivedView(_CalendarView):
    """DELETE — den für mich freigegebenen Kalender dieser Person nicht mehr sehen."""

    def delete(self, request, user_id):
        if not calendars.end_share(user_id, request.user.pk):
            raise calendars.CalendarRuleError('Diese Freigabe gibt es nicht (mehr).', 404)
        return Response(status=status.HTTP_204_NO_CONTENT)
