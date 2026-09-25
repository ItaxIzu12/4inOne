"""Was Sparziele in einem Monat vom verfügbaren Budget zurücklegen.

Zwei Quellen:
- tatsächlich Gespartes (`SavingsContribution`, datiert),
- die geplante Sparrate eines Ziels (`monthly_amount` im Zeitraum `plan_month` ..).

Pro Ziel und Monat zählt der GRÖSSERE der beiden Werte, damit nichts doppelt
abgezogen wird: Hast du im Plan-Monat 80 € statt der geplanten 50 € gespart, zählen
80 €; hast du noch nichts gebucht, bleiben die geplanten 50 € reserviert.

Die Rate endet von selbst, sobald das Ziel erreicht wäre: es wird nie mehr
reserviert als noch fehlt. Das rechnen wir Monat für Monat ab dem Planstart nach
(`_simulate`), so bleiben auch vergangene Monate stabil und ändern sich nicht,
wenn das Ziel später erreicht wird. Pausierte oder erreichte Ziele reservieren
nichts (nur tatsächlich Gespartes zählt dann noch).

Es wird nichts automatisch in „Bereits gespart“ gebucht — die Rate ist eine
sichtbare Reservierung, keine stille Datenänderung."""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import TruncMonth

from .models import SavingsContribution, SavingsGoal

ZERO = Decimal('0.00')
MAX_PLAN_MONTHS = 1200  # 100 Jahre — Schutz vor endlosen Schleifen bei kaputten Daten


def _next_month(day: date) -> date:
    return date(day.year + (day.month == 12), day.month % 12 + 1, 1)


def _in_period(goal: SavingsGoal, month: date) -> bool:
    if goal.plan_month is None or month < goal.plan_month:
        return False
    if goal.plan_open_ended:
        return True
    return month <= (goal.plan_end_month or goal.plan_month)


def _simulate(goal: SavingsGoal, by_month: dict[date, Decimal], month: date) -> tuple[Decimal, Decimal]:
    """(Wirkung dieses Monats, davon nur geplant) für ein Ziel mit Sparrate."""
    actual_in_month = by_month.get(month, ZERO)
    if not _in_period(goal, month):
        return actual_in_month, ZERO
    # Bereits Gespartes vor dem Planstart zählt für „wie viel fehlt noch“.
    running = sum((v for m, v in by_month.items() if m < goal.plan_month), ZERO)
    cursor, steps = goal.plan_month, 0
    while steps < MAX_PLAN_MONTHS:
        in_period = _in_period(goal, cursor)
        actual = by_month.get(cursor, ZERO)
        planned = min(goal.monthly_amount, max(goal.target_amount - running, ZERO)) if in_period else ZERO
        effect = max(planned, actual)
        if cursor == month:
            return effect, max(planned - actual, ZERO)
        running += effect
        cursor, steps = _next_month(cursor), steps + 1
    return actual_in_month, ZERO


def reserved_for_month(owner, month_start: date) -> tuple[Decimal, Decimal]:
    """(insgesamt zurückgelegt, davon nur geplant) für den Monat — Summe über alle Ziele."""
    monthly = defaultdict(dict)
    rows = (
        SavingsContribution.objects.filter(owner=owner)
        .annotate(m=TruncMonth('date'))
        .values('goal_id', 'm')
        .annotate(total=Sum('amount'))
    )
    for row in rows:
        month = row['m'].date() if hasattr(row['m'], 'date') and not isinstance(row['m'], date) else row['m']
        monthly[row['goal_id']][month] = row['total']

    total, planned_part = ZERO, ZERO
    goals = SavingsGoal.objects.filter(owner=owner, currency='EUR')
    for goal in goals:
        by_month = monthly.get(goal.pk, {})
        if goal.monthly_amount and goal.status == 'ACTIVE':
            effect, planned_only = _simulate(goal, by_month, month_start)
        else:
            effect, planned_only = by_month.get(month_start, ZERO), ZERO
        total += effect
        planned_part += planned_only
    return total, planned_part
