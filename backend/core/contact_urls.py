from django.urls import path

from core.contact_views import (
    ContactDetailView,
    ContactListView,
    InviteAcceptView,
    InviteCancelView,
    InviteCreateView,
    InviteDeclineView,
    InviteDetailView,
)

urlpatterns = [
    path('', ContactListView.as_view(), name='contacts'),
    path('<int:pk>/', ContactDetailView.as_view(), name='contact-detail'),
    path('invites/', InviteCreateView.as_view(), name='contact-invite-create'),
    path('invites/<int:pk>/', InviteCancelView.as_view(), name='contact-invite-cancel'),
    # Token immer im Body (nie in der URL, siehe contact_views._invite_for)
    path('invites/lookup/', InviteDetailView.as_view(), name='contact-invite-detail'),
    path('invites/accept/', InviteAcceptView.as_view(), name='contact-invite-accept'),
    path('invites/decline/', InviteDeclineView.as_view(), name='contact-invite-decline'),
]
