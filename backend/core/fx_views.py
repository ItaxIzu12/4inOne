from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .currencies import CURRENCIES
from .fx import latest_table


class ExchangeRatesView(APIView):
    """Aktuelle Richtkurse für die Vorschau im Frontend (EUR-Basis, alle unterstützten Währungen) — eine Anfrage pro
    Sitzung statt einer je Tastendruck. Gespeicherte Umrechnungen rechnet das Backend selbst (reisen/serializers.py)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        table = latest_table()
        if table is None:
            return Response({'available': False, 'base': 'EUR', 'rate_date': None, 'rates': {}})
        day, rates = table
        return Response(
            {
                'available': True,
                'base': 'EUR',
                'rate_date': day.isoformat(),
                'source': 'EZB-Referenzkurs',
                'rates': {code: str(rates[code]) for code in CURRENCIES if code in rates},
            }
        )
