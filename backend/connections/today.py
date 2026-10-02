"""„Heute“ aus allen Bereichen — eine Antwort, ein Blick (D8: fokussiert).

Jeder Abschnitt nutzt dieselbe Sichtbarkeitsregel wie seine Domain
(ADR-001). Nichts wird kopiert, alles wird beim Aufruf gelesen:

- Organisation: eigene Termine und Aufgaben (organisation.views.today_data).
- Haushalt: fällige Aufgaben für mich oder niemanden, Ordnerfristen der
  nächsten Tage (nicht für Kind-Konten, wie im Haushaltsordner selbst),
  offene Einkäufe.
- Reisen: Termine heute, laufende und bald beginnende Reisen.
- Finanzen: nur die EIGENEN privaten Zahlen des Monats.
- Vorschläge: die wichtigsten offenen (connections/suggestions.py).

Ein Abschnitt, den die Person nicht hat (kein Haushalt), ist `null` — das
Frontend blendet ihn dann aus, statt eine leere Karte zu zeigen."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Q, Sum

from connections import suggestions
from connections.models import ObjectType
from connections.registry import KINDS
from finanzen.private_api import money, month_figures
from finanzen.services import month_bounds
from haushalt import services as haushalt_services
from haushalt.models import FolderEntry, ShoppingItem, Task as HouseholdTask
from organisation.views import today_data
from reisen.models import Trip, TripEvent

DEADLINE_DAYS = 14
TRIP_LEAD_DAYS = 14
LIST_LIMIT = 8
SUGGESTION_LIMIT = 3


def _haushalt(user, today):
    membership = haushalt_services.membership_for(user)
    if membership is None:
        return None
    household = membership.household
    due = (
        HouseholdTask.objects.filter(household=household, is_done=False, due_date__lte=today)
        .filter(Q(assigned_to=user) | Q(assigned_to__isnull=True))
        .select_related('assigned_to')
        .order_by('due_date', 'due_time', 'id')
    )
    tasks = [
        {
            'id': task.pk,
            'title': task.title,
            'due_date': task.due_date.isoformat(),
            'due_time': task.due_time.strftime('%H:%M') if task.due_time else None,
            'overdue': task.due_date < today,
            'mine': task.assigned_to_id == user.pk,
        }
        for task in due[:LIST_LIMIT]
    ]
    deadlines = []
    if not haushalt_services.is_child_account(membership):
        horizon = today + timedelta(days=DEADLINE_DAYS)
        for entry in FolderEntry.objects.filter(household=household):
            for deadline in haushalt_services.folder_deadlines(entry):
                if today <= deadline['datum'] <= horizon:
                    deadlines.append(
                        {
                            'entry_id': entry.pk,
                            'art': deadline['art'],
                            'title': deadline['titel'],
                            'date': deadline['datum'].isoformat(),
                            'days': (deadline['datum'] - today).days,
                        }
                    )
        deadlines.sort(key=lambda d: (d['date'], d['title']))
    return {
        'tasks': tasks,
        'task_count': due.count(),
        'deadlines': deadlines[:LIST_LIMIT],
        'shopping_open': ShoppingItem.objects.filter(
            shopping_list__household=household, is_checked=False
        ).count(),
    }


def _reisen(user, today, tz):
    trips = KINDS[ObjectType.TRIP].visible(user).exclude(status__in=(Trip.Status.CANCELLED, Trip.Status.DONE))
    current = trips.filter(start_date__lte=today, end_date__gte=today).order_by('start_date', 'id').first()
    upcoming = (
        trips.filter(start_date__gt=today, start_date__lte=today + timedelta(days=TRIP_LEAD_DAYS))
        .order_by('start_date', 'id')
        .first()
    )
    start = datetime.combine(today, time.min, tzinfo=tz)
    end = start + timedelta(days=1)
    events = (
        TripEvent.objects.filter(trip__in=trips, starts_at__lt=end)
        .filter(Q(starts_at__gte=start) | Q(ends_at__gt=start))
        .select_related('trip')
        .order_by('starts_at', 'id')[:LIST_LIMIT]
    )

    def trip_info(trip):
        if trip is None:
            return None
        return {
            'id': trip.pk,
            'title': trip.title,
            'destination': trip.destination,
            'start_date': trip.start_date.isoformat(),
            'end_date': trip.end_date.isoformat(),
            'days_until': (trip.start_date - today).days,
        }

    return {
        'current': trip_info(current),
        'upcoming': trip_info(upcoming),
        'events': [
            {
                'id': event.pk,
                'trip_id': event.trip_id,
                'trip_title': event.trip.title,
                'title': event.title,
                'at': event.starts_at.isoformat(),
                'location': event.location,
            }
            for event in events
        ],
    }


def _finanzen(user, today):
    start, end = month_bounds(today)
    figures = month_figures(user, start, end)
    budget = figures['budget']
    return {
        'month': start.strftime('%Y-%m'),
        'budget': money(budget.amount) if budget else None,
        'expenses': money(figures['expense']),
        'available': money(figures['available']) if budget else None,
        'spent_today': money(
            figures['rows'].filter(type='EXPENSE', datum=today).aggregate(total=Sum('amount'))['total'] or 0
        ),
    }


def today_overview(user, tz_name: str) -> dict:
    organisation = today_data(user, tz_name)  # prüft auch die Zeitzone
    tz = ZoneInfo(tz_name)
    today = date.fromisoformat(organisation['date'])
    return {
        'date': organisation['date'],
        'timezone': tz_name,
        'organisation': organisation,
        'haushalt': _haushalt(user, today),
        'reisen': _reisen(user, today, tz),
        'finanzen': _finanzen(user, today),
        'suggestions': suggestions.for_user(user, limit=SUGGESTION_LIMIT),
    }
