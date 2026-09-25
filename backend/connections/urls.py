from django.urls import path

from connections.views import (
    ConnectionCandidatesView,
    ConnectionDetailView,
    ConnectionListCreateView,
    ConnectionOptionsView,
)

urlpatterns = [
    path('', ConnectionListCreateView.as_view(), name='connections'),
    # Vor <pk>, sonst hielte der Pfad „options“ für eine ID.
    path('options/', ConnectionOptionsView.as_view(), name='connections-options'),
    path('candidates/', ConnectionCandidatesView.as_view(), name='connections-candidates'),
    path('<int:pk>/', ConnectionDetailView.as_view(), name='connection-detail'),
]
