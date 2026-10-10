"""Umrechnungs-Schnappschuss einer Reiseausgabe (siehe TripExpense in models.py).

- Der Originalbetrag (amount, currency) ist die tatsächliche Zahlung und wird nie verändert.
- `amount_trip`: Wert in der Reisewährung — Grundlage für „Ausgegeben“/„Verbleibend“. Gleiche Währung = Kurs 1.
- `amount_home`: Vergleichswert in der Heimatwährung dessen, der die Ausgabe erfasst — historisch: einmal gespeichert,
  springt er nicht mit späteren Kursen mit. Neu berechnet wird nur, wenn sich Betrag oder Währung ändern.
- Ohne verfügbaren Kurs bleiben die Felder leer — nichts wird geraten.
"""

from __future__ import annotations

from core.fx import Rate, convert, get_rate, latest_table


class _Rates:
    """Holt die Kurstabelle höchstens einmal je Vorgang — und nur, wenn wirklich umgerechnet werden muss."""

    def __init__(self):
        self._table = None
        self._loaded = False

    def rate(self, source: str, target: str) -> Rate | None:
        if source == target:
            return get_rate(source, target)
        if not self._loaded:
            self._table, self._loaded = latest_table(), True
        return get_rate(source, target, self._table) if self._table else None


def snapshot_expense(expense, *, home_currency: str, recompute: bool, rates: _Rates | None = None) -> None:
    """Füllt fehlende Umrechnungen; mit `recompute` (Betrag/Währung geändert) werden beide neu berechnet."""
    rates = rates or _Rates()
    used: list[Rate] = []
    if recompute or expense.amount_trip is None:
        _to_trip(expense, rates, used)
    if recompute or expense.amount_home is None:
        rate = rates.rate(expense.currency, home_currency)
        expense.home_currency = home_currency
        expense.rate_to_home = rate.rate if rate else None
        expense.amount_home = convert(expense.amount, rate) if rate else None
        if rate and expense.currency != home_currency:
            used.append(rate)
    if used:
        expense.rate_date = used[0].rate_date
    elif recompute:
        expense.rate_date = None


def _to_trip(expense, rates: _Rates, used: list[Rate]) -> None:
    trip_currency = expense.trip.currency
    rate = rates.rate(expense.currency, trip_currency)
    expense.rate_to_trip = rate.rate if rate else None
    expense.amount_trip = convert(expense.amount, rate) if rate else None
    if rate and expense.currency != trip_currency:
        used.append(rate)


def resnapshot_trip_currency(trip) -> None:
    """Die Reisewährung wurde geändert: die Werte in Reisewährung neu berechnen (Planungsgröße, aktueller Richtkurs).
    Originalbeträge und die historischen Heimatwährungs-Werte bleiben unverändert."""
    rates = _Rates()
    for expense in trip.tripexpenses.select_related('trip'):
        used: list[Rate] = []
        _to_trip(expense, rates, used)
        expense.save(update_fields=['amount_trip', 'rate_to_trip'])


def backfill_pending(expenses) -> int:
    """Ausgaben, die während eines Kursausfalls gespeichert wurden (kein Wert in Reisewährung), nachrechnen, sobald
    wieder ein Kurs da ist — mit dem dann aktuellen Richtkurs; `rate_date` zeigt, von wann er ist. Die Heimatwährung
    bleibt die, die beim Speichern galt. Alte, migrierte Ausgaben sind nicht betroffen (sie haben einen Wert in
    Reisewährung, ihr Heimatwert bleibt unbekannt). Gibt die Zahl der nachgerechneten Ausgaben zurück."""
    pending = list(expenses.filter(amount_trip__isnull=True).select_related('trip'))
    if not pending:
        return 0
    rates = _Rates()
    done = 0
    for expense in pending:
        used: list[Rate] = []
        _to_trip(expense, rates, used)
        if expense.amount_trip is None:
            continue
        if expense.amount_home is None and expense.home_currency:
            rate = rates.rate(expense.currency, expense.home_currency)
            if rate:
                expense.rate_to_home, expense.amount_home = rate.rate, convert(expense.amount, rate)
                if expense.currency != expense.home_currency:
                    used.append(rate)
        if used and expense.rate_date is None:
            expense.rate_date = used[0].rate_date
        expense.save(update_fields=['amount_trip', 'rate_to_trip', 'amount_home', 'rate_to_home', 'rate_date'])
        done += 1
    return done
