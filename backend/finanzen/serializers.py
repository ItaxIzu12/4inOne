from rest_framework import serializers

from finanzen.models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'account', 'category', 'amount', 'description', 'occurred_at', 'created_at']
        read_only_fields = ['id', 'created_at']
