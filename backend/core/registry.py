"""Anmeldepunkte für bereichsübergreifende Aufgaben von `core` und der Fachbereiche (docs/ARCHITECTURE.md § 3.1, Phase 2, 24.11.2026).

`core` ist die unterste Ebene und importiert keinen Fachbereich. Wo `core` trotzdem Wissen aus den Bereichen braucht
(„Hat die Person schon Daten?“, „Welche Orte hat sie schon benutzt?“, „In welche Reise kann sie jemanden einladen?“),
melden die Bereiche eine Funktion in ihrer `apps.py › ready()` hier an. So hängt die Abhängigkeit in der richtigen
Richtung: Bereich → core.

Muster wie `connections/registry.py`: einfache Listen bzw. Wörterbücher, keine Magie. Reihenfolge über `order`
(kleiner zuerst), damit Ausgaben wie die Kontakt-Übersicht stabil bleiben, egal in welcher Reihenfolge Django die Apps
lädt.

Anmeldepunkte: Signaturen als `Protocol` unten (HasUserData, GuideSteps, …). `register()` prüft die Parameter schon
beim Start der App – eine falsch geschriebene Funktion verhindert den Start, statt still an einer Stelle zu scheitern,
die selten läuft (docs/ARCHITECTURE.md § 10.3 D, 25.11.2026). Einladungsarten: `register_invitation_scope()`.
"""

from __future__ import annotations

import inspect
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Callable, Protocol


# ------------------------------------------------------------------ Signaturen der Anmeldepunkte
class HasUserData(Protocol):
    """Hat die Person in diesem Bereich schon etwas eingetragen? `personal` = ihre Ein-Personen-Haushalte (QuerySet)."""

    def __call__(self, user: Any, personal: Any) -> bool: ...


class GuideSteps(Protocol):
    """Startschritte des Bereichs: {'bereich': {'schritt': bool, …}}. `household` = aktiver Haushalt oder None."""

    def __call__(self, user: Any, household: Any) -> dict[str, dict]: ...


class PlaceSource(Protocol):
    """Bisher benutzte Orte: [(Ort, Zeitstempel)]. `kind` = 'place' oder 'lodging'."""

    def __call__(self, user: Any, kind: str) -> list[tuple[str, Any]]: ...


@dataclass
class SharingContext:
    """Kontakt-Übersicht (core/contact_views.py): was teile ich mit wem, wozu kann ich einladen, wozu ist eingeladen."""

    user: Any
    people: list
    ids: set[int]
    open_invites: dict[tuple[int, str, int], int]
    shared: dict[int, list[dict]] = field(default_factory=dict)
    addable: dict[int, list[dict]] = field(default_factory=dict)
    pending: dict[int, list[dict]] = field(default_factory=dict)

    def classify(self, pk: int, entry: dict, *, member: bool, can_invite: bool) -> None:
        """Eintrag für eine Person einsortieren: geteilt, eingeladen (mit Einladungs-ID) oder einladbar."""
        key = (pk, entry['kind'], entry['id'])
        if member:
            self.shared[pk].append(entry)
        elif key in self.open_invites:
            self.pending[pk].append({**entry, 'invitation_id': self.open_invites[key]})
        elif can_invite:
            self.addable[pk].append(entry)


class ContactSharing(Protocol):
    def __call__(self, ctx: SharingContext) -> None: ...


class CleanupRules(Protocol):
    """Zu löschende Zeilen: {Beschriftung: QuerySet}. `now` = timezone.now()."""

    def __call__(self, now: datetime) -> dict[str, Any]: ...


class MemberRemoved(Protocol):
    """Vor dem Entfernen einer Person aus einem Haushalt, in derselben Transaktion."""

    def __call__(self, household: Any, user: Any) -> None: ...


class PlannedExpenses(Protocol):
    """Abgeleitete „Geplant“-Posten für Finanzen: (ersetzt gleichnamige wiederkehrende Posten?, Posten)."""

    def __call__(self, user: Any, start: date, end: date, month_rows: Any) -> tuple[bool, list[dict]]: ...


HAS_USER_DATA = 'has_user_data'
GUIDE_STEPS = 'guide_steps'
PLACE_SOURCES = 'place_sources'
CONTACT_SHARING = 'contact_sharing'
CLEANUP_RULES = 'cleanup_rules'
MEMBER_REMOVED = 'member_removed'
PLANNED_EXPENSES = 'planned_expenses'
SIGNATURES: dict[str, type[Protocol]] = {
    HAS_USER_DATA: HasUserData,
    GUIDE_STEPS: GuideSteps,
    PLACE_SOURCES: PlaceSource,
    CONTACT_SHARING: ContactSharing,
    CLEANUP_RULES: CleanupRules,
    MEMBER_REMOVED: MemberRemoved,
    PLANNED_EXPENSES: PlannedExpenses,
}
HOOKS = tuple(SIGNATURES)


def _parameter_names(fn: Callable[..., Any]) -> list[str]:
    return [p.name for p in inspect.signature(fn).parameters.values() if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)]


def _check_signature(hook: str, fn: Callable[..., Any]) -> None:
    expected = _parameter_names(SIGNATURES[hook].__call__)[1:]  # ohne self
    actual = _parameter_names(fn)
    if len(actual) != len(expected):
        raise TypeError(
            f'{fn.__module__}.{fn.__qualname__} passt nicht zum Anmeldepunkt {hook}: erwartet ({", ".join(expected)}), '
            f'hat ({", ".join(actual)}) – siehe core/registry.py › {SIGNATURES[hook].__name__}'
        )


_hooks: dict[str, list[tuple[int, str, Callable[..., Any]]]] = defaultdict(list)
_invitation_scopes: dict[str, Callable[[], Any]] = {}


def register(hook: str, fn: Callable[..., Any], *, order: int = 100) -> None:
    """Funktion für einen Anmeldepunkt eintragen. Doppelt angemeldete Funktionen (z. B. ready() zweimal in Tests)
    werden nur einmal geführt."""
    if hook not in HOOKS:
        raise ValueError(f'Unbekannter Anmeldepunkt: {hook}')
    _check_signature(hook, fn)
    key = f'{fn.__module__}.{fn.__qualname__}'
    if any(existing == key for _, existing, _ in _hooks[hook]):
        return
    _hooks[hook].append((order, key, fn))
    _hooks[hook].sort(key=lambda item: (item[0], item[1]))


def hooks(hook: str) -> list[Callable[..., Any]]:
    if hook not in HOOKS:
        raise ValueError(f'Unbekannter Anmeldepunkt: {hook}')
    return [fn for _, _, fn in _hooks[hook]]


def register_invitation_scope(scope_type: str, factory: Callable[[], Any]) -> None:
    _invitation_scopes[scope_type] = factory


def invitation_scope(scope_type: str) -> Callable[[], Any] | None:
    return _invitation_scopes.get(scope_type)
