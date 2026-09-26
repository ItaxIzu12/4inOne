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
wenn das Ziel später erreicht wird. Erreichte Ziele reservieren nichts mehr
(nur tatsächlich Gespartes zählt). Pausierte Ziele mindern das Budget gar nicht:
Gespartes und Rate sind frei, bis das Ziel wieder aktiv ist.

Ziele OHNE Rate halten ihr bisher Gespartes in jedem Monat ihres Zeitraums zurück: 450 € gespart,
gültig ab September bis auf Weiteres, mindern das Budget von September, Oktober, November … je um 450 €.
Endet der Zeitraum, wird das Ziel pausiert oder gelöscht, ist das Geld wieder frei.

Es wird nichts automatisch in „Bereits gespart“ gebucht — die Rate ist eine
sichtbare Reservierung, keine stille Datenänderung."""

from collections import defaultdict
from datetime import date, timedelta
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


def contribution_date(goal: SavingsGoal, today: date) -> date:
    """Wann eine Einzahlung ins Ziel zählt: heute — aber innerhalb des Zeitraums, für den das Ziel gilt.
    Ein Ziel für Oktober mindert das Budget im Oktober, auch wenn du es schon im September anlegst."""
    if goal.plan_month is None:
        return today
    if today < goal.plan_month:
        return goal.plan_month
    if not goal.plan_open_ended:
        last_month = goal.plan_end_month or goal.plan_month
        end = _next_month(last_month).replace(day=1)
        if today >= end:
            return end - timedelta(days=1)
    return today


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


def _held(goal: SavingsGoal, by_month: dict[date, Decimal], month: date) -> Decimal:
    """Bis Monatsende Gespartes eines Ziels ohne Rate — nur in den Monaten, in denen das Ziel gilt."""
    if not _in_period(goal, month):
        return ZERO
    end = _next_month(month)
    return max(sum((v for m, v in by_month.items() if m < end), ZERO), ZERO)


class SavingsPlanner:
    """Lädt die Sparziele und Einzahlungen einer Person einmal und rechnet damit beliebig
    viele Monate — für die Vorschau über mehrere Monate nötig, ohne jedes Mal neu zu laden."""

    def __init__(self, owner):
        self.monthly: dict[int, dict[date, Decimal]] = defaultdict(dict)
        rows = (
            SavingsContribution.objects.filter(owner=owner)
            .annotate(m=TruncMonth('date'))
            .values('goal_id', 'm')
            .annotate(total=Sum('amount'))
        )
        for row in rows:
            month = row['m'].date() if hasattr(row['m'], 'date') and not isinstance(row['m'], date) else row['m']
            self.monthly[row['goal_id']][month] = row['total']
        self.goals = list(SavingsGoal.objects.filter(owner=owner, currency='EUR'))

    def for_month(self, month_start: date) -> tuple[Decimal, Decimal]:
        """(insgesamt zurückgelegt, davon nur geplant) für den Monat — Summe über alle Ziele."""
        total, planned_part = ZERO, ZERO
        for goal in self.goals:
            if goal.status == 'PAUSED':
                continue  # pausiert: das Geld ist frei, weder Gespartes noch Rate mindern das Budget
            by_month = self.monthly.get(goal.pk, {})
            if goal.monthly_amount and goal.status == 'ACTIVE':
                effect, planned_only = _simulate(goal, by_month, month_start)
            elif goal.plan_month is not None:
                # Ohne Sparrate hält das Ziel sein Gespartes in JEDEM Monat seines Zeitraums zurück (Stand Monatsende).
                effect = _held(goal, by_month, month_start)
                planned_only = ZERO
            else:
                effect, planned_only = by_month.get(month_start, ZERO), ZERO
            total += effect
            planned_part += planned_only
        return total, planned_part


def reserved_for_month(owner, month_start: date) -> tuple[Decimal, Decimal]:
    return SavingsPlanner(owner).for_month(month_start)


PLAN_HORIZON_MONTHS = 12


def available_for_month(owner, month: date, planner: 'SavingsPlanner | None' = None):
    """(verfügbar, davon nur geplant) für den Monat; verfügbar ist None, wenn kein Budget gilt.
    verfügbar = Budget + Einnahmen − Ausgaben − Zurückgelegtes."""
    from .models import MonthlyBudget, Transaction
    from .services import month_bounds

    planner = planner or SavingsPlanner(owner)
    saved, planned = planner.for_month(month)
    budget = MonthlyBudget.for_month(owner, month)
    if budget is None:
        return None, planned
    first, last = month_bounds(month)
    rows = Transaction.objects.filter(owner=owner, datum__gte=first, datum__lt=last, currency='EUR')
    income = rows.filter(type='INCOME').aggregate(t=Sum('amount'))['t'] or ZERO
    expense = rows.filter(type='EXPENSE').aggregate(t=Sum('amount'))['t'] or ZERO
    return budget.amount + income - expense - saved, planned


def plan_alert(owner, start: date, planner: SavingsPlanner | None = None, months: int = PLAN_HORIZON_MONTHS):
    """Der erste Monat (ab `start`, höchstens `months` Monate weit), in dem Budget und Einnahmen nicht
    für alle Sparraten reichen — sonst None.

    Nur Monate, in denen wirklich eine Rate reserviert ist und ein Budget gilt; ein Minus allein durch
    Ausgaben ist Sache der normalen Überschreitungs-Meldung. Rein zur Warnung: es wird nichts verändert."""
    planner = planner or SavingsPlanner(owner)
    cursor = start
    for _ in range(months):
        available, planned = available_for_month(owner, cursor, planner)
        if planned > 0 and available is not None and available < 0:
            return {'month': cursor.strftime('%Y-%m'), 'over': format(-available, '.2f'), 'planned': format(planned, '.2f')}
        cursor = _next_month(cursor)
    return None


def goal_change_warning(owner, apply):
    """Vorschau: Was würde eine Änderung an einem Sparziel bewirken — bevor sie gespeichert wird?

    `apply` führt die Änderung aus (Ziel anlegen oder ändern, samt Einzahlung). Sie läuft in einer
    Transaktion, die danach IMMER zurückgerollt wird: es bleibt nichts in der Datenbank zurück.

    Gewarnt wird nur, wenn die Änderung die Lage verschlechtert:
    - `month_over`: in einem der nächsten Monate (ab heute) reicht das verfügbare Budget danach nicht,
    - `plan_alert`: in einem der nächsten Monate reichen Budget und Einnahmen nicht für alle Sparraten.
    Ohne Budget gibt es nichts zu vergleichen."""
    from django.db import transaction
    from django.utils import timezone

    month = timezone.localdate().replace(day=1)
    months = [month]
    for _ in range(PLAN_HORIZON_MONTHS - 1):
        months.append(_next_month(months[-1]))
    before_available = [available_for_month(owner, m)[0] for m in months]
    before_alert = plan_alert(owner, month)

    class _Rollback(Exception):
        pass

    try:
        with transaction.atomic():
            apply()
            after_rows = [available_for_month(owner, m) for m in months]
            after_available = [row[0] for row in after_rows]
            after_planned = [row[1] for row in after_rows]
            after_alert = plan_alert(owner, month)
            raise _Rollback
    except _Rollback:
        pass

    # Erster Monat (ab heute), in dem das verfügbare Budget nach der Änderung nicht reicht — und schlechter ist als vorher.
    month_over = None
    for m, before, after, planned in zip(months, before_available, after_available, after_planned):
        if m != month and planned > 0:
            continue  # Monate mit Sparrate meldet die Sparraten-Warnung
        if after is not None and after < 0 and (before is None or after < before):
            month_over = {'month': m.strftime('%Y-%m'), 'over': format(-after, '.2f')}
            break
    alert = None
    if after_alert is not None and (
        before_alert is None
        or Decimal(after_alert['over']) > Decimal(before_alert['over'])
        or after_alert['month'] < before_alert['month']
    ):
        alert = after_alert
    return {'month_over': month_over, 'plan_alert': alert}
