"""Öffentliche Website: eine datensparsame Besucherzählung.

Bewusst getrennt von den Nutzerdaten (Finanzen, Haushalt …): Hier landet nur, was Besucher der öffentlichen Seiten
als reiner Tageszähler je Seite erfasst wird — keine IP-Adresse, kein Browser-Kennzeichen,
kein Cookie, keine Nutzer-ID. Damit braucht die Zählung keine Einwilligung (kein Cookie-Banner).
"""

from django.db import models


class PageView(models.Model):
    """Ein Zähler je Tag, Seite und Gerätegröße — mehr nicht."""

    class Device(models.TextChoices):
        MOBILE = 'mobile', 'Handy'
        DESKTOP = 'desktop', 'Computer'

    day = models.DateField()
    path = models.CharField(max_length=60)
    device = models.CharField(max_length=10, choices=Device.choices)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-day', 'path']
        constraints = [models.UniqueConstraint(fields=['day', 'path', 'device'], name='website_pageview_unique_day')]
        verbose_name = 'Seitenaufruf'
        verbose_name_plural = 'Seitenaufrufe'

    def __str__(self) -> str:
        return f'{self.day} {self.path} ({self.device}): {self.count}'
