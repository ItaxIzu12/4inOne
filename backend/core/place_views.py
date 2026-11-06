"""GET /api/v1/places/?q=… — Ortsvorschläge (core/places.py): eigene Orte + Photon über diesen Server."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core import places
from core.throttling import LocalCacheThrottle


class PlacesRateThrottle(LocalCacheThrottle):
    """Ortssuche je Person begrenzen (Tippen erzeugt viele Anfragen; Photon ist ein Gemeinschaftsdienst)."""

    scope = 'places'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.pk)}


class PlacesView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [PlacesRateThrottle]

    def get(self, request):
        query = places.clean_query(request.query_params.get('q', ''))
        kind = request.query_params.get('kind', 'place')
        if kind not in places.KINDS:
            kind = 'place'
        near = places.clean_query(request.query_params.get('near', ''))[:80]
        found, reachable = places.external_places(query, kind, near)
        response = Response({'own': places.own_places(request.user, query, kind), 'places': found, 'external_ok': reachable})
        response['Cache-Control'] = 'no-store'
        return response
