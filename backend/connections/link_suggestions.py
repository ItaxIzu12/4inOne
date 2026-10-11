"""Verknüpfungs-Vorschläge (Suggestions V1): erkennen → erklären → vorschlagen → die Person entscheidet.

Ein Vorschlag sagt nur „das könnte zusammengehören“. Er ändert nichts: Erst „Verknüpfen“ legt eine Verbindung an,
und zwar über services.create_connection — mit allen Rechte- und Duplikatprüfungen der Connection Engine.

Grundsätze
- Regelbasiert und reproduzierbar, keine KI. Jede Regel kennt genau ein Typpaar, ihre Signale und ihren
  `reason_code`; der Text für Menschen entsteht daraus.
- Nur Objekte, die die Person auf BEIDEN Seiten bearbeiten darf (registry.Kind.editable). Was sie nicht sehen
  darf, kommt in keiner Rechnung vor — es gibt also nichts, was ein Vorschlag verraten könnte.
- Nicht gespeichert: Vorschläge werden bei jedem Aufruf aus den aktuellen Daten berechnet. Gelöschte Objekte,
  entzogene Rechte, inzwischen bestehende Verbindungen oder vorbeigegangene Reisen fallen dadurch von selbst weg.
  Gespeichert wird nur „Nicht relevant“ (SuggestionDismissal) — dauerhaft für dieses Paar.
- Lieber kein Vorschlag als ein schwacher: Textgleichheit allein reicht nur bei eindeutigen Namen (Gerät,
  Anbieter); sonst braucht es ein zweites Signal (Zeitraum, Reise- bzw. Vertragsbezug). Gleiche Woche allein
  reicht nie.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from connections import services
from connections.models import Connection, ObjectType, Origin, RelationType, SuggestionDismissal
from connections.registry import ALLOWED_PAIRS, KINDS, canonical_pair
from connections.serializers import MAX_ID
from finanzen.models import SavingsGoal
from haushalt.models import FolderEntry
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip

KEY_PREFIX = 'link'
THRESHOLD = 0.7  # darunter wird nichts vorgeschlagen
DASHBOARD_THRESHOLD = 0.8  # „Für dich“ zeigt höchstens einen, und nur einen starken
OBJECT_LIMIT = 3  # je Objekt höchstens drei auf einmal

TRIP_HORIZON_DAYS = 365
TASK_LEAD_DAYS = 30  # Aufgaben bis 30 Tage vor der Reise zählen als „kurz davor“
PREP_LEAD_DAYS = 14  # ohne Ortsnennung: nur bis 14 Tage vorher und nur, wenn genau eine Reise in Frage kommt
GOAL_LEAD_DAYS = 180  # Sparziel mit Zieldatum bis ein halbes Jahr vor der Reise
EVENT_MARGIN_DAYS = 1  # Anreise am Vortag, Rückfahrt am Tag danach
CANDIDATE_LIMIT = 300  # je Art; schützt vor O(n²) bei sehr vielen Einträgen

# Füllwörter und Wörter, die zu allgemein sind, um zwei Dinge zu verbinden.
STOPWORDS = {
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder', 'aber',
    'fuer', 'mit', 'von', 'vom', 'zum', 'zur', 'nach', 'bei', 'aus', 'auf', 'ins', 'im', 'am', 'an', 'in', 'zu',
    'bis', 'ab', 'neu', 'neue', 'neuer', 'neues', 'neuen', 'alt', 'alte', 'alter', 'altes', 'mein', 'meine',
    'unser', 'unsere', 'noch', 'mal', 'mehr', 'fuers', 'ueber', 'unter', 'vor', 'wegen', 'pruefen', 'bestaetigen',
    'erledigen', 'machen', 'kaufen', 'besorgen', 'planen', 'organisieren', 'sparen', 'sparziel', 'geld', 'kosten',
    'reise', 'reisen', 'urlaub', 'trip', 'tour', 'ferien', 'wochenende', 'kurztrip', 'auszeit', 'sommer', 'winter',
    'fruehling', 'herbst', 'sommerurlaub', 'winterurlaub', 'familie', 'freunde', 'termin', 'aufgabe', 'vertrag',
    'geraet', 'haushalt', 'zuhause', 'home', 'privat', 'wichtig', 'dringend', 'todo',
}
# Wörter, die eine Aufgabe oder einen Termin als Reisevorbereitung ausweisen.
TRAVEL_WORDS = {
    'hotel', 'unterkunft', 'ferienwohnung', 'airbnb', 'hostel', 'flug', 'flughafen', 'boarding', 'zug', 'ice',
    'bahn', 'bus', 'faehre', 'mietwagen', 'transfer', 'checkin', 'check', 'koffer', 'packen', 'packliste', 'visum',
    'reisepass', 'pass', 'ausweis', 'esta', 'tickets', 'ticket', 'abflug', 'anreise', 'abreise', 'rueckreise',
    'rueckflug', 'hinflug', 'buchen', 'buchung', 'reservieren', 'reservierung', 'impfung', 'roaming', 'waehrung',
}
# Reisebezug bei Sparzielen („Japan Urlaub“, „Reisekasse Berlin“) — ohne das nennt ein Sparziel die Stadt oft aus
# anderen Gründen („Kaution Wohnung Berlin“).
TRIP_GOAL_WORDS = TRAVEL_WORDS | {'reise', 'reisen', 'urlaub', 'trip', 'ferien', 'reisekasse', 'reisebudget',
                                  'urlaubskasse', 'urlaubsgeld', 'kurztrip', 'staedtetrip'}
# Wörter, die eine Aufgabe als Vertragssache ausweisen.
CONTRACT_WORDS = {
    'hotline', 'kundenservice', 'kundennummer', 'vertragsnummer', 'kundenkonto',
    'vertrag', 'vertraege', 'kuendigen', 'kuendigung', 'tarif', 'verlaengern', 'verlaengerung', 'wechseln',
    'wechsel', 'anbieter', 'rechnung', 'abrechnung', 'zaehlerstand', 'zaehler', 'beitrag', 'police',
    'versicherung', 'laufzeit', 'preiserhoehung', 'widerspruch',
}

KEY_PATTERN = re.compile(r'^link:([A-Z_]{1,20}):(\d{1,19}):([A-Z_]{1,20}):(\d{1,19})$')


# ---------------------------------------------------------------------------
# Text
# ---------------------------------------------------------------------------


def _fold(text: str) -> str:
    text = (text or '').lower()
    for umlaut, plain in (('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('ß', 'ss')):
        text = text.replace(umlaut, plain)
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]+', ' ', text)


def words(text: str, min_length: int = 4) -> dict[str, str]:
    """Bedeutungstragende Wörter: gefaltete Form → Originalschreibweise (für die Erklärung).
    Reiseziele dürfen kürzer sein („Rom“, „Ulm“) — sie zählen dann nur als ganzes Wort."""
    result: dict[str, str] = {}
    originals = re.findall(r'[^\W_]+', text or '')
    for original in originals:
        folded = _fold(original).strip()
        if len(folded) >= min_length and folded not in STOPWORDS and not folded.isdigit():
            result.setdefault(folded, original)
    return result


def _flags(text: str, vocabulary: set[str]) -> bool:
    return any(token in vocabulary for token in _fold(text).split())


def match_word(left: dict[str, str], right: dict[str, str]) -> tuple[str, bool] | None:
    """Das erste gemeinsame Wort (Originalschreibweise der linken Seite) und ob es GENAU gleich ist.
    Sonst — ab fünf Buchstaben — Wortanfang des anderen („Waschmaschine“/„Waschmaschinen“, „Berlin“/„Berliner“);
    das zählt schwächer, weil „Berliner Testament“ nichts mit einer Berlin-Reise zu tun hat. Nie Teilwörter mittendrin."""
    for folded, original in left.items():
        if folded in right:
            return original, True
    for folded, original in left.items():
        for other in right:
            short, long_ = sorted((folded, other), key=len)
            if len(short) >= 5 and long_.startswith(short):
                return original, False
    return None


def common_word(left: dict[str, str], right: dict[str, str]) -> str | None:
    found = match_word(left, right)
    return found[0] if found else None


# ---------------------------------------------------------------------------
# Vorschlag
# ---------------------------------------------------------------------------


@dataclass
class LinkSuggestion:
    rule: str
    reason_code: str
    score: float
    source_type: str
    source: object
    target_type: str
    target: object
    headline: str
    reason: str
    when: date | None = None  # für die Reihenfolge: was bald ansteht, zuerst

    @property
    def key(self) -> str:
        return f'{KEY_PREFIX}:{self.source_type}:{self.source.pk}:{self.target_type}:{self.target.pk}'

    def ref(self, side: str) -> tuple[str, int]:
        obj = self.source if side == 'source' else self.target
        return (self.source_type if side == 'source' else self.target_type), obj.pk

    def as_dict(self, focus: tuple[str, int] | None = None) -> dict:
        source = KINDS[self.source_type].summary(self.source)
        target = KINDS[self.target_type].summary(self.target)
        relation = ALLOWED_PAIRS[(self.source_type, self.target_type)][0]
        data = {
            'key': self.key,
            'reason_code': self.reason_code,
            'headline': self.headline,
            'reason': self.reason,
            'relation_label': RelationType(relation).label,
            'source': source,
            'target': target,
        }
        if focus is not None:
            data['other'] = target if self.ref('source') == focus else source
        if settings.DEBUG:  # nur in der Entwicklung: welche Regel, wie stark
            data['debug'] = {'rule': self.rule, 'score': round(self.score, 2)}
        return data


def _make(rule, code, score, source_type, source, target_type, target, headline, reason, when=None):
    # Richtung wie in der Connection Engine, damit A↔B und B↔A derselbe Vorschlag sind.
    pair = canonical_pair(source_type, target_type)
    assert pair is not None, (source_type, target_type)
    if pair != (source_type, target_type):
        source_type, source, target_type, target = target_type, target, source_type, source
    return LinkSuggestion(rule, code, score, source_type, source, target_type, target, headline, reason, when)


def _date(value: date) -> str:
    return value.strftime('%d.%m.')


def _trip_name(trip: Trip) -> str:
    return trip.destination or trip.title


# ---------------------------------------------------------------------------
# Kandidaten — nur, was die Person auf dieser Seite verknüpfen darf
# ---------------------------------------------------------------------------


class _Scope:
    """Einmal pro Aufruf geladene Kandidaten, bei Bedarf auf ein Objekt eingeschränkt."""

    def __init__(self, user, today: date, focus: tuple[str, int] | None):
        self.user = user
        self.today = today
        self.focus = focus
        self._cache: dict[str, list] = {}

    def _only(self, object_type: str, queryset):
        if self.focus and self.focus[0] == object_type:
            return queryset.filter(pk=self.focus[1])
        return queryset

    def _load(self, object_type: str, build):
        if object_type not in self._cache:
            queryset = self._only(object_type, build(KINDS[object_type].editable_for(self.user)))
            self._cache[object_type] = list(queryset[:CANDIDATE_LIMIT])
        return self._cache[object_type]

    def trips(self) -> list[Trip]:
        return self._load(ObjectType.TRIP, lambda qs: qs.filter(
            status__in=(Trip.Status.PLANNED, Trip.Status.CONFIRMED),
            end_date__gte=self.today,
            start_date__lte=self.today + timedelta(days=TRIP_HORIZON_DAYS),
        ).order_by('start_date', 'id'))

    def tasks(self) -> list[PersonalTask]:
        return self._load(ObjectType.TASK, lambda qs: qs.exclude(status=PersonalTask.Status.DONE).filter(
            Q(due_date__isnull=True) | Q(due_date__gte=self.today - timedelta(days=7))
        ).order_by('due_date', 'id'))

    def events(self) -> list[PersonalEvent]:
        start = timezone.make_aware(datetime.combine(self.today - timedelta(days=EVENT_MARGIN_DAYS), time.min))
        return self._load(ObjectType.CALENDAR_EVENT, lambda qs: qs.filter(starts_at__gte=start).order_by('starts_at', 'id'))

    def goals(self) -> list[SavingsGoal]:
        return self._load(ObjectType.SAVINGS_GOAL, lambda qs: qs.exclude(status='COMPLETED').order_by('id'))

    def devices(self) -> list[FolderEntry]:
        return self._load(ObjectType.DEVICE, lambda qs: qs.order_by('id'))

    def contracts(self) -> list[FolderEntry]:
        return self._load(ObjectType.CONTRACT, lambda qs: qs.exclude(status=FolderEntry.Status.ENDED).order_by('id'))


# ---------------------------------------------------------------------------
# Regeln — je Typpaar eine Funktion: Signale → Punktzahl → reason_code → Erklärung
# ---------------------------------------------------------------------------


def _trip_words(trip: Trip) -> dict[str, str]:
    return {**words(trip.title, 3), **words(trip.destination, 3)}


def rule_trip_task(scope: _Scope) -> list[LinkSuggestion]:
    """Aufgabe nennt das Reiseziel UND ist kurz vor/während der Reise fällig oder klingt nach Reisevorbereitung.
    Ohne Ortsnennung nur, wenn sie eindeutig nach Reisevorbereitung klingt, kurz vor der Reise fällig ist und genau
    EINE Reise in Frage kommt („Hotel bestätigen“ fünf Tage vor Berlin)."""
    found = []
    trips = [(trip, _trip_words(trip)) for trip in scope.trips()]
    if not trips:
        return found
    for task in scope.tasks():
        task_words = words(task.title, 3)
        travel = _flags(task.title, TRAVEL_WORDS)
        named = []
        for trip, keys in trips:
            hit = match_word(task_words, keys) if keys else None
            in_window = task.due_date is not None and (
                trip.start_date - timedelta(days=TASK_LEAD_DAYS) <= task.due_date <= trip.end_date
            )
            if hit is None:
                continue
            word, exact = hit
            named.append(trip)
            score = (0.6 if exact else 0.4) + (0.25 if in_window else 0) + (0.15 if travel else 0)
            if score < THRESHOLD:
                continue
            if in_window:
                code = 'DATE_AND_CONTEXT_MATCH'
                reason = f'Die Aufgabe erwähnt „{word}“ und ist kurz vor oder während deiner Reise fällig.'
            else:
                code = 'MATCHING_DESTINATION'
                reason = f'Die Aufgabe erwähnt „{word}“ und klingt nach Reisevorbereitung.'
            found.append(_make(
                'trip_task', code, score, ObjectType.TRIP, trip, ObjectType.TASK, task,
                f'„{task.title}“ könnte zu deiner Reise „{_trip_name(trip)}“ gehören.', reason, trip.start_date,
            ))
        if named or not travel or task.due_date is None:
            continue
        near = [
            trip for trip, _ in trips
            if trip.start_date - timedelta(days=PREP_LEAD_DAYS) <= task.due_date <= trip.start_date
        ]
        if len(near) == 1:  # bei zwei Reisen kurz hintereinander wäre es geraten
            trip = near[0]
            found.append(_make(
                'trip_task', 'TRAVEL_PREPARATION', THRESHOLD, ObjectType.TRIP, trip, ObjectType.TASK, task,
                f'„{task.title}“ könnte zu deiner Reise „{_trip_name(trip)}“ gehören.',
                'Die Aufgabe klingt nach Reisevorbereitung und ist kurz vor deiner Reise fällig.', trip.start_date,
            ))
    return found


def rule_trip_event(scope: _Scope) -> list[LinkSuggestion]:
    """Termin liegt im Reisezeitraum (± 1 Tag) UND nennt das Ziel — oder ist am An-/Abreisetag erkennbar Reise
    (Zug, Flug, Hotel …). Mitten in der Reise reicht ein Reisewort allein nicht („Zug zur Oma“)."""
    found = []
    trips = [(trip, _trip_words(trip)) for trip in scope.trips()]
    if not trips:
        return found
    margin = timedelta(days=EVENT_MARGIN_DAYS)
    for event in scope.events():
        day = timezone.localtime(event.starts_at).date()
        text = f'{event.title} {event.location}'
        event_words = words(text, 3)
        travel = _flags(text, TRAVEL_WORDS)
        for trip, keys in trips:
            if not (trip.start_date - margin <= day <= trip.end_date + margin):
                continue  # gleiche Zeit allein reicht nicht — aber ohne passende Zeit erst recht nicht
            hit = match_word(event_words, keys) if keys else None
            travel_day = abs((day - trip.start_date).days) <= 1 or abs((day - trip.end_date).days) <= 1
            if hit is not None:
                word, exact = hit
                score = (1.0 if exact else 0.7) if exact or travel else 0.0
                reason = f'Der Termin liegt in deinem Reisezeitraum und erwähnt „{word}“.'
            elif travel and travel_day:
                score = THRESHOLD
                reason = 'Der Termin liegt am An- oder Abreisetag und klingt nach Reise.'
            else:
                continue
            if score < THRESHOLD:
                continue
            found.append(_make(
                'trip_event', 'DATE_AND_CONTEXT_MATCH', score, ObjectType.TRIP, trip,
                ObjectType.CALENDAR_EVENT, event,
                f'„{event.title}“ könnte zu deiner Reise „{_trip_name(trip)}“ gehören.', reason, trip.start_date,
            ))
    return found


def rule_trip_goal(scope: _Scope) -> list[LinkSuggestion]:
    """Sparziel nennt das Reiseziel als ganzes Wort UND hat Reisebezug („Japan Urlaub“, „Reisekasse Berlin“) oder
    ein Zieldatum kurz vor/während der Reise. „Kaution Wohnung Berlin“ nennt die Stadt, ist aber kein Reisegeld."""
    found = []
    trips = [(trip, _trip_words(trip)) for trip in scope.trips()]
    trips = [(trip, keys) for trip, keys in trips if keys]
    for goal in scope.goals() if trips else []:
        goal_words = words(goal.title, 3)
        travel = _flags(goal.title, TRIP_GOAL_WORDS)
        for trip, keys in trips:
            hit = match_word(goal_words, keys)
            if hit is None or not hit[1]:
                continue
            timed = goal.target_date is not None and (
                trip.start_date - timedelta(days=GOAL_LEAD_DAYS) <= goal.target_date <= trip.end_date
            )
            if not (travel or timed):
                continue
            found.append(_make(
                'trip_goal', 'MATCHING_TITLE', 0.8, ObjectType.TRIP, trip, ObjectType.SAVINGS_GOAL, goal,
                f'Dein Sparziel „{goal.title}“ könnte zu deiner Reise „{_trip_name(trip)}“ gehören.',
                f'Das Sparziel erwähnt „{hit[0]}“, das Ziel deiner Reise.', trip.start_date,
            ))
    return found


def rule_device_goal(scope: _Scope) -> list[LinkSuggestion]:
    """Sparziel nennt das Gerät („Neue Waschmaschine“ ↔ „Waschmaschine“). Nur der Gerätename zählt."""
    found = []
    devices = [(device, words(device.name)) for device in scope.devices()]
    devices = [(device, keys) for device, keys in devices if keys]
    for goal in scope.goals() if devices else []:
        goal_words = words(goal.title)
        for device, keys in devices:
            word = common_word(keys, goal_words)
            if word is None:
                continue
            found.append(_make(
                'device_goal', 'DEVICE_SAVINGS_GOAL_MATCH', 0.8, ObjectType.DEVICE, device,
                ObjectType.SAVINGS_GOAL, goal,
                f'Dein Sparziel „{goal.title}“ könnte mit dem Gerät „{device.name}“ zusammenhängen.',
                f'Das Sparziel erwähnt „{word}“.', goal.target_date,
            ))
    return found


def rule_contract_task(scope: _Scope) -> list[LinkSuggestion]:
    """Aufgabe ist erkennbar Vertragssache (kündigen, Tarif, Rechnung, Hotline …) UND nennt den Anbieter oder den
    Vertragsnamen — oder nennt Anbieter UND Vertragsnamen. Der Anbieter allein reicht nicht („Allianz Arena
    Tickets“, „München Wohnung besichtigen“ bei „Stadtwerke München“), der Name allein auch nicht („Internet-Router
    neu starten“)."""
    found = []
    contracts = [(contract, words(contract.provider), words(contract.name)) for contract in scope.contracts()]
    if not contracts:
        return found
    for task in scope.tasks():
        task_words = words(task.title)
        if not task_words:
            continue
        contract_context = _flags(task.title, CONTRACT_WORDS)
        for contract, provider, name in contracts:
            by_provider = common_word(task_words, provider) if provider else None
            by_name = common_word(task_words, name) if name else None
            if by_provider and (contract_context or by_name):
                score, word = 0.8, by_provider
                reason = f'Die Aufgabe erwähnt „{word}“, den Anbieter dieses Vertrags.'
            elif by_name and contract_context:
                score, word = 0.75, by_name
                reason = f'Die Aufgabe erwähnt „{word}“ und betrifft einen Vertrag.'
            else:
                continue
            found.append(_make(
                'contract_task', 'CONTRACT_TASK_MATCH', score, ObjectType.CONTRACT, contract, ObjectType.TASK, task,
                f'„{task.title}“ könnte zu deinem Vertrag „{contract.name}“ gehören.', reason, task.due_date,
            ))
    return found


# Welche Regel welche Typen braucht — damit für ein einzelnes Objekt nur die passenden Regeln laufen.
RULES = (
    ((ObjectType.TRIP, ObjectType.TASK), rule_trip_task),
    ((ObjectType.TRIP, ObjectType.CALENDAR_EVENT), rule_trip_event),
    ((ObjectType.TRIP, ObjectType.SAVINGS_GOAL), rule_trip_goal),
    ((ObjectType.DEVICE, ObjectType.SAVINGS_GOAL), rule_device_goal),
    ((ObjectType.CONTRACT, ObjectType.TASK), rule_contract_task),
)


# ---------------------------------------------------------------------------
# Berechnen, filtern, sortieren
# ---------------------------------------------------------------------------


def _existing_pairs(found: list[LinkSuggestion]) -> set[tuple[str, int, str, int]]:
    if not found:
        return set()
    query = Q()
    for suggestion in found:
        query |= Q(source_type=suggestion.source_type, source_id=suggestion.source.pk,
                   target_type=suggestion.target_type, target_id=suggestion.target.pk)
    return set(Connection.objects.filter(query).values_list('source_type', 'source_id', 'target_type', 'target_id'))


def compute(user, focus: tuple[str, int] | None = None, today: date | None = None) -> list[LinkSuggestion]:
    scope = _Scope(user, today or timezone.localdate(), focus)
    found: list[LinkSuggestion] = []
    for types, rule in RULES:
        if focus is None or focus[0] in types:
            found.extend(rule(scope))
    # Ein Paar höchstens einmal (die stärkste Regel gewinnt), nichts Bestehendes, nichts Abgelehntes.
    best: dict[str, LinkSuggestion] = {}
    for suggestion in found:
        if suggestion.key not in best or suggestion.score > best[suggestion.key].score:
            best[suggestion.key] = suggestion
    existing = _existing_pairs(list(best.values()))
    dismissed = set(
        SuggestionDismissal.objects.filter(user=user, key__in=list(best)).values_list('key', flat=True)
    )
    result = [
        s for s in best.values()
        if s.key not in dismissed
        and (s.source_type, s.source.pk, s.target_type, s.target.pk) not in existing
        and s.ref('source') != s.ref('target')
    ]
    far = date.max
    result.sort(key=lambda s: (-s.score, s.when or far, s.key))
    return result


def for_object(user, object_type: str, object_id: int, limit: int = OBJECT_LIMIT) -> list[dict]:
    """Vorschläge zu einem Objekt (Detailansicht). Unsichtbares Objekt → 404; nur lesbares → keine Vorschläge."""
    if services.get_visible_object(user, object_type, object_id) is None:
        raise services.NotFound(services.OBJECT_NOT_FOUND)
    if not services.can_connect_object(user, object_type, object_id):
        return []
    focus = (object_type, object_id)
    return [s.as_dict(focus) for s in compute(user, focus)[:limit]]


def top_for_user(user, limit: int = 1, minimum: float = DASHBOARD_THRESHOLD) -> list[dict]:
    """Für „Für dich“: höchstens ein starker Vorschlag — oder keiner."""
    return [s.as_dict() for s in compute(user) if s.score >= minimum][:limit]


def _parse(key: str) -> tuple[str, int, str, int]:
    match = KEY_PATTERN.match(key or '')
    if match is None:
        raise services.NotFound('Dieser Vorschlag gilt nicht mehr.')
    source_type, source_id, target_type, target_id = match.groups()
    if (source_type, target_type) not in {types for types, _ in RULES} or max(int(source_id), int(target_id)) > MAX_ID:
        raise services.NotFound('Dieser Vorschlag gilt nicht mehr.')
    return source_type, int(source_id), target_type, int(target_id)


def _current(user, key: str) -> LinkSuggestion:
    """Der Vorschlag, wie er JETZT für diese Person gilt — neu berechnet, nie aus dem Client übernommen."""
    source_type, source_id, _, _ = _parse(key)
    for suggestion in compute(user, (source_type, source_id)):
        if suggestion.key == key:
            return suggestion
    raise services.NotFound('Dieser Vorschlag gilt nicht mehr.')


def accept(user, key: str) -> dict:
    """„Verknüpfen“: legt über die Connection Engine eine Verbindung an (Rechte, Existenz, Duplikat werden dort
    erneut geprüft). Ändert sonst nichts — keine Aufgabe, kein Datum, kein Betrag."""
    suggestion = _current(user, key)
    return services.create_connection(
        user, suggestion.source_type, suggestion.source.pk, suggestion.target_type, suggestion.target.pk,
        origin=Origin.SUGGESTED,
    )


def dismiss(user, key: str) -> None:
    """„Nicht relevant“: dieses Paar wird dieser Person nicht mehr vorgeschlagen."""
    _current(user, key)  # nur echte, eigene, aktuelle Vorschläge
    SuggestionDismissal.objects.get_or_create(user=user, key=key)
