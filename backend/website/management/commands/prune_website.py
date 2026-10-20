from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from website.models import ContactMessage, PageView


class Command(BaseCommand):
    help = 'Löscht Kontaktanfragen und Seitenzähler nach Ablauf der Aufbewahrungsfrist (täglich per Cron ausführen).'

    def handle(self, *args, **options):
        now = timezone.now()
        messages, _ = ContactMessage.objects.filter(
            created_at__lt=now - timedelta(days=settings.CONTACT_RETENTION_DAYS)
        ).delete()
        views, _ = PageView.objects.filter(
            day__lt=timezone.localdate() - timedelta(days=settings.PAGEVIEW_RETENTION_DAYS)
        ).delete()
        self.stdout.write(f'{messages} Kontaktanfragen und {views} Seitenzähler gelöscht.')
