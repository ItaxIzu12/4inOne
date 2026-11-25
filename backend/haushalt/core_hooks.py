"""Haushalt meldet sich bei `core` an (core/registry.py, docs/ARCHITECTURE.md § 3.1, 24.11.2026).

Der Code stand bis 24.11.2026 in core/onboarding_views.py und core/household_views.py; Verhalten unverändert.
"""

from __future__ import annotations

from django.db.models import Q

from core import registry


def has_user_data(user, personal) -> bool:
    from haushalt.models import FolderEntry, ShoppingItem, ShoppingTrip, Task, TaskCompletion

    checks = [
        ShoppingItem.objects.filter(Q(added_by=user) | Q(shopping_list__household__in=personal)),
        ShoppingTrip.objects.filter(Q(completed_by=user) | Q(household__in=personal)),
        TaskCompletion.objects.filter(Q(done_by=user) | Q(household__in=personal)),
        Task.objects.filter(Q(created_by=user) | Q(assigned_to=user) | Q(household__in=personal)),
        FolderEntry.objects.filter(Q(created_by=user) | Q(household__in=personal)),
    ]
    return any(query.exists() for query in checks)


def guide_steps(user, household) -> dict:
    from haushalt.models import FolderEntry, ShoppingItem, Task

    return {
        'haushalt': {
            'task': household is not None and Task.objects.filter(household=household).exists(),
            'shopping': household is not None and ShoppingItem.objects.filter(shopping_list__household=household).exists(),
            'folder': household is not None and FolderEntry.objects.filter(household=household).exists(),
        },
    }


def member_removed(household, user) -> None:
    from haushalt.services import remove_member_assignments

    remove_member_assignments(household, user)


def register() -> None:
    registry.register(registry.HAS_USER_DATA, has_user_data, order=20)
    registry.register(registry.GUIDE_STEPS, guide_steps, order=20)
    registry.register(registry.MEMBER_REMOVED, member_removed, order=20)
