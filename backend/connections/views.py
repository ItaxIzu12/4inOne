from rest_framework import status
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from connections import services
from connections.serializers import (
    CandidateQuerySerializer,
    ConnectionCreateSerializer,
    ObjectQuerySerializer,
    OptionsQuerySerializer,
)
from connections.throttling import ConnectionsWriteRateThrottle


class ConnectionsView(APIView):
    """Gemeinsame Basis: nur eingeloggt, nie zwischenspeichern, Regelverstöße
    aus dem Service als saubere Fehlerantwort."""

    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        return [] if self.request.method in SAFE_METHODS else [ConnectionsWriteRateThrottle()]

    def handle_exception(self, exc):
        if isinstance(exc, services.ConnectionRuleError):
            return Response({'detail': exc.message}, status=exc.status)
        return super().handle_exception(exc)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class ConnectionListCreateView(ConnectionsView):
    def get(self, request):
        query = ObjectQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data
        return Response(services.get_connections_for_object(request.user, data['object_type'], data['object_id']))

    def post(self, request):
        body = ConnectionCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        created = services.create_connection(
            request.user,
            data['source_type'], data['source_id'],
            data['target_type'], data['target_id'],
            data.get('relation_type'),
        )
        return Response(created, status=status.HTTP_201_CREATED)


class ConnectionDetailView(ConnectionsView):
    def get(self, request, pk):
        return Response(services.get_connection(request.user, pk))

    def delete(self, request, pk):
        services.delete_connection(request.user, pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConnectionOptionsView(ConnectionsView):
    def get(self, request):
        query = OptionsQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        return Response(services.options_for(query.validated_data['object_type']))


class ConnectionCandidatesView(ConnectionsView):
    def get(self, request):
        query = CandidateQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data
        return Response(
            services.candidates_for(request.user, data['object_type'], data['object_id'], data['target_type'], data['q'])
        )
