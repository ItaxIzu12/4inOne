"""Öffentliche Website: Kontaktanfragen und eine datensparsame Besucherzählung.

Bewusst getrennt von den Nutzerdaten (Finanzen, Haushalt …): Hier landet nur, was Besucher der öffentlichen Seiten
selbst schicken (Kontaktformular) oder ein reiner Tageszähler je Seite — keine IP-Adresse, kein Browser-Kennzeichen,
kein Cookie, keine Nutzer-ID. Damit braucht die Zählung keine Einwilligung (kein Cookie-Banner).
"""

from django.db import models


class ContactMessage(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=254)
    message = models.TextField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # Ob die Weiterleitung per E-Mail geklappt hat — gespeichert ist die Nachricht in jedem Fall.
    forwarded = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Kontaktanfrage'
        verbose_name_plural = 'Kontaktanfragen'

    def __str__(self) -> str:
        return f'{self.name} <{self.email}>'


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
