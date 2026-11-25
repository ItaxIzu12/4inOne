"""O1 – Erinnerung per E-Mail (22.11.2026; seit 24.11.2026 in connections, weil sie Organisation, Haushalt und Reisen
zusammenfasst – docs/ARCHITECTURE.md § 3.1).

Freiwillig und standardmäßig aus (UserPreference.reminder_email). Wer sie einschaltet, bekommt morgens eine kurze
Zusammenfassung — täglich oder wöchentlich am Montag:

- Termine und Aufgaben von heute (Organisation, wie „Heute“),
- fällige und überfällige Haushalts- und Reiseaufgaben (für mich oder niemanden),
- Fristen aus Haushalt › Zuhause: Kündigung, Wartung, Garantieende (täglich: in den nächsten 3 Tagen; wöchentlich: in
  den nächsten 14 Tagen).

Jeder Abschnitt nutzt dieselben Sichtbarkeitsregeln wie „Heute“ (connections/today.py). Ist nichts zu sagen, wird
keine E-Mail geschickt. Versand über den Befehl `send_reminder_emails` (z. B. per Cron um 7 Uhr); er merkt sich den
Tag des letzten Versands, ein zweiter Lauf am selben Tag schickt nichts doppelt. Nur an bestätigte Adressen.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from django.conf import settings
from django.core.mail import send_mail

from core.email_verification import is_verified
from core.models import UserPreference

logger = logging.getLogger(__name__)

DAILY_DEADLINE_DAYS = 3
WEEKLY_DEADLINE_DAYS = 14
MAX_LINES = 8


def _de(iso: str) -> str:
    return date.fromisoformat(iso[:10]).strftime('%d.%m.')


def _clip(lines: list[str]) -> list[str]:
    if len(lines) <= MAX_LINES:
        return lines
    return lines[:MAX_LINES] + [f'  … und {len(lines) - MAX_LINES} weitere']


def build_digest(user, weekly: bool, tz_name: str | None = None) -> tuple[str, str] | None:
    """(Betreff, Text) der Erinnerung — oder None, wenn heute nichts ansteht."""
    from connections.today import _haushalt, _reisen
    from organisation.views import today_data
    from zoneinfo import ZoneInfo

    tz_name = tz_name or settings.TIME_ZONE
    organisation = today_data(user, tz_name)
    today = date.fromisoformat(organisation['date'])
    household = _haushalt(user, today)
    travel = _reisen(user, today, ZoneInfo(tz_name))

    day_lines = []
    for item in organisation['items']:
        if item['kind'] == 'event':
            when = 'ganztägig' if item.get('all_day') else datetime.fromisoformat(item['at']).astimezone(ZoneInfo(tz_name)).strftime('%H:%M')
            day_lines.append(f'  {when}  {item["title"]}')
        else:
            note = f'überfällig seit {_de(item["at"])}' if item.get('overdue') else 'heute'
            day_lines.append(f'  Aufgabe  {item["title"]} ({note})')
    for event in travel.get('events', []):
        when = datetime.fromisoformat(event['at']).astimezone(ZoneInfo(tz_name)).strftime('%H:%M')
        day_lines.append(f'  {when}  {event["title"]} ({event["trip_title"]})')

    task_lines = []
    for task in (household or {}).get('tasks', []):
        note = f'überfällig seit {_de(task["due_date"])}' if task['overdue'] else 'heute'
        task_lines.append(f'  Haushalt  {task["title"]} ({note})')
    for task in travel.get('tasks', []):
        note = f'überfällig seit {_de(task["due_date"])}' if task['overdue'] else 'heute'
        task_lines.append(f'  {task["trip_title"]}  {task["title"]} ({note})')

    horizon = WEEKLY_DEADLINE_DAYS if weekly else DAILY_DEADLINE_DAYS
    deadline_lines = [
        f'  {d["title"]} – {_de(d["date"])}'
        + (' (heute)' if d['days'] == 0 else f' (in {d["days"]} Tagen)' if d['days'] > 1 else ' (morgen)')
        for d in (household or {}).get('deadlines', [])
        if 0 <= d['days'] <= horizon
    ]

    if not (day_lines or task_lines or deadline_lines):
        return None

    name = (user.first_name or '').strip()
    parts = [f'Guten Morgen{", " + name if name else ""},', '']
    parts.append('hier ist, was diese Woche ansteht:' if weekly else 'hier ist, was heute ansteht:')
    if day_lines:
        parts += ['', 'Heute', *_clip(day_lines)]
    if task_lines:
        parts += ['', 'Fällige Aufgaben', *_clip(task_lines)]
    if deadline_lines:
        parts += ['', f'Fristen in den nächsten {horizon} Tagen', *_clip(deadline_lines)]
    parts += [
        '',
        f'In 4inOne öffnen: {settings.FRONTEND_URL}/',
        '',
        'Du bekommst diese E-Mail, weil du in 4inOne Erinnerungen per E-Mail eingeschaltet hast. Abschalten oder auf '
        f'„wöchentlich“ ändern: {settings.FRONTEND_URL}/einstellungen/profil',
    ]
    count = len(day_lines) + len(task_lines) + len(deadline_lines)
    subject = f'4inOne – {"deine Woche" if weekly else "heute"}: {count} {"Punkt" if count == 1 else "Punkte"}'
    return subject, '\n'.join(parts) + '\n'


def due_today(preference: UserPreference, today: date) -> bool:
    if preference.reminder_email == UserPreference.ReminderEmail.OFF:
        return False
    if preference.reminder_last_sent == today:
        return False
    if preference.reminder_email == UserPreference.ReminderEmail.WEEKLY:
        return today.weekday() == 0  # Montag
    return True


def send_due_reminders(today: date, dry_run: bool = False) -> dict:
    """Schickt allen fälligen Personen ihre Erinnerung. Zählt gesendet, übersprungen (nichts zu sagen) und Fehler."""
    stats = {'sent': 0, 'empty': 0, 'skipped': 0, 'failed': 0}
    preferences = (
        UserPreference.objects.exclude(reminder_email=UserPreference.ReminderEmail.OFF)
        .select_related('user')
        .filter(user__is_active=True)
    )
    for preference in preferences:
        user = preference.user
        if not due_today(preference, today) or not user.email or not is_verified(user):
            stats['skipped'] += 1
            continue
        try:
            digest = build_digest(user, weekly=preference.reminder_email == UserPreference.ReminderEmail.WEEKLY)
        except Exception:  # eine kaputte Quelle darf den Versand an andere nicht aufhalten
            logger.exception('Erinnerung konnte nicht zusammengestellt werden')
            stats['failed'] += 1
            continue
        if digest is None:
            stats['empty'] += 1
        elif not dry_run:
            subject, body = digest
            try:
                send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])
            except Exception:
                logger.exception('Erinnerung konnte nicht gesendet werden')  # ohne Adresse im Log
                stats['failed'] += 1
                continue
            stats['sent'] += 1
        else:
            stats['sent'] += 1
        if not dry_run:
            # Auch „nichts zu sagen“ zählt als erledigt für heute — der Befehl darf mehrmals laufen.
            preference.reminder_last_sent = today
            preference.save(update_fields=['reminder_last_sent'])
    return stats

