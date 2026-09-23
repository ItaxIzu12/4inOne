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


class DataExportRateThrottle(LocalCacheThrottle):
    """Rate-Limit für Datenexporte (ARCHITEKTUR.md §3.9: "muss selbst
    rate-limitiert sein, sonst lässt er sich zum wiederholten Bulk-Abgreifen
    aller Haushaltsdaten missbrauchen, auch mit gültigem Token") — bisher nur
    als Umgebungsvariable (RATE_LIMIT_DATA_EXPORT) reserviert, jetzt zum
    ersten Mal tatsächlich verwendet: für die Berichte-Endpunkte (CSV/PDF,
    finanzen/views.py BerichtCsvView/BerichtPdfView). Ein Bericht enthält
    vollständige Haushaltsdaten über einen ganzen Monat/ein ganzes Jahr —
    mindestens so sensibel wie ein einzelner Datenexport.

    Pro NUTZER (wie TransactionWriteRateThrottle), nicht pro Haushalt — sonst
    könnte ein Mitglied das Limit für den ganzen Haushalt aufbrauchen."""

    scope = 'data_export'

    def get_cache_key(self, request, view):
        ident = request.user.pk if request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
