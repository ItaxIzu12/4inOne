from core.throttling import LocalCacheThrottle


class HaushaltWriteRateThrottle(LocalCacheThrottle):
    """Grenze für schreibende Haushalt-Endpunkte — wie
    finanzen.throttling.TransactionWriteRateThrottle vor allem Schutz vor
    einem Frontend-Bug (Endlosschleife), nicht vor Angreifern. Großzügiger
    als bei Finanzen, weil beim Einkaufen viele Einträge in kurzer Zeit
    abgehakt werden. Pro Nutzer."""

    scope = 'haushalt_write'

    def get_cache_key(self, request, view):
        ident = request.user.pk if request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
