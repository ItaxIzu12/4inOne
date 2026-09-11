import re
from decimal import Decimal

from rest_framework import serializers

from core.models import Household, HouseholdMembership
from finanzen.models import Category, RecurringDeduction, Transaction

# ^#[0-9A-Fa-f]{6}$ — striktes Hex-Format. Verhindert, dass ein nicht
# validierter Wert später (falls das Frontend color irgendwann direkt in ein
# style-Attribut einsetzt) CSS-Injection erlaubt, z. B. "red;background:
# url(...)" statt eines reinen Hex-Codes (Sicherheitsprüfung PRÜFUNG 3).
_COLOR_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')

# Obergrenze bewusst deutlich unter dem, was DecimalField(max_digits=10)
# technisch zuließe (bis zu 8 Vorkommastellen) — 1.000.000 ist für ein
# Haushaltsbudget bereits unrealistisch hoch, verhindert also sowohl
# Tippfehler (eine Null zu viel) als auch absichtlichen Missbrauch, der die
# Budget-/Fairness-Berechnung verfälschen würde (PRÜFUNG 3).
_MAX_AMOUNT = Decimal('1000000')


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'color', 'icon_key', 'monthly_goal', 'is_default']
        # is_default nur lesbar: wird ausschließlich beim automatischen
        # Anlegen gesetzt (finanzen/signals.py), nie vom Client — sonst
        # könnte sich eine selbst angelegte Kategorie als "Standard"
        # ausgeben oder umgekehrt der Namensschutz unten umgangen werden.
        #
        # Mass-Assignment-Hinweis (PRÜFUNG 1): `fields` ist eine explizite
        # Whitelist, kein `fields = '__all__'` — household ist hier bewusst
        # NICHT aufgeführt. Ein Client kann household_id also strukturell gar
        # nicht mitschicken (DRF ignoriert unbekannte Schlüssel im Body
        # stillschweigend), unabhängig von read_only_fields.
        read_only_fields = ['id', 'is_default']

    def validate_name(self, value):
        # Name der drei Standard-Kategorien bleibt unveränderbar (siehe
        # is_default-Docstring, finanzen/models.py) — monthly_goal/color/
        # icon_key bleiben für sie trotzdem änderbar, nur der Name nicht.
        if self.instance is not None and self.instance.is_default and value != self.instance.name:
            raise serializers.ValidationError('Der Name einer Standard-Kategorie kann nicht geändert werden.')
        return value

    def validate_color(self, value):
        if not _COLOR_RE.match(value):
            raise serializers.ValidationError('Die Farbe muss ein Hex-Wert im Format #RRGGBB sein.')
        return value


class TransactionSerializer(serializers.ModelSerializer):
    # Verschachtelt für's Lesen (Frontend braucht Farbe/Icon direkt an der
    # Transaktion, ohne pro Zeile eine zweite Anfrage) — category_id bleibt
    # das flache, beschreibbare Feld für Erstellen/Ändern. Das ist das
    # übliche DRF-Muster "nested read, flat write".
    category = CategorySerializer(read_only=True)
    # required=True (keine Ausnahme mehr): "Ausgabe hinzufügen" verlangt jetzt
    # eine Kategorie-Auswahl im Frontend (siehe features/finanzen/finanzen.html
    # Kategorie-Chips) — eine Transaction ohne Kategorie ergäbe dort keinen
    # sinnvollen Zustand mehr.
    category_id = serializers.PrimaryKeyRelatedField(source='category', queryset=Category.objects.all(), write_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id',
            'account',
            'category',
            'category_id',
            'amount',
            'description',
            'occurred_at',
            'created_at',
            'created_by',
            'updated_by',
            'updated_at',
        ]
        # account/created_by/updated_by/updated_at read-only: alle werden
        # serverseitig abgeleitet (TransactionViewSet.perform_create/
        # perform_update), nie aus Client-Eingaben — sonst könnte eine
        # beliebige Account-ID eines fremden Haushalts untergeschoben werden
        # (IDOR, dieselbe Klasse wie bei category_id, siehe validate()
        # unten), oder sich ein Nutzer per updated_by im Body fälschlich als
        # jemand anderen ausgeben.
        #
        # Mass-Assignment-Hinweis (PRÜFUNG 1): `fields` ist eine explizite
        # Whitelist. Transaction hat ohnehin kein eigenes household-Feld
        # (nur über account.household erreichbar) — account selbst ist
        # read-only, ein household_id/account_id im PATCH-Body wird also
        # sowohl durch die fehlende Feld-Deklaration als auch durch
        # read_only_fields stillschweigend ignoriert, nicht übernommen.
        read_only_fields = ['id', 'created_at', 'account', 'created_by', 'updated_by', 'updated_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Der Betrag muss größer als 0 sein.')
        if value >= _MAX_AMOUNT:
            raise serializers.ValidationError('Der Betrag darf nicht 1.000.000 € oder mehr betragen.')
        return value

    def validate(self, attrs):
        # IDOR-Schutz (ARCHITEKTUR.md §3.2): eine mitgeschickte category_id
        # könnte aus einem FREMDEN Haushalt stammen (erraten/durchprobiert).
        # Geprüft wird gegen die Haushalte der ANFRAGENDEN Person, nicht
        # gegen attrs['account'] — das ist zum Zeitpunkt von validate() beim
        # Erstellen noch gar nicht gesetzt (read-only, kommt erst in
        # perform_create() dazu), ein Vergleich dagegen wäre hier wirkungslos.
        request = self.context.get('request')
        category = attrs.get('category', getattr(self.instance, 'category', None))
        if request is not None and category is not None:
            if not category.household.members.filter(pk=request.user.pk).exists():
                raise serializers.ValidationError({'category_id': 'Diese Kategorie gehört nicht zu deinem Haushalt.'})
        return attrs


