from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import EventViewSet, FileViewSet, NoteViewSet, TaskViewSet, TodayView

router = SimpleRouter()
router.register('events', EventViewSet, basename='organisation-event')
router.register('tasks', TaskViewSet, basename='organisation-task')
router.register('notes', NoteViewSet, basename='organisation-note')
router.register('files', FileViewSet, basename='organisation-file')
urlpatterns = [path('today/', TodayView.as_view(), name='organisation-today'), path('', include(router.urls))]
