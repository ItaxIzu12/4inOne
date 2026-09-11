from django.core.cache import caches
from rest_framework.throttling import AnonRateThrottle


class LocalCacheThrottle(AnonRateThrottle):
    """Basisklasse für alle Auth-/MFA-Rate-Limits (core/auth_views.py,
    core/mfa_views.py): Zustand landet im 'throttle'-Cache (LocMemCache,
    siehe settings.py), NICHT im Redis-gestützten Default-Cache — Login/
    Registrierung/Passwort-Reset/MFA dürfen nicht ausfallen, nur weil Redis
    (noch) nicht läuft."""

    cache = caches['throttle']
