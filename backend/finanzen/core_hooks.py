"""Finanzen meldet sich bei `core` an (core/registry.py, docs/ARCHITECTURE.md § 3.1, 24.11.2026).

Der Code stand bis 24.11.2026 in core/onboarding_views.py; Verhalten unverändert.
"""

from __future__ import annotations

from django.db.models import Q

from core import registry


def has_user_data(user, personal) -> bool:
    from finanzen.models import Budget, Category, MonthlyBudget, RecurringDeduction, SavingsGoal, Transaction

    checks = [
        MonthlyBudget.objects.filter(owner=user),
        SavingsGoal.objects.filter(owner=user),
        Transaction.objects.filter(Q(created_by=user) | Q(account__household__in=personal)),
        RecurringDeduction.objects.filter(Q(created_by=user) | Q(household__in=personal)),
        Category.objects.filter(household__in=personal).filter(Q(is_default=False) | Q(monthly_goal__isnull=False)),
        Budget.objects.filter(household__in=personal),
    ]
    return any(query.exists() for query in checks)


def guide_steps(user, household) -> dict:
    from finanzen.models import MonthlyBudget, SavingsGoal, Transaction

    return {
        'finanzen': {
            'budget': MonthlyBudget.objects.filter(owner=user).exists(),
            'transaction': Transaction.objects.filter(owner=user).exists(),
            'goal': SavingsGoal.objects.filter(owner=user).exists(),
        },
    }


def register() -> None:
    registry.register(registry.HAS_USER_DATA, has_user_data, order=10)
    registry.register(registry.GUIDE_STEPS, guide_steps, order=10)
