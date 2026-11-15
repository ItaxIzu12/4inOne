from django.contrib import admin

from .models import AuthEvent


@admin.register(AuthEvent)
class AuthEventAdmin(admin.ModelAdmin):
    """Nur lesen — das Protokoll wird nie von Hand geändert."""

    list_display = ('created_at', 'kind', 'user', 'ip_prefix')
    list_filter = ('kind',)
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
