from core.throttling import LocalCacheThrottle


class ConnectionsWriteRateThrottle(LocalCacheThrottle):
    """Schutz vor einem Frontend-Fehler (Endlosschleife) beim Anlegen und
    Lösen von Verbindungen. Pro Nutzer."""

    scope = 'connections_write'

    def get_cache_key(self, request, view):
        ident = request.user.pk if request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
