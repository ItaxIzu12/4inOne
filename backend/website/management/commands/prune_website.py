from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from website.models import PageView


class Command(BaseCommand):
    help = 'Löscht Seitenzähler nach Ablauf der Aufbewahrungsfrist (täglich per Cron ausführen).'

    def handle(self, *args, **options):
        views, _ = PageView.objects.filter(
            day__lt=timezone.localdate() - timedelta(days=settings.PAGEVIEW_RETENTION_DAYS)
        ).delete()
        self.stdout.write(f'{views} Seitenzähler gelöscht.')
