"""Nutzung im Beta-Test aus vorhandenen Zeitstempeln (Entwicklungsplan Phase 5: „Welche Bereiche nutzen sie
wiederholt?“, „Würden sie freiwillig weiterverwenden?“).

    python manage.py beta_usage_report --since 2026-11-10 [--until 2026-12-08] [--users a@x.de,b@y.de] [--output f.md]

Es gibt kein Tracking: gezählt wird nur, wann eine Person etwas angelegt, erledigt oder abgeschlossen hat (created_at,
done_at, completed_at …), je Bereich und je Tag — keine Inhalte, keine Beträge, keine Titel. Ohne --users zählen alle
Personen, die Beta-Feedback gegeben haben. Ausgabe pseudonymisiert (P1, P2 … in derselben Reihenfolge wie
beta_feedback_report)."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from connections.models import AutoLink, Connection
from core.models import BetaFeedback
from finanzen.models import SavingsGoal, Transaction
from haushalt.models import FolderEntry, ShoppingTrip, Task as HouseholdTask, TaskCompletion
from organisation.models import PersonalEvent, PersonalNote, PersonalTask
from reisen.models import Trip

# (Bereich, Modell, Personenfeld, Zeitfeld)
SOURCES = [
    ('Finanzen', Transaction.all_objects, 'owner', 'created_at'),  # auch später gelöschte zählen als Nutzung
    ('Finanzen', SavingsGoal.objects, 'owner', 'created_at'),
    ('Haushalt', FolderEntry.objects, 'created_by', 'created_at'),
    ('Haushalt', HouseholdTask.objects, 'created_by', 'created_at'),
    ('Haushalt', TaskCompletion.objects, 'done_by', 'done_at'),
    ('Haushalt', ShoppingTrip.objects, 'completed_by', 'completed_at'),
    ('Organisation', PersonalEvent.objects, 'owner', 'created_at'),
    ('Organisation', PersonalTask.objects, 'owner', 'created_at'),
    ('Organisation', PersonalNote.objects, 'owner', 'created_at'),
    ('Reisen', Trip.objects, 'owner', 'created_at'),
    ('Verbindungen', AutoLink.objects, 'owner', 'created_at'),
    ('Verbindungen', Connection.objects, 'created_by', 'created_at'),
]
AREAS = ['Finanzen', 'Haushalt', 'Organisation', 'Reisen', 'Verbindungen']


def _day(value: str, name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise CommandError(f'{name} bitte als JJJJ-MM-TT angeben.') from error


class Command(BaseCommand):
    help = 'Zählt pseudonymisiert, an wie vielen Tagen/Wochen Testpersonen welche Bereiche genutzt haben.'

    def add_arguments(self, parser):
        parser.add_argument('--since', required=True, help='Beginn des Beta-Tests (JJJJ-MM-TT).')
        parser.add_argument('--until', help='Ende (JJJJ-MM-TT, einschließlich); Standard heute.')
        parser.add_argument('--users', help='E-Mail-Adressen der Testpersonen, kommagetrennt (Standard: alle mit Feedback).')
        parser.add_argument('--output', help='Datei für den Bericht (sonst Konsole).')

    def handle(self, *args, since, until=None, users=None, output=None, **options):
        start = _day(since, '--since')
        end = _day(until, '--until') if until else timezone.localdate()
        if end < start:
            raise CommandError('--until liegt vor --since.')
        tz = timezone.get_current_timezone()
        window = (datetime.combine(start, time.min, tz), datetime.combine(end + timedelta(days=1), time.min, tz))

        # Reihenfolge wie im Feedback-Bericht: zuerst nach erster Rückmeldung, dann die übrigen nach Anmeldung.
        ordered = list(dict.fromkeys(BetaFeedback.objects.order_by('created_at', 'id').values_list('user_id', flat=True)))
        if users:
            emails = [e.strip().lower() for e in users.split(',') if e.strip()]
            found = dict(get_user_model().objects.filter(email__in=emails).values_list('id', 'email'))
            missing = sorted(set(emails) - {e.lower() for e in found.values()})
            if missing:
                raise CommandError(f'{len(missing)} Adresse(n) ohne Konto — bitte prüfen.')
            ordered = [u for u in ordered if u in found] + sorted(u for u in found if u not in ordered)
        alias = {user_id: f'P{i + 1}' for i, user_id in enumerate(ordered)}

        days: dict[int, set] = defaultdict(set)
        counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        area_days: dict[int, dict[str, set]] = defaultdict(lambda: defaultdict(set))
        for area, manager, person, stamp in SOURCES:
            rows = manager.filter(**{f'{person}_id__in': list(alias), f'{stamp}__gte': window[0], f'{stamp}__lt': window[1]})
            for user_id, moment in rows.values_list(f'{person}_id', stamp):
                day = timezone.localtime(moment, tz).date()
                days[user_id].add(day)
                counts[user_id][area] += 1
                area_days[user_id][area].add(day)

        lines = ['# Beta-Nutzung (automatisch erzeugt)', '',
                 f'Zeitraum: {start:%d.%m.%Y} – {end:%d.%m.%Y} · Personen: **{len(alias)}**', '',
                 'Gezählt: Einträge angelegt bzw. erledigt (keine Inhalte). In Klammern: an wie vielen Tagen.', '',
                 '| Person | aktive Tage | aktive Wochen | ' + ' | '.join(AREAS) + ' |',
                 '|---|---|---|' + '---|' * len(AREAS)]
        for user_id, name in alias.items():
            weeks = {d.isocalendar()[:2] for d in days[user_id]}
            cells = [f'{counts[user_id][a]} ({len(area_days[user_id][a])})' if counts[user_id][a] else '—' for a in AREAS]
            lines.append(f'| {name} | {len(days[user_id])} | {len(weeks)} | ' + ' | '.join(cells) + ' |')
        repeat = sum(1 for u in alias if len({d.isocalendar()[:2] for d in days[u]}) >= 2)
        lines += ['', f'In mindestens zwei verschiedenen Wochen aktiv: **{repeat} von {len(alias)}**.',
                  '', '> Wiederholte Nutzung im Test ist ein Hinweis, kein Nachweis langfristiger Nutzung (Plan Phase 5).', '']

        text = '\n'.join(lines)
        if output:
            with open(output, 'w', encoding='utf-8') as handle:
                handle.write(text)
            self.stdout.write(f'Bericht geschrieben: {output} ({len(alias)} Personen)')
        else:
            self.stdout.write(text)
