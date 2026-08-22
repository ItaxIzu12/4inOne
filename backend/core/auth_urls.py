from django.urls import path

from core.auth_views import (
    LoginView,
    LogoutView,
    PasswordResetRequestView,
    RefreshView,
    RegisterView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
]
