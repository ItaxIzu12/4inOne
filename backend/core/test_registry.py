"""Vertrag von core/registry.py (docs/ARCHITECTURE.md § 10.3 D, 25.11.2026).

Die Bereiche melden sich beim App-Start an. Dieser Test hält fest, WER sich wofür anmeldet, und dass falsche
Signaturen sofort beim Anmelden auffallen – nicht erst in einer selten benutzten Ansicht.
"""

import pytest

from core import registry

# Wer sich wofür anmeldet. Ändert sich das, ist es eine bewusste Entscheidung und gehört hier nachgetragen.
EXPECTED = {
    registry.HAS_USER_DATA: ['finanzen.core_hooks', 'haushalt.core_hooks', 'organisation.core_hooks'],
    registry.GUIDE_STEPS: ['finanzen.core_hooks', 'haushalt.core_hooks', 'organisation.core_hooks', 'reisen.core_hooks'],
    registry.PLACE_SOURCES: ['organisation.core_hooks', 'reisen.core_hooks'],
    registry.CONTACT_SHARING: ['reisen.core_hooks', 'organisation.core_hooks', 'organisation.core_hooks'],
    registry.CLEANUP_RULES: ['reisen.core_hooks'],
    registry.MEMBER_REMOVED: ['haushalt.core_hooks'],
    registry.PLANNED_EXPENSES: ['connections.apps', 'connections.apps'],
}


def test_every_hook_has_its_expected_registrations_in_order():
    assert set(EXPECTED) == set(registry.HOOKS)
    for hook, modules in EXPECTED.items():
        assert [fn.__module__ for fn in registry.hooks(hook)] == modules, hook


def test_invitation_scopes_are_registered():
    from core.models import Invitation

    for scope in (Invitation.Scope.TRIP, Invitation.Scope.CALENDAR, Invitation.Scope.MY_CALENDAR):
        assert registry.invitation_scope(scope) is not None, scope


def test_registered_functions_match_their_protocol():
    for hook in registry.HOOKS:
        for fn in registry.hooks(hook):
            registry._check_signature(hook, fn)  # wirft bei Abweichung


def test_wrong_signature_is_refused_at_registration():
    def too_many(user, personal, extra):
        return False

    with pytest.raises(TypeError, match='passt nicht zum Anmeldepunkt has_user_data'):
        registry.register(registry.HAS_USER_DATA, too_many)
    assert too_many not in registry.hooks(registry.HAS_USER_DATA)


def test_unknown_hook_is_refused():
    with pytest.raises(ValueError):
        registry.register('gibt_es_nicht', lambda user: None)
    with pytest.raises(ValueError):
        registry.hooks('gibt_es_nicht')


def test_registering_twice_keeps_one_entry():
    fn = registry.hooks(registry.CLEANUP_RULES)[0]
    registry.register(registry.CLEANUP_RULES, fn)
    assert registry.hooks(registry.CLEANUP_RULES).count(fn) == 1


def test_sharing_context_classifies_like_before():
    ctx = registry.SharingContext(user=None, people=[], ids={1, 2, 3}, open_invites={(2, 'TRIP', 9): 77},
                                  shared={1: [], 2: [], 3: []}, addable={1: [], 2: [], 3: []}, pending={1: [], 2: [], 3: []})
    entry = {'kind': 'TRIP', 'id': 9, 'title': 'Lissabon'}
    ctx.classify(1, entry, member=True, can_invite=True)
    ctx.classify(2, entry, member=False, can_invite=True)
    ctx.classify(3, entry, member=False, can_invite=False)
    assert ctx.shared[1] == [entry]
    assert ctx.pending[2] == [{**entry, 'invitation_id': 77}] and ctx.addable[2] == []
    assert ctx.shared[3] == ctx.pending[3] == ctx.addable[3] == []
