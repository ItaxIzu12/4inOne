from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import PackingItemViewSet, TripEventViewSet, TripExpenseViewSet, TripTaskViewSet, TripViewSet

router = SimpleRouter()
router.register('trips', TripViewSet, basename='reisen-trip')
router.register('packing-items', PackingItemViewSet, basename='reisen-packing-item')
router.register('tasks', TripTaskViewSet, basename='reisen-task')
router.register('events', TripEventViewSet, basename='reisen-event')
router.register('expenses', TripExpenseViewSet, basename='reisen-expense')
urlpatterns = [path('', include(router.urls))]
