"""O4 – Globale Suche: ein Begriff, Treffer aus allen Bereichen, gruppiert nach Art.

Jede Art nutzt GENAU die Sichtbarkeitsregel ihrer Domain (connections.registry.KINDS bzw. dieselbe
Owner-Regel wie die privaten APIs) — die Suche erweitert nie, was jemand sehen darf (docs/GLOBAL_SEARCH.md).
Es werden nur Titel/Name und ein kurzer Kontext zurückgegeben, keine Beträge fremder Verträge, keine
Vertrags- oder Seriennummern. Gesucht wird im Titel/Namen; bei Notizen auch im Text, bei Buchungen im
Verwendungszweck.
"""

from django.db.models import Q

from connections.models import ObjectType
from connections.registry import KINDS
from finanzen.models import Transaction
from organisation.models import PersonalNote

MIN_LENGTH = 2
MAX_LENGTH = 80
PER_KIND = 5

# Wohin ein Treffer in der App führt (Pfad + Abfrage); die ID ergänzt die Funktion `_link`.
_LINKS = {
    ObjectType.TASK: ('/organisation', {'kind': 'task'}),
    ObjectType.CALENDAR_EVENT: ('/organisation', {'kind': 'event'}),
    ObjectType.SAVINGS_GOAL: ('/finanzen', {'tab': 'goals'}),
    ObjectType.HOUSEHOLD_TASK: ('/haushalt', {'tab': 'aufgaben'}),
    ObjectType.TRIP: ('/reisen', {}),
    ObjectType.DEVICE: ('/haushalt', {'tab': 'zuhause', 'bereich': 'geraete'}),
    ObjectType.CONTRACT: ('/haushalt', {'tab': 'zuhause', 'bereich': 'vertraege'}),
}
_ID_PARAM = {
    ObjectType.TASK: 'id',
    ObjectType.CALENDAR_EVENT: 'id',
    ObjectType.SAVINGS_GOAL: 'goal',
    ObjectType.HOUSEHOLD_TASK: 'task',
    ObjectType.TRIP: 'trip',
    ObjectType.DEVICE: 'entry',
    ObjectType.CONTRACT: 'entry',
}
# Reihenfolge der Gruppen im Ergebnis
_ORDER = (
    ObjectType.CALENDAR_EVENT, ObjectType.TASK, 'NOTE', ObjectType.HOUSEHOLD_TASK, ObjectType.DEVICE,
    ObjectType.CONTRACT, ObjectType.TRIP, ObjectType.SAVINGS_GOAL, 'TRANSACTION',
)


def _link(kind_key: str, pk: int) -> dict:
    path, query = _LINKS[kind_key]
    return {'path': path, 'query': {**query, _ID_PARAM[kind_key]: str(pk)}}


def _note_title(note: PersonalNote) -> str:
    if note.title:
        return note.title
    first = (note.body or '').strip().splitlines()
    return first[0][:80] if first else 'Notiz ohne Titel'


def _euro(value) -> str:
    text = f'{value:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return f'{text} €'


def search(user, raw_query: str) -> dict:
    query = (raw_query or '').strip()[:MAX_LENGTH]
    if len(query) < MIN_LENGTH:
        return {'groups': []}
    groups: dict[str, dict] = {}

    for key, kind in KINDS.items():
        rows = (
            kind.visible(user)
            .filter(**dict(kind.base_filter))
            .filter(**{f'{kind.title_field}__icontains': query})
            .order_by('-pk')[:PER_KIND]
        )
        items = [{**kind.summary(obj), 'link': _link(key, obj.pk)} for obj in rows]
        if items:
            groups[key] = {'type': key, 'label': kind.label, 'domain': kind.domain, 'items': items}

    notes = (
        PersonalNote.objects.filter(owner=user)
        .filter(Q(title__icontains=query) | Q(body__icontains=query))
        .order_by('-pinned', '-updated_at')[:PER_KIND]
    )
    note_items = [
        {
            'type': 'NOTE', 'id': n.pk, 'title': _note_title(n), 'subtitle': 'Angeheftet' if n.pinned else 'Notiz',
            'domain': 'organisation', 'link': {'path': '/organisation', 'query': {'kind': 'note', 'id': str(n.pk)}},
        }
        for n in notes
    ]
    if note_items:
        groups['NOTE'] = {'type': 'NOTE', 'label': 'Notiz', 'domain': 'organisation', 'items': note_items}

    # Nur die EIGENEN privaten Buchungen (wie finanzen.private_api); gelöschte blendet der Manager aus.
    transactions = (
        Transaction.objects.filter(owner=user, description__icontains=query)
        .select_related('category')
        .order_by('-datum', '-pk')[:PER_KIND]
    )
    tx_items = [
        {
            'type': 'TRANSACTION', 'id': t.pk, 'title': t.description,
            'subtitle': f"{t.datum:%d.%m.%Y} · {'+' if t.type == 'INCOME' else '−'}{_euro(t.amount)}"
            + (f' · {t.category.name}' if t.category_id else ''),
            'domain': 'finanzen',
            'link': {'path': '/finanzen', 'query': {'tab': 'transactions', 'buchung': str(t.pk)}},
        }
        for t in transactions
    ]
    if tx_items:
        groups['TRANSACTION'] = {'type': 'TRANSACTION', 'label': 'Buchung', 'domain': 'finanzen', 'items': tx_items}

    # Der Suchbegriff wird bewusst nicht zurückgegeben (die Rechte-Matrix prüft, dass keine Antwort fremde Wörter enthält).
    return {'groups': [groups[key] for key in _ORDER if key in groups]}
