"""O3 – Kalender-Abo: anlegen (ruft sofort ab), auflisten, umbenennen/umfärben, löschen, jetzt aktualisieren und die
Termine eines Zeitraums lesen. Alles nur für die eigene Person; der geheime Link wird nie zurückgegeben."""

from datetime import date
from urllib.parse import urlsplit

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import LocalCacheThrottle
from organisation import services, subscriptions
from organisation.models import CalendarColor, CalendarSubscription

MAX_ID = 2_147_483_647


class SubscriptionWriteThrottle(LocalCacheThrottle):
    """Anlegen und „Jetzt aktualisieren“ rufen fremde Server ab – je Person begrenzt."""

    scope = 'calendar_subscription'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.pk)}


class SubscriptionInput(serializers.Serializer):
    name = serializers.CharField(min_length=1, max_length=60)
    url = serializers.CharField(max_length=1000)
    color = serializers.ChoiceField(choices=CalendarColor.choices, required=False)


class SubscriptionPatch(serializers.Serializer):
    name = serializers.CharField(min_length=1, max_length=60, required=False)
    color = serializers.ChoiceField(choices=CalendarColor.choices, required=False)


def present(sub: CalendarSubscription) -> dict:
    return {
        'id': sub.pk,
        'name': sub.name,
        'color': sub.color,
        # Nur der Rechnername – der vollständige Link enthält oft einen geheimen Schlüssel.
        'host': urlsplit(sub.url).hostname or '',
        'last_synced_at': sub.last_synced_at.isoformat() if sub.last_synced_at else None,
        'last_error': sub.last_error,
        'event_count': sub.events.count(),
    }


class _SubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        return [SubscriptionWriteThrottle()] if self.request.method == 'POST' else []

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response

    def _own(self, request, pk):
        if pk > MAX_ID:
            return None
        return CalendarSubscription.objects.filter(owner=request.user, pk=pk).first()


class SubscriptionListView(_SubscriptionView):
    def get(self, request):
        return Response([present(s) for s in CalendarSubscription.objects.filter(owner=request.user)])

    def post(self, request):
        body = SubscriptionInput(data=request.data)
        body.is_valid(raise_exception=True)
        if CalendarSubscription.objects.filter(owner=request.user).count() >= subscriptions.MAX_SUBSCRIPTIONS:
            return Response({'detail': f'Du kannst höchstens {subscriptions.MAX_SUBSCRIPTIONS} Kalender abonnieren.'}, status=400)
        try:
            url = subscriptions.normalize_url(body.validated_data['url'])
            text = subscriptions.fetch(url)
        except subscriptions.SubscriptionError as error:
            return Response({'url': [str(error)]}, status=400)
        sub = CalendarSubscription.objects.create(
            owner=request.user, name=body.validated_data['name'].strip(), url=url,
            color=body.validated_data.get('color', CalendarColor.SLATE),
        )
        subscriptions.refresh(sub, text)
        return Response(present(sub), status=status.HTTP_201_CREATED)


class SubscriptionDetailView(_SubscriptionView):
    def patch(self, request, pk):
        sub = self._own(request, pk)
        if sub is None:
            return Response({'detail': 'Nicht gefunden.'}, status=404)
        body = SubscriptionPatch(data=request.data)
        body.is_valid(raise_exception=True)
        for field, value in body.validated_data.items():
            setattr(sub, field, value.strip() if field == 'name' else value)
        sub.save(update_fields=list(body.validated_data) or None)
        return Response(present(sub))

    def delete(self, request, pk):
        sub = self._own(request, pk)
        if sub is None:
            return Response({'detail': 'Nicht gefunden.'}, status=404)
        sub.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubscriptionRefreshView(_SubscriptionView):
    def post(self, request, pk):
        sub = self._own(request, pk)
        if sub is None:
            return Response({'detail': 'Nicht gefunden.'}, status=404)
        try:
            subscriptions.refresh(sub)
        except subscriptions.SubscriptionError as error:
            return Response({'detail': str(error), **present(sub)}, status=400)
        return Response(present(sub))


class SubscriptionEventsView(_SubscriptionView):
    """GET ?start=JJJJ-MM-TT&end=JJJJ-MM-TT&timezone=… — nur lesbare Termine aller eigenen Abos."""

    def get(self, request):
        try:
            start = date.fromisoformat(request.query_params.get('start', ''))
            end = date.fromisoformat(request.query_params.get('end', ''))
        except ValueError:
            return Response({'detail': 'Bitte gib start und end als JJJJ-MM-TT an.'}, status=400)
        if end < start or (end - start).days > services.MAX_RANGE_DAYS:
            return Response({'detail': 'Ungültiger Zeitraum.'}, status=400)
        tz = services.zone(request.query_params.get('timezone', 'Europe/Berlin'))
        return Response([
            {
                'id': e.pk, 'title': e.title, 'starts_at': e.starts_at.isoformat(),
                'ends_at': e.ends_at.isoformat() if e.ends_at else None, 'all_day': e.all_day, 'location': e.location,
                'subscription': e.subscription_id, 'subscription_name': e.subscription.name, 'color': e.subscription.color,
            }
            for e in subscriptions.events_between(request.user, start, end, tz)
        ])
