"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from finanzen.views import OnboardingStatusView
from core.onboarding_views import OnboardingProfileView

urlpatterns = [
    path('api/v1/onboarding/profile/', OnboardingProfileView.as_view(), name='onboarding-profile'),
    # Pfad kommt aus ADMIN_URL_PATH (.env), NICHT hart als 'admin/' —
    # siehe ARCHITEKTUR.md §3.4 (Standardziel automatisierter Scanner).
    path(settings.ADMIN_URL_PATH, admin.site.urls),
    # API-Versionierung (ARCHITEKTUR.md, bisher offener Punkt): ALLE
    # bestehenden Endpunkte ziehen gemeinsam auf /api/v1/ um, nicht nur
    # Finanzen — sonst wäre core/auth dauerhaft unversioniert geblieben,
    # während neuere Module schon versioniert sind.
    path('api/v1/auth/', include('core.auth_urls')),
    path('api/v1/finanzen/private/', include('finanzen.private_urls')),
    path('api/v1/finanzen/', include('finanzen.urls')),
    path('api/v1/household/', include('core.household_urls')),
    path('api/v1/organisation/', include('organisation.urls')),
    path('api/v1/haushalt/', include('haushalt.urls')),
    # OnboardingStatusView liegt in finanzen/views.py (braucht Transaction/
    # Category von dort), ist aber kein finanzen-spezifischer Endpunkt —
    # daher direkt hier verdrahtet statt in finanzen/urls.py, und unter
    # einem neutralen Pfad statt /api/v1/finanzen/... gemountet.
    path('api/v1/onboarding/status/', OnboardingStatusView.as_view(), name='onboarding-status'),
]
