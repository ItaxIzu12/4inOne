from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import PackingItem, Trip, TripEvent, TripExpense, TripTask
from .serializers import (
    PackingItemSerializer,
    TripEventSerializer,
    TripExpenseSerializer,
    TripSerializer,
    TripTaskSerializer,
)


class PrivateResponseMixin:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class TripViewSet(PrivateResponseMixin, viewsets.ModelViewSet):
    """Analog zu OwnedViewSet (organisation/views.py): Reisen gehören direkt dem Nutzer."""

    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    queryset = Trip.objects.all()

    def get_queryset(self):
        return self.queryset.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class TripScopedViewSet(PrivateResponseMixin, viewsets.ModelViewSet):
    """Für alles, was an eine Trip hängt (Packliste/Aufgaben/Termine/Ausgaben). Der Zugriff
    läuft über trip__owner statt einem eigenen owner-Feld — siehe TripScopedModel-Docstring.
    Optionaler Query-Parameter ?trip=<id> grenzt auf eine einzelne Reise ein, da ein Nutzer
    mehrere Reisen gleichzeitig haben kann (anders als z. B. Haushalt, wo es je Nutzer nur
    einen aktiven Haushalt gibt)."""

    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = self.queryset.filter(trip__owner=self.request.user)
        trip_id = self.request.query_params.get('trip')
        if trip_id is not None:
            queryset = queryset.filter(trip_id=trip_id)
        return queryset


class PackingItemViewSet(TripScopedViewSet):
    queryset = PackingItem.objects.all()
    serializer_class = PackingItemSerializer


class TripTaskViewSet(TripScopedViewSet):
    queryset = TripTask.objects.all()
    serializer_class = TripTaskSerializer


class TripEventViewSet(TripScopedViewSet):
    queryset = TripEvent.objects.all()
    serializer_class = TripEventSerializer


class TripExpenseViewSet(TripScopedViewSet):
    queryset = TripExpense.objects.all()
    serializer_class = TripExpenseSerializer
