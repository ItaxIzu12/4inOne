"""Die gesamte Connection-Logik an einer Stelle. Views reichen nur durch.

Sicherheitsregeln (docs/CONNECTION_ENGINE.md, AUTH_AND_PERMISSIONS.md):

- Eine Verbindung gewährt nie Zugriff. „Sichtbar“ heißt: das Objekt liegt im
  Queryset des Nutzers (registry.KINDS[...].visible) — dieselbe Regel wie in
  den Domain-APIs.
- Fremde und nicht existierende Objekte sind von außen nicht zu
  unterscheiden (beides `NotFound`), sonst ließen sich fremde IDs erraten.
- Eine Verbindung sieht nur, wer BEIDE Seiten sehen darf. Ist eine Seite
  unsichtbar, taucht die Verbindung gar nicht auf — auch nicht als Zähler
  oder maskierter Eintrag.
"""

from django.db import IntegrityError, transaction
from django.db.models import Q

from connections.models import Connection, ObjectType, Origin, RelationType
from connections.registry import ALLOWED_PAIRS, KINDS, canonical_pair, partner_types

MAX_CONNECTIONS_PER_OBJECT = 50
CANDIDATE_LIMIT = 50


class ConnectionRuleError(Exception):
    """Regelverstoß mit HTTP-Status (views.py übersetzt)."""

    status = 400

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.message = message
        if status is not None:
            self.status = status


class NotFound(ConnectionRuleError):
    status = 404

    def __init__(self, message: str = 'Nicht gefunden.'):
        super().__init__(message, 404)


OBJECT_NOT_FOUND = 'Dieses Objekt wurde nicht gefunden.'


def get_visible_object(user, object_type: str, object_id: int):
    kind = KINDS.get(object_type)
    if kind is None:
        return None
    return kind.visible(user).filter(pk=object_id).first()


def _resolve(user, refs: set[tuple[str, int]]) -> dict[tuple[str, int], object]:
    """Alle sichtbaren Objekte zu (Typ, ID)-Paaren, je Typ eine Abfrage."""
    by_type: dict[str, set[int]] = {}
    for object_type, object_id in refs:
        by_type.setdefault(object_type, set()).add(object_id)
    found = {}
    for object_type, ids in by_type.items():
        kind = KINDS.get(object_type)
        if kind is None:
            continue
        for obj in kind.visible(user).filter(pk__in=ids):
            found[(object_type, obj.pk)] = obj
    return found


def _touching(object_type: str, object_id: int) -> Q:
    return Q(source_type=object_type, source_id=object_id) | Q(target_type=object_type, target_id=object_id)


def present(connection: Connection, objects: dict) -> dict:
    source = objects[(connection.source_type, connection.source_id)]
    target = objects[(connection.target_type, connection.target_id)]
    return {
        'id': connection.pk,
        'relation_type': connection.relation_type,
        'relation_label': RelationType(connection.relation_type).label,
        'origin': connection.origin,
        'created_at': connection.created_at.isoformat(),
        'source': KINDS[connection.source_type].summary(source),
        'target': KINDS[connection.target_type].summary(target),
    }


def _visible_connections(user, connections) -> list[tuple[Connection, dict]]:
    """Nur Verbindungen, deren beide Seiten der Nutzer sehen darf."""
    connections = list(connections)
    refs = set()
    for connection in connections:
        refs.add((connection.source_type, connection.source_id))
        refs.add((connection.target_type, connection.target_id))
    objects = _resolve(user, refs)
    return [
        (connection, objects)
        for connection in connections
        if (connection.source_type, connection.source_id) in objects
        and (connection.target_type, connection.target_id) in objects
    ]


def get_connections_for_object(user, object_type: str, object_id: int) -> list[dict]:
    if get_visible_object(user, object_type, object_id) is None:
        raise NotFound(OBJECT_NOT_FOUND)
    queryset = Connection.objects.filter(_touching(object_type, object_id))
    result = []
    for connection, objects in _visible_connections(user, queryset):
        item = present(connection, objects)
        is_source = (connection.source_type, connection.source_id) == (object_type, object_id)
        item['other'] = item['target'] if is_source else item['source']
        result.append(item)
    return result


def get_connection(user, connection_id: int) -> dict:
    connection = Connection.objects.filter(pk=connection_id).first()
    visible = _visible_connections(user, [connection]) if connection else []
    if not visible:
        raise NotFound('Diese Verbindung wurde nicht gefunden.')
    return present(*visible[0])


def user_can_view_connected_object(user, object_type: str, object_id: int) -> bool:
    return get_visible_object(user, object_type, object_id) is not None


