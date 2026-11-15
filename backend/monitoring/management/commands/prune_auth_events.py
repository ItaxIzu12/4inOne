from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from monitoring.models import AuthEvent


class Command(BaseCommand):
    help = 'Löscht Anmelde-Ereignisse älter als AUTH_EVENT_RETENTION_DAYS (Standard 90). Täglich per Timer.'

    def handle(self, **options):
        cutoff = timezone.now() - timedelta(days=settings.AUTH_EVENT_RETENTION_DAYS)
        deleted, _ = AuthEvent.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(f'{deleted} Anmelde-Ereignisse gelöscht (älter als {settings.AUTH_EVENT_RETENTION_DAYS} Tage).')
