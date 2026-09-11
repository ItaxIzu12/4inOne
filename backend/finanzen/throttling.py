from core.throttling import LocalCacheThrottle


class TransactionWriteRateThrottle(LocalCacheThrottle):
    """Moderates Limit auf schreibende Transaktions-Endpunkte (Sicherheits-
    prüfung PRÜFUNG 4). Zweck ist NICHT, einen böswilligen Angreifer zu
    stoppen — ein eingeloggtes Haushaltsmitglied ist ohnehin vertrauenswürdig
    und die Tragweite dadurch begrenzt. Der eigentliche Zweck ist Schutz vor
    einem Frontend-Bug (z. B. eine versehentliche Endlosschleife, die
    Tausende Transaktionen anlegt), der sonst die Datenbank sowie die live
    berechnete Fairness-/Budget-Aggregation verstopfen würde.

    Pro NUTZER (nicht pro Haushalt wie HouseholdInviteRateThrottle) — ein
    Frontend-Bug betrifft typischerweise eine einzelne offene Browser-Tab-
    Sitzung, nicht gleich den ganzen Haushalt gemeinsam.
    """

    scope = 'finanzen_write'

    def get_cache_key(self, request, view):
        ident = request.user.pk if request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
