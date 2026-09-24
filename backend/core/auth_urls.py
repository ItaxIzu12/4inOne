from django.urls import path

from core.auth_views import (
    CsrfTokenView,
    LoginView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegisterView,
)
from core.mfa_views import MfaSetupView, MfaVerifyView

urlpatterns = [
    path('csrf/', CsrfTokenView.as_view(), name='auth-csrf'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='auth-password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('mfa/setup/', MfaSetupView.as_view(), name='auth-mfa-setup'),
    path('mfa/verify/', MfaVerifyView.as_view(), name='auth-mfa-verify'),
]
