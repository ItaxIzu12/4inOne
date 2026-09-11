from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from core.mfa_views import user_has_mfa_enabled
from core.models import HouseholdMembership
from core.permissions import HouseholdScopedPermission
from finanzen.insights import berechne_insights
from finanzen.models import Account, Budget, Category, RecurringDeduction, Transaction
from finanzen.serializers import (
    CategorySerializer,
    HouseholdBufferSerializer,
    HouseholdMembershipIncomeSerializer,
    OwnIncomeSerializer,
    RecurringDeductionSerializer,
    TransactionSerializer,
)
from finanzen.throttling import TransactionWriteRateThrottle


def _money(value: Decimal) -> str:
    """Formatiert einen Decimal-Betrag konsistent mit zwei Nachkommastellen
    — Sum()-Aggregationen (z. B. household_total_income über mehrere
    HouseholdMembership-Zeilen) liefern je nach DB-Backend/Eingabewerten
    manchmal eine reduzierte Präzision zurück (z. B. Decimal('5200') statt
    Decimal('5200.00')), was das Frontend sonst uneinheitlich formatiert
    ausgeliefert bekäme."""
    return str(Decimal(value).quantize(Decimal('0.01')))


class TransactionCursorPagination(CursorPagination):
    """CursorPagination statt PageNumberPagination (TEIL 4): bleibt stabil,
    wenn während des Blätterns neue Transaktionen dazukommen — ein
    Seitenzahl-Offset würde bei gleichzeitigen neuen Einträgen Zeilen
    doppelt anzeigen oder überspringen, ein Cursor auf occurred_at/id
    nicht."""

    page_size = 20
    ordering = '-occurred_at'
    cursor_query_param = 'cursor'


class TransactionViewSet(ModelViewSet):
    """Beispielhafte Anwendung von HouseholdScopedPermission
    (ARCHITEKTUR.md §3.2/§4 aus Schritt 4).

    Die Queryset-Filterung unten schränkt zusätzlich die Liste auf die
    eigenen Haushalte ein (verhindert, dass fremde Transaktionen überhaupt
    in einer Listenansicht auftauchen) — HouseholdScopedPermission bleibt
    trotzdem Pflicht, weil sie auch Einzelabrufe über erratene IDs
    (retrieve/update/delete) absichert, die die Queryset-Filterung allein
    nicht abdeckt. Der ?q=-Suchparameter (TEIL 4) filtert INNERHALB dieses
    bereits haushalts-eingeschränkten Querysets weiter — eine Suche kann
    dadurch strukturell nie Treffer aus einem fremden Haushalt liefern,
    unabhängig vom Suchbegriff.
    """

    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, HouseholdScopedPermission]
    household_field = 'account__household'
    pagination_class = TransactionCursorPagination

    def get_throttles(self):
        # Nur auf schreibenden Methoden (PRÜFUNG 4) — GET/HEAD/OPTIONS bleibt
        # unlimitiert, ein Frontend-Bug beim Lesen verstopft die DB nicht auf
        # dieselbe Art wie eine Schreib-Endlosschleife.
        if self.request.method in SAFE_METHODS:
            return []
        return [TransactionWriteRateThrottle()]

    def get_queryset(self):
        queryset = (
            Transaction.objects.select_related('category', 'account')
            .filter(account__household__members=self.request.user)
            .order_by('-occurred_at')
        )

        query = self.request.query_params.get('q', '').strip()
        if query:
            queryset = queryset.filter(Q(description__icontains=query) | Q(category__name__icontains=query))

        return queryset

    def perform_create(self, serializer):
        # account kommt nie vom Client (siehe serializers.py read_only_fields)
        # — stattdessen aus dem Haushalt der anfragenden Person abgeleitet,
        # dasselbe IDOR-Muster wie CategoryViewSet.perform_create() oben.
        # .first() statt get_or_create(household=household, ...): ein
        # Haushalt kann laut Datenmodell mehrere Accounts haben, ein
        # get_or_create-Lookup nur auf household würde dann mit
        # MultipleObjectsReturned abstürzen. Existiert noch keiner (Haushalte
        # aus RegisterView bekommen nur Household+HouseholdMembership, kein
        # Account), wird beim ersten "Ausgabe hinzufügen" eines angelegt.
        household = self.request.user.households.first()
        if household is None:
            raise ValidationError('Dieses Konto ist noch keinem Haushalt zugeordnet.')
        account = Account.objects.filter(household=household).first()
        if account is None:
            account = Account.objects.create(household=household, name='Haushaltskasse')
        serializer.save(account=account, created_by=self.request.user)

    def perform_update(self, serializer):
        # updated_by ausschließlich aus request.user, NIEMALS aus dem
        # Request-Body übernehmen (PRÜFUNG 5) — sonst könnte sich ein Nutzer
        # per mitgeschicktem Feld fälschlich als jemand anderen ausgeben.
        # updated_at aktualisiert sich automatisch (auto_now=True).
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        # NICHT instance.delete() (DRFs Default) — Transaction darf laut
        # Modell-Docstring ausschließlich weich gelöscht werden (§ 257 HGB/
        # § 147 AO Aufbewahrungspflicht, siehe finanzen/models.py).
        instance.soft_delete()


