from rest_framework.permissions import BasePermission

from core.models import HouseholdMembership


class HouseholdScopedPermission(BasePermission):
    """Object-Level-Authorization für haushaltsgebundene Daten.

    ARCHITEKTUR.md §3.2 markiert fehlende Object-Level-Authorization als die
    bisher größte Sicherheitslücke des Konzepts: Es reicht NICHT, nur zu
    prüfen, ob ein Nutzer eingeloggt ist (IsAuthenticated) — zusätzlich muss
    für JEDEN Endpunkt, der eine ID entgegennimmt, geprüft werden, ob das
    angefragte Objekt tatsächlich zu einem Haushalt gehört, in dem dieser
    Nutzer Mitglied ist. Sonst kann ein Angreifer fremde Haushaltsdaten
    einfach über erratene/durchprobierte IDs abrufen (IDOR / Broken Object
    Level Authorization, OWASP API Security Top 10 #1).

    JEDE neue View, die Haushaltsdaten zurückgibt oder verändert, MUSS diese
    Permission-Klasse in permission_classes einbinden (zusammen mit
    IsAuthenticated) — implizite Queryset-Filterung allein reicht nicht,
    weil sie bei neuen Endpunkten leicht vergessen wird. Diese Klasse ist
    der einzige Ort, an dem diese Prüfung implementiert ist; neue Module
    sollen sie wiederverwenden statt sie erneut zu implementieren.

    Erwartet, dass das Objekt entweder direkt ein `household`-Attribut hat
    (z. B. Account, ShoppingList, CalendarEvent) oder das Attribut über eine
    Relation erreichbar ist (z. B. Transaction.account.household) — dafür
    `household_field` auf dem View mit einem doppelt-unterstrichenen Pfad
    überschreiben (z. B. `household_field = 'account__household'`).
    """

    default_household_field = 'household'

    def has_object_permission(self, request, view, obj) -> bool:
        household_field = getattr(view, 'household_field', self.default_household_field)
        household = obj
        for part in household_field.split('__'):
            household = getattr(household, part, None)
            if household is None:
                return False

        return HouseholdMembership.objects.filter(
            user=request.user, household=household
        ).exists()
