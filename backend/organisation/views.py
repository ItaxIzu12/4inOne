from datetime import datetime, time, timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
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
from . import services
from .models import FileCategory, PersonalEvent, PersonalFile, PersonalNote, PersonalTask
from .serializers import PersonalEventSerializer, PersonalFileSerializer, PersonalNoteSerializer, PersonalTaskSerializer


def _day(value: str | None, field: str):
    try:
        return datetime.strptime(value or '', '%Y-%m-%d').date()
    except ValueError:
        raise ValidationError({field: 'Bitte ein Datum im Format JJJJ-MM-TT angeben.'})


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


IMPORT_MAX_EVENTS = 1000
IMPORT_LABELS = {'title': 'Titel', 'starts_at': 'Beginn', 'ends_at': 'Ende', 'recurrence': 'Wiederholung', 'location': 'Ort', 'description': 'Beschreibung', 'all_day': 'Ganztägig'}


class EventViewSet(OwnedViewSet):
    """Termine. Mit ?start=JJJJ-MM-TT&end=JJJJ-MM-TT (höchstens 400 Tage) nur der
    Zeitraum, wiederkehrende Termine einmal pro Vorkommen (series_starts_at = Beginn
    der Serie). Ohne Zeitraum: alle eigenen Termine wie gespeichert."""

    queryset = PersonalEvent.objects.all()
    serializer_class = PersonalEventSerializer

    @action(detail=False, methods=['post'], url_path='import')
    def import_events(self, request):
        """Kalenderdatei (ICS) übernehmen — die Termine wurden im Browser gelesen. Jede Zeile durchläuft denselben
        Serializer wie ein Termin von Hand. Dubletten (gleicher Titel und Beginn, schon vorhanden oder doppelt in
        der Datei) werden übersprungen. Mit dry_run nur prüfen (Vorschau), sonst alles Gültige in einem Schritt."""
        rows = request.data.get('rows')
        if not isinstance(rows, list) or not rows:
            raise ValidationError({'rows': 'Die Datei enthält keine Termine.'})
        if len(rows) > IMPORT_MAX_EVENTS:
            raise ValidationError({'rows': f'Höchstens {IMPORT_MAX_EVENTS} Termine auf einmal.'})
        dry_run = request.data.get('dry_run') is True
        seen, results, valid = set(), [], []
        for index, raw in enumerate(rows, start=1):
            data = {k: raw.get(k) for k in ('title', 'starts_at', 'ends_at', 'all_day', 'recurrence', 'location', 'description')} if isinstance(raw, dict) else {}
            serializer = PersonalEventSerializer(data={k: v for k, v in data.items() if v is not None or k == 'ends_at'})
            if not serializer.is_valid():
                field, messages = next(iter(serializer.errors.items()))
                message = messages[0] if isinstance(messages, list) else messages
                results.append({'row': index, 'status': 'invalid', 'message': f'{IMPORT_LABELS.get(field, field)}: {message}'})
                continue
            attrs = serializer.validated_data
            key = (attrs['title'].casefold(), attrs['starts_at'])
            exists = PersonalEvent.objects.filter(owner=request.user, title__iexact=attrs['title'], starts_at=attrs['starts_at']).exists()
            if key in seen or exists:
                results.append({'row': index, 'status': 'duplicate', 'message': 'Schon im Kalender'})
                continue
            seen.add(key)
            results.append({'row': index, 'status': 'new', 'message': ''})
            valid.append(attrs)
        summary = {
            'new': len(valid),
            'duplicates': sum(1 for r in results if r['status'] == 'duplicate'),
            'invalid': sum(1 for r in results if r['status'] == 'invalid'),
            'rows': results,
        }
        if dry_run or not valid:
            return Response({**summary, 'created': 0})
        with transaction.atomic():
            PersonalEvent.objects.bulk_create([PersonalEvent(owner=request.user, **attrs) for attrs in valid])
        return Response({**summary, 'created': len(valid)}, status=201)

    def list(self, request, *args, **kwargs):
        if 'start' not in request.query_params and 'end' not in request.query_params:
            return super().list(request, *args, **kwargs)
        start = _day(request.query_params.get('start'), 'start')
        end = _day(request.query_params.get('end'), 'end')
        if end < start:
            raise ValidationError({'end': 'Das Ende des Zeitraums liegt vor dem Beginn.'})
        if (end - start).days > services.MAX_RANGE_DAYS:
            raise ValidationError({'end': 'Der Zeitraum ist zu lang.'})
        tz = services.zone(request.query_params.get('timezone', 'Europe/Berlin'))
        rows = []
        for event, occ_start, occ_end in services.events_between(request.user, start, end, tz):
            data = self.get_serializer(event).data
            data['series_starts_at'] = data['starts_at']
            data['starts_at'] = occ_start.isoformat()
            data['ends_at'] = occ_end.isoformat() if occ_end else None
            rows.append(data)
        return Response(rows)


