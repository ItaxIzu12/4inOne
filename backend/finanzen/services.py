"""Gemeinsame Monatsrechnung für Übersicht (OverviewView) und Analysen
(AnalysenView) — bewusst EINE Stelle statt zwei getrennter Berechnungen in
den Views, damit beide Tabs serverseitig nicht auseinanderlaufen können
(FinanzenTab.md §4).

Alles hier wird bei jedem Aufruf live berechnet, nie zwischengespeichert
(ARCHITEKTUR.md §2.3).

Zwei Begriffe, die leicht durcheinandergeraten:
- "feste Abzüge" (RecurringDeduction) sind Plangrößen, KEINE Transaktionen.
  Ein Betrag gehört entweder als fester Abzug ODER als Transaktion in den
  Haushalt, nie als beides — sonst wird er doppelt gezählt.
- Es zählen nur AKTIVE Abzüge (ein pausierter fließt nirgends ein).
"""

from datetime import datetime
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from core.models import Household, HouseholdMembership
from finanzen.models import Category, RecurringDeduction, Transaction

ZERO = Decimal('0')


def month_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Erster Moment des laufenden Monats (inklusive) und des Folgemonats
    (exklusive), als aware datetimes in der aktuellen Django-Zeitzone.
    Die Obergrenze verhindert, dass in die Zukunft datierte Buchungen
    schon im laufenden Monat mitzählen."""
    local_now = timezone.localtime(now or timezone.now())
    start = timezone.make_aware(datetime(local_now.year, local_now.month, 1))
    if local_now.month == 12:
        end = timezone.make_aware(datetime(local_now.year + 1, 1, 1))
    else:
        end = timezone.make_aware(datetime(local_now.year, local_now.month + 1, 1))
    return start, end


def month_transactions(household: Household):
    """Alle (nicht weich gelöschten) Transaktionen des laufenden Monats."""
    start, end = month_bounds()
    return Transaction.objects.filter(account__household=household, occurred_at__gte=start, occurred_at__lt=end)


def transactions_total(household: Household) -> Decimal:
    return month_transactions(household).aggregate(total=Sum('amount'))['total'] or ZERO


def active_deductions(household: Household):
    return RecurringDeduction.objects.filter(household=household, active=True)


def active_deductions_total(household: Household) -> Decimal:
    return active_deductions(household).aggregate(total=Sum('amount'))['total'] or ZERO


def household_income_total(household: Household) -> Decimal:
    return (
        HouseholdMembership.objects.filter(household=household, monthly_income__isnull=False).aggregate(
            total=Sum('monthly_income')
        )['total']
        or ZERO
    )


def category_spent(household: Household) -> dict[int, Decimal]:
    """"Ausgegeben" pro Kategorie-ID: Transaktionen dieser Kategorie im
    laufenden Monat PLUS die dieser Kategorie zugeordneten aktiven festen
    Abzüge (FinanzenTab.md §4).

    Bewusst zwei getrennte Abfragen, die in Python zusammengeführt werden:
    zwei Sum()-Annotationen über zwei verschiedene Relationen in EINER
    Abfrage würden die Zeilen beider Joins miteinander multiplizieren und
    die Summen aufblähen."""
    spent: dict[int, Decimal] = {}
    tx_rows = month_transactions(household).exclude(category__isnull=True).values('category_id').annotate(total=Sum('amount'))
    for row in tx_rows:
        spent[row['category_id']] = row['total']

    deduction_rows = (
        active_deductions(household).exclude(category__isnull=True).values('category_id').annotate(total=Sum('amount'))
    )
    for row in deduction_rows:
        spent[row['category_id']] = spent.get(row['category_id'], ZERO) + row['total']
    return spent


def budget_totals(household: Household) -> tuple[Decimal, Decimal]:
    """(ausgegeben, Ziel) für den Budget-Kopf der Übersicht.

    ausgegeben = ALLE Transaktionen des Monats + ALLE aktiven festen Abzüge,
    also auch solche ohne Kategorie — dieselbe Ausgabensumme, die auch vom
    Verfügbaren Einkommen abgezogen wird. Ziel = Summe der monatlichen Ziele
    aller Kategorien des Haushalts."""
    goal = Category.objects.filter(household=household).aggregate(total=Sum('monthly_goal'))['total'] or ZERO
    return transactions_total(household) + active_deductions_total(household), goal


def verfuegbares_einkommen(household: Household) -> Decimal:
    """Haushalts-Gesamteinkommen − aktive feste Abzüge − ALLE Transaktionen
    des laufenden Monats − Puffer (FinanzenTab.md §3.4). Kann negativ sein."""
    return (
        household_income_total(household)
        - active_deductions_total(household)
        - transactions_total(household)
        - household.monthly_buffer
    )
