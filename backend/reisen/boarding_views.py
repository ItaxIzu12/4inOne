"""Bordkarten-API (Schritt 1): nur die eigene Person sieht und verwaltet ihre Bordkarten, nur für Reisen, die sie
sehen darf.

GET    /api/v1/reisen/boarding-passes/?trip=<id>   eigene Bordkarten dieser Reise (mit entschlüsseltem Code)
POST   /api/v1/reisen/boarding-passes/             multipart `file` + `trip` – Wallet-Datei (.pkpass), Screenshot oder PDF
                                                   (Art am Inhalt erkannt) –, oder JSON {trip, format, message}
DELETE /api/v1/reisen/boarding-passes/<id>/
"""

from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import LocalCacheThrottle
from reisen import boarding
from reisen.models import BoardingPass
from reisen.views import trips_visible_to

MAX_ID = 2_147_483_647
MAX_PER_TRIP = 20


class BoardingPassWriteThrottle(LocalCacheThrottle):
    scope = 'boarding_pass'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.pk)}


class CodeInput(serializers.Serializer):
    trip = serializers.IntegerField(min_value=1, max_value=MAX_ID)
    format = serializers.ChoiceField(choices=boarding.FORMATS)
    message = serializers.CharField(max_length=boarding.MAX_MESSAGE, trim_whitespace=False)


def present(bp: BoardingPass) -> dict:
    return {
        'id': bp.pk, 'trip': bp.trip_id, 'format': bp.barcode_format, 'message': boarding.decrypt(bp.barcode_ciphertext),
        'source': bp.source, 'passenger_name': bp.passenger_name, 'pnr_hint': bp.pnr_hint, 'airline_name': bp.airline_name,
        'flight_number': bp.flight_number, 'from_code': bp.from_code, 'from_name': bp.from_name, 'to_code': bp.to_code,
        'to_name': bp.to_name, 'flight_date': bp.flight_date.isoformat() if bp.flight_date else None,
        'boarding_time': bp.boarding_time, 'departure_time': bp.departure_time, 'gate': bp.gate, 'seat': bp.seat,
        'group': bp.group, 'sequence': bp.sequence,
    }


class _View(APIView):
    permission_classes = [IsAuthenticated]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class BoardingPassListView(_View):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_throttles(self):
        return [BoardingPassWriteThrottle()] if self.request.method == 'POST' else []

    def _trip(self, request, raw):
        try:
            trip_id = int(raw)
        except (TypeError, ValueError):
            return None
        if not 1 <= trip_id <= MAX_ID:
            return None
        return trips_visible_to(request.user).filter(pk=trip_id).first()

    def get(self, request):
        trip = self._trip(request, request.query_params.get('trip'))
        if trip is None:
            return Response({'detail': 'Reise nicht gefunden.'}, status=404)
        return Response([present(bp) for bp in BoardingPass.objects.filter(owner=request.user, trip=trip)])

    def post(self, request):
        upload = request.FILES.get('file')
        trip = self._trip(request, request.data.get('trip'))
        if trip is None:
            return Response({'detail': 'Reise nicht gefunden.'}, status=404)
        if BoardingPass.objects.filter(owner=request.user, trip=trip).count() >= MAX_PER_TRIP:
            return Response({'detail': f'Höchstens {MAX_PER_TRIP} Bordkarten je Reise.'}, status=400)
        try:
            if upload is not None:
                if upload.size > boarding.MAX_SCAN_BYTES:
                    raise boarding.BoardingPassError('Die Datei ist zu groß (höchstens 10 MB).')
                raw = upload.read()
                if raw[:4] == b'PK\x03\x04' or upload.name.lower().endswith('.pkpass'):  # ZIP = Wallet-Datei
                    fmt, message, data = boarding.parse_pkpass(raw)
                    source = 'pkpass'
                else:  # Screenshot oder PDF: Code lesen, Bild/PDF selbst wird nicht gespeichert
                    fmt, message = boarding.read_code(raw)
                    data = boarding.parse_bcbp(message) or boarding.PassData()
                    source = 'image'
            else:
                body = CodeInput(data=request.data)
                body.is_valid(raise_exception=True)
                fmt, message = body.validated_data['format'], body.validated_data['message']
                data = boarding.parse_bcbp(message) or boarding.PassData()
                source = 'image'
        except boarding.BoardingPassError as error:
            return Response({'detail': str(error)}, status=400)
        bp = BoardingPass.objects.create(
            owner=request.user, trip=trip, barcode_format=fmt, barcode_ciphertext=boarding.encrypt(message), source=source,
            passenger_name=data.passenger_name[:60], pnr_hint=boarding.masked_pnr(data.pnr), airline_name=data.airline_name[:60],
            flight_number=data.flight_number[:12], from_code=data.from_code[:3], from_name=data.from_name[:60],
            to_code=data.to_code[:3], to_name=data.to_name[:60], flight_date=data.flight_date,
            boarding_time=data.boarding_time[:20], departure_time=data.departure_time[:20], gate=data.gate[:10],
            seat=data.seat[:6], group=data.group[:10], sequence=data.sequence[:6],
        )
        return Response(present(bp), status=status.HTTP_201_CREATED)


class BoardingPassDetailView(_View):
    def delete(self, request, pk):
        if pk > MAX_ID:
            return Response(status=404)
        deleted, _ = BoardingPass.objects.filter(owner=request.user, pk=pk).delete()
        return Response(status=204 if deleted else 404)
