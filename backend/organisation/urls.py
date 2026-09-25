from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import EventViewSet, TaskViewSet, TodayView

router = SimpleRouter()
router.register('events', EventViewSet, basename='organisation-event')
router.register('tasks', TaskViewSet, basename='organisation-task')
urlpatterns = [path('today/', TodayView.as_view(), name='organisation-today'), path('', include(router.urls))]
