"""Wiederholungen für Aufgaben und Termine — eine Logik für Haushalt und
Organisation (keine zweite „Engine“). Eine Wiederholung ist entweder alle N
Tage (`days`; wöchentlich = 7) oder alle N Kalendermonate (`months`;
jährlich = 12). Es entstehen nie Datensätze pro Vorkommen: Aufgaben rücken
beim Erledigen weiter, Termine werden für einen Zeitraum berechnet."""

import calendar
from collections.abc import Iterator
from datetime import date, timedelta

# Die einfache Auswahl im Formular und ihre Intervalle.
SIMPLE = {'daily': (1, None), 'weekly': (7, None), 'monthly': (None, 1), 'yearly': (None, 12)}


def add_months(value: date, months: int) -> date:
    """value + months Monate; der Tag wird auf das Monatsende begrenzt
    (31.01. + 1 Monat = 28./29.02.)."""
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def nth(base: date, days: int | None, months: int | None, step: int) -> date:
    """Das `step`-te Vorkommen nach `base` (0 = base selbst). Monate werden
    immer vom Start aus gezählt, damit der 31. nicht dauerhaft zum 28. wird."""
    if days:
        return base + timedelta(days=days * step)
    return add_months(base, (months or 1) * step)


def next_after(base: date, days: int | None, months: int | None, today: date) -> date:
    """Nächster Termin nach `today` im Rhythmus ab `base` — vom bisherigen
    Fälligkeitsdatum aus (Di 06.10 → Di 13.10); spät erledigt rückt im selben
    Rhythmus weiter, ohne Nachhol-Datensätze."""
    step = 1
    while True:
        day = nth(base, days, months, step)
        if day > today:
            return day
        step += 1


def occurrences(base: date, days: int | None, months: int | None, start: date, end: date, limit: int = 400) -> Iterator[date]:
    """Alle Vorkommen im Bereich [start, end] (beide einschließlich), höchstens `limit`."""
    if base > end:
        return
    step = 0
    if days and base < start:
        # Direkt zum ersten Vorkommen im Bereich springen statt Jahre durchzuzählen.
        step = max(0, (start - base).days // days)
    elif months and base < start:
        step = max(0, ((start.year - base.year) * 12 + start.month - base.month) // months - 1)
    count = 0
    while count < limit:
        day = nth(base, days, months, step)
        if day > end:
            return
        if day >= start:
            count += 1
            yield day
        step += 1
