from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import (
    PackingItemViewSet,
    TripBudgetCategoryViewSet,
    TripEventViewSet,
    TripExpenseViewSet,
    TripParticipantViewSet,
    TripSettlementViewSet,
    TripTaskViewSet,
    TripViewSet,
)

router = SimpleRouter()
router.register('trips', TripViewSet, basename='reisen-trip')
router.register('packing-items', PackingItemViewSet, basename='reisen-packing-item')
router.register('tasks', TripTaskViewSet, basename='reisen-task')
router.register('events', TripEventViewSet, basename='reisen-event')
router.register('expenses', TripExpenseViewSet, basename='reisen-expense')
router.register('budget-categories', TripBudgetCategoryViewSet, basename='reisen-budget-category')
router.register('participants', TripParticipantViewSet, basename='reisen-participant')
router.register('settlements', TripSettlementViewSet, basename='reisen-settlement')
from .boarding_views import BoardingPassDetailView, BoardingPassListView

urlpatterns = [
    # Bordkarten (Schritt 1, docs/BORDKARTE_KONZEPT.md) – nur die eigenen
    path('boarding-passes/', BoardingPassListView.as_view(), name='reisen-boarding-passes'),
    path('boarding-passes/<int:pk>/', BoardingPassDetailView.as_view(), name='reisen-boarding-pass'),
    path('', include(router.urls)),
]
