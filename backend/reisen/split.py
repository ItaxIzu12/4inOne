"""Wer schuldet wem (15.11.2026).

Jede Ausgabe mit Zahler wird gleich auf die Personen aufgeteilt, für die sie war (leer = alle Mitreisenden). Pro Person:
ausgelegt − Anteil (+ beglichen gezahlt − beglichen erhalten) = Saldo. Positiv = bekommt Geld, negativ = schuldet.
Daraus die wenigsten Überweisungen: immer die größte Schuld an das größte Guthaben, bis alles ausgeglichen ist.

Gerechnet wird in der Reisewährung (TripExpense.amount_trip) mit Decimal auf den Cent. Bleibt bei der Teilung ein Rest
(10,00 € durch 3), bekommen ihn die ersten Personen nach Nutzer-ID je einen Cent – nachvollziehbar und stabil.
Ausgaben ohne Zahler (ältere) oder ohne Kurs in die Reisewährung zählen nicht mit; `unassigned` sagt, wie viele das
sind. Veyora bewegt nie Geld – „beglichen“ ist nur ein Vermerk (TripSettlement).
"""

from __future__ import annotations

from decimal import ROUND_DOWN, Decimal

from .models import Trip, TripExpense, TripParticipant, TripSettlement

CENT = Decimal('0.01')


def _name(user) -> str:
    # dieselbe Regel wie serializers._display_name: kein voller Name, keine E-Mail an andere
    return user.first_name or user.email.split('@')[0]


def trip_people(trip: Trip) -> list:
    """Wer mitreist (Teilnehmende). Ohne Teilnehmerzeilen die Person, die die Reise angelegt hat."""
    users = [p.user for p in TripParticipant.objects.filter(trip=trip).select_related('user').order_by('user_id')]
    return users or [trip.owner]


def split_equally(amount: Decimal, user_ids: list[int]) -> dict[int, Decimal]:
    """Betrag gleich aufteilen; der Rest in Cent geht reihum an die ersten (nach ID sortiert)."""
    ids = sorted(user_ids)
    base = (amount / len(ids)).quantize(CENT, rounding=ROUND_DOWN)
    rest = int(((amount - base * len(ids)) / CENT).to_integral_value())
    return {uid: base + (CENT if i < rest else Decimal('0')) for i, uid in enumerate(ids)}


def transfers_for(balance: dict[int, Decimal]) -> list[tuple[int, int, Decimal]]:
    """Wenigste Überweisungen (Schuldner, Empfänger, Betrag): größte Schuld an das größte Guthaben."""
    debtors = sorted(((-b, uid) for uid, b in balance.items() if b < 0), reverse=True)
    creditors = sorted(((b, uid) for uid, b in balance.items() if b > 0), reverse=True)
    debtors = [[amount, uid] for amount, uid in debtors]
    creditors = [[amount, uid] for amount, uid in creditors]
    result = []
    while debtors and creditors:
        debtors.sort(key=lambda d: (-d[0], d[1]))
        creditors.sort(key=lambda c: (-c[0], c[1]))
        debt, creditor = debtors[0], creditors[0]
        amount = min(debt[0], creditor[0])
        if amount > 0:
            result.append((debt[1], creditor[1], amount))
        debt[0] -= amount
        creditor[0] -= amount
        debtors = [d for d in debtors if d[0] > 0]
        creditors = [c for c in creditors if c[0] > 0]
    return result


def balances(trip: Trip) -> dict:
    travellers = trip_people(trip)
    traveller_ids = [u.id for u in travellers]
    people = {u.id: u for u in travellers}
    paid: dict[int, Decimal] = {}
    share: dict[int, Decimal] = {}
    unassigned = 0
    expenses = TripExpense.objects.filter(trip=trip).select_related('paid_by').prefetch_related('shared_with')
    for expense in expenses:
        if expense.paid_by_id is None or expense.amount_trip is None:
            unassigned += 1
            continue
        people.setdefault(expense.paid_by_id, expense.paid_by)
        for user in expense.shared_with.all():
            people.setdefault(user.id, user)
        shares = [u.id for u in expense.shared_with.all()] or traveller_ids
        paid[expense.paid_by_id] = paid.get(expense.paid_by_id, Decimal('0')) + expense.amount_trip
        for uid, part in split_equally(expense.amount_trip, shares).items():
            share[uid] = share.get(uid, Decimal('0')) + part
    balance = {uid: paid.get(uid, Decimal('0')) - share.get(uid, Decimal('0')) for uid in people}
    settled = []
    for s in TripSettlement.objects.filter(trip=trip).select_related('from_user', 'to_user'):
        people.setdefault(s.from_user_id, s.from_user)
        people.setdefault(s.to_user_id, s.to_user)
        balance[s.from_user_id] = balance.get(s.from_user_id, Decimal('0')) + s.amount
        balance[s.to_user_id] = balance.get(s.to_user_id, Decimal('0')) - s.amount
        settled.append({'id': s.id, 'from_user': s.from_user_id, 'from_name': _name(s.from_user), 'to_user': s.to_user_id,
                        'to_name': _name(s.to_user), 'amount': str(s.amount), 'created_at': s.created_at.isoformat()})
    rows = [
        {'user': uid, 'name': _name(people[uid]), 'paid': str(paid.get(uid, Decimal('0')).quantize(CENT)),
         'share': str(share.get(uid, Decimal('0')).quantize(CENT)), 'balance': str(balance.get(uid, Decimal('0')).quantize(CENT))}
        for uid in sorted(people)
    ]
    return {
        'currency': trip.currency,
        'people': rows,
        'transfers': [
            {'from_user': a, 'from_name': _name(people[a]), 'to_user': b, 'to_name': _name(people[b]), 'amount': str(amt.quantize(CENT))}
            for a, b, amt in transfers_for(balance)
        ],
        'settlements': settled,
        'unassigned': unassigned,
    }