def create_connection(user, type_a: str, id_a: int, type_b: str, id_b: int, relation_type: str | None = None) -> dict:
    if (type_a, id_a) == (type_b, id_b):
        raise ConnectionRuleError('Ein Objekt lässt sich nicht mit sich selbst verknüpfen.')
    pair = canonical_pair(type_a, type_b)
    if pair is None:
        raise ConnectionRuleError('Diese beiden Arten lassen sich nicht verknüpfen.')
    allowed_relations = ALLOWED_PAIRS[pair]
    relation = relation_type or allowed_relations[0]
    if relation not in allowed_relations:
        raise ConnectionRuleError('Diese Art der Verknüpfung ist für dieses Paar nicht möglich.')

    (source_type, source_id), (target_type, target_id) = (
        ((type_a, id_a), (type_b, id_b)) if pair == (type_a, type_b) else ((type_b, id_b), (type_a, id_a))
    )
    source = get_visible_object(user, source_type, source_id)
    target = get_visible_object(user, target_type, target_id)
    if source is None or target is None:
        # Bewusst dieselbe Antwort für „gibt es nicht“ und „gehört dir nicht“.
        raise NotFound(OBJECT_NOT_FOUND)

    for object_type, object_id in ((source_type, source_id), (target_type, target_id)):
        if Connection.objects.filter(_touching(object_type, object_id)).count() >= MAX_CONNECTIONS_PER_OBJECT:
            raise ConnectionRuleError(f'Mehr als {MAX_CONNECTIONS_PER_OBJECT} Verknüpfungen sind nicht möglich.')

    if Connection.objects.filter(
        source_type=source_type, source_id=source_id, target_type=target_type, target_id=target_id
    ).exists():
        raise ConnectionRuleError('Diese Verknüpfung besteht bereits.', 409)
    try:
        with transaction.atomic():
            connection = Connection.objects.create(
                source_type=source_type,
                source_id=source_id,
                target_type=target_type,
                target_id=target_id,
                relation_type=relation,
                origin=Origin.MANUAL,
                created_by=user,
            )
    except IntegrityError:  # zwei gleichzeitige Anfragen
        raise ConnectionRuleError('Diese Verknüpfung besteht bereits.', 409) from None
    return present(connection, {(source_type, source_id): source, (target_type, target_id): target})


def delete_connection(user, connection_id: int) -> None:
    get_connection(user, connection_id)  # 404, wenn nicht beide Seiten sichtbar
    Connection.objects.filter(pk=connection_id).delete()


def options_for(object_type: str) -> list[dict]:
    """Womit sich ein Typ verbinden lässt (Schritt 1 der Oberfläche)."""
    result = []
    for partner in partner_types(object_type):
        pair = canonical_pair(object_type, partner)
        result.append(
            {'type': partner, 'label': KINDS[partner].label, 'domain': KINDS[partner].domain,
             'relation_type': ALLOWED_PAIRS[pair][0]}
        )
    return result


def candidates_for(user, object_type: str, object_id: int, target_type: str, query: str = '') -> list[dict]:
    """Objekte des Zieltyps, die der Nutzer sehen darf und die noch nicht mit
    diesem Objekt verbunden sind (Schritt 2)."""
    if canonical_pair(object_type, target_type) is None:
        raise ConnectionRuleError('Diese beiden Arten lassen sich nicht verknüpfen.')
    if get_visible_object(user, object_type, object_id) is None:
        raise NotFound(OBJECT_NOT_FOUND)
    kind = KINDS[target_type]
    queryset = kind.visible(user)
    if query:
        queryset = queryset.filter(title__icontains=query)
    already = set()
    for connection in Connection.objects.filter(_touching(object_type, object_id)):
        other = (
            (connection.target_type, connection.target_id)
            if (connection.source_type, connection.source_id) == (object_type, object_id)
            else (connection.source_type, connection.source_id)
        )
        if other[0] == target_type:
            already.add(other[1])
    return [kind.summary(obj) for obj in queryset.exclude(pk__in=already).order_by('-pk')[:CANDIDATE_LIMIT]]


def find_orphans() -> list[int]:
    """IDs von Verbindungen, deren Objekt es nicht mehr gibt.

    Normalerweise räumt signals.py sofort auf. Waisen entstehen nur, wenn ein
    Objekt an den Signalen vorbei verschwindet (Raw-SQL, `_raw_delete`, ein
    direkter Eingriff in die Datenbank, Import älterer Daten)."""
    orphan_ids: set[int] = set()
    for key, kind in KINDS.items():
        for side in ('source', 'target'):
            referenced = set(
                Connection.objects.filter(**{f'{side}_type': key}).values_list(f'{side}_id', flat=True).distinct()
            )
            existing: set[int] = set()
            ids = list(referenced)
            for start in range(0, len(ids), 500):  # SQLite begrenzt die Zahl der Parameter
                chunk = ids[start : start + 500]
                existing.update(kind.model.objects.filter(pk__in=chunk).values_list('pk', flat=True))
            missing = referenced - existing
            for start in range(0, len(missing), 500):
                chunk = list(missing)[start : start + 500]
                orphan_ids.update(
                    Connection.objects.filter(**{f'{side}_type': key, f'{side}_id__in': chunk}).values_list('pk', flat=True)
                )
    return sorted(orphan_ids)


def prune_orphans() -> int:
    """Löscht Verbindungen ohne Objekt; gibt die Anzahl zurück."""
    orphan_ids = find_orphans()
    for start in range(0, len(orphan_ids), 500):
        Connection.objects.filter(pk__in=orphan_ids[start : start + 500]).delete()
    return len(orphan_ids)
