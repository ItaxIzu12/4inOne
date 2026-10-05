from django.urls import path

from connections.views import (
    ConnectionCandidatesView,
    ConnectionDetailView,
    ConnectionListCreateView,
    ConnectionOptionsView,
    SuggestionAcceptView,
    SuggestionDismissView,
    SuggestionListView,
    TripRemindersView,
    TripSavingsView,
)

urlpatterns = [
    path('', ConnectionListCreateView.as_view(), name='connections'),
    # Vor <pk>, sonst hielte der Pfad „options“ für eine ID.
    path('options/', ConnectionOptionsView.as_view(), name='connections-options'),
    path('candidates/', ConnectionCandidatesView.as_view(), name='connections-candidates'),
    path('suggestions/', SuggestionListView.as_view(), name='connection-suggestions'),
    path('suggestions/accept/', SuggestionAcceptView.as_view(), name='connection-suggestions-accept'),
    path('suggestions/dismiss/', SuggestionDismissView.as_view(), name='connection-suggestions-dismiss'),
    path('reisen/<int:trip_id>/erinnerungen/', TripRemindersView.as_view(), name='trip-reminders'),
    path('reisen/<int:trip_id>/sparziel/', TripSavingsView.as_view(), name='trip-savings'),
    path('<int:pk>/', ConnectionDetailView.as_view(), name='connection-detail'),
]
