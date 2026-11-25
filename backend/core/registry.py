"""Anmeldepunkte für bereichsübergreifende Aufgaben von `core` und der Fachbereiche (docs/ARCHITECTURE.md § 3.1, Phase 2, 24.11.2026).

`core` ist die unterste Ebene und importiert keinen Fachbereich. Wo `core` trotzdem Wissen aus den Bereichen braucht
(„Hat die Person schon Daten?“, „Welche Orte hat sie schon benutzt?“, „In welche Reise kann sie jemanden einladen?“),
melden die Bereiche eine Funktion in ihrer `apps.py › ready()` hier an. So hängt die Abhängigkeit in der richtigen
Richtung: Bereich → core.

Muster wie `connections/registry.py`: einfache Listen bzw. Wörterbücher, keine Magie. Reihenfolge über `order`
(kleiner zuerst), damit Ausgaben wie die Kontakt-Übersicht stabil bleiben, egal in welcher Reihenfolge Django die Apps
lädt.

Anmeldepunkte (Signatur):

- HAS_USER_DATA:     fn(user, personal_households: QuerySet[Household]) -> bool
- GUIDE_STEPS:       fn(user, household: Household | None) -> dict[str, dict]   (Bereich → Startschritte)
- PLACE_SOURCES:     fn(user, kind: str) -> list[tuple[str, datetime]]          (Ort, Zeitstempel)
- CONTACT_SHARING:   fn(user, people, ids, open_invites, shared, addable, pending) -> None  (füllt die drei dicts)
- INVITATION_SCOPES: Schlüssel = Invitation.Scope-Wert, Wert = fn() -> invitations.Scope
- CLEANUP_RULES:     fn(now) -> dict[str, QuerySet]                             (Beschriftung → zu löschende Zeilen)
- MEMBER_REMOVED:    fn(household, user) -> None   (vor dem Entfernen aus einem Haushalt, in derselben Transaktion)
- PLANNED_EXPENSES:  fn(user, start, end, month_rows) -> (ersetzt_wiederkehrende: bool, list[dict])
                     abgeleitete „Geplant“-Posten für Finanzen (Verträge, Reisebudget; angemeldet von connections)
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Callable

HAS_USER_DATA = 'has_user_data'
GUIDE_STEPS = 'guide_steps'
PLACE_SOURCES = 'place_sources'
CONTACT_SHARING = 'contact_sharing'
CLEANUP_RULES = 'cleanup_rules'
MEMBER_REMOVED = 'member_removed'
PLANNED_EXPENSES = 'planned_expenses'
HOOKS = (HAS_USER_DATA, GUIDE_STEPS, PLACE_SOURCES, CONTACT_SHARING, CLEANUP_RULES, MEMBER_REMOVED, PLANNED_EXPENSES)

_hooks: dict[str, list[tuple[int, str, Callable[..., Any]]]] = defaultdict(list)
_invitation_scopes: dict[str, Callable[[], Any]] = {}


def register(hook: str, fn: Callable[..., Any], *, order: int = 100) -> None:
    """Funktion für einen Anmeldepunkt eintragen. Doppelt angemeldete Funktionen (z. B. ready() zweimal in Tests)
    werden nur einmal geführt."""
    if hook not in HOOKS:
        raise ValueError(f'Unbekannter Anmeldepunkt: {hook}')
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
