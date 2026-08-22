import pytest

from core.models import Household
from haushalt.models import ShoppingItem, ShoppingList


@pytest.mark.django_db
def test_shopping_item_belongs_to_list():
    household = Household.objects.create(name='Testhaushalt')
    shopping_list = ShoppingList.objects.create(household=household)
    item = ShoppingItem.objects.create(shopping_list=shopping_list, name='Milch')

    assert item.shopping_list.household == household
    assert item.is_checked is False
