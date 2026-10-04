from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Sum
from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from . import files as file_rules
from .models import FileCategory, PersonalEvent, PersonalFile, PersonalNote, PersonalTask
from .serializers import PersonalEventSerializer, PersonalFileSerializer, PersonalNoteSerializer, PersonalTaskSerializer


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


class NoteViewSet(OwnedViewSet):
    queryset = PersonalNote.objects.all()
    serializer_class = PersonalNoteSerializer


class FileViewSet(OwnedViewSet):
    """Private Dateien: Hochladen (multipart, Feld „file“), Metadaten ändern
    (Name, Kategorie, Favorit), Löschen und der Inhalt über …/inhalt/.
    Fremde IDs liefern 404 wie überall in Organisation."""

    queryset = PersonalFile.objects.all()
    serializer_class = PersonalFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def create(self, request, *args, **kwargs):
        upload = request.FILES.get('file')
        if upload is None:
            raise ValidationError({'file': 'Bitte eine Datei auswählen.'})
        if upload.size > file_rules.MAX_FILE_SIZE:
            raise ValidationError({'file': 'Die Datei ist größer als 10 MB.'})
        used = PersonalFile.objects.filter(owner=request.user).aggregate(total=Sum('size'))['total'] or 0
        if used + upload.size > file_rules.QUOTA:
            raise ValidationError({'file': 'Dein Speicherplatz (500 MB) reicht dafür nicht mehr.'})
        head = upload.read(2048)
        upload.seek(0)
        content_type = file_rules.sniff(head, upload)
        name = file_rules.clean_name(upload.name or '')
        if content_type is None or not file_rules.matches_extension(name, content_type):
            raise ValidationError({'file': 'Dieser Dateityp wird nicht unterstützt. Erlaubt sind PDF, Bilder (PNG, JPG, WebP, GIF), Text, Word und Excel.'})
        category = request.data.get('category') or (FileCategory.IMAGE if content_type.startswith('image/') else FileCategory.OTHER)
        if category not in FileCategory.values:
            raise ValidationError({'category': 'Unbekannte Kategorie.'})
        with transaction.atomic():
            entry = PersonalFile(owner=request.user, name=name, content_type=content_type, size=upload.size, category=category)
            entry.file.save('upload', upload, save=False)
            entry.save()
        return Response(self.get_serializer(entry).data, status=201)

    def perform_destroy(self, instance):
        stored = instance.file
        instance.delete()
        stored.delete(save=False)

    @action(detail=False, methods=['get'], url_path='speicher')
    def storage(self, request):
        used = PersonalFile.objects.filter(owner=request.user).aggregate(total=Sum('size'))['total'] or 0
        return Response({'used': used, 'quota': file_rules.QUOTA})

    @action(detail=True, methods=['get'], url_path='inhalt')
    def content(self, request, pk=None):
        entry = self.get_object()
        PersonalFile.objects.filter(pk=entry.pk).update(used_at=timezone.now())
        inline = entry.content_type in file_rules.INLINE_TYPES and request.query_params.get('download') != '1'
        response = FileResponse(entry.file.open('rb'), content_type=entry.content_type, as_attachment=not inline, filename=entry.name)
        # Nie als etwas anderes deuten und keine aktiven Inhalte zulassen.
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"
        response['Cache-Control'] = 'no-store'
        return response


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
