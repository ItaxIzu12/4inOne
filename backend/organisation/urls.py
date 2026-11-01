from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .calendar_views import CalendarDetailView, CalendarListView, CalendarMemberView, ShareGivenView, ShareListView, ShareReceivedView
from .views import EventViewSet, FileViewSet, NoteViewSet, SummaryView, TaskViewSet, TodayView

router = SimpleRouter()
router.register('events', EventViewSet, basename='organisation-event')
router.register('tasks', TaskViewSet, basename='organisation-task')
router.register('notes', NoteViewSet, basename='organisation-note')
router.register('files', FileViewSet, basename='organisation-file')
urlpatterns = [
    path('calendars/', CalendarListView.as_view(), name='organisation-calendars'),
    path('calendars/<int:pk>/', CalendarDetailView.as_view(), name='organisation-calendar'),
    path('calendars/<int:pk>/members/<int:user_id>/', CalendarMemberView.as_view(), name='organisation-calendar-member'),
    path('shares/', ShareListView.as_view(), name='organisation-shares'),
    path('shares/given/<int:user_id>/', ShareGivenView.as_view(), name='organisation-share-given'),
    path('shares/received/<int:user_id>/', ShareReceivedView.as_view(), name='organisation-share-received'),
    path('today/', TodayView.as_view(), name='organisation-today'), path('summary/', SummaryView.as_view(), name='organisation-summary'), path('', include(router.urls))]