class HouseholdMembershipIncomeSerializer(serializers.ModelSerializer):
    """Serialisiert eine HouseholdMembership mit monthly_income NUR sichtbar
    für die eigene Person — für jede ANDERE Membership liefert dieser
    Serializer das Feld immer als null, unabhängig vom tatsächlich
    gespeicherten Wert.

    Bewusst ein SerializerMethodField statt eines normalen ModelSerializer-
    Felds: das Standardverhalten würde den gespeicherten Wert unabhängig vom
    anfragenden Nutzer ausliefern — ein Datenleck auf FELD-Ebene, das
    HouseholdScopedPermission (core/permissions.py) nicht abdeckt, weil sie
    nur Haushalts-ZUGEHÖRIGKEIT prüft, nicht wer innerhalb des Haushalts
    welches Einzelfeld sehen darf. monthly_income ist ein privates
    Einzeleinkommen, keine gemeinsame Haushaltsangabe wie z. B. der Puffer.
    """

    monthly_income = serializers.SerializerMethodField()

    class Meta:
        model = HouseholdMembership
        fields = ['id', 'user_id', 'role', 'monthly_income']

    def get_monthly_income(self, obj):
        request = self.context.get('request')
        if request is None or request.user.pk != obj.user_id:
            return None
        return str(obj.monthly_income) if obj.monthly_income is not None else None


class OwnIncomeSerializer(serializers.ModelSerializer):
    """NUR für PATCH auf die eigene HouseholdMembership (finanzen/views.py
    SetOwnIncomeView) — die View lädt bereits ausschließlich
    request.user's eigene Membership, ein Nutzer kann hierüber also
    strukturell nie das Einkommen einer fremden Membership setzen (es gibt
    keine ID im Request-Body, die auf eine andere Membership zeigen
    könnte)."""

    class Meta:
        model = HouseholdMembership
        fields = ['monthly_income']

    def validate_monthly_income(self, value):
        if value is None:
            return value
        if value < 0:
            raise serializers.ValidationError('Das Einkommen darf nicht negativ sein.')
        if value >= _MAX_AMOUNT:
            raise serializers.ValidationError('Der Betrag darf nicht 1.000.000 € oder mehr betragen.')
        return value


class HouseholdBufferSerializer(serializers.ModelSerializer):
    """NUR für PATCH auf monthly_buffer (finanzen/views.py
    SetHouseholdBufferView) — haushaltsweit, absichtlich nicht über den
    allgemeinen Household-Serializer (den es noch nicht gibt), um diesen
    Endpunkt strikt auf genau dieses eine Feld zu beschränken."""

    class Meta:
        model = Household
        fields = ['monthly_buffer']

    def validate_monthly_buffer(self, value):
        if value < 0:
            raise serializers.ValidationError('Der Puffer darf nicht negativ sein.')
        if value >= _MAX_AMOUNT:
            raise serializers.ValidationError('Der Betrag darf nicht 1.000.000 € oder mehr betragen.')
        return value


class RecurringDeductionSerializer(serializers.ModelSerializer):
    # Gleiches "nested read, flat write"-Muster wie TransactionSerializer
    # oben — category ist optional (ein fester Abzug wie "Miete" muss nicht
    # zwingend einer Ausgaben-Kategorie zugeordnet sein).
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source='category', queryset=Category.objects.all(), write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = RecurringDeduction
        fields = ['id', 'name', 'amount', 'category', 'category_id', 'active', 'created_by']
        # household/created_by read-only, household über fields-Whitelist
        # gar nicht erst exponiert — dieselbe Mass-Assignment-Absicherung
        # wie bei Transaction/Category oben (PRÜFUNG 1).
        read_only_fields = ['id', 'created_by']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Der Betrag muss größer als 0 sein.')
        if value >= _MAX_AMOUNT:
            raise serializers.ValidationError('Der Betrag darf nicht 1.000.000 € oder mehr betragen.')
        return value

    def validate(self, attrs):
        # IDOR-Schutz, dasselbe Muster wie TransactionSerializer.validate()
        # oben: eine mitgeschickte category_id könnte aus einem fremden
        # Haushalt stammen.
        request = self.context.get('request')
        category = attrs.get('category', getattr(self.instance, 'category', None))
        if request is not None and category is not None:
            if not category.household.members.filter(pk=request.user.pk).exists():
                raise serializers.ValidationError({'category_id': 'Diese Kategorie gehört nicht zu deinem Haushalt.'})
        return attrs
