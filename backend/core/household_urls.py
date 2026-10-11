from django.urls import path

from core.household_views import HouseholdMemberDetailView, HouseholdMembersView

urlpatterns = [
    path('members/', HouseholdMembersView.as_view(), name='household-members'),
    path('members/<int:pk>/', HouseholdMemberDetailView.as_view(), name='household-member'),
]
