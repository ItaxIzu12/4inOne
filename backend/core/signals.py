"""Aufräumen, wenn ein teilbarer Bereich verschwindet.

Einladungen verweisen bewusst ohne Fremdschlüssel auf ihren Bereich (core.models.Invitation › scope_id). Wird eine
Reise oder ein Haushalt gelöscht — direkt oder mit dem Konto —, werden offene Einladungen dorthin sofort
zurückgezogen, statt bis zum Annehmen als scheinbar gültig herumzuliegen.
"""

from django.db.models.signals import post_delete
from django.utils import timezone


def _revoke_open_invitations(scope_type: str):
    def handler(sender, instance, **kwargs):
        from core.models import Invitation

        Invitation.objects.filter(
            scope_type=scope_type, scope_id=instance.pk, status=Invitation.Status.PENDING
        ).update(status=Invitation.Status.REVOKED, responded_at=timezone.now())

    return handler


def connect() -> None:
    from core.models import Household, Invitation
    from reisen.models import Trip

    post_delete.connect(_revoke_open_invitations(Invitation.Scope.HOUSEHOLD), sender=Household, weak=False,
                        dispatch_uid='invitations-household-deleted')
    post_delete.connect(_revoke_open_invitations(Invitation.Scope.TRIP), sender=Trip, weak=False,
                        dispatch_uid='invitations-trip-deleted')
