from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import TripParticipant

WRITABLE_ROLES = (TripParticipant.Role.OWNER, TripParticipant.Role.EDITOR)


class TripAccessPermission(BasePermission):
    """Objekt-Berechtigung für eine Trip-Instanz selbst (nicht ihren Inhalt, siehe TripContentAccessPermission).

    Lesen dürfen der Ersteller (Trip.owner) und alle Teilnehmer. Die Reise selbst bearbeiten oder löschen darf
    nur der Ersteller oder ein Teilnehmer mit Rolle OWNER — eine EDITOR/VIEWER-Mitgliedschaft reicht dafür nicht,
    sonst könnte jede Mitreisende das Datum oder den Titel der Reise ändern."""

    def has_object_permission(self, request, view, trip) -> bool:
        if trip.owner_id == request.user.id:
            return True
        participant = TripParticipant.objects.filter(trip=trip, user=request.user).first()
        if participant is None:
            return False
        if request.method in SAFE_METHODS:
            return True
        return participant.role == TripParticipant.Role.OWNER


class TripContentAccessPermission(BasePermission):
    """Objekt-Berechtigung für alles, was zu einer Reise gehört (Packliste/Aufgaben/Budget/Ausgaben/Termine).

    Lesen dürfen Ersteller und alle Teilnehmer. Schreiben dürfen Ersteller und Teilnehmer mit Rolle OWNER/EDITOR
    — eine reine VIEWER-Mitgliedschaft darf eine geteilte Reise ansehen, aber nichts daran ändern. Mitgliedschaft
    in EINER Reise gewährt nie Zugriff auf andere Reisen, Finanzen, Haushalt oder Organisation derselben Person
    (siehe AGENTS.md Privacy-Prinzipien) — diese Klasse prüft ausschließlich gegen trip.owner/trip.participants."""

    def has_object_permission(self, request, view, obj) -> bool:
        trip = obj.trip
        if trip.owner_id == request.user.id:
            return True
        participant = TripParticipant.objects.filter(trip=trip, user=request.user).first()
        if participant is None:
            return False
        if request.method in SAFE_METHODS:
            return True
        return participant.role in WRITABLE_ROLES


class TripParticipantManagePermission(BasePermission):
    """Teilnehmer verwalten (hinzufügen/Rolle ändern/entfernen) dürfen nur der Ersteller oder ein Teilnehmer mit
    Rolle OWNER — AUSSER eine Person entfernt sich selbst ("die Reise verlassen"), das darf jeder Teilnehmer
    unabhängig von seiner Rolle, sonst gäbe es keinen Ausweg aus einer geteilten Reise."""

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        if request.method == 'DELETE' and obj.user_id == request.user.id:
            return True
        if obj.trip.owner_id == request.user.id:
            return True
        return TripParticipant.objects.filter(
            trip=obj.trip, user=request.user, role=TripParticipant.Role.OWNER
        ).exists()
