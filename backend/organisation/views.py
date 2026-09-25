from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import PersonalEvent, PersonalTask
from .serializers import PersonalEventSerializer, PersonalTaskSerializer


class PrivateResponseMixin:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class OwnedViewSet(PrivateResponseMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return self.queryset.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class EventViewSet(OwnedViewSet):
    queryset = PersonalEvent.objects.all()
    serializer_class = PersonalEventSerializer


class TaskViewSet(OwnedViewSet):
    queryset = PersonalTask.objects.all()
    serializer_class = PersonalTaskSerializer


def today_data(user, tz_name):
    try:
        tz = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise serializers.ValidationError({'timezone': 'Unbekannte Zeitzone.'})
    today = timezone.now().astimezone(tz).date()
    start = datetime.combine(today, time.min, tzinfo=tz)
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=tz)
    # Include multi-day events that overlap today; end is exclusive at midnight.
    events = PersonalEvent.objects.filter(owner=user, starts_at__lt=end).filter(
        Q(starts_at__gte=start) | Q(ends_at__gt=start)
    )
    tasks = PersonalTask.objects.filter(owner=user, due_date__lte=today).exclude(status=PersonalTask.Status.DONE)
    items = []
    for event in events:
        items.append({'kind': 'event', 'id': event.pk, 'title': event.title,
                      'at': event.starts_at.isoformat(), 'overdue': False,
                      'location': event.location})
    for task in tasks:
        at = datetime.combine(task.due_date, task.due_time or time.min, tzinfo=tz)
        items.append({'kind': 'task', 'id': task.pk, 'title': task.title,
                      'at': at.isoformat(), 'overdue': task.due_date < today,
                      'all_day': task.due_time is None, 'status': task.status, 'priority': task.priority})
    items.sort(key=lambda item: (datetime.fromisoformat(item['at']), item['kind'], item['id']))
    return {'date': today.isoformat(), 'timezone': tz_name, 'items': items,
            'event_count': events.count(),
            'open_task_count': PersonalTask.objects.filter(owner=user).exclude(status=PersonalTask.Status.DONE).count(),
            'overdue_count': tasks.filter(due_date__lt=today).count()}


class TodayView(PrivateResponseMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(today_data(request.user, request.query_params.get('timezone', 'Europe/Berlin')))