class CategoryViewSet(ModelViewSet):
    """Kategorien sind pro Haushalt frei definierbar (TEIL 1) — dieselbe
    Haushalts-Absicherung wie bei Transaction, siehe Docstring oben.

    Race-Condition-Hinweis (PRÜFUNG 6, bewusst dokumentiert statt gelöst):
    Zwei Haushaltsmitglieder könnten theoretisch gleichzeitig dasselbe
    monthly_goal per PATCH ändern — für den aktuellen Umfang (kleine
    Haushalte, seltene gleichzeitige Bearbeitung) ist Last-Write-Wins
    (DRFs Standard-partial_update, kein Override hier) bewusst ausreichend.
    Kein Optimistic Locking (z. B. per Versions-Feld) nötig, bis die
    Haushaltsgröße/Bearbeitungsfrequenz das rechtfertigt.
    """

    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, HouseholdScopedPermission]
    household_field = 'household'

    def get_queryset(self):
        return Category.objects.filter(household__members=self.request.user).order_by('name')

    def perform_destroy(self, instance):
        # Standard-Kategorien dürfen weder umbenannt (siehe
        # CategorySerializer.validate_name) noch gelöscht werden (PRÜFUNG 2)
        # — sonst ließe sich z. B. "Haushalt" löschen, wodurch die
        # Einkauf-zu-Ausgabe-Verknüpfung bricht, die auf diesen
        # Kategorienamen angewiesen ist.
        if instance.is_default:
            raise ValidationError('Eine Standard-Kategorie kann nicht gelöscht werden.')
        instance.delete()

    def perform_create(self, serializer):
        # Neue Kategorien gehören immer zu einem Haushalt, in dem die
        # anfragende Person Mitglied ist — sonst könnte man beim Anlegen
        # eine beliebige household-ID unterschieben (dieselbe IDOR-Klasse
        # wie bei category_id auf Transaction, siehe serializers.py).
        # .first(): TODO sobald Mehrfach-Haushalte im Frontend wählbar sind
        # (aktuell hat jeder Nutzer laut RegisterView genau einen).
        household = self.request.user.households.first()
        if household is None:
            # Betrifft in der Praxis nur Konten, die VOR der automatischen
            # Haushalts-Anlage in RegisterView entstanden sind (siehe
            # Chat-Verlauf: ein per createsuperuser angelegtes Konto ohne
            # Household). Ohne diese Prüfung würde serializer.save() mit
            # household=None gegen die NOT-NULL-Constraint auf
            # Category.household laufen und als unbehandelter 500
            # IntegrityError enden statt einer sauberen 400-Antwort.
            raise ValidationError('Dieses Konto ist noch keinem Haushalt zugeordnet.')
        serializer.save(household=household)


