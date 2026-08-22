from datetime import datetime, timezone

import pytest

from core.models import Household
from organisation.models import CalendarEvent


@pytest.mark.django_db
def test_calendar_event_belongs_to_household():
    household = Household.objects.create(name='Testhaushalt')
    event = CalendarEvent.objects.create(
        household=household, title='Zahnarzt', starts_at=datetime(2026, 8, 28, 9, 0, tzinfo=timezone.utc)
    )

    assert event.household == household
