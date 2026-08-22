from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from core.permissions import HouseholdScopedPermission
from finanzen.models import Transaction
from finanzen.serializers import TransactionSerializer


class TransactionViewSet(ModelViewSet):
    """Beispielhafte Anwendung von HouseholdScopedPermission
    (ARCHITEKTUR.md §3.2/§4 aus Schritt 4).

    Die Queryset-Filterung unten schränkt zusätzlich die Liste auf die
    eigenen Haushalte ein (verhindert, dass fremde Transaktionen überhaupt
    in einer Listenansicht auftauchen) — HouseholdScopedPermission bleibt
    trotzdem Pflicht, weil sie auch Einzelabrufe über erratene IDs
    (retrieve/update/delete) absichert, die die Queryset-Filterung allein
    nicht abdeckt.
    """

    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, HouseholdScopedPermission]
    household_field = 'account__household'

    def get_queryset(self):
        return Transaction.objects.filter(account__household__members=self.request.user)