class OverviewView(APIView):
    """Aggregierte Zahlen für die Finanzen-Startseite (Budget-Block +
    Kategorien-Donut, siehe features/finanzen/finanzen.ts im Frontend) —
    bewusst EIN Endpunkt statt zwei, da beide Werte aus denselben
    Transaktionen des laufenden Monats berechnet werden.

    "Faire Aufteilung" und "Abo-Radar" liefert dieser Endpunkt bewusst
    NICHT: Transaction hat kein Feld für "wer hat bezahlt", und es gibt
    noch kein Abo-Konzept im Datenmodell — beides bräuchte eine echte
    Datenmodell-Erweiterung (neues Feld/Model + Migration), keine reine
    Aggregation bestehender Daten, siehe Chat-Verlauf. Diese beiden Kacheln
    bleiben im Frontend bewusst Platzhalter.

    Kein HouseholdScopedPermission nötig (anders als bei Transaction/
    Category oben): es gibt hier keine client-seitig übergebene ID, die
    geprüft werden müsste — der Haushalt wird ausschließlich aus
    request.user abgeleitet, ein Angreifer kann also strukturell keine
    fremde ID unterschieben.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        household = request.user.households.first()
        if household is None:
            return Response(
                {
                    'budget': {'planned': '0', 'total': '0'},
                    'categories': [],
                    'member_count': 1,
                    'household_name': '',
                    'members': [],
                }
            )

        month_start = timezone.now().date().replace(day=1)

        total_budget = (
            Budget.objects.filter(household=household, month=month_start).aggregate(total=Sum('amount'))['total']
            or Decimal('0')
        )

        transactions_this_month = Transaction.objects.filter(account__household=household, occurred_at__gte=month_start)
        total_spent = transactions_this_month.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # ALLE Kategorien des Haushalts, nicht nur die mit Ausgaben diesen
        # Monat — sonst verschwindet eine Kategorie mit Ziel aber noch ohne
        # Ausgabe komplett aus der Übersicht, obwohl ihr Ziel (monthly_goal)
        # trotzdem angezeigt werden soll. filter() INNERHALB von Sum() statt
        # .filter() auf dem Queryset, damit Kategorien ohne Treffer als 0 €
        # erscheinen (LEFT JOIN-Semantik), nicht herausfallen (INNER JOIN).
        categories_qs = (
            Category.objects.filter(household=household)
            .annotate(
                spent=Sum(
                    'transactions__amount',
                    filter=Q(transactions__occurred_at__gte=month_start, transactions__deleted_at__isnull=True),
                )
            )
            .order_by('name')
        )

        # Faire Aufteilung ergibt bei einer Person keinen Sinn — das Feld
        # existiert dann gar nicht im JSON (nicht null/0), das Frontend prüft
        # per @if auf Anwesenheit (siehe features/finanzen/finanzen.ts).
        member_count = household.members.count()
        response_data = {
            'budget': {'planned': str(total_spent), 'total': str(total_budget)},
            'categories': [
                {
                    'id': category.id,
                    'name': category.name,
                    'color': category.color,
                    'icon_key': category.icon_key,
                    'amount': str(category.spent or Decimal('0')),
                    'monthly_goal': str(category.monthly_goal) if category.monthly_goal is not None else None,
                }
                for category in categories_qs
            ],
            'member_count': member_count,
            'household_name': household.name,
            'members': [{'id': user.id, 'name': user.first_name or user.email} for user in household.members.all()],
        }

        if member_count >= 2:
            fairness_totals = (
                transactions_this_month.exclude(created_by__isnull=True)
                .values('created_by__id', 'created_by__first_name', 'created_by__email')
                .annotate(amount=Sum('amount'))
            )
            fairness_total = sum((row['amount'] for row in fairness_totals), Decimal('0'))
            response_data['fairness'] = [
                {
                    'user_id': row['created_by__id'],
                    'name': row['created_by__first_name'] or row['created_by__email'],
                    'percentage': round(float(row['amount'] / fairness_total * 100), 1) if fairness_total else 0,
                }
                for row in fairness_totals
            ]

        return Response(response_data)


class OnboardingStatusView(APIView):
    """Aggregierter Status für den Onboarding-Block (Dashboard, /app) — EIN
    Endpunkt statt vier Einzelabfragen, da das Frontend alle vier Werte
    gleichzeitig für die "welche Schritte noch offen?"-Anzeige braucht.

    Liegt bewusst hier (finanzen/views.py) statt in core/, weil es
    Transaction/Category braucht — core importiert laut ARCHITEKTUR.md §2.1
    NICHT von finanzen, umgekehrt schon (siehe z. B. finanzen/models.py
    Household-Import). Wird trotzdem unter einem neutralen Pfad
    (/api/v1/onboarding/status/) gemountet, siehe config/urls.py.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        household = request.user.households.first()
        if household is None:
            return Response(
                {
                    'has_transaction': False,
                    'has_category': False,
                    'member_count': 1,
                    'mfa_enabled': user_has_mfa_enabled(request.user),
                }
            )

        return Response(
            {
                'has_transaction': Transaction.objects.filter(account__household=household).exists(),
                'has_category': Category.objects.filter(household=household).exists(),
                'member_count': household.members.count(),
                'mfa_enabled': user_has_mfa_enabled(request.user),
            }
        )


