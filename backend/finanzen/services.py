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

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum
from django.utils import timezone

from core.models import Household, HouseholdMembership
from finanzen.models import Category, RecurringDeduction, Transaction

ZERO = Decimal('0')


def month_bounds(today: date | None = None) -> tuple[date, date]:
    """Erster Tag des laufenden Monats (inklusive) und des Folgemonats
    (exklusive) — Grenzen für Transaction.datum (ein DateField, kein
    Zeitstempel, daher reine date-Arithmetik statt aware datetimes)."""
    today = today or timezone.localdate()
    start = today.replace(day=1)
    end = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
    return start, end


def month_transactions(household: Household):
    """Alle (nicht weich gelöschten) Transaktionen des laufenden Monats,
    nach datum gefiltert (dem vom Nutzer gewählten Ausgabedatum), nicht nach
    dem technischen Erstellungs-Zeitstempel created_at."""
    start, end = month_bounds()
    return Transaction.objects.filter(account__household=household, datum__gte=start, datum__lt=end)


def period_transactions(household: Household, start: date, end: date):
    """Transaktionen in [start, end) — Grundlage für die Monats-/
    Jahresberichte (finanzen/reports.py). Wie month_transactions, aber mit
    frei wählbaren Grenzen statt des laufenden Monats."""
    return (
        Transaction.objects.filter(account__household=household, datum__gte=start, datum__lt=end)
        .select_related('category')
        .order_by('datum')
    )


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


def _category_amounts(transactions_qs, deductions_qs, deduction_multiplier: Decimal = Decimal('1')) -> dict[int, Decimal]:
    """Gemeinsamer Kern von category_spent() (aktueller Monat) und
    period_category_amounts() (Berichte, finanzen/reports.py): Transaktionen
    PLUS zugeordnete aktive feste Abzüge, pro Kategorie-ID summiert.

    Bewusst zwei getrennte Abfragen, die in Python zusammengeführt werden:
    zwei Sum()-Annotationen über zwei verschiedene Relationen in EINER
    Abfrage würden die Zeilen beider Joins miteinander multiplizieren und
    die Summen aufblähen.

    `deduction_multiplier` skaliert die (monatlichen) festen Abzüge auf einen
    längeren Zeitraum (z. B. 12 für einen Jahresbericht) — die Transaktionen
    selbst werden NIE skaliert, sie sind bereits reale Beträge im jeweiligen
    Zeitraum."""
    spent: dict[int, Decimal] = {}
    tx_rows = transactions_qs.exclude(category__isnull=True).values('category_id').annotate(total=Sum('amount'))
    for row in tx_rows:
        spent[row['category_id']] = row['total']

    deduction_rows = deductions_qs.exclude(category__isnull=True).values('category_id').annotate(total=Sum('amount'))
    for row in deduction_rows:
        spent[row['category_id']] = spent.get(row['category_id'], ZERO) + row['total'] * deduction_multiplier
    return spent


def category_spent(household: Household) -> dict[int, Decimal]:
    """"Ausgegeben" pro Kategorie-ID: Transaktionen dieser Kategorie im
    laufenden Monat PLUS die dieser Kategorie zugeordneten aktiven festen
    Abzüge (FinanzenTab.md §4)."""
    return _category_amounts(month_transactions(household), active_deductions(household))


def period_category_amounts(household: Household, start: date, end: date, monate: int) -> dict[int, Decimal]:
    """Wie category_spent(), aber für einen frei wählbaren Berichtszeitraum
    [start, end) statt des laufenden Monats — die festen Abzüge werden mit
    `monate` skaliert (1 für einen Monatsbericht, 12 für einen Jahresbericht),
    siehe finanzen/reports.py."""
    return _category_amounts(period_transactions(household, start, end), active_deductions(household), Decimal(monate))


