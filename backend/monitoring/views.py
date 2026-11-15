"""Admin-Panel-API und der Tunnel für Fehlerberichte aus dem Browser (docs/MONITORING.md)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from datetime import timedelta
from urllib.parse import quote, urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import LocalCacheThrottle

from .models import AuthEvent
from .permissions import IsMonitoringAdmin

logger = logging.getLogger(__name__)
PAGE_SIZE = 50
MAX_ENVELOPE_BYTES = 512 * 1024


def mask_email(email: str) -> str:
    """„sophie@example.com“ → „s•••@example.com“ — das Panel braucht keine vollen Adressen."""
    local, _, domain = (email or '').partition('@')
    return f'{local[:1]}•••@{domain}' if domain else ''


def _person(user):
    if user is None:
        return None
    return {'name': user.first_name or mask_email(user.email).split('@')[0], 'email': mask_email(user.email)}


class AdminOverviewView(APIView):
    permission_classes = [IsMonitoringAdmin]

    def get(self, request):
        now = timezone.now()
        User = get_user_model()

        def counts(since):
            rows = AuthEvent.objects.filter(created_at__gte=since).values('kind').annotate(n=Count('id'))
            found = {row['kind']: row['n'] for row in rows}
            return {kind: found.get(kind, 0) for kind in AuthEvent.Kind.values}

        return Response({
            'accounts': {
                'total': User.objects.filter(is_active=True).count(),
                'new_7d': User.objects.filter(date_joined__gte=now - timedelta(days=7)).count(),
                'active_7d': AuthEvent.objects.filter(kind=AuthEvent.Kind.LOGIN_SUCCEEDED, created_at__gte=now - timedelta(days=7),
                                                      user__isnull=False).values('user').distinct().count(),
            },
            'events_24h': counts(now - timedelta(hours=24)),
            'events_7d': counts(now - timedelta(days=7)),
            'labels': dict(AuthEvent.Kind.choices),
            'monitoring': {
                'connected': bool(settings.SENTRY_DSN),
                'environment': settings.SENTRY_ENVIRONMENT,
                'url': settings.GLITCHTIP_URL or None,
                'errors_available': bool(settings.GLITCHTIP_API_TOKEN and settings.GLITCHTIP_ORG and settings.GLITCHTIP_URL),
            },
            'retention_days': settings.AUTH_EVENT_RETENTION_DAYS,
        })


class AdminEventsView(APIView):
    permission_classes = [IsMonitoringAdmin]

    def get(self, request):
        queryset = AuthEvent.objects.select_related('user')
        kind = request.query_params.get('kind')
        if kind:
            if kind not in AuthEvent.Kind.values:
                return Response({'detail': 'Unbekannte Art.'}, status=400)
            queryset = queryset.filter(kind=kind)
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1
        start = (page - 1) * PAGE_SIZE
        rows = list(queryset[start:start + PAGE_SIZE + 1])
        return Response({
            'results': [
                {'id': e.id, 'kind': e.kind, 'label': e.get_kind_display(), 'created_at': e.created_at.isoformat(),
                 'user': _person(e.user), 'ip_prefix': e.ip_prefix}
                for e in rows[:PAGE_SIZE]
            ],
            'page': page,
            'has_more': len(rows) > PAGE_SIZE,
        })


class AdminErrorsView(APIView):
    """Die letzten offenen Fehler aus GlitchTip (lesend, über ein API-Token mit Leserechten)."""

    permission_classes = [IsMonitoringAdmin]

    def get(self, request):
        base, token, org = settings.GLITCHTIP_URL, settings.GLITCHTIP_API_TOKEN, settings.GLITCHTIP_ORG
        if not (base and token and org):
            return Response({'available': False, 'reason': 'not_configured', 'issues': []})
        if urlsplit(base).scheme not in ('http', 'https'):
            return Response({'available': False, 'reason': 'not_configured', 'issues': []})
        url = f"{base.rstrip('/')}/api/0/organizations/{quote(org)}/issues/?query=is:unresolved&limit=10"
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=4) as answer:  # noqa: S310 (feste Adresse aus den Einstellungen)
                data = json.loads(answer.read(2 * 1024 * 1024))
        except (urllib.error.URLError, TimeoutError, ValueError, OSError):
            logger.warning('GlitchTip-API nicht erreichbar')
            return Response({'available': False, 'reason': 'unreachable', 'issues': []})
        issues = []
        for issue in data if isinstance(data, list) else []:
            issues.append({
                'id': issue.get('id'),
                'title': issue.get('title') or '',
                'culprit': issue.get('culprit') or '',
                'level': issue.get('level') or 'error',
                'count': int(issue.get('count') or 0),
                'last_seen': issue.get('lastSeen'),
                'link': f"{base.rstrip('/')}/{quote(org)}/issues/{quote(str(issue.get('id')))}",
            })
        return Response({'available': True, 'issues': issues})


class MonitoringConfigView(APIView):
    """Für den Browser: ob Fehlerberichte aktiv sind. Der DSN ist bei Sentry/GlitchTip öffentlich gedacht (er erlaubt
    nur das Melden); der Browser schickt trotzdem nie direkt dorthin, sondern über den Tunnel unten."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        dsn = settings.SENTRY_DSN
        return Response({'enabled': bool(dsn), 'dsn': dsn or None, 'environment': settings.SENTRY_ENVIRONMENT})