class AnalysenView(APIView):
    """Aggregierte Zahlen für den Analysen-Tab (finanzen.ts) — "Verfügbares
    Einkommen" + regelbasierte Insights (finanzen/insights.py, KEIN KI-/
    LLM-Aufruf, siehe Chat-Verlauf). Analog zu OverviewView oben: ein
    Endpunkt für mehrere zusammengehörige, live berechnete Werte.

    SICHERHEITSKRITISCH: monthly_income ANDERER Mitglieder wird NIE
    ausgeliefert — nur die eigene Angabe (über
    HouseholdMembershipIncomeSerializer) und die HAUSHALTS-SUMME
    (household_total_income, eine reine Aggregation ohne Rückschluss auf
    Einzelbeträge bei mehr als einer Person mit gesetztem Einkommen). Das
    ist eine bewusste, striktere Feld-Ebenen-Einschränkung ZUSÄTZLICH zu
    HouseholdScopedPermission (die nur Haushalts-Zugehörigkeit prüft, nicht
    wer welches Einzelfeld sehen darf) — hier aber ohnehin nicht relevant,
    da kein Objekt über eine ID abgerufen wird.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        household = request.user.households.first()
        if household is None:
            return Response(
                {
                    'monthly_income': None,
                    'household_total_income': '0.00',
                    'monthly_buffer': '0.00',
                    'recurring_deductions': [],
                    'verfuegbares_einkommen': '0.00',
                    'insights': [],
                }
            )

        own_membership = HouseholdMembership.objects.get(user=request.user, household=household)
        own_income = HouseholdMembershipIncomeSerializer(own_membership, context={'request': request}).data[
            'monthly_income'
        ]

        household_total_income = (
            HouseholdMembership.objects.filter(household=household, monthly_income__isnull=False).aggregate(
                total=Sum('monthly_income')
            )['total']
            or Decimal('0')
        )

        deductions_qs = (
            RecurringDeduction.objects.filter(household=household).select_related('category').order_by('name')
        )
        active_deductions_total = (
            deductions_qs.filter(active=True).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        )

        verfuegbares_einkommen = household_total_income - active_deductions_total - household.monthly_buffer

        return Response(
            {
                'monthly_income': own_income,
                'household_total_income': _money(household_total_income),
                'monthly_buffer': _money(household.monthly_buffer),
                'recurring_deductions': RecurringDeductionSerializer(deductions_qs, many=True).data,
                'verfuegbares_einkommen': _money(verfuegbares_einkommen),
                'insights': berechne_insights(household_total_income, active_deductions_total, household.monthly_buffer),
            }
        )


class SetOwnIncomeView(APIView):
    """PATCH setzt AUSSCHLIESSLICH das eigene monthly_income (request.user)
    — es gibt keine ID im Request-Body, die auf eine fremde Membership
    zeigen könnte, ein Nutzer kann also strukturell nie das Einkommen eines
    anderen Mitglieds setzen."""

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        household = request.user.households.first()
        if household is None:
            raise ValidationError('Dieses Konto ist noch keinem Haushalt zugeordnet.')
        membership = HouseholdMembership.objects.get(user=request.user, household=household)
        serializer = OwnIncomeSerializer(membership, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(HouseholdMembershipIncomeSerializer(membership, context={'request': request}).data)


class SetHouseholdBufferView(APIView):
    """PATCH auf monthly_buffer — HAUSHALTS-weit (auf Household, nicht pro
    Mitglied wie monthly_income), jedes Mitglied darf ihn ändern, dieselbe
    Offenheit wie beim gemeinsamen Budget/den Kategorien oben."""

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        household = request.user.households.first()
        if household is None:
            raise ValidationError('Dieses Konto ist noch keinem Haushalt zugeordnet.')
        serializer = HouseholdBufferSerializer(household, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'monthly_buffer': str(household.monthly_buffer)})


class RecurringDeductionViewSet(ModelViewSet):
    """CRUD für feste Abzüge (Miete, Versicherung, ...) — dieselbe
    Haushalts-Absicherung wie Transaction/Category oben. Anders als
    Transaction: kein Soft-Delete nötig, ein fester Abzug ist eine
    Plangröße ohne handelsrechtliche Aufbewahrungspflicht (siehe
    finanzen/models.py RecurringDeduction-Docstring)."""

    serializer_class = RecurringDeductionSerializer
    permission_classes = [IsAuthenticated, HouseholdScopedPermission]
    household_field = 'household'

    def get_queryset(self):
        return (
            RecurringDeduction.objects.filter(household__members=self.request.user)
            .select_related('category')
            .order_by('name')
        )

    def perform_create(self, serializer):
        household = self.request.user.households.first()
        if household is None:
            raise ValidationError('Dieses Konto ist noch keinem Haushalt zugeordnet.')
        serializer.save(household=household, created_by=self.request.user)
