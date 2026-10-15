"""Abgelaufene Hilfsdaten entfernen — täglich per Cron/Scheduler ausführen (`python manage.py cleanup_expired`).

Fachdaten (Transaktionen, Aufgaben, Reisen, Notizen …) werden NIE angefasst. Entfernt wird nur, was abgelaufen ist
und keinen Zweck mehr hat; ohne diesen Lauf wüchsen die Tabellen unbegrenzt.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone


class Command(BaseCommand):
    help = 'Entfernt abgelaufene Tokens, Sitzungen, Idempotenz-Schlüssel und alte erledigte Benachrichtigungen.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Nur zählen, nichts löschen.')

    def handle(self, *args, dry_run=False, **options):
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

        from core.idempotency import LIFETIME as IDEMPOTENCY_LIFETIME
        from core.models import ContactInvite, IdempotencyRecord, Notification, PasswordResetToken, UserSession

        now = timezone.now()
        refresh_lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
        groups = {
            # Refresh-Tokens jenseits ihres Ablaufs (inkl. Sperrliste per CASCADE)
            'abgelaufene Refresh-Tokens': OutstandingToken.objects.filter(expires_at__lt=now),
            # Geräte, deren letzte Aktivität länger zurückliegt als ein Refresh-Token überhaupt gilt
            'verwaiste Gerätesitzungen': UserSession.objects.filter(last_seen__lt=now - refresh_lifetime),
            'abgelaufene Reset-Links': PasswordResetToken.objects.filter(expires_at__lt=now - timedelta(days=1)),
            'alte Idempotenz-Schlüssel': IdempotencyRecord.objects.filter(created_at__lt=now - IDEMPOTENCY_LIFETIME),
            'gelesene Benachrichtigungen älter als 90 Tage': Notification.objects.filter(read_at__lt=now - timedelta(days=90)),
            'abgelaufene Kontakt-Einladungen älter als 30 Tage': ContactInvite.objects.filter(
                accepted_at__isnull=True, expires_at__lt=now - timedelta(days=30)
            ),
        }
        with transaction.atomic():
            for label, queryset in groups.items():
                count = queryset.count()
                if count and not dry_run:
                    queryset.delete()
                self.stdout.write(f'{label}: {count}{" (nur gezählt)" if dry_run else ""}')
