from django.urls import path

from core.household_views import HouseholdInviteView

urlpatterns = [
    path('invite/', HouseholdInviteView.as_view(), name='household-invite'),
]