def _head_from(ausgegeben: Decimal, ziel: Decimal) -> dict[str, Decimal | int]:
    """Kern von budget_head() und der Kategorien-Aufschlüsselung im
    Bericht (finanzen/reports.py): uebrig/prozent aus ausgegeben und ziel.

        uebrig  = ziel − ausgegeben        (kann negativ sein)
        prozent = ausgegeben / ziel × 100  (0, falls ziel = 0; kann > 100 sein)"""
    if ziel > 0:
        prozent = int((ausgegeben / ziel * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    else:
        prozent = 0
    return {'ausgegeben': ausgegeben, 'ziel': ziel, 'uebrig': ziel - ausgegeben, 'prozent': prozent}


def budget_head(household: Household, spent_by_category: dict[int, Decimal] | None = None) -> dict[str, Decimal | int]:
    """Budget-Kopfzeile der Übersicht (FinanzenTab.md §2.1) — wird aus den
    Kategorien darunter berechnet, nicht als freistehende Zahl. Siehe
    _head_from() für die Formel.

    Dadurch geht der Kopf immer auf mit der Kategorien-Liste darunter auf.
    Folge: Buchungen OHNE Kategorie (Transaction.category ist nach dem Löschen
    einer Kategorie NULL, feste Abzüge dürfen kategorielos sein) tauchen in
    keiner Kategorie auf und zählen daher auch hier nicht — im Verfügbaren
    Einkommen (verfuegbares_einkommen) zählen sie trotzdem.

    `spent_by_category` kann übergeben werden, wenn der Aufrufer die
    Kategorie-Summen ohnehin schon berechnet hat (spart zwei Abfragen)."""
    spent = category_spent(household) if spent_by_category is None else spent_by_category
    ausgegeben = sum(spent.values(), ZERO)
    ziel = Category.objects.filter(household=household).aggregate(total=Sum('monthly_goal'))['total'] or ZERO
    return _head_from(ausgegeben, ziel)


def period_budget_head(household: Household, spent_by_category: dict[int, Decimal], monate: int) -> dict[str, Decimal | int]:
    """Wie budget_head(), aber für einen Berichtszeitraum: das Kategorie-Ziel
    ist eine monatliche Größe und wird deshalb mit `monate` skaliert (ein
    Jahresbericht vergleicht z. B. gegen das 12-Fache des monatlichen
    Ziels), die Ausgaben kommen unskaliert aus period_category_amounts()."""
    ausgegeben = sum(spent_by_category.values(), ZERO)
    ziel = Category.objects.filter(household=household).aggregate(total=Sum('monthly_goal'))['total'] or ZERO
    return _head_from(ausgegeben, ziel * monate)


def verfuegbares_einkommen(household: Household) -> Decimal:
    """Haushalts-Gesamteinkommen − aktive feste Abzüge − ALLE Transaktionen
    des laufenden Monats − Puffer (FinanzenTab.md §3.4). Kann negativ sein."""
    return (
        household_income_total(household)
        - active_deductions_total(household)
        - transactions_total(household)
        - household.monthly_buffer
    )


def period_verfuegbares_einkommen(household: Household, start: date, end: date, monate: int) -> Decimal:
    """Wie verfuegbares_einkommen(), aber für einen Berichtszeitraum: Einkommen,
    aktive Abzüge und Puffer sind monatliche Größen und werden mit `monate`
    skaliert (1 für einen Monat, 12 für ein Jahr) — die Transaktionssumme ist
    bereits ein realer Betrag über den ganzen Zeitraum und wird NICHT skaliert.

    WICHTIG (Einschränkung, die im Bericht dokumentiert werden muss): Es gibt
    kein historisches Einkommen/keine historischen Abzüge — für einen
    vergangenen Zeitraum wird der AKTUELLE Stand von monthly_income/
    RecurringDeduction/monthly_buffer zugrunde gelegt, nicht der damals
    tatsächlich gültige (den es im Datenmodell nicht gibt)."""
    tx_total = period_transactions(household, start, end).aggregate(total=Sum('amount'))['total'] or ZERO
    return (
        household_income_total(household) * monate
        - active_deductions_total(household) * monate
        - tx_total
        - household.monthly_buffer * monate
    )
