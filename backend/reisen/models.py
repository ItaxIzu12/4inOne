from django.conf import settings
from django.db import models


class Trip(models.Model):
    """Eine regulär angelegte, konkrete Reise.

    owner/created_by (das Feld owner) ist strikt von Teilnahme getrennt: wer eine Reise anlegt, muss nicht
    selbst mitreisen (z. B. jemand organisiert eine Reise für andere) — siehe TripParticipant. Bewusst KEINE
    Kopplung an core.Household: ADR-001s Vorschlag, Household zu einem allgemeinen "Bereich" (kind=trip) zu
    verallgemeinern, ist noch nicht entschieden ("Status: Vorschlag"), und eine Reise darf nicht exklusiv an
    GENAU einen Haushalt hängen — ein Nutzer kann mehreren Haushalten/Gruppen angehören, eine Reisegruppe ist
    meist eine andere Personenmenge als jeder bestehende Haushalt. TripParticipant ist deshalb ein eigenständiges,
    schlankes Modell nur für Reisen, das den bereits existierenden Contact (core/models.py) zur Auswahl nutzt,
    statt eine zweite Einladungs-Infrastruktur per E-Mail nachzubauen.

    start_date/end_date sind Pflichtfelder: eine Reise ohne konkreten Zeitraum wird in V1 nicht als
    Trip gespeichert. "Reiseideen" (Inspiration ohne festen Termin) sind ein eigenständiges, noch
    nicht gebautes Konzept und dürfen nicht mit Trip vermischt werden — eine spätere Draft/Idea-
    Funktion mit optionalen Datumsfeldern ist ausdrücklich nicht Teil von Reisen V1.
    """

    class Status(models.TextChoices):
        PLANNED = 'PLANNED', 'Geplant'
        ACTIVE = 'ACTIVE', 'Unterwegs'
        DONE = 'DONE', 'Abgeschlossen'
        CANCELLED = 'CANCELLED', 'Storniert'

    class TravelType(models.TextChoices):
        CITY_TRIP = 'CITY_TRIP', 'Städtereise'
        BEACH = 'BEACH', 'Strandurlaub'
        BUSINESS = 'BUSINESS', 'Geschäftsreise'
        ROAD_TRIP = 'ROAD_TRIP', 'Roadtrip'
        ACTIVE = 'ACTIVE', 'Aktivurlaub'
        FAMILY = 'FAMILY', 'Familienreise'
        GENERAL = 'GENERAL', 'Allgemein'

    class TransportType(models.TextChoices):
        FLIGHT = 'FLIGHT', 'Flugzeug'
        TRAIN = 'TRAIN', 'Zug'
        CAR = 'CAR', 'Auto'
        BUS = 'BUS', 'Bus'
        OTHER = 'OTHER', 'Sonstiges'

    class BaggageType(models.TextChoices):
        HAND_LUGGAGE = 'HAND_LUGGAGE', 'Nur Handgepäck'
        CHECKED_BAGGAGE = 'CHECKED_BAGGAGE', 'Aufgabegepäck'
        CAR_LUGGAGE = 'CAR_LUGGAGE', 'Gepäck im Auto'
        UNKNOWN = 'UNKNOWN', 'Noch unklar'

    class Currency(models.TextChoices):
        EUR = 'EUR', 'Euro'
        USD = 'USD', 'US-Dollar'
        GBP = 'GBP', 'Britisches Pfund'
        CHF = 'CHF', 'Schweizer Franken'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trips')
    title = models.CharField(max_length=120)
    destination = models.CharField(max_length=160, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    notes = models.TextField(blank=True, max_length=5000)
    status = models.CharField(max_length=9, choices=Status.choices, default=Status.PLANNED)
    # Alle drei optional und ohne Default-Wahl (blank statt einer erzwungenen Erstoption): sie dienen nur dazu, die
    # Smart-Setup-Vorschläge (siehe frontend trip-suggestions.ts) sinnvoller zu wählen — Reisen funktioniert auch
    # ganz ohne sie, siehe Trip-Docstring/AGENTS.md "nicht alles erzwingen".
    travel_type = models.CharField(max_length=10, choices=TravelType.choices, blank=True, default='')
    transport_type = models.CharField(max_length=6, choices=TransportType.choices, blank=True, default='')
    baggage_type = models.CharField(max_length=16, choices=BaggageType.choices, blank=True, default='')
    # Das geplante Reisebudget bleibt ein eigenständiger, einfacher Wert je Reise — bewusst kein zweites
    # vollständiges Finanzsystem und keine Verbindung zu core/finanzen (siehe TripExpense-Docstring). Currency
    # ist explizit (kein Float, kein impliziter Euro-Zwang), Decimal wie überall bei Geldbeträgen im Projekt.
    budget_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.EUR)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_date', 'id']
        indexes = [models.Index(fields=['owner', 'start_date'])]
        constraints = [
            models.CheckConstraint(condition=models.Q(end_date__gte=models.F('start_date')), name='trip_end_after_start'),
            models.CheckConstraint(
                condition=models.Q(budget_amount__isnull=True) | models.Q(budget_amount__gte=0),
                name='trip_budget_not_negative',
            ),
        ]

    def __str__(self) -> str:
        return self.title


