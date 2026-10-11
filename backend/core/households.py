"""Welcher Haushalt gilt für eine Person?

Jede Person bekommt bei der Registrierung einen eigenen Haushalt. Über eine angenommene Einladung kann sie
einem weiteren beitreten (core/invitations.py). Daraus folgen zwei klar getrennte Fragen:

- **aktiver Haushalt** — der zuletzt beigetretene. Der Haushaltsbereich (Aufgaben, Einkauf, Geräte, Verträge)
  und alles, was darauf aufbaut (Startseite, Vorschläge), zeigt diesen.
- **eigener Haushalt** — der bei der Registrierung angelegte (älteste Mitgliedschaft). Nur daran hängen die
  eingefrorenen alten Haushaltsfinanzen. Ein Beitritt zu einem fremden Haushalt öffnet dadurch nie dessen
  Finanzen; private Finanzen, Sparziele und Organisation hängen ohnehin an der Person.
"""

from core.models import Household, HouseholdMembership


def active_membership(user) -> HouseholdMembership | None:
    return HouseholdMembership.objects.select_related('household').filter(user=user).order_by('-id').first()


def own_membership(user) -> HouseholdMembership | None:
    return HouseholdMembership.objects.select_related('household').filter(user=user).order_by('id').first()


def active_household(user) -> Household | None:
    membership = active_membership(user)
    return membership.household if membership else None


def own_household(user) -> Household | None:
    membership = own_membership(user)
    return membership.household if membership else None
