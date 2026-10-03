"""Vorschläge V1: erkennen → erklären → vorschlagen → die Person entscheidet
(D-009). Nichts passiert automatisch.

Vorschläge werden nie gespeichert, sondern bei jedem Aufruf aus den echten
Daten berechnet. Gespeichert wird nur eine Ablehnung (SuggestionDismissal).
So kann ein Vorschlag nie veralten: Ist der Anlass weg (Sparziel verknüpft,
Aufgabe verschoben, Packliste gefüllt), verschwindet auch der Vorschlag.

Erster Ablauf: „Reise planen“. Eine Reise fragt drei Dinge:

- Wovon wird sie bezahlt? → privates Sparziel mit Monatsrate (Finanzen).
- Was bleibt zu Hause liegen? → Haushaltsaufgaben, die in die Reisezeit
  fallen: verschieben, abgeben oder nur verknüpfen (Haushalt).
- Ist sie vorbereitet? → leere Packliste kurz vor der Abreise (Reisen).

Sicherheit (ADR-001):

- Jede Regel sieht nur, was die Person auch in der Domain sehen darf: die
  Reise über registry.KINDS, Haushaltsaufgaben nur aus IHREM Haushalt, ein
  Sparziel nur als ihr eigenes.
- Eine Mitreisende aus einem anderen Haushalt bekommt nie Vorschläge zu
  fremden Haushaltsaufgaben, und ihr Sparziel bleibt privat. Die
  Verbindung Reise↔Sparziel sieht nur, wer beide Seiten sehen darf.
- Annehmen berechnet den Vorschlag neu, statt Angaben vom Client zu
  übernehmen. Ein veralteter oder fremder Schlüssel ergibt 404.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_UP, Decimal
from types import SimpleNamespace

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from connections import services
from connections.models import Connection, ObjectType, Origin, SuggestionDismissal
from connections.registry import KINDS, _date, _euro
from finanzen.models import MonthlyBudget, SavingsGoal
from haushalt import services as haushalt_services
from haushalt.models import Task as HouseholdTask
from reisen.models import Trip, TripParticipant
from reisen.permissions import WRITABLE_ROLES

PACKING_LEAD_DAYS = 7
TODAY_TRIP_LIMIT = 10
MAX_MONTH_SPAN = 240  # Schutz gegen Endlosschleifen bei monatlichen Aufgaben

ACTIVE_TRIP_STATUSES = (Trip.Status.PLANNED, Trip.Status.ACTIVE)


class SuggestionError(services.ConnectionRuleError):
    pass


@dataclass
class Suggestion:
    key: str
    kind: str
    title: str
    reason: str
    trip: Trip
    priority: int
    actions: list[dict] = field(default_factory=list)
    detail: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            'key': self.key,
            'kind': self.kind,
            'title': self.title,
            'reason': self.reason,
            'trip': {'id': self.trip.pk, 'title': self.trip.title},
            'actions': self.actions,
            'detail': self.detail,
        }


# ---------------------------------------------------------------------------
# Hilfen
# ---------------------------------------------------------------------------


def _first_of_month(value: date) -> date:
    return value.replace(day=1)


def _next_month(value: date) -> date:
    return date(value.year + 1, 1, 1) if value.month == 12 else date(value.year, value.month + 1, 1)


def _months_between(first: date, last: date) -> list[date]:
    months, cursor = [], first
    while cursor <= last and len(months) < MAX_MONTH_SPAN:
        months.append(cursor)
        cursor = _next_month(cursor)
    return months


def _can_edit_trip_content(user, trip: Trip) -> bool:
    """Wie reisen.permissions.TripContentAccessPermission für Schreibzugriffe."""
    if trip.owner_id == user.pk:
        return True
    return TripParticipant.objects.filter(trip=trip, user=user, role__in=WRITABLE_ROLES).exists()


def _headcount(trip: Trip) -> int:
    people = set(trip.participants.values_list('user_id', flat=True))
    people.add(trip.owner_id)
    return len(people)


def _budget_total(trip: Trip) -> Decimal | None:
    if trip.budget_amount:
        return trip.budget_amount
    planned = trip.tripbudgetcategorys.aggregate(total=Sum('planned_amount'))['total']
    return planned or None


def _connected_ids(trip: Trip, other_type: str) -> set[int]:
    ids = set()
    for connection in Connection.objects.filter(
        Q(source_type=ObjectType.TRIP, source_id=trip.pk, target_type=other_type)
        | Q(target_type=ObjectType.TRIP, target_id=trip.pk, source_type=other_type)
    ):
        ids.add(connection.target_id if connection.source_type == ObjectType.TRIP else connection.source_id)
    return ids


def _link(user, trip: Trip, other_type: str, other_id: int) -> None:
    if other_id in _connected_ids(trip, other_type):
        return
    services.create_connection(user, ObjectType.TRIP, trip.pk, other_type, other_id, origin=Origin.SUGGESTED)


def occurs_between(task: HouseholdTask, start: date, end: date) -> date | None:
    """Erster Fälligkeitstag der Aufgabe in [start, end], sonst None.
    Wiederkehrende Aufgaben werden ab ihrem nächsten Fälligkeitstag
    weitergerechnet — so, wie sie nach dem Abhaken weiterrücken würden."""
    due = task.due_date
    if due is None or due > end:
        return None
    if due >= start:
        return due
    if task.recurrence_days:
        steps = -(-(start - due).days // task.recurrence_days)
        candidate = due + timedelta(days=steps * task.recurrence_days)
        return candidate if candidate <= end else None
    if task.recurrence_months:
        for step in range(1, MAX_MONTH_SPAN):
            candidate = haushalt_services.add_months(due, step * task.recurrence_months)
            if candidate > end:
                return None
            if candidate >= start:
                return candidate
    return None


def _is_recurring(task: HouseholdTask) -> bool:
    return bool(task.recurrence_days or task.recurrence_months)


def _recurrence_text(task: HouseholdTask) -> str:
    if task.recurrence_months:
        return 'jeden Monat' if task.recurrence_months == 1 else f'alle {task.recurrence_months} Monate'
    return {1: 'täglich', 7: 'jede Woche'}.get(task.recurrence_days, f'alle {task.recurrence_days} Tage')


def _display_name(user) -> str:
    return (user.first_name or user.get_username().split('@')[0]).strip()


# ---------------------------------------------------------------------------
# Regeln
# ---------------------------------------------------------------------------


def _goal_or_budget(user, trip: Trip, today: date) -> list[Suggestion]:
    if trip.status != Trip.Status.PLANNED or trip.start_date <= today:
        return []
    connected = _connected_ids(trip, ObjectType.SAVINGS_GOAL)
    if connected and SavingsGoal.objects.filter(owner=user, pk__in=connected).exists():
        return []

    total = _budget_total(trip)
    if trip.currency != Trip.Currency.EUR:
        # Die privaten Finanzen rechnen nur in Euro, und 4inOne kennt keine
        # Wechselkurse. Statt still nichts zu sagen: erklären und die Person
        # das Ziel selbst in Euro anlegen lassen.
        if total is None:
            return []
        return [
            Suggestion(
                key=f'trip:{trip.pk}:goal-foreign',
                kind='TRIP_SAVINGS_GOAL_MANUAL',
                title=f'Für „{trip.title}“ sparen',
                reason=(
                    f'Das Budget der Reise ist in {trip.currency} geplant, deine Finanzen rechnen in Euro. '
                    '4inOne kennt keinen Wechselkurs – lege das Sparziel deshalb selbst in Euro an und '
                    'verknüpfe es dann mit der Reise.'
                ),
                trip=trip,
                priority=2,
                actions=[{'action': 'open_finance', 'label': 'Sparziel in Finanzen anlegen', 'navigate': True}],
                detail={'budget_total': str(total), 'currency': trip.currency},
            )
        ]
    if total is None:
        if not _can_edit_trip_content(user, trip):
            return []
        return [
            Suggestion(
                key=f'trip:{trip.pk}:budget',
                kind='TRIP_BUDGET',
                title=f'Budget für „{trip.title}“ festlegen',
                reason=(
                    'Ohne Budget kann 4inOne nicht ausrechnen, wie viel du bis zur Abreise '
                    'pro Monat zurücklegen solltest.'
                ),
                trip=trip,
                priority=3,
                actions=[{'action': 'open_budget', 'label': 'Budget festlegen', 'navigate': True}],
            )
        ]

    people = _headcount(trip)
    share = (total / people).quantize(Decimal('0.01'), rounding=ROUND_UP)
    plan_month = _first_of_month(today)
    plan_end_month = max(_first_of_month(trip.start_date - timedelta(days=1)), plan_month)
    months = _months_between(plan_month, plan_end_month)
    rate = min((share / len(months)).quantize(Decimal('0.01'), rounding=ROUND_UP), share)
    budgets_missing = any(MonthlyBudget.for_month(user, month) is None for month in months)

    if people > 1:
        basis = f'Euer Budget von {_euro(total)} geteilt durch {people} Personen sind {_euro(share)} für dich.'
    else:
        basis = f'Das Budget der Reise ist {_euro(share)}.'
    month_word = 'Monat' if len(months) == 1 else 'Monate'
    if budgets_missing:
        plan = (
            f'Bis zur Abreise am {_date(trip.start_date)} bleiben {len(months)} {month_word}. '
            'Du hast noch nicht für jeden dieser Monate ein Budget – das Sparziel wird deshalb ohne '
            'feste Monatsrate angelegt. Sobald die Budgets stehen, kannst du die Rate eintragen.'
        )
        monthly = None
    else:
        plan = (
            f'Bis zur Abreise am {_date(trip.start_date)} bleiben {len(months)} {month_word} – '
            f'das sind {_euro(rate)} pro Monat.'
        )
        monthly = rate
    return [
        Suggestion(
            key=f'trip:{trip.pk}:goal',
            kind='TRIP_SAVINGS_GOAL',
            title=f'Für „{trip.title}“ sparen',
            reason=f'{basis} {plan}',
            trip=trip,
            priority=2,
            actions=[{'action': 'create_goal', 'label': 'Sparziel anlegen'}],
            detail={
                'target_amount': str(share),
                'monthly_amount': str(monthly) if monthly is not None else None,
                'months': len(months),
                'plan_month': plan_month.isoformat(),
                'plan_end_month': plan_end_month.isoformat(),
                'people': people,
                'budget_total': str(total),
            },
        )
    ]


def _household_consequences(user, trip: Trip, today: date) -> list[Suggestion]:
    if trip.status not in ACTIVE_TRIP_STATUSES or trip.end_date < today:
        return []
    membership = haushalt_services.membership_for(user)
    if membership is None:
        return []
    household = membership.household
    start = max(trip.start_date, today)
    already = _connected_ids(trip, ObjectType.HOUSEHOLD_TASK)
    others = [
        {'id': member.pk, 'name': _display_name(member)}
        for member in household.members.exclude(pk=user.pk).order_by('id')
    ]
    tasks = (
        HouseholdTask.objects.filter(household=household, is_done=False, due_date__isnull=False, due_date__lte=trip.end_date)
        .filter(Q(assigned_to=user) | Q(assigned_to__isnull=True))
        .exclude(pk__in=already)
        .order_by('due_date', 'id')
    )
    after_trip = trip.end_date + timedelta(days=1)
    where = f'in {trip.destination}' if trip.destination else f'auf „{trip.title}“'
    result = []
    for task in tasks:
        hit = occurs_between(task, start, trip.end_date)
        if hit is None:
            continue
        actions = []
        if task.due_date >= start:
            # Nur wenn der nächste Termin selbst in die Reise fällt — sonst
            # würde Verschieben Termine VOR der Reise überspringen.
            actions.append({'action': 'postpone', 'label': f'Auf {_date(after_trip)} verschieben'})
        if others:
            actions.append({'action': 'hand_over', 'label': 'Jemand anderes übernimmt', 'needs_member': True})
        actions.append({'action': 'link', 'label': 'Nur merken'})

        if _is_recurring(task):
            reason = (
                f'Sie ist {_recurrence_text(task)} dran – am {_date(hit)} bist du {where} '
                f'({_date(trip.start_date)}–{_date(trip.end_date)}).'
            )
        else:
            reason = f'Sie ist am {_date(hit)} fällig – da bist du {where}.'
        if task.assigned_to_id is None:
            reason += ' Sie ist noch niemandem zugeteilt.'
        result.append(
            Suggestion(
                key=f'trip:{trip.pk}:htask:{task.pk}',
                kind='TRIP_HOUSEHOLD_TASK',
                title=f'„{task.title}“ fällt in deine Reise',
                reason=reason,
                trip=trip,
                priority=1,
                actions=actions,
                detail={
                    'task_id': task.pk,
                    'due_date': hit.isoformat(),
                    'postpone_to': after_trip.isoformat(),
                    'recurring': _is_recurring(task),
                    'members': others,
                },
            )
        )
    return result


def _packing(user, trip: Trip, today: date) -> list[Suggestion]:
    if trip.status != Trip.Status.PLANNED:
        return []
    days = (trip.start_date - today).days
    if not 0 <= days <= PACKING_LEAD_DAYS or trip.packingitems.exists():
        return []
    if not _can_edit_trip_content(user, trip):
        return []
    when = 'heute' if days == 0 else 'morgen' if days == 1 else f'in {days} Tagen'
    return [
        Suggestion(
            key=f'trip:{trip.pk}:packing',
            kind='TRIP_PACKING',
            title='Packliste anlegen',
            reason=f'„{trip.title}“ beginnt {when}, und die Packliste ist noch leer.',
            trip=trip,
            priority=0,
            actions=[{'action': 'open_packing', 'label': 'Packliste öffnen', 'navigate': True}],
        )
    ]


RULES = (_packing, _household_consequences, _goal_or_budget)


def _compute(user, trip: Trip, today: date) -> list[Suggestion]:
    found = [s for rule in RULES for s in rule(user, trip, today)]
    dismissed = set(
        SuggestionDismissal.objects.filter(user=user, key__in=[s.key for s in found]).values_list('key', flat=True)
    )
    return sorted((s for s in found if s.key not in dismissed), key=lambda s: (s.priority, s.trip.start_date, s.key))


# ---------------------------------------------------------------------------
# Öffentliche Funktionen
# ---------------------------------------------------------------------------


def _visible_trip(user, trip_id: int) -> Trip:
    trip = KINDS[ObjectType.TRIP].visible(user).filter(pk=trip_id).first()
    if trip is None:
        raise services.NotFound(services.OBJECT_NOT_FOUND)
    return trip


def for_trip(user, trip_id: int) -> list[dict]:
    trip = _visible_trip(user, trip_id)
    return [s.as_dict() for s in _compute(user, trip, timezone.localdate())]


def for_user(user, limit: int | None = None) -> list[dict]:
    """Vorschläge zu allen anstehenden Reisen der Person (für „Heute“)."""
    today = timezone.localdate()
    trips = (
        KINDS[ObjectType.TRIP]
        .visible(user)
        .filter(status__in=ACTIVE_TRIP_STATUSES, end_date__gte=today)
        .order_by('start_date', 'id')[:TODAY_TRIP_LIMIT]
    )
    found = []
    for trip in trips:
        found.extend(_compute(user, trip, today))
    found.sort(key=lambda s: (s.priority, s.trip.start_date, s.key))
    return [s.as_dict() for s in (found[:limit] if limit else found)]


def _parse_key(key: str) -> int:
    parts = key.split(':')
    if len(parts) < 3 or parts[0] != 'trip' or not parts[1].isdigit():
        raise services.NotFound('Dieser Vorschlag gilt nicht mehr.')
    return int(parts[1])


def _current(user, key: str) -> Suggestion:
    trip = _visible_trip(user, _parse_key(key))
    for suggestion in _compute(user, trip, timezone.localdate()):
        if suggestion.key == key:
            return suggestion
    raise services.NotFound('Dieser Vorschlag gilt nicht mehr.')


def dismiss(user, key: str) -> None:
    _current(user, key)  # nur echte, sichtbare Vorschläge lassen sich ablehnen
    SuggestionDismissal.objects.get_or_create(user=user, key=key)


def accept(user, key: str, action: str, member_id: int | None = None) -> dict:
    suggestion = _current(user, key)
    offered = {a['action']: a for a in suggestion.actions}
    if action not in offered:
        raise SuggestionError('Diese Aktion passt nicht zu diesem Vorschlag.')
    if offered[action].get('navigate'):
        raise SuggestionError('Diese Aktion öffnet nur eine Ansicht und wird nicht gespeichert.')
    with transaction.atomic():
        if suggestion.kind == 'TRIP_SAVINGS_GOAL':
            return _create_goal(user, suggestion)
        return _resolve_task(user, suggestion, action, member_id)


def _create_goal(user, suggestion: Suggestion) -> dict:
    # Über den Serializer der privaten Finanzen, damit dieselben Regeln gelten
    # wie beim Anlegen von Hand (Beträge, Zeitraum, Budget je Monat).
    from finanzen.private_api import SavingsGoalSerializer

    detail = suggestion.detail
    serializer = SavingsGoalSerializer(
        data={
            'title': f'Reise: {suggestion.trip.title}'[:120],
            'target_amount': detail['target_amount'],
            'target_date': suggestion.trip.start_date.isoformat(),
            'monthly_amount': detail['monthly_amount'],
            'plan_month': detail['plan_month'],
            'plan_end_month': detail['plan_end_month'],
        },
        context={'request': SimpleNamespace(user=user)},
    )
    if not serializer.is_valid():
        raise SuggestionError('Das Sparziel ließ sich nicht anlegen. Bitte lege es in Finanzen von Hand an.')
    goal = serializer.save(owner=user)
    _link(user, suggestion.trip, ObjectType.SAVINGS_GOAL, goal.pk)
    rate = f', {_euro(goal.monthly_amount)} pro Monat' if goal.monthly_amount else ''
    return {'detail': f'Sparziel „{goal.title}“ angelegt{rate}.', 'savings_goal_id': goal.pk}


def _resolve_task(user, suggestion: Suggestion, action: str, member_id: int | None) -> dict:
    task = HouseholdTask.objects.select_for_update().get(pk=suggestion.detail['task_id'])
    if action == 'postpone':
        task.due_date = date.fromisoformat(suggestion.detail['postpone_to'])
        task.save(update_fields=['due_date'])
        message = f'„{task.title}“ ist jetzt am {_date(task.due_date)} fällig.'
    elif action == 'hand_over':
        member = next((m for m in suggestion.detail['members'] if m['id'] == member_id), None)
        if member is None:
            raise SuggestionError('Bitte eine Person aus deinem Haushalt auswählen.')
        task.assigned_to_id = member['id']
        task.save(update_fields=['assigned_to'])
        message = f'{member["name"]} übernimmt „{task.title}“.'
    else:
        message = f'„{task.title}“ ist mit der Reise verknüpft.'
    _link(user, suggestion.trip, ObjectType.HOUSEHOLD_TASK, task.pk)
    return {'detail': message, 'household_task_id': task.pk}