class TunnelRateThrottle(LocalCacheThrottle):
    scope = 'monitoring_tunnel'


def _same_target(envelope_dsn: str, configured_dsn: str) -> bool:
    a, b = urlsplit(envelope_dsn), urlsplit(configured_dsn)
    return (a.scheme, a.hostname, a.port, a.username, a.path.rstrip('/')) == (b.scheme, b.hostname, b.port, b.username, b.path.rstrip('/'))


@csrf_exempt
@require_POST
def tunnel(request):
    """Fehlerberichte aus dem Browser → GlitchTip. So bleibt die CSP bei `connect-src 'self'`.

    Kein offener Proxy: weitergeleitet wird nur an genau den konfigurierten DSN (Adresse, Port, Schlüssel, Projekt);
    alles andere → 400. Größenlimit und Rate-Limit pro IP."""
    configured = settings.SENTRY_DSN
    if not configured:
        return HttpResponse(status=204)
    throttle = TunnelRateThrottle()
    if not throttle.allow_request(request, None):
        return HttpResponse(status=429)
    try:
        length = int(request.META.get('CONTENT_LENGTH') or 0)
    except ValueError:
        length = 0
    if length > MAX_ENVELOPE_BYTES:
        return HttpResponse(status=413)
    body = request.read(MAX_ENVELOPE_BYTES + 1)
    if len(body) > MAX_ENVELOPE_BYTES:
        return HttpResponse(status=413)
    try:
        header = json.loads(body.split(b'\n', 1)[0])
        dsn = header.get('dsn', '')
    except (ValueError, AttributeError):
        return JsonResponse({'detail': 'Ungültiger Bericht.'}, status=400)
    if not isinstance(dsn, str) or not _same_target(dsn, configured):
        return JsonResponse({'detail': 'Ungültiges Ziel.'}, status=400)
    target = urlsplit(configured)
    project = target.path.strip('/').split('/')[-1]
    upstream = f'{target.scheme}://{target.hostname}{":" + str(target.port) if target.port else ""}/api/{quote(project)}/envelope/'
    req = urllib.request.Request(upstream, data=body, method='POST', headers={'Content-Type': 'application/x-sentry-envelope'})
    try:
        with urllib.request.urlopen(req, timeout=3) as answer:  # noqa: S310 (nur der konfigurierte DSN)
            return HttpResponse(status=answer.status)
    except urllib.error.HTTPError as error:
        return HttpResponse(status=error.code if 400 <= error.code < 600 else 502)
    except (urllib.error.URLError, TimeoutError, OSError):
        return HttpResponse(status=502)