class TripScopedModel(models.Model):
    """Gemeinsame Basis für alles, was zu genau einer Reise gehört. Der Besitz läuft
    ausschließlich über trip.owner — kein eigenes owner-Feld, damit nichts aus dem
    Gleichgewicht geraten kann (siehe OwnedViewSet-Analogon in views.py)."""

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='%(class)ss')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class PackingItem(TripScopedModel):
    class Category(models.TextChoices):
        DOKUMENTE = 'DOKUMENTE', 'Dokumente'
        KLEIDUNG = 'KLEIDUNG', 'Kleidung'
        TECHNIK = 'TECHNIK', 'Technik'
        GESUNDHEIT = 'GESUNDHEIT', 'Gesundheit'
        HYGIENE = 'HYGIENE', 'Hygiene'
        SONSTIGES = 'SONSTIGES', 'Sonstiges'

    title = models.CharField(max_length=120)
    is_packed = models.BooleanField(default=False)
    quantity = models.PositiveSmallIntegerField(default=1)
    # Anders als Trip.travel_type/... (bewusst leer = "keine Angabe"): jeder Artikel gehört konzeptionell zu
    # GENAU einer Kategorie, damit die Liste danach gruppiert werden kann — "Sonstiges" statt eines leeren Werts.
    category = models.CharField(max_length=10, choices=Category.choices, default=Category.SONSTIGES)
    note = models.CharField(max_length=240, blank=True, default='')

    class Meta:
        ordering = ['is_packed', 'id']
        indexes = [models.Index(fields=['trip', 'is_packed'])]


class TripTask(TripScopedModel):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Offen'
        DONE = 'DONE', 'Erledigt'

    title = models.CharField(max_length=120)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=4, choices=Status.choices, default=Status.OPEN)
    note = models.CharField(max_length=240, blank=True, default='')

    class Meta:
        ordering = ['status', 'due_date', 'id']
        indexes = [models.Index(fields=['trip', 'status'])]


class TripEvent(TripScopedModel):
    title = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ['starts_at', 'id']
        indexes = [models.Index(fields=['trip', 'starts_at'])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=models.F('starts_at')),
                name='trip_event_end_after_start',
            ),
        ]


class TripExpense(TripScopedModel):
    """Eigenständige Ausgabenerfassung je Reise — bewusst NICHT mit Finanzen/Transaction
    verbunden (AGENTS.md: Finanzen bleibt stabil, Cross-Domain nur über explizite
    Connections, die für Reisen V1 noch nicht gebaut werden)."""

    title = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()

    class Meta:
        ordering = ['date', 'id']
        indexes = [models.Index(fields=['trip', 'date'])]
        constraints = [models.CheckConstraint(condition=models.Q(amount__gte=0), name='trip_expense_not_negative')]


class TripBudgetCategory(TripScopedModel):
    """Geplanter Betrag je Budget-Kategorie einer Reise — nur die Planung (siehe ANZEIGE-Beispiel in der
    Aufgabenstellung: "Geplant: Transport 500 €, ..."). Tatsächliche Ausgaben bleiben bewusst unkategorisiert in
    TripExpense; eine Ist-je-Kategorie-Auswertung wäre ein zweites, größeres Feature und ist hier nicht verlangt."""

    class Category(models.TextChoices):
        TRANSPORT = 'TRANSPORT', 'Transport'
        UNTERKUNFT = 'UNTERKUNFT', 'Unterkunft'
        ESSEN = 'ESSEN', 'Essen'
        AKTIVITAETEN = 'AKTIVITAETEN', 'Aktivitäten'
        SHOPPING = 'SHOPPING', 'Shopping'
        SONSTIGES = 'SONSTIGES', 'Sonstiges'
        RESERVE = 'RESERVE', 'Reserve'

    category = models.CharField(max_length=12, choices=Category.choices)
    planned_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(fields=['trip', 'category'], name='trip_budget_category_unique_per_trip'),
            models.CheckConstraint(condition=models.Q(planned_amount__gte=0), name='trip_budget_category_not_negative'),
        ]


class TripParticipant(models.Model):
    """Wer an einer Reise teilnimmt und mit welcher Rolle — getrennt von Trip.owner (siehe Trip-Docstring).

    Bei einer Solo-Reise entsteht automatisch genau eine Zeile für den Ersteller mit Rolle OWNER (siehe
    TripViewSet.perform_create) — keine Pflicht, vorher eine Gruppe oder einen Haushalt anzulegen. Der Ersteller
    kann diese Zeile später trotzdem wieder entfernen (die Reise selbst bleibt über Trip.owner weiter seine),
    denn "Ersteller" und "Teilnehmer" sind laut Aufgabenstellung bewusst unterschiedliche Dinge.

    Nur drei Rollen, keine Enterprise-Matrix:
    - OWNER: darf wie der Ersteller Teilnehmer verwalten und die Reise selbst bearbeiten.
    - EDITOR: darf Packliste/Aufgaben/Budget/Ausgaben bearbeiten, aber nicht Teilnehmer verwalten oder die Reise selbst ändern.
    - VIEWER: nur lesen.

    Teilnehmer werden ausschließlich aus den eigenen Kontakten (core.Contact) ausgewählt — keine neue
    Einladungs-Infrastruktur per E-Mail, und kein Endpunkt, der beliebige E-Mail-Adressen gegen vorhandene Konten
    prüfen würde (das wäre eine User-Enumeration-Lücke, OWASP API Security Top 10)."""

    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Besitzer'
        EDITOR = 'EDITOR', 'Bearbeiter'
        VIEWER = 'VIEWER', 'Betrachter'

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trip_participations')
    role = models.CharField(max_length=6, choices=Role.choices, default=Role.VIEWER)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['added_at', 'id']
        constraints = [models.UniqueConstraint(fields=['trip', 'user'], name='unique_trip_participant')]

    def __str__(self) -> str:
        return f'{self.user} @ {self.trip} ({self.role})'
