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
    path('invites/<str:token>/', InviteDetailView.as_view(), name='contact-invite-detail'),
    path('invites/<str:token>/accept/', InviteAcceptView.as_view(), name='contact-invite-accept'),
    path('invites/<str:token>/decline/', InviteDeclineView.as_view(), name='contact-invite-decline'),
]
