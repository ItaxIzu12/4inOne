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
- Verknüpfen verlangt Schreibrecht auf BEIDE Seiten (registry.Kind.editable).
  Lösen darf, wer die Verbindung angelegt hat, oder wer beide Seiten
  bearbeiten darf. Sichtbar, aber nicht bearbeitbar → 403; unsichtbar → 404.
- Das Limit je Objekt zählt nur die eigenen Verbindungen — sonst verriete die
  Fehlermeldung, dass es versteckte Verbindungen anderer gibt.
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


class Forbidden(ConnectionRuleError):
    status = 403

    def __init__(self, message: str = 'Dafür fehlt dir die Berechtigung.'):
        super().__init__(message, 403)


OBJECT_NOT_FOUND = 'Dieses Objekt wurde nicht gefunden.'
NOT_EDITABLE = 'Dieses Objekt kannst du nur ansehen — verknüpfen ist dafür nicht möglich.'


def get_visible_object(user, object_type: str, object_id: int):
    kind = KINDS.get(object_type)
    if kind is None:
        return None
    return kind.visible(user).filter(pk=object_id).first()


def can_connect_object(user, object_type: str, object_id: int) -> bool:
    """Darf der Nutzer dieses Objekt verknüpfen (Schreibrecht wie in der Domain)?"""
    kind = KINDS.get(object_type)
    return kind is not None and kind.editable_for(user).filter(pk=object_id).exists()


def _require_connectable(user, object_type: str, object_id: int):
    """Das Objekt, wenn der Nutzer es verknüpfen darf; sonst 404 (unsichtbar) bzw. 403 (nur lesbar)."""
    obj = get_visible_object(user, object_type, object_id)
    if obj is None:
        raise NotFound(OBJECT_NOT_FOUND)
    if not can_connect_object(user, object_type, object_id):
        raise Forbidden(NOT_EDITABLE)
    return obj


def _resolve(user, refs: set[tuple[str, int]], editable: bool = False) -> dict[tuple[str, int], object]:
    """Alle sichtbaren (bzw. bearbeitbaren) Objekte zu (Typ, ID)-Paaren, je Typ eine Abfrage."""
    by_type: dict[str, set[int]] = {}
    for object_type, object_id in refs:
        by_type.setdefault(object_type, set()).add(object_id)
    found = {}
    for object_type, ids in by_type.items():
        kind = KINDS.get(object_type)
        if kind is None:
            continue
        queryset = kind.editable_for(user) if editable else kind.visible(user)
        for obj in queryset.filter(pk__in=ids):
            found[(object_type, obj.pk)] = obj
    return found


def can_delete_connection(user, connection: Connection, editable: dict | None = None) -> bool:
    """Wer sie angelegt hat, oder wer beide Seiten bearbeiten darf. Sichtbarkeit prüft der Aufrufer."""
    if connection.created_by_id == user.pk:
        return True
    sides = {(connection.source_type, connection.source_id), (connection.target_type, connection.target_id)}
    if editable is None:
        editable = _resolve(user, sides, editable=True)
    return all(side in editable for side in sides)


def _touching(object_type: str, object_id: int) -> Q:
    return Q(source_type=object_type, source_id=object_id) | Q(target_type=object_type, target_id=object_id)


def present(connection: Connection, objects: dict, can_delete: bool) -> dict:
    source = objects[(connection.source_type, connection.source_id)]
    target = objects[(connection.target_type, connection.target_id)]
    return {
        'id': connection.pk,
        'can_delete': can_delete,
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
    visible = _visible_connections(user, queryset)
    refs = set()
    for connection, _ in visible:
        refs.add((connection.source_type, connection.source_id))
        refs.add((connection.target_type, connection.target_id))
    editable = _resolve(user, refs, editable=True) if visible else {}  # eine Abfrage je Typ, kein N+1
    result = []
    for connection, objects in visible:
        item = present(connection, objects, can_delete_connection(user, connection, editable))
        is_source = (connection.source_type, connection.source_id) == (object_type, object_id)
        item['other'] = item['target'] if is_source else item['source']
        result.append(item)
    return result


def _visible_connection(user, connection_id: int) -> tuple[Connection, dict]:
    connection = Connection.objects.filter(pk=connection_id).first()
    visible = _visible_connections(user, [connection]) if connection else []
    if not visible:
        raise NotFound('Diese Verbindung wurde nicht gefunden.')
    return visible[0]


def get_connection(user, connection_id: int) -> dict:
    connection, objects = _visible_connection(user, connection_id)
    return present(connection, objects, can_delete_connection(user, connection))


def user_can_view_connected_object(user, object_type: str, object_id: int) -> bool:
    return get_visible_object(user, object_type, object_id) is not None


def create_connection(
    user, type_a: str, id_a: int, type_b: str, id_b: int, relation_type: str | None = None,
    origin: str = Origin.MANUAL,
) -> dict:
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
    if not (can_connect_object(user, source_type, source_id) and can_connect_object(user, target_type, target_id)):
        raise Forbidden(NOT_EDITABLE)

    for object_type, object_id in ((source_type, source_id), (target_type, target_id)):
        own = Connection.objects.filter(_touching(object_type, object_id), created_by=user)
        if own.count() >= MAX_CONNECTIONS_PER_OBJECT:
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
                origin=origin,
                created_by=user,
            )
    except IntegrityError:  # zwei gleichzeitige Anfragen
        raise ConnectionRuleError('Diese Verknüpfung besteht bereits.', 409) from None
    return present(connection, {(source_type, source_id): source, (target_type, target_id): target}, True)


def delete_connection(user, connection_id: int) -> None:
    """Löst nur den Zusammenhang — beide Objekte bleiben unverändert."""
    connection, _ = _visible_connection(user, connection_id)  # 404, wenn nicht beide Seiten sichtbar
    if not can_delete_connection(user, connection):
        raise Forbidden('Diese Verknüpfung kannst du nicht entfernen.')
    connection.delete()


def options_for(object_type: str, user=None, object_id: int | None = None) -> list[dict]:
    """Womit sich ein Typ verbinden lässt (Schritt 1 der Oberfläche). Mit Objekt-ID wird zuerst
    geprüft, ob der Nutzer dieses Objekt überhaupt verknüpfen darf (404/403)."""
    if user is not None and object_id is not None:
        _require_connectable(user, object_type, object_id)
    result = []
    for partner in partner_types(object_type):
        pair = canonical_pair(object_type, partner)
        result.append(
            {'type': partner, 'label': KINDS[partner].label, 'domain': KINDS[partner].domain,
             'relation_type': ALLOWED_PAIRS[pair][0]}
        )
    return result


def candidates_for(user, object_type: str, object_id: int, target_type: str, query: str = '') -> list[dict]:
    """Objekte des Zieltyps, die der Nutzer verknüpfen darf und die noch nicht mit
    diesem Objekt verbunden sind (Schritt 2). Gefiltert wird hier im Backend."""
    if canonical_pair(object_type, target_type) is None:
        raise ConnectionRuleError('Diese beiden Arten lassen sich nicht verknüpfen.')
    _require_connectable(user, object_type, object_id)
    kind = KINDS[target_type]
    queryset = kind.editable_for(user)
    if query:
        queryset = queryset.filter(**{f'{kind.title_field}__icontains': query})
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
                existing.update(kind.base().filter(pk__in=chunk).values_list('pk', flat=True))
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
