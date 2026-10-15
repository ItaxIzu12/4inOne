"""Idempotente Anlage-Anfragen: dieselbe Anfrage zweimal ergibt genau ein Objekt.

Der Client schickt einen Header `Idempotency-Key` (pro Formular-Absendung stabil, siehe Frontend
`shared/idempotency.ts`). Der Server

1. legt vorab einen Platzhalter an (Unique-Constraint je Person + Endpunkt + Schlüssel) — eine gleichzeitige zweite
   Anfrage bekommt 409 statt eines Duplikats;
2. verarbeitet die Anfrage normal;
3. speichert bei Erfolg Statuscode und Antwort; bei Fehlern wird der Platzhalter verworfen, damit ein erneuter
   Versuch nach Korrektur möglich ist.

Eine Wiederholung mit demselben Schlüssel bekommt die gespeicherte Antwort — aber nur, solange das Objekt für die
Person noch sichtbar ist (sonst 404, Rechteentzug wirkt sofort). Derselbe Schlüssel mit anderem Inhalt
wird mit 422 abgelehnt. Ohne Header verhält sich alles wie bisher.
"""

import hashlib
import json
import re
from datetime import timedelta
from functools import wraps

from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from core.models import IdempotencyRecord

HEADER = 'Idempotency-Key'
LIFETIME = timedelta(hours=24)
_KEY = re.compile(r'^[A-Za-z0-9_.:-]{8,100}$')


def _fingerprint(request) -> str:
    try:
        payload = json.dumps(request.data, sort_keys=True, cls=DjangoJSONEncoder, default=str)
    except (TypeError, ValueError):
        payload = repr(request.data)
    return hashlib.sha256(f'{request.method} {request.path} {payload}'.encode()).hexdigest()


def _still_visible(view, body) -> bool:
    """Eine gespeicherte Antwort mit Objekt-ID wird nur wiederholt, wenn das Objekt für die Person JETZT noch
    sichtbar ist — dieselbe Regel wie für GET (get_queryset des Views). Antworten ohne Objekt (z. B. Import-
    Zusammenfassung über eigene Daten) bleiben wiederholbar."""
    object_id = body.get('id') if isinstance(body, dict) else None
    get_queryset = getattr(view, 'get_queryset', None)
    if object_id is None or get_queryset is None:
        return True
    return get_queryset().filter(pk=object_id).exists()


def idempotent(scope: str):
    """Dekorator für die `create`-Methode bzw. eine POST-Action eines DRF-Views."""

    def decorator(handler):
        @wraps(handler)
        def wrapper(self, request, *args, **kwargs):
            key = request.headers.get(HEADER)
            if not key or not request.user.is_authenticated:
                return handler(self, request, *args, **kwargs)
            if not _KEY.match(key):
                return Response({'detail': 'Ungültiger Idempotency-Key.'}, status=status.HTTP_400_BAD_REQUEST)

            fingerprint = _fingerprint(request)
            existing = IdempotencyRecord.objects.filter(user=request.user, scope=scope, key=key).first()
            if existing is not None and existing.created_at < timezone.now() - LIFETIME:
                existing.delete()
                existing = None
            if existing is not None:
                if existing.fingerprint != fingerprint:
                    return Response(
                        {'detail': 'Dieser Schlüssel wurde schon für eine andere Eingabe verwendet.'},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )
                if existing.status_code == 0:
                    return Response({'detail': 'Wird bereits gespeichert.'}, status=status.HTTP_409_CONFLICT)
                if not _still_visible(self, existing.body):
                    # Zugriff inzwischen entzogen (z. B. aus der Reise entfernt): keine alte Antwort mit Daten
                    # ausliefern, auf die die Person heute keinen Zugriff mehr hat.
                    return Response({'detail': 'Nicht gefunden.'}, status=status.HTTP_404_NOT_FOUND)
                replay = Response(existing.body, status=existing.status_code)
                replay['Idempotent-Replay'] = 'true'
                return replay

            IdempotencyRecord.objects.filter(user=request.user, created_at__lt=timezone.now() - LIFETIME).delete()
            try:
                with transaction.atomic():
                    record = IdempotencyRecord.objects.create(
                        user=request.user, scope=scope, key=key, fingerprint=fingerprint
                    )
            except IntegrityError:  # gleichzeitige zweite Anfrage mit demselben Schlüssel
                return Response({'detail': 'Wird bereits gespeichert.'}, status=status.HTTP_409_CONFLICT)

            try:
                response = handler(self, request, *args, **kwargs)
            except Exception:
                record.delete()
                raise
            if 200 <= response.status_code < 300:
                record.status_code = response.status_code
                record.body = json.loads(json.dumps(response.data, cls=DjangoJSONEncoder))
                record.save(update_fields=['status_code', 'body'])
            else:
                record.delete()
            return response

        return wrapper

    return decorator