class TaskViewSet(OwnedViewSet):
    """Aufgaben. Filter: ?status=OPEN|DONE, ?due_date=JJJJ-MM-TT, ?overdue=1, ?recurring=1.
    Wird eine wiederkehrende Aufgabe auf DONE gesetzt, rückt sie stattdessen weiter."""

    queryset = PersonalTask.objects.all()
    serializer_class = PersonalTaskSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != 'list':
            return queryset
        params = self.request.query_params
        if params.get('status'):
            queryset = queryset.filter(status=params['status'])
        if params.get('due_date'):
            queryset = queryset.filter(due_date=_day(params['due_date'], 'due_date'))
        if params.get('overdue') == '1':
            queryset = queryset.filter(due_date__lt=timezone.localdate()).exclude(status=PersonalTask.Status.DONE)
        if params.get('recurring') == '1':
            queryset = queryset.filter(Q(recurrence_days__isnull=False) | Q(recurrence_months__isnull=False))
        return queryset

    def perform_update(self, serializer):
        task = serializer.instance
        finishing = serializer.validated_data.get('status') == PersonalTask.Status.DONE and task.status != PersonalTask.Status.DONE
        if finishing:
            # Den Status setzt complete_task: wiederkehrend bleibt die Aufgabe offen.
            serializer.validated_data.pop('status')
        task = serializer.save()
        if finishing:
            services.complete_task(task)


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
        instance.delete()

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
    tz = services.zone(tz_name)
    today = timezone.now().astimezone(tz).date()
    # Termine, die heute berühren (auch mehrtägige und wiederkehrende Vorkommen).
    events = services.events_between(user, today, today, tz)
    tasks = PersonalTask.objects.filter(owner=user, due_date__lte=today).exclude(status=PersonalTask.Status.DONE)
    items = []
    for event, occ_start, _occ_end in events:
        items.append({'kind': 'event', 'id': event.pk, 'title': event.title,
                      'at': occ_start.isoformat(), 'overdue': False,
                      'location': event.location, 'all_day': event.all_day})
    for task in tasks:
        at = datetime.combine(task.due_date, task.due_time or time.min, tzinfo=tz)
        items.append({'kind': 'task', 'id': task.pk, 'title': task.title,
                      'at': at.isoformat(), 'overdue': task.due_date < today,
                      'all_day': task.due_time is None, 'status': task.status, 'priority': task.priority})
    items.sort(key=lambda item: (datetime.fromisoformat(item['at']), item['kind'], item['id']))
    return {'date': today.isoformat(), 'timezone': tz_name, 'items': items,
            'event_count': len(events),
            'open_task_count': PersonalTask.objects.filter(owner=user).exclude(status=PersonalTask.Status.DONE).count(),
            'overdue_count': tasks.filter(due_date__lt=today).count()}


class SummaryView(PrivateResponseMixin, APIView):
    """Kennzahlen für das Dashboard: Termine heute, Aufgaben heute, überfällige Aufgaben."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(services.summary(request.user, request.query_params.get('timezone', 'Europe/Berlin')))


class TodayView(PrivateResponseMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(today_data(request.user, request.query_params.get('timezone', 'Europe/Berlin')))
