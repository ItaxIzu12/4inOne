from django.http import FileResponse
from rest_framework.views import APIView

from finanzen.throttling import DataExportRateThrottle

from .export import build_export


class DataExportView(APIView):
    """GET /api/v1/auth/export/ — alle eigenen Daten als ZIP (DSGVO Art. 15/20). Angemeldet (Standard-Rechte inkl.
    Zwei-Faktor), höchstens RATE_LIMIT_DATA_EXPORT Exporte pro Minute und Person (gleiches Limit wie Finanzberichte):
    sonst ließe sich ein gestohlenes Token zum wiederholten Abgreifen nutzen."""

    throttle_classes = [DataExportRateThrottle]

    def get(self, request):
        archive, filename, _ = build_export(request.user)
        response = FileResponse(archive, as_attachment=True, filename=filename, content_type='application/zip')
        response['Cache-Control'] = 'no-store'
        return response
