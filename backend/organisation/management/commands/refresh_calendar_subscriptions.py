"""O3: Alle Kalender-Abos neu abrufen (organisation/subscriptions.py). Gedacht für Cron, z. B. stündlich:

    python manage.py refresh_calendar_subscriptions

Abos, die vor weniger als --min-age Minuten aktualisiert wurden, werden übersprungen."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from organisation import subscriptions
from organisation.models import CalendarSubscription


class Command(BaseCommand):
    help = 'Ruft abonnierte Kalender (ICS-Links) neu ab und ersetzt ihre Termine.'

    def add_arguments(self, parser):
        parser.add_argument('--min-age', type=int, default=50, help='Nur Abos, die älter als so viele Minuten sind.')

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(minutes=options['min_age'])
        done = failed = 0
        for sub in CalendarSubscription.objects.filter(Q(last_synced_at__isnull=True) | Q(last_synced_at__lt=cutoff)):
            try:
                subscriptions.refresh(sub)
                done += 1
            except subscriptions.SubscriptionError:
                failed += 1
            except Exception:  # ein kaputtes Abo hält die anderen nicht auf
                failed += 1
        self.stdout.write(f'Kalender-Abos: {done} aktualisiert, {failed} fehlgeschlagen')
