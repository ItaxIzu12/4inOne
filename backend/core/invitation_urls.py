from django.urls import path

from core.invitation_views import (
    InvitationAcceptView,
    InvitationDeclineView,
    InvitationListView,
    InvitationRevokeView,
    NotificationListView,
    NotificationReadView,
)

invitation_urlpatterns = [
    path('', InvitationListView.as_view(), name='invitations'),
    path('<int:pk>/accept/', InvitationAcceptView.as_view(), name='invitation-accept'),
    path('<int:pk>/decline/', InvitationDeclineView.as_view(), name='invitation-decline'),
    path('<int:pk>/revoke/', InvitationRevokeView.as_view(), name='invitation-revoke'),
]

notification_urlpatterns = [
    path('', NotificationListView.as_view(), name='notifications'),
    path('read/', NotificationReadView.as_view(), name='notifications-read'),
]
